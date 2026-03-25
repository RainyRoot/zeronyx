#!/usr/bin/env bash
# Alternative: start backend manually alongside electron-vite
# Normally 'npm run dev' handles everything via BackendManager in main.ts
# Use this if you want a standalone backend for API testing.

set -e

BACKEND_PORT=${ZERONYX_PORT:-8742}

echo "==> Starting ZeroNyx backend on port $BACKEND_PORT"
cd "$(dirname "$0")/.."

PYTHON=./backend/.venv/bin/python3
if [ ! -f "$PYTHON" ]; then
  PYTHON=python3
fi

$PYTHON backend/main.py --port "$BACKEND_PORT"
