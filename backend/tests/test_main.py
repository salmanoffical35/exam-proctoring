"""
Run: cd backend && pytest tests/ -v
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, engine, Base

@pytest.fixture(autouse=True, scope="session")
def setup_db():
    Base.metadata.drop_all(bind=engine)
    init_db()
    yield

client = TestClient(app)

# ── Auth tests ────────────────────────────────────────────────────────────────
def test_root():
    r = client.get("/")
    assert r.status_code == 200
    assert "app" in r.json()

def test_health():
    r = client.get("/health")
    assert r.json() == {"status": "ok"}

def test_register_and_login():
    # Register
    r = client.post("/api/v1/auth/register", json={
        "full_name": "Test Student",
        "email": "test@test.com",
        "student_id": "TST001",
        "password": "testpass123",
        "role": "student"
    })
    assert r.status_code == 201

    # Duplicate email
    r2 = client.post("/api/v1/auth/register", json={
        "full_name": "Test2",
        "email": "test@test.com",
        "password": "abc"
    })
    assert r2.status_code == 400

    # Login
    r3 = client.post("/api/v1/auth/login", json={"email": "test@test.com", "password": "testpass123"})
    assert r3.status_code == 200
    data = r3.json()
    assert "access_token" in data
    assert data["user"]["role"] == "student"
    return data["access_token"]

def _get_token(email, password):
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return r.json().get("access_token", "")

def test_me_endpoint():
    token = _get_token("admin@proctor.com", "admin123")
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["role"] in ["admin", "student"]

def test_list_exams_requires_auth():
    r = client.get("/api/v1/exams/")
    assert r.status_code == 403  # no token

def test_list_exams():
    token = _get_token("student@proctor.com", "student123")
    r = client.get("/api/v1/exams/", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_admin_dashboard_requires_admin():
    student_token = _get_token("student@proctor.com", "student123")
    r = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {student_token}"})
    assert r.status_code == 403

def test_admin_dashboard():
    admin_token = _get_token("admin@proctor.com", "admin123")
    r = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    data = r.json()
    assert "total_students" in data
    assert "total_alerts" in data

# ── AI service tests ──────────────────────────────────────────────────────────
def test_ai_service_blank_frame():
    from app.services.ai_service import analyze_frame
    import base64
    import numpy as np
    import cv2

    # Generate blank white frame
    blank = np.ones((480, 640, 3), dtype=np.uint8) * 200
    _, buf = cv2.imencode(".jpg", blank)
    b64 = base64.b64encode(buf).decode()

    result = analyze_frame(b64, draw_annotations=False)
    assert hasattr(result, 'face_count')
    assert hasattr(result, 'alerts')
    assert hasattr(result, 'gaze_direction')
    # Blank frame → no face detected
    assert result.face_count == 0
    assert any(a['type'] == 'no_face' for a in result.alerts)

def test_ai_service_invalid_frame():
    from app.services.ai_service import analyze_frame
    result = analyze_frame("not-valid-base64-data", draw_annotations=False)
    assert any(a['type'] == 'frame_error' for a in result.alerts)

def test_alert_service_cooldown():
    from app.services.alert_service import _is_on_cooldown
    # First call - not on cooldown
    assert not _is_on_cooldown(9999, "no_face")
    # Second call immediately - on cooldown
    assert _is_on_cooldown(9999, "no_face")
    # Different type - not on cooldown
    assert not _is_on_cooldown(9999, "multiple_faces")
