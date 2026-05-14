"""
Analytics Service
Generates per-session proctoring reports and system-wide statistics.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from app.models.alert import Alert, AlertType, AlertSeverity
from app.models.exam import ExamSession, SessionStatus
from app.models.user import User

def session_report(db: Session, session_id: int) -> dict:
    """Full analytics report for one exam session."""
    session = db.query(ExamSession).filter(ExamSession.id == session_id).first()
    if not session:
        return {}

    alerts = db.query(Alert).filter(Alert.session_id == session_id).all()

    # Time breakdown
    duration_secs = 0
    if session.end_time and session.start_time:
        duration_secs = (session.end_time - session.start_time).seconds

    # Alert frequency (alerts per minute)
    alert_freq = round(len(alerts) / max(duration_secs / 60, 1), 2)

    # Alert type breakdown
    type_counts = {}
    for a in alerts:
        type_counts[a.alert_type.value] = type_counts.get(a.alert_type.value, 0) + 1

    # Severity distribution
    sev_counts = {}
    for a in alerts:
        sev_counts[a.severity.value] = sev_counts.get(a.severity.value, 0) + 1

    # Timeline: alerts per 5-minute bucket
    timeline = []
    if session.start_time and alerts:
        for i in range(0, max(duration_secs, 300), 300):
            bucket_start = session.start_time + timedelta(seconds=i)
            bucket_end   = session.start_time + timedelta(seconds=i + 300)
            count = sum(1 for a in alerts if bucket_start <= a.timestamp < bucket_end)
            timeline.append({
                "minute": i // 60,
                "count": count
            })

    # Risk assessment
    critical_count = sev_counts.get("critical", 0)
    high_count     = sev_counts.get("high", 0)
    risk = (
        "critical" if critical_count >= 2 or session.proctoring_score < 40
        else "high"    if high_count >= 3 or session.proctoring_score < 60
        else "medium"  if len(alerts) >= 3
        else "low"
    )

    return {
        "session_id": session_id,
        "student_name": session.student.full_name if session.student else "",
        "exam_title":   session.exam.title if session.exam else "",
        "status":       session.status.value,
        "proctoring_score": session.proctoring_score,
        "risk_level":   risk,
        "duration_minutes": round(duration_secs / 60, 1),
        "total_alerts": len(alerts),
        "alert_frequency_per_min": alert_freq,
        "alert_by_type":     type_counts,
        "alert_by_severity": sev_counts,
        "timeline_5min":     timeline,
        "recommendation": _recommendation(risk, type_counts),
    }

def _recommendation(risk: str, type_counts: dict) -> str:
    if risk == "critical":
        if type_counts.get("multiple_faces", 0) > 0:
            return "⚠️ CRITICAL: Multiple faces detected. Possible impersonation. Manual review mandatory."
        return "⚠️ CRITICAL: Extremely high violation count. Exam result should be flagged for review."
    if risk == "high":
        if type_counts.get("tab_switch", 0) > 2:
            return "HIGH: Repeated tab switching detected. Student likely accessed external resources."
        if type_counts.get("no_face", 0) > 3:
            return "HIGH: Student left frame repeatedly. Exam integrity questionable."
        return "HIGH: Multiple violations detected. Recommend instructor review."
    if risk == "medium":
        return "MEDIUM: Some violations detected. Likely minor issues. Low priority review."
    return "LOW: Clean session. No significant violations."

def system_stats_last_7_days(db: Session) -> dict:
    """Dashboard stats for the past 7 days."""
    since = datetime.utcnow() - timedelta(days=7)

    total_alerts   = db.query(Alert).filter(Alert.timestamp >= since).count()
    sessions_run   = db.query(ExamSession).filter(ExamSession.start_time >= since).count()
    flagged        = db.query(ExamSession).filter(
        ExamSession.start_time >= since,
        ExamSession.status == SessionStatus.FLAGGED
    ).count()

    # Daily alert counts
    daily = []
    for d in range(6, -1, -1):
        day_start = datetime.utcnow().replace(hour=0, minute=0, second=0) - timedelta(days=d)
        day_end   = day_start + timedelta(days=1)
        count = db.query(Alert).filter(
            and_(Alert.timestamp >= day_start, Alert.timestamp < day_end)
        ).count()
        daily.append({
            "date": day_start.strftime("%b %d"),
            "alerts": count
        })

    # Most problematic alert type this week
    top_alert = db.query(
        Alert.alert_type, func.count(Alert.id).label("cnt")
    ).filter(Alert.timestamp >= since)\
     .group_by(Alert.alert_type)\
     .order_by(func.count(Alert.id).desc())\
     .first()

    return {
        "period": "last_7_days",
        "total_alerts":    total_alerts,
        "sessions_run":    sessions_run,
        "flagged_sessions": flagged,
        "flagged_rate":    round(flagged / max(sessions_run, 1) * 100, 1),
        "top_alert_type":  top_alert[0].value if top_alert else None,
        "daily_alerts":    daily,
    }
