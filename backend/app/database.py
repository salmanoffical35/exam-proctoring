from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Create engine - supports both SQLite and PostgreSQL
engine = create_engine(
    settings.DATABASE_URL,
    # SQLite needs this; harmless for PostgreSQL
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """FastAPI dependency - yields DB session, closes after request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Create all tables on startup."""
    from app.models import user, exam, alert  # noqa - register models
    Base.metadata.create_all(bind=engine)
