#!/usr/bin/env bash
set -e

echo "==> ZeroNyx Setup"

# Node dependencies
echo "==> Installing Node dependencies..."
npm install

# Python venv + deps
echo "==> Setting up Python virtual environment..."
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt
deactivate
cd ..

echo ""
echo "Setup complete."
echo "  Start dev:   npm run dev"
echo "  Build:       npm run build"
