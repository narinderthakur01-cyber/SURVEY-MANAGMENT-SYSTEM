import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.api.deps import get_db, get_current_user, require_admin
from app.core.security import get_password_hash
from app.models.user import User
from app.models.role import Role
from app.models.team import Team
from app.models.team_member import TeamMember
from app.schemas.user import UserCreate, UserUpdate, UserStatusUpdate, UserRead

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    current_admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a new staff user (Admin only).
    """
    # Normalize email
    normalized_email = user_in.email.lower().strip()

    # Check email uniqueness
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists",
        )

    # Validate role_id exists
    role = db.query(Role).filter(Role.id == user_in.role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role_id specified",
        )

    new_user = User(
        email=normalized_email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name.strip(),
        phone_number=user_in.phone_number.strip() if user_in.phone_number else None,
        role_id=user_in.role_id,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.get("", response_model=list[UserRead])
def list_users(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    role_name: str | None = None,
):
    """
    List users:
    - Admin: can view all users.
    - Supervisor: can view workers in their authorized teams.
    - Worker: unauthorized.
    """
    if current_user.role.name == "ADMIN":
        query = db.query(User).options(joinedload(User.role))
        if role_name:
            query = query.join(Role).filter(Role.name == role_name.upper())
        return query.all()

    if current_user.role.name == "SUPERVISOR":
        # Supervisor can only view workers belonging to teams they supervise
        supervised_team_ids = [
            t.id for t in db.query(Team.id).filter(Team.supervisor_id == current_user.id).all()
        ]
        worker_ids = [
            m.user_id
            for m in db.query(TeamMember.user_id)
            .filter(TeamMember.team_id.in_(supervised_team_ids))
            .all()
        ]
        # Include the supervisor themselves and their team workers
        allowed_ids = set(worker_ids + [current_user.id])
        return (
            db.query(User)
            .options(joinedload(User.role))
            .filter(User.id.in_(allowed_ids))
            .all()
        )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to view users list",
    )


@router.get("/{user_id}", response_model=UserRead)
def get_user_by_id(
    user_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get user details by ID:
    - Admin can view any user.
    - User can view their own profile.
    - Supervisor can view workers in their teams.
    """
    target_user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.id == user_id)
        .first()
    )
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if current_user.role.name == "ADMIN" or current_user.id == user_id:
        return target_user

    if current_user.role.name == "SUPERVISOR":
        # Check if target_user is a member of any team this supervisor leads
        is_member = (
            db.query(TeamMember)
            .join(Team, Team.id == TeamMember.team_id)
            .filter(Team.supervisor_id == current_user.id, TeamMember.user_id == user_id)
            .first()
        )
        if is_member:
            return target_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have authorization to view this user",
    )


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: uuid.UUID,
    user_update: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update user profile:
    - Admin can update any user (including changing role).
    - Regular users can update their own name/phone (cannot change role).
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    is_admin = current_user.role.name == "ADMIN"
    if not is_admin and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to update this user",
        )

    if user_update.role_id is not None:
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can modify user roles",
            )
        role = db.query(Role).filter(Role.id == user_update.role_id).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Specified role_id does not exist",
            )
        target_user.role_id = user_update.role_id

    if user_update.full_name is not None:
        target_user.full_name = user_update.full_name.strip()
    if user_update.phone_number is not None:
        target_user.phone_number = user_update.phone_number.strip()

    db.commit()
    db.refresh(target_user)
    return target_user


@router.patch("/{user_id}/status", response_model=UserRead)
def update_user_status(
    user_id: uuid.UUID,
    status_update: UserStatusUpdate,
    current_admin: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Activate or deactivate user account (Admin only).
    Prevents self-deactivation by an admin.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if target_user.id == current_admin.id and not status_update.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own account",
        )

    target_user.is_active = status_update.is_active
    db.commit()
    db.refresh(target_user)
    return target_user
