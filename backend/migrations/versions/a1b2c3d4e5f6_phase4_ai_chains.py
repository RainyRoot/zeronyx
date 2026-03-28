"""Phase 4: add ai_analyses, chains, chain_runs tables

Revision ID: a1b2c3d4e5f6
Revises: f4a91c3b5e72
Create Date: 2026-03-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f4a91c3b5e72'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- ai_analyses ---
    op.create_table(
        'ai_analyses',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('context_type', sa.String(length=32), nullable=False),
        sa.Column('context_id', sa.String(), nullable=True),
        sa.Column('provider', sa.String(length=32), nullable=True),
        sa.Column('model', sa.String(length=128), nullable=True),
        sa.Column('prompt_type', sa.String(length=64), nullable=True),
        sa.Column('response', sa.Text(), nullable=True),
        sa.Column('tokens_used', sa.Integer(), nullable=True),
        sa.Column('sanitized', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('ai_analyses', schema=None) as batch_op:
        batch_op.create_index('ix_ai_analyses_project_id', ['project_id'], unique=False)
        batch_op.create_index('ix_ai_analyses_context_id', ['context_id'], unique=False)

    # --- chains ---
    op.create_table(
        'chains',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(length=256), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('steps', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('trigger_on', sa.String(length=32), nullable=False, server_default='manual'),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('last_run', sa.String(length=64), nullable=True),
        sa.Column('last_status', sa.String(length=32), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('chains', schema=None) as batch_op:
        batch_op.create_index('ix_chains_project_id', ['project_id'], unique=False)

    # --- chain_runs ---
    op.create_table(
        'chain_runs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('chain_id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='running'),
        sa.Column('step_results', sa.Text(), nullable=False, server_default='{}'),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('started_at', sa.String(length=64), nullable=True),
        sa.Column('finished_at', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('chain_runs', schema=None) as batch_op:
        batch_op.create_index('ix_chain_runs_chain_id', ['chain_id'], unique=False)
        batch_op.create_index('ix_chain_runs_project_id', ['project_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('chain_runs', schema=None) as batch_op:
        batch_op.drop_index('ix_chain_runs_project_id')
        batch_op.drop_index('ix_chain_runs_chain_id')
    op.drop_table('chain_runs')

    with op.batch_alter_table('chains', schema=None) as batch_op:
        batch_op.drop_index('ix_chains_project_id')
    op.drop_table('chains')

    with op.batch_alter_table('ai_analyses', schema=None) as batch_op:
        batch_op.drop_index('ix_ai_analyses_context_id')
        batch_op.drop_index('ix_ai_analyses_project_id')
    op.drop_table('ai_analyses')
