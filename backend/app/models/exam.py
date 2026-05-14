from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from sqlalchemy import Enum as SAEnum
from app.database import Base

class ExamStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class SessionStatus(str, enum.Enum):
    STARTED = "started"
    COMPLETED = "completed"
    FLAGGED = "flagged"    # too many alerts
    TERMINATED = "terminated"

class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    duration_minutes = Column(Integer, default=60)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(SAEnum(ExamStatus), default=ExamStatus.SCHEDULED)
    created_by = Column(Integer, ForeignKey("users.id"))
    questions = Column(JSON, default=list)   # store questions as JSON
    max_alerts = Column(Integer, default=5)  # auto-terminate after N alerts
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    sessions = relationship("ExamSession", back_populates="exam")

class ExamSession(Base):
    """One session per student per exam."""
    __tablename__ = "exam_sessions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(SAEnum(SessionStatus), default=SessionStatus.STARTED)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    answers = Column(JSON, default=dict)
    alert_count = Column(Integer, default=0)
    proctoring_score = Column(Integer, default=100)  # starts 100, deducted per alert

    # Relationships
    exam = relationship("Exam", back_populates="sessions")
    student = relationship("User", back_populates="exam_sessions")
    alerts = relationship("Alert", back_populates="session")
