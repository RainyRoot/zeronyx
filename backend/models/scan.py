from datetime import datetime
from sqlalchemy import DateTime, String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin, new_uuid


class Scan(Base, TimestampMixin):
    """A single tool execution against a target."""

    __tablename__ = "scans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    target_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("targets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # nmap | nuclei | nikto | gobuster | hydra | sqlmap | metasploit | searchsploit
    tool: Mapped[str] = mapped_column(String(64), nullable=False)
    profile: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # JSON: all scan parameters / flags
    config: Mapped[str | None] = mapped_column(Text, nullable=True)
    # pending | running | completed | failed | cancelled
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    target: Mapped["Target | None"] = relationship("Target", back_populates="scans")  # noqa: F821
    result: Mapped["ScanResult | None"] = relationship(  # noqa: F821
        "ScanResult", back_populates="scan", cascade="all, delete-orphan", uselist=False
    )
    findings: Mapped[list["Finding"]] = relationship(  # noqa: F821
        "Finding", back_populates="scan", cascade="all, delete-orphan"
    )


class ScanResult(Base):
    """Raw + parsed output from a completed scan."""

    __tablename__ = "scan_results"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    scan_id: Mapped[str] = mapped_column(
        String, ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    raw_output: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON: structured parsed result
    parsed: Mapped[str | None] = mapped_column(Text, nullable=True)
    # xml | json | text
    format: Mapped[str | None] = mapped_column(String(16), nullable=True)

    scan: Mapped["Scan"] = relationship("Scan", back_populates="result")
