from datetime import datetime
from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.base import Base, TimestampMixin, new_uuid


class ProxyRequest(Base, TimestampMixin):
    """One HTTP/HTTPS flow captured by the embedded mitmproxy instance."""

    __tablename__ = "proxy_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)

    # Request fields
    method: Mapped[str] = mapped_column(String(16), nullable=False)
    scheme: Mapped[str] = mapped_column(String(8), nullable=False, default="http")
    host: Mapped[str] = mapped_column(String(512), nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False, default=80)
    path: Mapped[str] = mapped_column(Text, nullable=False, default="/")
    url: Mapped[str] = mapped_column(Text, nullable=False)
    request_headers: Mapped[str | None] = mapped_column(Text, nullable=True)   # JSON
    request_body: Mapped[str | None] = mapped_column(Text, nullable=True)       # text or base64

    # Response fields (may be null if no response received)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_headers: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    response_body: Mapped[str | None] = mapped_column(Text, nullable=True)     # text or base64
    content_type: Mapped[str | None] = mapped_column(String(256), nullable=True)

    # Metadata
    response_size: Mapped[int | None] = mapped_column(Integer, nullable=True)   # bytes
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    # Tagging / notes (Pro: intercept edits)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
