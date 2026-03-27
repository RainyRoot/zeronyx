"""add proxy_requests table

Revision ID: f4a91c3b5e72
Revises: d2be98a7a8b3
Create Date: 2026-03-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f4a91c3b5e72'
down_revision: Union[str, Sequence[str], None] = 'd2be98a7a8b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'proxy_requests',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('method', sa.String(length=16), nullable=False),
        sa.Column('scheme', sa.String(length=8), nullable=False),
        sa.Column('host', sa.String(length=512), nullable=False),
        sa.Column('port', sa.Integer(), nullable=False),
        sa.Column('path', sa.Text(), nullable=False),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('request_headers', sa.Text(), nullable=True),
        sa.Column('request_body', sa.Text(), nullable=True),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('response_headers', sa.Text(), nullable=True),
        sa.Column('response_body', sa.Text(), nullable=True),
        sa.Column('content_type', sa.String(length=256), nullable=True),
        sa.Column('response_size', sa.Integer(), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('tags', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('proxy_requests', schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f('ix_proxy_requests_project_id'), ['project_id'], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table('proxy_requests', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_proxy_requests_project_id'))
    op.drop_table('proxy_requests')
