"""
Alert Service
Handles: cooldown logic, DB persistence, session score updates.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.alert import Alert, AlertType, AlertSeverity, ALERT_SEVERITY, ALERT_DEDUCTION
from app.models.exam import ExamSession, SessionStatus
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# In-memory cooldown tracker: {session_id: {alert_type: last_alert_time}}
_cooldown_cache: dict = {}

def _is_on_cooldown(session_id: int, alert_type: str) -> bool:
    """Prevent spamming same alert type within cooldown window."""
    key = f"{session_id}:{alert_type}"
    last = _cooldown_cache.get(key)
    if last and (datetime.utcnow() - last).seconds < settings.ALERT_COOLDOWN_SECONDS:
        return True
    _cooldown_cache[key] = datetime.utcnow()
    return False

def process_ai_alerts(
    db: Session,
    session_id: int,
    student_id: int,
    ai_alerts: list,   # from ProctoringResult.alerts
    snapshot_path: str = None
) -> list[dict]:
    """
    Persist AI-generated alerts to DB, respect cooldown, update session score.
    Returns list of new alerts created.
    """
    session = db.query(ExamSession).filter(ExamSession.id == session_id).first()
    if not session or session.status != SessionStatus.STARTED:
        return []

    created = []

    for alert_data in ai_alerts:
        raw_type = alert_data.get("type", "")

        # Map to AlertType enum
        try:
            alert_type = AlertType(raw_type)
        except ValueError:
            logger.warning(f"Unknown alert type: {raw_type}")
            continue

        # Cooldown check
        if _is_on_cooldown(session_id, alert_type.value):
            continue

        severity = ALERT_SEVERITY.get(alert_type, AlertSeverity.LOW)
        deduction = ALERT_DEDUCTION.get(alert_type, 0)

        # Create alert record
        alert = Alert(
            session_id=session_id,
            student_id=student_id,
            alert_type=alert_type,
            severity=severity,
            confidence=alert_data.get("confidence", 1.0),
            message=alert_data.get("message", ""),
            snapshot_path=snapshot_path,
        )
        db.add(alert)

        # Update session stats
        session.alert_count += 1
        session.proctoring_score = max(0, session.proctoring_score - deduction)

        # Auto-terminate if too many alerts
        exam = session.exam
        if exam and session.alert_count >= exam.max_alerts:
            session.status = SessionStatus.FLAGGED
            logger.warning(f"Session {session_id} flagged: {session.alert_count} alerts")

        created.append({
            "type": alert_type.value,
            "severity": severity.value,
            "message": alert.message,
            "confidence": alert.confidence,
            "timestamp": alert.timestamp.isoformat() if alert.timestamp else datetime.utcnow().isoformat()
        })

    db.commit()
    return created

def get_session_alerts(db: Session, session_id: int) -> list:
    alerts = db.query(Alert).filter(Alert.session_id == session_id)\
               .order_by(Alert.timestamp.desc()).all()
    return [
        {
            "id": a.id,
            "type": a.alert_type.value,
            "severity": a.severity.value,
            "message": a.message,
            "confidence": a.confidence,
            "timestamp": a.timestamp.isoformat()
        }
        for a in alerts
    ]
