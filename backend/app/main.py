"""
AI Exam Proctoring System - FastAPI Backend
Run: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import logging

from app.config import settings
from app.database import init_db
from app.routers import auth, exams, proctoring, admin
from app.routers import analytics

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS - allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,       prefix="/api/v1")
app.include_router(exams.router,      prefix="/api/v1")
app.include_router(proctoring.router, prefix="/api/v1")
app.include_router(admin.router,      prefix="/api/v1")
app.include_router(analytics.router,  prefix="/api/v1")

# ── Static files (snapshots) ─────────────────────────────────────────────────
os.makedirs("snapshots", exist_ok=True)
app.mount("/snapshots", StaticFiles(directory="snapshots"), name="snapshots")

# ── Startup ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    init_db()
    logging.info("Database initialized")
    _seed_demo_data()

def _seed_demo_data():
    """Create demo admin + student if DB is empty. Uses separate transactions
    so a failing exam insert never rolls back the user accounts."""
    from app.database import SessionLocal
    from app.models.user import User, UserRole
    from app.utils.jwt_handler import hash_password
    from datetime import datetime, timedelta
    from app.models.exam import Exam, ExamStatus

    db = SessionLocal()

    # ── Step 1: Seed users (own transaction) ─────────────────────────────────
    admin_id = None
    try:
        if db.query(User).count() == 0:
            admin = User(
                full_name="Admin User",
                email="admin@proctor.com",
                hashed_password=hash_password("admin123"),
                role=UserRole.ADMIN,
            )
            student = User(
                full_name="Demo Student",
                email="student@proctor.com",
                student_id="STU001",
                hashed_password=hash_password("student123"),
                role=UserRole.STUDENT,
            )
            db.add_all([admin, student])
            db.commit()          # ← commit users immediately, independently
            db.refresh(admin)
            admin_id = admin.id
            logging.info("✅ Demo users seeded: admin@proctor.com / admin123  |  student@proctor.com / student123")
        else:
            # DB already has users — grab admin id for exam seed check
            existing_admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
            if existing_admin:
                admin_id = existing_admin.id
            logging.info("ℹ️  Users already exist, skipping user seed.")
    except Exception as e:
        logging.error(f"❌ User seed error: {e}")
        db.rollback()
    finally:
        db.close()

    # ── Step 2: Seed demo exam (separate session + transaction) ───────────────
    if not admin_id:
        logging.warning("⚠️  Skipping exam seed — no admin user found.")
        return

    db2 = SessionLocal()
    try:
        from app.models.exam import Exam, ExamStatus
        if db2.query(Exam).count() == 0:
            now = datetime.utcnow()
            exam = Exam(
                title="Demo Computer Science Exam",
                description="Sample exam for testing the proctoring system",
                duration_minutes=60,
                start_time=now,
                end_time=now + timedelta(hours=2),
                status=ExamStatus.ACTIVE,
                created_by=admin_id,
                max_alerts=10,
                questions=[
                    {"id": 1, "text": "What is Big O notation?", "type": "text", "marks": 10},
                    {"id": 2, "text": "Explain recursion with an example.", "type": "text", "marks": 15},
                    {"id": 3, "text": "What is the difference between TCP and UDP?", "type": "text", "marks": 10},
                    {"id": 4, "text": "Which data structure uses LIFO?", "type": "mcq",
                     "options": ["Queue", "Stack", "Tree", "Graph"], "answer": "Stack", "marks": 5},
                    {"id": 5, "text": "What does SQL stand for?", "type": "mcq",
                     "options": ["Structured Query Language", "Simple Query Logic", "Structured Queue Logic", "None"],
                     "answer": "Structured Query Language", "marks": 5},
                ]
            )
            db2.add(exam)
            db2.commit()
            logging.info("✅ Demo exam seeded successfully.")
        else:
            logging.info("ℹ️  Exams already exist, skipping exam seed.")
    except Exception as e:
        logging.error(f"❌ Exam seed error: {e}")
        db2.rollback()
    finally:
        db2.close()

@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "status": "running",
        "docs": "/docs",
        "demo_credentials": {
            "admin": {"email": "admin@proctor.com", "password": "admin123"},
            "student": {"email": "student@proctor.com", "password": "student123"},
        }
    }

@app.get("/health")
def health():
    return {"status": "ok"}
