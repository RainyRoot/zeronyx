import argparse
import logging
from contextlib import asynccontextmanager

import uvicorn
from alembic import command as alembic_command
from alembic.config import Config as AlembicConfig
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import settings
from backend import models  # noqa: F401 — registers all models with Base.metadata
from backend.api.routes import projects, targets, scans, findings, app_settings, export, credentials, proxy, metasploit, shodan
from backend.api.websocket import scan_stream

logging.basicConfig(
    level=logging.DEBUG if settings.is_dev else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("zeronyx")


def _run_migrations() -> None:
    """Apply any pending Alembic migrations on startup."""
    cfg = AlembicConfig("alembic.ini")
    alembic_command.upgrade(cfg, "head")
    logger.info(f"Database ready: {settings.db_path}")


def _check_tools() -> None:
    """Log which external tools are available on startup."""
    from backend.adapters import list_adapters
    available = []
    missing = []
    for name, cls in list_adapters():
        if cls().is_installed():
            available.append(name)
        else:
            missing.append(name)
    if available:
        logger.info("Tools available: %s", ", ".join(available))
    if missing:
        logger.warning("Tools not found (install to use): %s", ", ".join(missing))


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"ZeroNyx backend starting (env={settings.env})")
    _run_migrations()
    _check_tools()
    yield
    logger.info("ZeroNyx backend shutting down")


app = FastAPI(
    title="ZeroNyx Backend",
    version="0.1.0",
    docs_url="/docs" if settings.is_dev else None,
    redoc_url=None,
    lifespan=lifespan,
    redirect_slashes=False,
)

# CORS — only allow local Electron renderer
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",      # Vite dev server
        "http://127.0.0.1:5173",
        "http://localhost:8742",
        "http://127.0.0.1:8742",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 422 Validation errors — flatten Pydantic error list into a readable string
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    messages = [
        f"{' -> '.join(str(l) for l in e['loc'])}: {e['msg']}"
        for e in errors
    ]
    return JSONResponse(
        status_code=422,
        content={"detail": "; ".join(messages), "errors": errors},
    )


# 500 Global error handler
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error on {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# Health
@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "version": "0.1.0", "env": settings.env}


# REST routers
app.include_router(projects.router, prefix="/api")
app.include_router(targets.router, prefix="/api")
app.include_router(scans.router, prefix="/api")
app.include_router(findings.router, prefix="/api")
app.include_router(app_settings.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(credentials.router, prefix="/api")
app.include_router(proxy.router, prefix="/api")
app.include_router(metasploit.router, prefix="/api")
app.include_router(shodan.router, prefix="/api")

# WebSocket routers
app.include_router(scan_stream.router)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ZeroNyx Backend")
    parser.add_argument("--port", type=int, default=settings.port)
    parser.add_argument("--host", type=str, default=settings.host)
    args = parser.parse_args()

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level="debug" if settings.is_dev else "info",
    )
