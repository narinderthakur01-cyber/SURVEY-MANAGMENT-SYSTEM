from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_admin
from app.models.role import Role
from app.models.user import User
from app.schemas.role import RoleRead

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("", response_model=list[RoleRead])
def list_roles(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    List all system roles (Admin only).
    """
    return db.query(Role).all()
