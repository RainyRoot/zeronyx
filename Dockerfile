# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build the React frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /build

# Copy package manifests first so layer is cached unless deps change
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/

# Skip Electron binary download and native addon compilation (node-pty etc.)
# — the Docker build only needs the Vite/React toolchain
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1

RUN npm ci --ignore-scripts

# Copy source files needed for the frontend build
COPY frontend/ ./frontend/
COPY electron/ ./electron/
COPY electron.vite.config.ts tsconfig.json tsconfig.node.json ./

# Build only the React renderer using the standalone vite config.
# Output lands in out/renderer/
RUN npm run build:docker

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Python backend + serve built frontend as a web app
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS final

WORKDIR /app

# System libraries required by some Python packages (cryptography, etc.)
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Backend source and Alembic config
COPY backend/ ./backend/
COPY alembic.ini ./

# Built React frontend (from stage 1)
COPY --from=frontend-builder /build/out/renderer/ ./frontend-dist/

# Persistent data directory (SQLite databases, uploads, etc.)
RUN mkdir -p /data

# ── Runtime configuration ────────────────────────────────────────────────────
ENV ZERONYX_ENV=production \
    ZERONYX_HOST=0.0.0.0 \
    ZERONYX_PORT=8742 \
    ZERONYX_DATA_DIR=/data \
    ZERONYX_SERVE_FRONTEND=true \
    ZERONYX_FRONTEND_DIR=/app/frontend-dist

EXPOSE 8742

# Mount /data to persist the SQLite databases across container restarts
VOLUME ["/data"]

CMD ["python", "-m", "backend.main"]
