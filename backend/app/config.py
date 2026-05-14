from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # App
    APP_NAME: str = "AI Exam Proctoring System"
    DEBUG: bool = False
    SECRET_KEY: str = "change-this-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours for exam sessions

    # Database
    DATABASE_URL: str = "sqlite:///./proctoring.db"

    # CORS - add your frontend URL
    FRONTEND_URL: str = "http://localhost:5173"

    # AI Settings
    FACE_DETECTION_CONFIDENCE: float = 0.7
    ALERT_COOLDOWN_SECONDS: int = 10   # min seconds between same alert type
    NO_FACE_THRESHOLD_SECONDS: int = 5  # alert if no face for 5s
    MULTI_FACE_THRESHOLD: int = 1       # alert if >1 face detected

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
