import os
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_proctoring.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
