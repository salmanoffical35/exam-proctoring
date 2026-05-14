"""
Proctoring Router
POST /proctor/analyze  - REST: analyze single frame
WS   /proctor/ws/{session_id} - WebSocket: real-time analysis stream
"""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db, SessionLocal
from app.models.exam import ExamSession, SessionStatus
from app.models.user import User
from app.services.ai_service import analyze_frame
from app.services.alert_service import process_ai_alerts, get_session_alerts
from app.utils.jwt_handler import get_current_user, decode_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/proctor", tags=["Proctoring"])

# ── Connection Manager for WebSocket broadcast to admin ──────────────────────
class ConnectionManager:
    def __init__(self):
        # {session_id: [admin_websockets]}
        self.admin_watchers: dict[int, list[WebSocket]] = {}

    async def add_watcher(self, session_id: int, ws: WebSocket):
        self.admin_watchers.setdefault(session_id, []).append(ws)

    def remove_watcher(self, session_id: int, ws: WebSocket):
        watchers = self.admin_watchers.get(session_id, [])
        if ws in watchers:
            watchers.remove(ws)

    async def broadcast_alert(self, session_id: int, alert_data: dict):
        for ws in self.admin_watchers.get(session_id, []):
            try:
                await ws.send_json(alert_data)
            except Exception:
                pass

manager = ConnectionManager()

# ── REST: single frame analysis ──────────────────────────────────────────────
class FrameRequest(BaseModel):
    session_id: int
    frame: str             # base64-encoded JPEG/PNG
    tab_switch: bool = False  # frontend sends True if user switched tabs

@router.post("/analyze")
async def analyze(
    data: FrameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate session belongs to this user
    session = db.query(ExamSession).filter(
        ExamSession.id == data.session_id,
        ExamSession.student_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")
    if session.status != SessionStatus.STARTED:
        raise HTTPException(400, f"Session is {session.status.value}")

    # Run AI analysis
    ai_result = analyze_frame(data.frame, draw_annotations=True)

    # Add tab-switch alert if frontend detected it
    if data.tab_switch:
        ai_result.alerts.append({
            "type": "tab_switch",
            "message": "Student switched browser tab/window",
            "confidence": 1.0
        })

    # Persist alerts
    new_alerts = process_ai_alerts(
        db=db,
        session_id=data.session_id,
        student_id=current_user.id,
        ai_alerts=ai_result.alerts
    )

    # Broadcast to admin watchers
    if new_alerts:
        db.refresh(session)
        for alert in new_alerts:
            await manager.broadcast_alert(data.session_id, {
                "event": "alert",
                "session_id": data.session_id,
                "student_id": current_user.id,
                "student_name": current_user.full_name,
                **alert
            })

    db.refresh(session)
    return {
        "face_count": ai_result.face_count,
        "gaze_direction": ai_result.gaze_direction,
        "head_pose": ai_result.head_pose,
        "alerts": new_alerts,
        "session_status": session.status.value,
        "proctoring_score": session.proctoring_score,
        "annotated_frame": ai_result.annotated_frame_b64,
    }

@router.get("/sessions/{session_id}/alerts")
def session_alerts(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return get_session_alerts(db, session_id)

# ── WebSocket: student sends frames continuously ─────────────────────────────
@router.websocket("/ws/{session_id}")
async def proctor_websocket(
    websocket: WebSocket,
    session_id: int,
    token: str = "",     # passed as query param: ws://...?token=xxx
):
    await websocket.accept()

    # Authenticate via token query param
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub", 0))
    except Exception:
        await websocket.send_json({"error": "Unauthorized"})
        await websocket.close(code=1008)
        return

    db = SessionLocal()
    try:
        session = db.query(ExamSession).filter(
            ExamSession.id == session_id,
            ExamSession.student_id == user_id
        ).first()

        if not session:
            await websocket.send_json({"error": "Session not found"})
            await websocket.close(code=1008)
            return

        await websocket.send_json({"status": "connected", "session_id": session_id})
        logger.info(f"WS connected: session={session_id} user={user_id}")

        while True:
            # Receive frame from student browser
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            if msg.get("type") == "frame":
                b64_frame = msg.get("data", "")
                tab_switch = msg.get("tab_switch", False)

                # AI analysis
                ai_result = analyze_frame(b64_frame, draw_annotations=False)

                if tab_switch:
                    ai_result.alerts.append({
                        "type": "tab_switch",
                        "message": "Tab switch detected",
                        "confidence": 1.0
                    })

                new_alerts = process_ai_alerts(
                    db=db,
                    session_id=session_id,
                    student_id=user_id,
                    ai_alerts=ai_result.alerts
                )

                db.refresh(session)

                # Send result back to student
                await websocket.send_json({
                    "face_count": ai_result.face_count,
                    "gaze": ai_result.gaze_direction,
                    "alerts": new_alerts,
                    "proctoring_score": session.proctoring_score,
                    "session_status": session.status.value,
                })

                # Broadcast to admin
                for alert in new_alerts:
                    await manager.broadcast_alert(session_id, {
                        "event": "alert",
                        "session_id": session_id,
                        "student_id": user_id,
                        **alert
                    })

            elif msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        logger.info(f"WS disconnected: session={session_id}")
    except Exception as e:
        logger.error(f"WS error: {e}")
    finally:
        db.close()

# ── WebSocket: admin watches a session ───────────────────────────────────────
@router.websocket("/admin/watch/{session_id}")
async def admin_watch_websocket(
    websocket: WebSocket,
    session_id: int,
    token: str = ""
):
    await websocket.accept()
    try:
        payload = decode_token(token)
        role = payload.get("role", "")
        if role not in ["admin", "proctor"]:
            await websocket.send_json({"error": "Forbidden"})
            await websocket.close(1008)
            return
    except Exception:
        await websocket.send_json({"error": "Unauthorized"})
        await websocket.close(1008)
        return

    await manager.add_watcher(session_id, websocket)
    await websocket.send_json({"status": "watching", "session_id": session_id})
    try:
        while True:
            # Keep alive; admin receives alerts via broadcast
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.remove_watcher(session_id, websocket)
