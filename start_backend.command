#!/bin/bash
# This script starts the Marg backend
# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Navigating to backend directory..."
cd "$DIR/backend"

echo "Activating virtual environment..."
# If venv doesn't exist, create it
if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Creating one..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "Installing requirements..."
pip install -r requirements.txt

echo "Starting FastAPI server with uvicorn..."
uvicorn main:app --reload --host 0.0.0.0 --port 8000
