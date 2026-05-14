@echo off
:: ============================================================
:: start.bat — Start AI Exam Proctoring System on Windows
:: ============================================================

echo [INFO] Setting up backend...
cd backend

if not exist "venv" (
    python -m venv venv
    echo [INFO] Virtual environment created
)

call venv\Scripts\activate.bat
pip install -r requirements.txt -q
echo [INFO] Python deps installed

if not exist ".env" (
    copy .env.example .env
    echo [INFO] .env created — please set SECRET_KEY in backend\.env
)

if not exist "snapshots" mkdir snapshots

echo [INFO] Setting up frontend...
cd ..\frontend

if not exist ".env" (
    echo VITE_API_URL=http://localhost:8000/api/v1 > .env
    echo VITE_WS_URL=ws://localhost:8000 >> .env
)

call npm install

cd ..

echo [INFO] Starting backend in new window...
start "Backend" cmd /k "cd backend && call venv\Scripts\activate.bat && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 4 >nul

echo [INFO] Starting frontend in new window...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ============================================
echo   AI Exam Proctoring System Running!
echo ============================================
echo   Frontend  -^> http://localhost:5173
echo   Backend   -^> http://localhost:8000
echo   API Docs  -^> http://localhost:8000/docs
echo.
echo   Admin:   admin@proctor.com / admin123
echo   Student: student@proctor.com / student123
echo ============================================
pause
