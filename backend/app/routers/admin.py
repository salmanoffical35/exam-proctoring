from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.database import get_db
from app.models.user import User, UserRole
from app.models.exam import Exam, ExamSession, SessionStatus
from app.models.alert import Alert, AlertType
from app.utils.jwt_handler import require_admin, get_current_user, hash_password

router = APIRouter(prefix="/admin", tags=["Admin"])

class StudentCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    student_id: Optional[str] = None

@router.get("/dashboard")
def dashboard_stats(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    total_students   = db.query(User).filter(User.role == UserRole.STUDENT).count()
    total_exams      = db.query(Exam).count()
    active_sessions  = db.query(ExamSession).filter(ExamSession.status == SessionStatus.STARTED).count()
    total_alerts     = db.query(Alert).count()
    flagged_sessions = db.query(ExamSession).filter(ExamSession.status == SessionStatus.FLAGGED).count()
    alert_breakdown  = db.query(Alert.alert_type, func.count(Alert.id)).group_by(Alert.alert_type).all()
    return {
        "total_students": total_students,
        "total_exams": total_exams,
        "active_sessions": active_sessions,
        "total_alerts": total_alerts,
        "flagged_sessions": flagged_sessions,
        "alert_breakdown": {t.value: c for t, c in alert_breakdown},
    }

@router.get("/sessions")
def all_sessions(exam_id: int = None, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    q = db.query(ExamSession)
    if exam_id:
        q = q.filter(ExamSession.exam_id == exam_id)
    sessions = q.order_by(ExamSession.start_time.desc()).limit(200).all()
    return [
        {
            "session_id": s.id,
            "exam_id": s.exam_id,
            "exam_title": s.exam.title if s.exam else "",
            "student_id": s.student_id,
            "student_name": s.student.full_name if s.student else "",
            "student_number": s.student.student_id if s.student else "",
            "status": s.status.value,
            "alert_count": s.alert_count,
            "proctoring_score": s.proctoring_score,
            "start_time": s.start_time.isoformat(),
            "end_time": s.end_time.isoformat() if s.end_time else None,
        }
        for s in sessions
    ]

@router.get("/sessions/{session_id}/detail")
def session_detail(session_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    session = db.query(ExamSession).filter(ExamSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Session not found")
    return {
        "session_id": session.id,
        "student": {
            "id": session.student.id,
            "name": session.student.full_name,
            "email": session.student.email,
            "student_id": session.student.student_id,
        },
        "exam": {"id": session.exam.id, "title": session.exam.title},
        "status": session.status.value,
        "alert_count": session.alert_count,
        "proctoring_score": session.proctoring_score,
        "start_time": session.start_time.isoformat(),
        "end_time": session.end_time.isoformat() if session.end_time else None,
        "alerts": [
            {
                "id": a.id,
                "type": a.alert_type.value,
                "severity": a.severity.value,
                "message": a.message,
                "confidence": a.confidence,
                "timestamp": a.timestamp.isoformat()
            }
            for a in session.alerts
        ],
    }

@router.get("/students")
def all_students(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    students = db.query(User).filter(User.role == UserRole.STUDENT).all()
    return [
        {
            "id": s.id,
            "full_name": s.full_name,
            "email": s.email,
            "student_id": s.student_id,
            "is_active": s.is_active,
            "created_at": s.created_at.isoformat(),
        }
        for s in students
    ]

# ── YEH NAYA ENDPOINT HAI ─────────────────────────────────────────────────────
@router.post("/students", status_code=201)
def create_student(data: StudentCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Email already registered")
    if data.student_id and db.query(User).filter(User.student_id == data.student_id).first():
        raise HTTPException(400, "Student ID already exists")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    student = User(
        full_name=data.full_name,
        email=data.email,
        student_id=data.student_id or None,
        hashed_password=hash_password(data.password),
        role=UserRole.STUDENT,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return {"id": student.id, "full_name": student.full_name, "email": student.email, "message": "Student created"}

@router.patch("/students/{student_id}/toggle")
def toggle_student(student_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    student = db.query(User).filter(User.id == student_id, User.role == UserRole.STUDENT).first()
    if not student:
        raise HTTPException(404, "Student not found")
    student.is_active = not student.is_active
    db.commit()
    return {"is_active": student.is_active}
