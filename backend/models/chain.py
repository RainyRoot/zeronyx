from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.base import Base, TimestampMixin, new_uuid


class Chain(Base, TimestampMixin):
    """An automated workflow definition (Pro feature).

    A chain is a sequence of steps executed in order.  Each step is stored as
    JSON inside ``steps``::

        [
          {"id": "...", "type": "scan",   "tool": "nmap",    "config": {...}},
          {"id": "...", "type": "scan",   "tool": "gobuster", "config": {...}, "depends_on": "prev_result"},
          {"id": "...", "type": "notify", "message": "Chain complete"},
        ]
    """

    __tablename__ = "chains"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # JSON array of ChainStep dicts
    steps: Mapped[str] = mapped_column(Text, nullable=False, default="[]")

    # manual | on_scan_complete | scheduled
    trigger_on: Mapped[str] = mapped_column(String(32), default="manual", nullable=False)

    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Filled after each run
    last_run: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_status: Mapped[str | None] = mapped_column(String(32), nullable=True)  # success | failed | running


class ChainRun(Base, TimestampMixin):
    """Execution record for a single chain invocation."""

    __tablename__ = "chain_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    chain_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(String, nullable=False, index=True)

    # running | completed | failed | cancelled
    status: Mapped[str] = mapped_column(String(32), default="running", nullable=False)

    # JSON: per-step results {step_id: {status, output, scan_id?}}
    step_results: Mapped[str] = mapped_column(Text, default="{}", nullable=False)

    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    finished_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
