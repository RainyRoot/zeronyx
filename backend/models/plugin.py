"""SQLAlchemy model for installed plugins."""

from sqlalchemy import String, Boolean, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, timezone

from backend.models.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Plugin(Base):
    __tablename__ = "plugins"

    id: Mapped[str] = mapped_column(String, primary_key=True)           # plugin manifest id
    name: Mapped[str] = mapped_column(String, nullable=False)
    version: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    author: Mapped[str] = mapped_column(String, default="")
    plugin_type: Mapped[str] = mapped_column(String, default="both")    # backend/frontend/both
    install_path: Mapped[str] = mapped_column(String, nullable=False)   # absolute path to plugin dir
    permissions: Mapped[str] = mapped_column(Text, default="[]")        # JSON array
    ui_slots: Mapped[str] = mapped_column(Text, default="[]")           # JSON array
    hooks: Mapped[str] = mapped_column(Text, default="[]")              # JSON array
    settings: Mapped[str] = mapped_column(Text, default="{}")           # JSON: schema definitions
    settings_values: Mapped[str] = mapped_column(Text, default="{}")    # JSON: user values
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    permissions_granted: Mapped[bool] = mapped_column(Boolean, default=False)
    installed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
