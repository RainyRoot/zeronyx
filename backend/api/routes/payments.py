"""Payment-related routes.

/api/payments/checkout-url  — returns the Stripe Checkout URL for the given plan
/api/payments/webhook       — receives Stripe events (on the licensing server)

The desktop app uses checkout-url to open the browser for purchasing.
The webhook endpoint would be deployed on a separate web server, not the desktop app.
"""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

logger = logging.getLogger("zeronyx.payments")

router = APIRouter(prefix="/payments", tags=["payments"])

# Stripe Checkout URLs (set via environment on the licensing server)
STRIPE_CHECKOUT_PRO = os.getenv(
    "STRIPE_CHECKOUT_PRO_URL",
    "https://buy.stripe.com/zeronyx_pro",  # replace with real Stripe Payment Link
)
STRIPE_CHECKOUT_ENTERPRISE = os.getenv(
    "STRIPE_CHECKOUT_ENTERPRISE_URL",
    "https://buy.stripe.com/zeronyx_enterprise",
)


class CheckoutUrlResponse(BaseModel):
    url: str
    tier: str


@router.get("/checkout-url/{tier}", response_model=CheckoutUrlResponse)
def get_checkout_url(tier: str):
    """Return the Stripe Checkout URL for the given tier.

    The frontend opens this URL in the default browser.
    """
    if tier == "pro":
        return CheckoutUrlResponse(url=STRIPE_CHECKOUT_PRO, tier="pro")
    if tier == "enterprise":
        return CheckoutUrlResponse(url=STRIPE_CHECKOUT_ENTERPRISE, tier="enterprise")
    raise HTTPException(400, f"Unknown tier: {tier}")


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Process incoming Stripe webhook events.

    This endpoint is meant to be deployed on your licensing server (not the
    desktop app). It verifies the Stripe signature, generates a license key on
    successful payment, and should trigger an e-mail to the customer.

    Configure in Stripe Dashboard → Webhooks → Add endpoint:
      https://your-server.com/api/payments/webhook
    Events to listen for: checkout.session.completed
    """
    from backend.services.stripe_service import (
        verify_stripe_webhook,
        get_tier_for_price,
        generate_license_for_purchase,
    )

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = verify_stripe_webhook(payload, sig_header)
    except ValueError as exc:
        logger.warning("Stripe webhook rejected: %s", exc)
        raise HTTPException(400, str(exc)) from exc

    if event.get("type") == "checkout.session.completed":
        session = event["data"]["object"]
        email: str = session.get("customer_details", {}).get("email", "")
        price_id: str = (session.get("line_items", {}).get("data", [{}])[0]
                         .get("price", {}).get("id", ""))
        tier = get_tier_for_price(price_id)

        if email:
            try:
                license_key = generate_license_for_purchase(email, tier)
                logger.info("License generated for %s (%s): %s…", email, tier, license_key[:40])
                # TODO: send license_key to email via your mail service
            except Exception as exc:
                logger.error("Failed to generate license for %s: %s", email, exc)

    return {"received": True}
