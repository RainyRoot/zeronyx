from datetime import datetime
from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin, new_uuid


class Host(Base, TimestampMixin):
    """A discovered host within a project."""

    __tablename__ = "hosts"
    __table_args__ = (UniqueConstraint("project_id", "ip", name="uq_host_project_ip"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    ip: Mapped[str] = mapped_column(String(64), nullable=False)
    hostname: Mapped[str | None] = mapped_column(String(256), nullable=True)
    os: Mapped[str | None] = mapped_column(String(256), nullable=True)
    os_accuracy: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mac: Mapped[str | None] = mapped_column(String(32), nullable=True)
    vendor: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # up | down | unknown
    state: Mapped[str] = mapped_column(String(16), default="up", nullable=False)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    ports: Mapped[list["Port"]] = relationship(  # noqa: F821
        "Port", back_populates="host", cascade="all, delete-orphan"
    )
    findings: Mapped[list["Finding"]] = relationship(  # noqa: F821
        "Finding", back_populates="host"
    )
    credentials: Mapped[list["Credential"]] = relationship(  # noqa: F821
        "Credential", back_populates="host", cascade="all, delete-orphan"
    )
    notes_rel: Mapped[list["Note"]] = relationship(  # noqa: F821
        "Note", back_populates="host"
    )
