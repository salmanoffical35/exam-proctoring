from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.database import get_db
from app.models.exam import Exam, ExamSession, ExamStatus, SessionStatus
from app.models.user import User, UserRole
from app.utils.jwt_handler import get_current_user, require_admin

router = APIRouter(prefix="/exams", tags=["Exams"])

# ── Schemas ──────────────────────────────────────────────────────────────────
class ExamCreate(BaseModel):
    title: str
    description: Optional[str] = None
    duration_minutes: int = 60
    start_time: datetime
    end_time: datetime
    questions: List[dict] = []
    max_alerts: int = 5

class AnswerSubmit(BaseModel):
    answers: dict   # {question_id: answer}

# ── Admin: Create exam ────────────────────────────────────────────────────────
@router.post("/", status_code=201)
def create_exam(
    data: ExamCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    exam = Exam(
        title=data.title,
        description=data.description,
        duration_minutes=data.duration_minutes,
        start_time=data.start_time,
        end_time=data.end_time,
        questions=data.questions,
        max_alerts=data.max_alerts,
        created_by=admin.id,
        status=ExamStatus.SCHEDULED,
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return {"id": exam.id, "title": exam.title, "message": "Exam created"}

@router.get("/")
def list_exams(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    exams = db.query(Exam).filter(Exam.status != ExamStatus.CANCELLED).all()
    return [
        {
            "id": e.id,
            "title": e.title,
            "description": e.description,
            "duration_minutes": e.duration_minutes,
            "start_time": e.start_time.isoformat(),
            "end_time": e.end_time.isoformat(),
            "status": e.status.value,
            "question_count": len(e.questions or []),
        }
        for e in exams
    ]

@router.get("/{exam_id}")
def get_exam(exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(404, "Exam not found")
    return {
        "id": exam.id,
        "title": exam.title,
        "description": exam.description,
        "duration_minutes": exam.duration_minutes,
        "start_time": exam.start_time.isoformat(),
        "end_time": exam.end_time.isoformat(),
        "status": exam.status.value,
        "questions": exam.questions if current_user.role != UserRole.STUDENT else exam.questions,
    }

# ── Student: Start exam session ───────────────────────────────────────────────
@router.post("/{exam_id}/start")
def start_session(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(404, "Exam not found")

    now = datetime.utcnow()
    if now < exam.start_time:
        raise HTTPException(400, "Exam hasn't started yet")
    if now > exam.end_time:
        raise HTTPException(400, "Exam has ended")

    # Check existing session
    existing = db.query(ExamSession).filter(
        ExamSession.exam_id == exam_id,
        ExamSession.student_id == current_user.id,
        ExamSession.status == SessionStatus.STARTED
    ).first()
    if existing:
        return {"session_id": existing.id, "message": "Resuming existing session"}

    session = ExamSession(
        exam_id=exam_id,
        student_id=current_user.id,
        status=SessionStatus.STARTED,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session_id": session.id, "message": "Session started"}

@router.post("/{exam_id}/submit")
def submit_exam(
    exam_id: int,
    data: AnswerSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ExamSession).filter(
        ExamSession.exam_id == exam_id,
        ExamSession.student_id == current_user.id,
        ExamSession.status == SessionStatus.STARTED
    ).first()
    if not session:
        raise HTTPException(404, "No active session found")

    session.answers = data.answers
    session.status = SessionStatus.COMPLETED
    session.end_time = datetime.utcnow()
    db.commit()
    return {
        "message": "Exam submitted",
        "proctoring_score": session.proctoring_score,
        "alert_count": session.alert_count
    }

@router.get("/{exam_id}/session")
def get_my_session(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(ExamSession).filter(
        ExamSession.exam_id == exam_id,
        ExamSession.student_id == current_user.id
    ).order_by(ExamSession.id.desc()).first()
    if not session:
        raise HTTPException(404, "No session found")
    return {
        "session_id": session.id,
        "status": session.status.value,
        "alert_count": session.alert_count,
        "proctoring_score": session.proctoring_score,
        "start_time": session.start_time.isoformat(),
    }
