"""add event_tracker table

Revision ID: c73570688096
Revises: 47df3d43171e
Create Date: 2018-04-15 09:19:37.858610

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c73570688096'
down_revision = '47df3d43171e'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('event_tracker',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('last_read', sa.Integer(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('event_tracker')
    # ### end Alembic commands ###
