"""Shared pytest fixtures for ZeroNyx backend tests."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from backend.models.base import Base
from backend.api.deps import get_db
from backend.api.routes import projects, targets, scans, findings, app_settings

# ---------------------------------------------------------------------------
# In-memory SQLite database + minimal test app (no lifespan / migrations)
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite://"


@pytest.fixture(scope="session")
def engine():
    e = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(e)
    yield e
    e.dispose()


@pytest.fixture()
def db(engine) -> Session:
    connection = engine.connect()
    transaction = connection.begin()
    TestSession = sessionmaker(bind=connection)
    session = TestSession()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db: Session) -> TestClient:
    """FastAPI test client backed by an in-memory DB, no migrations."""
    test_app = FastAPI()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    test_app.dependency_overrides[get_db] = override_get_db

    test_app.include_router(projects.router, prefix="/api")
    test_app.include_router(targets.router, prefix="/api")
    test_app.include_router(scans.router, prefix="/api")
    test_app.include_router(findings.router, prefix="/api")
    test_app.include_router(app_settings.router, prefix="/api")

    with TestClient(test_app, raise_server_exceptions=True) as c:
        yield c
