"""SQLAlchemy model for activated license."""

from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class License(Base):
    __tablename__ = "licenses"

    id: Mapped[str] = mapped_column(String, primary_key=True)          # UUID
    key_id: Mapped[str] = mapped_column(String, nullable=False, unique=True)  # from JWT claim
    raw_key: Mapped[str] = mapped_column(Text, nullable=False)          # original JWT string
    tier: Mapped[str] = mapped_column(String, nullable=False)           # community / pro / enterprise
    email: Mapped[str] = mapped_column(String, default="")
    machine_id: Mapped[str] = mapped_column(String, nullable=False)
    features: Mapped[str] = mapped_column(Text, default="[]")           # JSON array of feature names
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    activated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
