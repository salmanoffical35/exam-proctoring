# 🎓 AI-Powered Smart Online Exam Proctoring System

> Final Year Project — Industry-grade online exam monitoring with real-time AI cheating detection

[![CI/CD](https://github.com/YOUR_USERNAME/exam-proctoring/actions/workflows/deploy.yml/badge.svg)](https://github.com/YOUR_USERNAME/exam-proctoring/actions)

---

## 🧠 Features

| Feature | Technology |
|---|---|
| Real-time face detection | MediaPipe Face Detection |
| Multiple face alert | OpenCV + MediaPipe |
| Gaze / eye tracking | MediaPipe Face Mesh (iris landmarks) |
| Head pose estimation | Geometry from 468 landmarks |
| Tab switch detection | Browser Visibility API |
| JWT Authentication | python-jose + bcrypt |
| WebSocket streaming | FastAPI WebSocket |
| Admin dashboard | React + Recharts |
| Auto-submit on time | Frontend countdown |

## 🏗 Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser (React)                                 │
│  ┌──────────┐  frames   ┌──────────────────────┐│
│  │ Webcam   │──────────▶│ FastAPI WebSocket     ││
│  │ (WebRTC) │           │ /api/v1/proctor/ws/N  ││
│  └──────────┘           └────────┬─────────────┘│
│                                  │ analyze_frame()
│  ┌──────────────────┐   alerts  │              │
│  │ Admin Dashboard  │◀──────────┤ MediaPipe AI ││
│  └──────────────────┘           └──────────────┘│
└─────────────────────────────────────────────────┘
           │                      │
      Vercel/Netlify         Render/Railway
         (CDN)                (Docker)
```

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- Git

### 1. Clone
```bash
git clone https://github.com/YOUR_USERNAME/exam-proctoring.git
cd exam-proctoring
```

### 2. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # edit SECRET_KEY
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
API docs: http://localhost:8000/docs

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env          # no changes needed for local
npm run dev
```
App: http://localhost:5173

### 4. Demo Login
| Role | Email | Password |
|---|---|---|
| Admin | admin@proctor.com | admin123 |
| Student | student@proctor.com | student123 |

---

## 🔧 Environment Variables

### Backend (`backend/.env`)
```
SECRET_KEY=<openssl rand -hex 32>
DATABASE_URL=sqlite:///./proctoring.db
FRONTEND_URL=http://localhost:5173
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
```

---

## 🧪 Tests
```bash
cd backend
pytest tests/ -v
```

---

## ☁️ Deployment

### Backend → Render
1. Push code to GitHub
2. Go to https://render.com → New Web Service
3. Connect repo, select Docker runtime
4. Root directory: `backend`
5. Set env vars: `SECRET_KEY`, `FRONTEND_URL`
6. Copy the service URL (e.g. `https://exam-api.onrender.com`)

### Frontend → Vercel
1. Go to https://vercel.com → Import Project
2. Select repo, set Framework: Vite
3. Root directory: `frontend`
4. Add env vars:
   - `VITE_API_URL` = `https://exam-api.onrender.com/api/v1`
   - `VITE_WS_URL`  = `wss://exam-api.onrender.com`
5. Deploy

### GitHub Actions Secrets (for CI/CD)
Go to repo → Settings → Secrets → Add:
- `RENDER_DEPLOY_HOOK_URL` (from Render dashboard)
- `VERCEL_TOKEN` (from Vercel account settings)
- `VITE_API_URL`
- `VITE_WS_URL`

---

## 📁 Project Structure

```
exam-proctoring/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI entry + seeding
│   │   ├── config.py         # Settings via pydantic
│   │   ├── database.py       # SQLAlchemy setup
│   │   ├── models/           # SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── exam.py
│   │   │   └── alert.py
│   │   ├── routers/          # API routes
│   │   │   ├── auth.py
│   │   │   ├── exams.py
│   │   │   ├── proctoring.py # WebSocket + frame analysis
│   │   │   └── admin.py
│   │   ├── services/
│   │   │   ├── ai_service.py # MediaPipe face/gaze detection
│   │   │   └── alert_service.py
│   │   └── utils/
│   │       └── jwt_handler.py
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── context/AuthContext.jsx
│       ├── hooks/useProctoring.js  # webcam + WebSocket
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── StudentDashboard.jsx
│       │   ├── ExamPage.jsx        # exam UI + camera overlay
│       │   ├── AdminDashboard.jsx  # charts + session table
│       │   └── SessionDetail.jsx
│       └── utils/api.js
├── .github/workflows/deploy.yml
├── render.yaml
└── README.md
```

---

## 🔐 Security Features
- JWT with 8-hour expiry (exam sessions)
- bcrypt password hashing
- CORS restricted to frontend URL
- Role-based access (student/admin/proctor)
- WebSocket auth via token query param
- Alert cooldown prevents flood

## 📊 Alert Types
| Alert | Severity | Score Deduction |
|---|---|---|
| No Face | High | -10 |
| Multiple Faces | Critical | -20 |
| Looking Away | Medium | -5 |
| Tab Switch | High | -15 |
| Phone Detected | Critical | -20 |
| Suspicious Movement | Low | -3 |

---

## 🎯 FYP Info
- **Title:** AI-Powered Smart Online Exam Proctoring System
- **Stack:** FastAPI · React · MediaPipe · SQLite · WebSocket
- **Deployment:** Render (backend) · Vercel (frontend)
