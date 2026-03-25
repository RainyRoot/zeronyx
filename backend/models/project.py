from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from backend.models.base import Base, TimestampMixin, new_uuid


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON string: list of allowed IPs/domains/CIDRs
    scope: Mapped[str | None] = mapped_column(Text, nullable=True)
    # active | archived | completed
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
