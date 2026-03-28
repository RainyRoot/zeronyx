"""REST routes for license management."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services import license_service

router = APIRouter(prefix="/license", tags=["license"])


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------

class LicenseStatus(BaseModel):
    activated: bool
    tier: str                  # community / pro / enterprise
    email: str
    key_id: str
    features: list[str]
    machine_id: str
    issued_at: str | None
    expires_at: str | None
    is_expired: bool

    @classmethod
    def from_active(cls, lic: Any) -> "LicenseStatus":
        import json
        from datetime import timezone
        now = datetime.now(timezone.utc)
        exp = lic.expires_at
        return cls(
            activated=True,
            tier=lic.tier,
            email=lic.email or "",
            key_id=lic.key_id,
            features=json.loads(lic.features or "[]"),
            machine_id=lic.machine_id,
            issued_at=lic.issued_at.isoformat() if lic.issued_at else None,
            expires_at=exp.isoformat() if exp else None,
            is_expired=bool(exp and exp < now),
        )

    @classmethod
    def community(cls) -> "LicenseStatus":
        return cls(
            activated=False,
            tier="community",
            email="",
            key_id="",
            features=[],
            machine_id=license_service.get_machine_id(),
            issued_at=None,
            expires_at=None,
            is_expired=False,
        )


class ActivateRequest(BaseModel):
    key: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/status", response_model=LicenseStatus)
def get_license_status(db: Session = Depends(get_db)):
    """Return the current license status."""
    lic = license_service.get_active_license(db)
    if not lic:
        return LicenseStatus.community()
    return LicenseStatus.from_active(lic)


@router.post("/activate", response_model=LicenseStatus)
def activate_license(body: ActivateRequest, db: Session = Depends(get_db)):
    """Activate a license key."""
    if not body.key or not body.key.strip():
        raise HTTPException(400, "License key is required.")
    try:
        lic = license_service.activate_license(body.key, db)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return LicenseStatus.from_active(lic)


@router.delete("/deactivate", status_code=204)
def deactivate_license(db: Session = Depends(get_db)):
    """Deactivate the current license (revert to Community)."""
    license_service.deactivate_license(db)


@router.get("/machine-id")
def get_machine_id():
    """Return the machine fingerprint (used for license binding)."""
    return {"machine_id": license_service.get_machine_id()}
