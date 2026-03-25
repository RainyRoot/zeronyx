from sqlalchemy import Integer, String, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin, new_uuid


class Port(Base, TimestampMixin):
    """An open port on a discovered host."""

    __tablename__ = "ports"
    __table_args__ = (
        UniqueConstraint("host_id", "number", "protocol", name="uq_port_host_proto"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    host_id: Mapped[str] = mapped_column(
        String, ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scan_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("scans.id", ondelete="SET NULL"), nullable=True
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    # tcp | udp
    protocol: Mapped[str] = mapped_column(String(8), default="tcp", nullable=False)
    # open | closed | filtered
    state: Mapped[str] = mapped_column(String(16), default="open", nullable=False)
    service: Mapped[str | None] = mapped_column(String(128), nullable=True)
    version: Mapped[str | None] = mapped_column(String(256), nullable=True)
    banner: Mapped[str | None] = mapped_column(Text, nullable=True)

    host: Mapped["Host"] = relationship("Host", back_populates="ports")  # noqa: F821
    findings: Mapped[list["Finding"]] = relationship(  # noqa: F821
        "Finding", back_populates="port"
    )
    credentials: Mapped[list["Credential"]] = relationship(  # noqa: F821
        "Credential", back_populates="port"
    )
