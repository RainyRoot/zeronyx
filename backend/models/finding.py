from sqlalchemy import Float, String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin, new_uuid


class Finding(Base, TimestampMixin):
    """A vulnerability or notable finding from a scan."""

    __tablename__ = "findings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    scan_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("scans.id", ondelete="SET NULL"), nullable=True, index=True
    )
    host_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("hosts.id", ondelete="SET NULL"), nullable=True
    )
    port_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("ports.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    # critical | high | medium | low | info
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    cvss: Mapped[float | None] = mapped_column(Float, nullable=True)
    cve: Mapped[str | None] = mapped_column(String(32), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    remediation: Mapped[str | None] = mapped_column(Text, nullable=True)
    tool_source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # open | confirmed | false_positive | resolved
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False)

    scan: Mapped["Scan | None"] = relationship("Scan", back_populates="findings")  # noqa: F821
    host: Mapped["Host | None"] = relationship("Host", back_populates="findings")  # noqa: F821
    port: Mapped["Port | None"] = relationship("Port", back_populates="findings")  # noqa: F821
    evidence: Mapped[list["FindingEvidence"]] = relationship(
        "FindingEvidence", back_populates="finding", cascade="all, delete-orphan"
    )
    notes_rel: Mapped[list["Note"]] = relationship(  # noqa: F821
        "Note", back_populates="finding"
    )


class FindingEvidence(Base, TimestampMixin):
    """Attached evidence (screenshot, request/response, output) for a finding."""

    __tablename__ = "finding_evidence"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    finding_id: Mapped[str] = mapped_column(
        String, ForeignKey("findings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # screenshot | request | response | output | note
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str | None] = mapped_column(String(256), nullable=True)
    # text content or file path
    data: Mapped[str | None] = mapped_column(Text, nullable=True)

    finding: Mapped["Finding"] = relationship("Finding", back_populates="evidence")
