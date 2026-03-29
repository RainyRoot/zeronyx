"""License validation and management service.

License keys are RS256-signed JWTs. The app embeds only the RSA public key.
The private key lives on the licensing server and is used to issue keys.

JWT Payload schema:
  {
    "jti":   "<uuid>",          # key ID
    "sub":   "<email>",         # licensee e-mail
    "tier":  "community|pro|enterprise",
    "iat":   <epoch>,
    "exp":   <epoch> | absent,  # absent = perpetual
    "feat":  ["<feature>", ...] # unlocked feature flags
  }
"""

from __future__ import annotations

import hashlib
import json
import platform
import socket
import uuid
from datetime import datetime, timezone
from typing import Any

import jwt
from jwt.exceptions import InvalidTokenError

from sqlalchemy.orm import Session

from backend.models.license import License

# ---------------------------------------------------------------------------
# Embedded RSA public key (2048-bit, generated for ZeroNyx)
# The corresponding private key is kept securely on the licensing server.
# ---------------------------------------------------------------------------
_PUBLIC_KEY_PEM = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr1O4Op1130Bll5og4GYL
xxYHDDVnvygBz9hY+HJPngRJNI/6YfN0zpMP7KX4zK8jSuldSPQUH8FhDgy0D2T1
Snpw8lJH1C9XI+QZWu5aVVD9/KjbGwk8IiWsIpvw//3clAr59+lPTSPpMZhCDDhr
dfPyjttyOGeJT5bkGycpd38ZtHWx2bBKxmnhobSW6paV16OncX/EpSS9H0VzNrwL
PMD3c03sOQZ36bsofOLis01ke1UbmWd68JYKFLQjlGt+y1AZwtqOT+8HxPySVPPV
6QiSX+1DWrs3LpL3zgf5YwxfnI+aB+Hod0ShxdZdpz66I8cbEJ+qlsDFyRm1JXAF
NwIDAQAB
-----END PUBLIC KEY-----"""

# Pro feature flags — strings checked via is_feature_enabled()
PRO_FEATURES = {
    "ai_analysis",
    "chain_engine",
    "obsidian_sync",
    "plugin_marketplace",
    "advanced_reports",
    "team_mode",
}


# ---------------------------------------------------------------------------
# Machine fingerprinting
# ---------------------------------------------------------------------------

def get_machine_id() -> str:
    """Return a stable SHA-256 fingerprint for this machine."""
    parts = [
        socket.gethostname(),
        platform.node(),
        platform.machine(),
        platform.processor(),
        str(uuid.getnode()),   # MAC address as int
    ]
    raw = "|".join(p for p in parts if p)
    return hashlib.sha256(raw.encode()).hexdigest()


# ---------------------------------------------------------------------------
# JWT verification
# ---------------------------------------------------------------------------

def _decode_key(raw_key: str) -> dict[str, Any]:
    """Decode and verify a license JWT. Raises InvalidTokenError on failure."""
    options: dict[str, Any] = {
        "verify_signature": True,
        "require": ["jti", "sub", "tier", "iat"],
    }
    payload = jwt.decode(
        raw_key,
        _PUBLIC_KEY_PEM,
        algorithms=["RS256"],
        options=options,
    )
    return payload


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def activate_license(raw_key: str, db: Session) -> License:
    """Validate and persist a license key. Returns the License record.

    Raises ValueError with a human-readable message on failure.
    """
    raw_key = raw_key.strip()

    # 1. Verify JWT signature and claims
    try:
        payload = _decode_key(raw_key)
    except InvalidTokenError as exc:
        raise ValueError(f"Invalid license key: {exc}") from exc

    key_id: str = payload["jti"]
    email: str = payload.get("sub", "")
    tier: str = payload.get("tier", "community")
    features: list[str] = payload.get("feat", [])
    iat = datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
    exp_ts = payload.get("exp")
    expires_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc) if exp_ts else None

    # 2. Check expiry
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise ValueError("License key has expired.")

    # 3. Deactivate any existing license
    db.query(License).filter(License.is_active == True).update({"is_active": False})  # noqa: E712

    # 4. Check if this key was already activated on this machine
    existing = db.query(License).filter(License.key_id == key_id).first()
    if existing:
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return existing

    # 5. Store new license
    lic = License(
        id=str(uuid.uuid4()),
        key_id=key_id,
        raw_key=raw_key,
        tier=tier,
        email=email,
        machine_id=get_machine_id(),
        features=json.dumps(features),
        issued_at=iat,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(lic)
    db.commit()
    db.refresh(lic)
    return lic


def deactivate_license(db: Session) -> None:
    """Remove the active license (revert to Community tier)."""
    db.query(License).filter(License.is_active == True).update({"is_active": False})  # noqa: E712
    db.commit()


def get_active_license(db: Session) -> License | None:
    """Return the currently active License record, or None."""
    return db.query(License).filter(License.is_active == True).first()  # noqa: E712


def get_tier(db: Session) -> str:
    """Return the current tier: 'community', 'pro', or 'enterprise'."""
    lic = get_active_license(db)
    if not lic:
        return "community"
    # Re-verify expiry on every check
    if lic.expires_at and lic.expires_at < datetime.now(timezone.utc):
        deactivate_license(db)
        return "community"
    return lic.tier


def is_pro(db: Session) -> bool:
    return get_tier(db) in ("pro", "enterprise")


def is_feature_enabled(feature: str, db: Session) -> bool:
    """Check if a specific named feature is unlocked."""
    lic = get_active_license(db)
    if not lic:
        return False
    if lic.expires_at and lic.expires_at < datetime.now(timezone.utc):
        return False
    features: list[str] = json.loads(lic.features or "[]")
    return feature in features or lic.tier == "enterprise"
