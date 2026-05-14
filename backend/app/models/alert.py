from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from sqlalchemy import Enum as SAEnum
from app.database import Base

class AlertType(str, enum.Enum):
    NO_FACE = "no_face"
    MULTIPLE_FACES = "multiple_faces"
    LOOKING_AWAY = "looking_away"
    SUSPICIOUS_MOVEMENT = "suspicious_movement"
    TAB_SWITCH = "tab_switch"
    PHONE_DETECTED = "phone_detected"

class AlertSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

# Severity mapping per alert type
ALERT_SEVERITY = {
    AlertType.NO_FACE: AlertSeverity.HIGH,
    AlertType.MULTIPLE_FACES: AlertSeverity.CRITICAL,
    AlertType.LOOKING_AWAY: AlertSeverity.MEDIUM,
    AlertType.SUSPICIOUS_MOVEMENT: AlertSeverity.LOW,
    AlertType.TAB_SWITCH: AlertSeverity.HIGH,
    AlertType.PHONE_DETECTED: AlertSeverity.CRITICAL,
}

# Score deduction per alert type
ALERT_DEDUCTION = {
    AlertType.NO_FACE: 10,
    AlertType.MULTIPLE_FACES: 20,
    AlertType.LOOKING_AWAY: 5,
    AlertType.SUSPICIOUS_MOVEMENT: 3,
    AlertType.TAB_SWITCH: 15,
    AlertType.PHONE_DETECTED: 20,
}

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("exam_sessions.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    alert_type = Column(SAEnum(AlertType), nullable=False)
    severity = Column(SAEnum(AlertSeverity), nullable=False)
    confidence = Column(Float, default=1.0)   # AI confidence 0-1
    message = Column(String(500))
    snapshot_path = Column(String(500), nullable=True)  # saved frame path
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    session = relationship("ExamSession", back_populates="alerts")
    student = relationship("User", back_populates="alerts")
