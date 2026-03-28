"""Stripe webhook processing and license issuance.

Flow:
  1. User clicks "Upgrade to Pro" in the app → opens Stripe Checkout in browser
  2. After payment Stripe POSTs a webhook to your licensing server
  3. The licensing server calls generate_license_for_purchase() → returns a JWT key
  4. The key is e-mailed to the customer (or shown on the success page)
  5. Customer pastes the key in Settings → License to activate

This service runs on the LICENSING SERVER (not the desktop app).
The desktop app only consumes the license key through license_service.py.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from typing import Any

STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRO_PRICE_ID = os.getenv("STRIPE_PRO_PRICE_ID", "price_XXXXX")
STRIPE_ENTERPRISE_PRICE_ID = os.getenv("STRIPE_ENTERPRISE_PRICE_ID", "price_YYYYY")


def verify_stripe_webhook(payload: bytes, sig_header: str) -> dict[str, Any]:
    """Verify Stripe webhook signature and return parsed event.

    Raises ValueError if the signature is invalid.
    """
    if not STRIPE_WEBHOOK_SECRET:
        raise ValueError("STRIPE_WEBHOOK_SECRET is not configured.")

    # Stripe signature format: t=<timestamp>,v1=<hmac_sha256>
    parts = {k: v for k, v in (part.split("=", 1) for part in sig_header.split(",") if "=" in part)}
    timestamp = parts.get("t", "")
    v1_sig = parts.get("v1", "")

    if not timestamp or not v1_sig:
        raise ValueError("Malformed Stripe-Signature header.")

    signed_payload = f"{timestamp}.{payload.decode()}"
    expected = hmac.new(
        STRIPE_WEBHOOK_SECRET.encode(),
        signed_payload.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, v1_sig):
        raise ValueError("Stripe webhook signature verification failed.")

    return json.loads(payload)


def get_tier_for_price(price_id: str) -> str:
    """Map a Stripe price ID to a ZeroNyx tier."""
    if price_id == STRIPE_PRO_PRICE_ID:
        return "pro"
    if price_id == STRIPE_ENTERPRISE_PRICE_ID:
        return "enterprise"
    return "pro"


def generate_license_for_purchase(email: str, tier: str) -> str:
    """Generate a license JWT for a completed purchase.

    This is called by the licensing server after a successful Stripe webhook.
    It uses the same generate() function as the CLI key generator.
    """
    import sys
    import os

    # Add the project root to sys.path so the script import works
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)

    from scripts.generate_license_key import generate

    # Pro: 1-year subscription; Enterprise: perpetual
    days = 365 if tier == "pro" else None
    return generate(email=email, tier=tier, features=None, days=days)
