#!/bin/sh
# Catalyst injects the required port into this environment variable
PORT=${X_ZOHO_CATALYST_LISTEN_PORT:-8000}
echo "Starting MARG FastAPI Server on port $PORT..."
uvicorn main:app --host 0.0.0.0 --port $PORT
