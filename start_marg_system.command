#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "==================================================="
echo "         STARTING MARG FULL SYSTEM"
echo "==================================================="

# Cleanup function to kill all background processes when the user closes the window or presses Ctrl+C
cleanup() {
    echo ""
    echo "==================================================="
    echo "Shutting down MARG System..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "Goodbye!"
    echo "==================================================="
    exit
}

# Trap exit signals
trap cleanup SIGINT SIGTERM EXIT

# 1. START BACKEND
echo "[1/2] Starting Python Backend..."
cd "$DIR/backend"

# Ensure venv exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!


# 2. START FRONTEND
echo "[2/2] Starting React Frontend..."
cd "$DIR/frontend"

# We don't want npm install to block every time, so we just run dev
npm run dev &
FRONTEND_PID=$!

echo "==================================================="
echo " ALL SYSTEMS ARE GO! "
echo " Backend running at: http://localhost:8000"
echo " Frontend running at: http://localhost:5173"
echo ""
echo " NOTE: Keep this terminal window open."
echo " Press Ctrl+C or close this window to stop everything."
echo "==================================================="

# Wait for both processes to keep the terminal open
wait
