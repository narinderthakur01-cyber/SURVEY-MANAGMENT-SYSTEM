"""Survey engine and dynamic survey builder schema (Phase 3)

Revision ID: 0002_survey_engine
Revises: 0001_initial_identity
Create Date: 2026-11-27 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '0002_survey_engine'
down_revision: Union[str, None] = '0001_initial_identity'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. surveys table
    op.create_table(
        'surveys',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_surveys_created_by'), 'surveys', ['created_by'], unique=False)

    # 2. survey_versions table
    op.create_table(
        'survey_versions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('survey_id', sa.UUID(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='DRAFT'),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['survey_id'], ['surveys.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('survey_id', 'version_number', name='uq_survey_version')
    )
    op.create_index(op.f('ix_survey_versions_survey_id'), 'survey_versions', ['survey_id'], unique=False)

    # 3. survey_sections table
    op.create_table(
        'survey_sections',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('version_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['version_id'], ['survey_versions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_survey_sections_version_id'), 'survey_sections', ['version_id'], unique=False)

    # 4. questions table
    op.create_table(
        'questions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('section_id', sa.UUID(), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('question_type', sa.String(length=50), nullable=False),
        sa.Column('is_required', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('validation_rules', sa.JSON(), nullable=True),
        sa.Column('conditional_logic', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['section_id'], ['survey_sections.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_questions_section_id'), 'questions', ['section_id'], unique=False)

    # 5. question_options table
    op.create_table(
        'question_options',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('question_id', sa.UUID(), nullable=False),
        sa.Column('option_text', sa.String(length=255), nullable=False),
        sa.Column('option_value', sa.String(length=255), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_question_options_question_id'), 'question_options', ['question_id'], unique=False)

    # 6. survey_public_links table
    op.create_table(
        'survey_public_links',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('version_id', sa.UUID(), nullable=False),
        sa.Column('slug', sa.String(length=64), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['version_id'], ['survey_versions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_survey_public_links_slug'), 'survey_public_links', ['slug'], unique=True)
    op.create_index(op.f('ix_survey_public_links_version_id'), 'survey_public_links', ['version_id'], unique=False)


def downgrade() -> None:
    op.drop_table('survey_public_links')
    op.drop_table('question_options')
    op.drop_table('questions')
    op.drop_table('survey_sections')
    op.drop_table('survey_versions')
    op.drop_table('surveys')
