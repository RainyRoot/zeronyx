from sqlalchemy import Boolean, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin, new_uuid


class Credential(Base, TimestampMixin):
    """A discovered credential (cleartext, hash, or session token)."""

    __tablename__ = "credentials"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    host_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("hosts.id", ondelete="SET NULL"), nullable=True
    )
    port_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("ports.id", ondelete="SET NULL"), nullable=True
    )
    source_scan: Mapped[str | None] = mapped_column(
        String, ForeignKey("scans.id", ondelete="SET NULL"), nullable=True
    )
    # ssh | ftp | http | smb | rdp | etc.
    service: Mapped[str | None] = mapped_column(String(64), nullable=True)
    username: Mapped[str | None] = mapped_column(String(256), nullable=True)
    password: Mapped[str | None] = mapped_column(String(512), nullable=True)
    hash: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # ntlm | lm | md5 | sha1 | bcrypt | etc.
    hash_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    host: Mapped["Host | None"] = relationship("Host", back_populates="credentials")  # noqa: F821
    port: Mapped["Port | None"] = relationship("Port", back_populates="credentials")  # noqa: F821
