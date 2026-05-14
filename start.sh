#!/usr/bin/env bash
# ============================================================
# start.sh — Start AI Exam Proctoring System locally
# Usage: chmod +x start.sh && ./start.sh
# ============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERR]${NC}  $1"; exit 1; }

# ── Check prereqs ────────────────────────────────────────────
command -v python3 >/dev/null 2>&1 || error "Python 3 not found"
command -v node    >/dev/null 2>&1 || error "Node.js not found"
command -v npm     >/dev/null 2>&1 || error "npm not found"

PYTHON_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
info "Python: $PYTHON_VER | Node: $(node --version)"

# ── Backend setup ────────────────────────────────────────────
info "Setting up backend..."
cd backend

if [ ! -d "venv" ]; then
    python3 -m venv venv
    info "Virtual environment created"
fi

source venv/bin/activate

pip install -r requirements.txt -q
info "Python dependencies installed"

if [ ! -f ".env" ]; then
    cp .env.example .env
    # Generate random secret
    SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    sed -i.bak "s/your-super-secret-key-change-this/$SECRET/" .env
    rm -f .env.bak
    info ".env created with random SECRET_KEY"
fi

mkdir -p snapshots

# ── Frontend setup ───────────────────────────────────────────
info "Setting up frontend..."
cd ../frontend

if [ ! -f ".env" ]; then
    cp .env.example .env
    # Use local backend for dev
    cat > .env << 'EOF'
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
EOF
    info "Frontend .env created (pointing to local backend)"
fi

npm install -q
info "Node dependencies installed"

# ── Launch ───────────────────────────────────────────────────
cd ..

info "Starting backend on :8000..."
(cd backend && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) &
BACKEND_PID=$!

sleep 3   # wait for backend to init DB

info "Starting frontend on :5173..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  🎓 AI Exam Proctoring System Running!${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "  Frontend  → ${YELLOW}http://localhost:5173${NC}"
echo -e "  Backend   → ${YELLOW}http://localhost:8000${NC}"
echo -e "  API Docs  → ${YELLOW}http://localhost:8000/docs${NC}"
echo ""
echo -e "  Admin:   admin@proctor.com / admin123"
echo -e "  Student: student@proctor.com / student123"
echo -e "${GREEN}============================================${NC}"
echo "Press Ctrl+C to stop"

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; info 'Stopped.'" EXIT
wait
