"""Live field workforce tracking and geolocation schema (Phase 5)

Revision ID: 0004_live_tracking
Revises: 0003_workforce_task
Create Date: 2026-11-27 15:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '0004_live_tracking'
down_revision: Union[str, None] = '0003_workforce_task'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. tracking_sessions table
    op.create_table(
        'tracking_sessions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('worker_id', sa.UUID(), nullable=False),
        sa.Column('task_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='ACTIVE'),
        sa.Column('consent_granted', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('termination_reason', sa.String(length=100), nullable=True),
        sa.Column('device_info', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['worker_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_tracking_sessions_task_id'), 'tracking_sessions', ['task_id'], unique=False)
    op.create_index(op.f('ix_tracking_sessions_worker_id'), 'tracking_sessions', ['worker_id'], unique=False)
    op.create_index(op.f('ix_tracking_sessions_status'), 'tracking_sessions', ['status'], unique=False)

    # 2. worker_locations table
    op.create_table(
        'worker_locations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('worker_id', sa.UUID(), nullable=False),
        sa.Column('task_id', sa.UUID(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('accuracy', sa.Float(), nullable=False),
        sa.Column('speed', sa.Float(), nullable=True),
        sa.Column('heading', sa.Float(), nullable=True),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['tracking_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['worker_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_worker_locations_session_id'), 'worker_locations', ['session_id'], unique=False)
    op.create_index(op.f('ix_worker_locations_worker_id'), 'worker_locations', ['worker_id'], unique=False)
    op.create_index(op.f('ix_worker_locations_task_id'), 'worker_locations', ['task_id'], unique=False)
    op.create_index(op.f('ix_worker_locations_recorded_at'), 'worker_locations', ['recorded_at'], unique=False)
    op.create_index('ix_worker_locations_worker_recorded', 'worker_locations', ['worker_id', 'recorded_at'], unique=False)
    op.create_index('ix_worker_locations_task_recorded', 'worker_locations', ['task_id', 'recorded_at'], unique=False)


def downgrade() -> None:
    op.drop_table('worker_locations')
    op.drop_table('tracking_sessions')
