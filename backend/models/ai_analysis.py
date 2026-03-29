from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.base import Base, TimestampMixin, new_uuid


class AIAnalysis(Base, TimestampMixin):
    """Stored result of an AI analysis request."""

    __tablename__ = "ai_analyses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)

    # What was analysed: scan | finding | project | report
    context_type: Mapped[str] = mapped_column(String(32), nullable=False)
    # ID of the scan / finding / project
    context_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)

    # Which AI was used
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)   # ollama | openai | anthropic
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Type of analysis performed
    prompt_type: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )  # analyse | false_positive | exploits | report

    # The generated response (Markdown)
    response: Mapped[str | None] = mapped_column(Text, nullable=True)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Whether PII/IPs were anonymised before sending to the cloud
    sanitized: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
