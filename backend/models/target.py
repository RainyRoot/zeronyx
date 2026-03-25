from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin, new_uuid


class Target(Base, TimestampMixin):
    """A scope target within a project (IP, domain, CIDR, URL)."""

    __tablename__ = "targets"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    value: Mapped[str] = mapped_column(String(512), nullable=False)
    # ip | domain | cidr | url
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON array of strings
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)

    scans: Mapped[list["Scan"]] = relationship(  # noqa: F821
        "Scan", back_populates="target", cascade="all, delete-orphan"
    )
    notes_rel: Mapped[list["Note"]] = relationship(  # noqa: F821
        "Note", back_populates="target", cascade="all, delete-orphan"
    )
