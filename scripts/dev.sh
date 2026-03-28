#!/usr/bin/env bash
# ZeroNyx — one-shot dev launcher
# Usage: ./scripts/dev.sh
#
# Installs missing deps automatically on first run, then starts the app.
# Subsequent runs skip install and go straight to launch.

set -e
cd "$(dirname "$0")/.."

VENV="backend/.venv"
PYTHON="$VENV/bin/python3"

# ---- 1. Node deps ----------------------------------------------------------
if [ ! -d "node_modules" ]; then
  echo "==> Installing Node dependencies..."
  npm install --silent
fi

# ---- 2. Python venv --------------------------------------------------------
if [ ! -f "$PYTHON" ]; then
  echo "==> Creating Python virtual environment..."
  python3 -m venv "$VENV"
fi

# Sync pip deps only when requirements.txt changed (hash-based cache)
REQS_HASH_FILE="$VENV/.reqs_hash"
REQS_HASH=$(md5sum backend/requirements.txt 2>/dev/null | cut -d' ' -f1 || echo "none")
CACHED_HASH=$(cat "$REQS_HASH_FILE" 2>/dev/null || echo "")

if [ "$REQS_HASH" != "$CACHED_HASH" ]; then
  echo "==> Installing/updating Python dependencies..."
  "$VENV/bin/pip" install --upgrade pip -q
  "$VENV/bin/pip" install -r backend/requirements.txt -q
  echo "$REQS_HASH" > "$REQS_HASH_FILE"
fi

# ---- 3. Launch -------------------------------------------------------------
echo "==> Starting ZeroNyx..."
exec npm run dev
