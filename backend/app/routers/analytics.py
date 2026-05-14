from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.utils.jwt_handler import require_admin
from app.services.analytics_service import session_report, system_stats_last_7_days

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/session/{session_id}/report")
def get_session_report(
    session_id: int,
    db: Session = Depends(get_db),
    admin=Depends(require_admin)
):
    return session_report(db, session_id)

@router.get("/system/week")
def get_weekly_stats(
    db: Session = Depends(get_db),
    admin=Depends(require_admin)
):
    return system_stats_last_7_days(db)
