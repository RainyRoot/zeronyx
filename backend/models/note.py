from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin, new_uuid


class Note(Base, TimestampMixin):
    """Free-form notes attached to a target, host, or finding."""

    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    target_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("targets.id", ondelete="SET NULL"), nullable=True
    )
    host_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("hosts.id", ondelete="SET NULL"), nullable=True
    )
    finding_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("findings.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # JSON array of strings
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)

    target: Mapped["Target | None"] = relationship("Target", back_populates="notes_rel")  # noqa: F821
    host: Mapped["Host | None"] = relationship("Host", back_populates="notes_rel")  # noqa: F821
    finding: Mapped["Finding | None"] = relationship("Finding", back_populates="notes_rel")  # noqa: F821
