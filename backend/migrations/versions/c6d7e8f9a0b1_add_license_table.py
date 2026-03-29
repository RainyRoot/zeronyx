"""add licenses table

Revision ID: c6d7e8f9a0b1
Revises: 0fad6f848916
Create Date: 2026-03-28 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c6d7e8f9a0b1'
down_revision: Union[str, Sequence[str], None] = '0fad6f848916'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'licenses',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('key_id', sa.String(), nullable=False),
        sa.Column('raw_key', sa.Text(), nullable=False),
        sa.Column('tier', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False, server_default=''),
        sa.Column('machine_id', sa.String(), nullable=False),
        sa.Column('features', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('activated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key_id'),
    )


def downgrade() -> None:
    op.drop_table('licenses')
