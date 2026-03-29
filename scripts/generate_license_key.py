#!/usr/bin/env python3
"""ZeroNyx License Key Generator — internal developer tool.

Usage:
  python scripts/generate_license_key.py \\
    --email customer@example.com \\
    --tier pro \\
    --features ai_analysis chain_engine obsidian_sync plugin_marketplace advanced_reports \\
    --days 365

Keep the private key (PRIVATE_KEY_PEM below) SECRET — never ship it with the app.
The app embeds only the corresponding public key for offline verification.
"""

import argparse
import json
import uuid
from datetime import datetime, timedelta, timezone

import jwt

# ---------------------------------------------------------------------------
# Private key — KEEP SECRET — licensing server only
# ---------------------------------------------------------------------------
PRIVATE_KEY_PEM = """-----BEGIN RSA PRIVATE KEY-----
MIIEogIBAAKCAQEAr1O4Op1130Bll5og4GYLxxYHDDVnvygBz9hY+HJPngRJNI/6
YfN0zpMP7KX4zK8jSuldSPQUH8FhDgy0D2T1Snpw8lJH1C9XI+QZWu5aVVD9/Kjb
Gwk8IiWsIpvw//3clAr59+lPTSPpMZhCDDhrdfPyjttyOGeJT5bkGycpd38ZtHWx
2bBKxmnhobSW6paV16OncX/EpSS9H0VzNrwLPMD3c03sOQZ36bsofOLis01ke1Ub
mWd68JYKFLQjlGt+y1AZwtqOT+8HxPySVPPV6QiSX+1DWrs3LpL3zgf5YwxfnI+a
B+Hod0ShxdZdpz66I8cbEJ+qlsDFyRm1JXAFNwIDAQABAoIBAAxJ9PI1rcZgBv7o
Atx8POCGc3FwVo9l6FTj4VCTAXAwYrd4TSnCbykUG8CiJqYTRa2Ty0HvXSbgp8MB
VvBzk9HVl33wEHmp5PAlgX6Z/yxW2xjhP927HdV3djpFEnUziQADbYPqM8wJqno/
3Ib9Uod8Z2Qc2B8c1iKXj17r2jc2TGv1pHr8+0CjbpKTqDyrVD9NrRL8DDt6L5zt
JbrE2xQjEn0ifNFPATXrkb0aqsLgGcn2Vpwr1IHHVjNflXNVYoKV4ORXPUIopyqv
E0cm5XWAJWzxS3s7NMsFSY2Cg5QFkaI0cKYCnhL02reagXDsrmzU1xulojw6JsdE
BkeWPokCgYEA3L0h5E0wOnmcGmmtOJtHg+s3o4mNHrkDw5+XUkdP8tn25OJvXbKH
+/M90s91urbgb6Sy+K4VLtsMrVfVJgaYgYyzEvNGCsGtUzl/nfnGiy3FlrZPhYHi
hu3zr08/9wSY6rjwLRmj4H0EO9BXjDHpl9+ALTQH/ErpCVzQxHnno8UCgYEAy1WG
A9vDMGXYHcZuHwGS3cXQMFuUtwi6E3JfwnAJ2gY8uN5oOHk9f3hWQ1YpkCm96Twu
rfolIEMl/R8EB2YhMfeFHZ257FJqXLIORM9K8Cfu8j0+qI2AOkRoSRRrtRjkRgA9
cb8AEAbDUYMqKWiCAD4n5hqeV9nMJt43UqpHCMsCgYBQo++rvd8unZq/s3eKxH99
3AJ5hhi97o1HfBgGAPNeHu6pc2eH7V7sVlJxn0S9L24SmzKe0sn+Uhvxf7Lor2Qr
f8Ez3RfrehHd45WRmtxDoDcc9gFbHrYo4OkzVFpj3ZQXu/RSJZnOux0+1MAHAXz6
9LWYzfdU3fEAcJ38CSTsmQKBgFsOyL5Pm0DASyFCbKxcAw5n+My/JoE1Wkc9MB8e
F3tY0bakex3XRbAhDtiG7IQP/WlGt0zYOeoRyCBr1F0P4ovC4g0aRlnLqrAqWPN9
tXyJFZvLy5SmEaeGXQFlMLrgE9I5Z0raE0gaDzwgti/nCljbfPiyMPj8o01AtJvD
f54zAoGAegxtz38hkFqf8lCnjSgVj1M7cxju31IBY67pXy1923DPOJC94pH+jgur
NcGIkC0S2f5qSt+ZdjEQ9l6pq7trLEwv6ENb4Lzg2C1ZipJZ5zC39A9gGpDMzlYf
cBJSFLiUJHbAbPc8Pd0Tp+Nh8/5N715kcpV35+2OyrHv1v+AUOg=
-----END RSA PRIVATE KEY-----"""

TIER_DEFAULTS: dict[str, list[str]] = {
    "community": [],
    "pro": [
        "ai_analysis",
        "chain_engine",
        "obsidian_sync",
        "plugin_marketplace",
        "advanced_reports",
    ],
    "enterprise": [
        "ai_analysis",
        "chain_engine",
        "obsidian_sync",
        "plugin_marketplace",
        "advanced_reports",
        "team_mode",
        "custom_branding",
        "priority_support",
    ],
}


def generate(
    email: str,
    tier: str,
    features: list[str] | None,
    days: int | None,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict = {
        "jti": str(uuid.uuid4()),
        "sub": email,
        "tier": tier,
        "iat": int(now.timestamp()),
        "feat": features if features is not None else TIER_DEFAULTS.get(tier, []),
    }
    if days is not None:
        exp = now + timedelta(days=days)
        payload["exp"] = int(exp.timestamp())

    token = jwt.encode(payload, PRIVATE_KEY_PEM, algorithm="RS256")
    return token


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a ZeroNyx license key")
    parser.add_argument("--email", required=True, help="Licensee e-mail address")
    parser.add_argument("--tier", choices=["community", "pro", "enterprise"], default="pro")
    parser.add_argument(
        "--features",
        nargs="*",
        help="Override feature list (default: tier defaults)",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=None,
        help="Validity in days (omit for perpetual)",
    )
    args = parser.parse_args()

    key = generate(args.email, args.tier, args.features, args.days)

    print("\n=== ZeroNyx License Key ===")
    print(key)
    print()

    # Decode and show human-readable summary
    decoded = jwt.decode(key, options={"verify_signature": False})
    print("--- Payload ---")
    print(json.dumps(decoded, indent=2))
    exp_ts = decoded.get("exp")
    if exp_ts:
        exp_dt = datetime.fromtimestamp(exp_ts, tz=timezone.utc)
        print(f"\nExpires: {exp_dt.strftime('%Y-%m-%d')}")
    else:
        print("\nExpires: Never (perpetual)")
    print()


if __name__ == "__main__":
    main()
