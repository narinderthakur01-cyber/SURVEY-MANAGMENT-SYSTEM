import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.api.deps import get_db, get_current_user, require_admin
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.user import User
from app.models.role import Role
from app.schemas.team import TeamCreate, TeamUpdate, TeamRead, TeamMemberAdd, TeamMemberRead

router = APIRouter(prefix="/teams", tags=["Teams"])


def _check_team_supervisor_access(team: Team, user: User):
    """Ensure user is either admin or the direct supervisor of the team."""
    if user.role.name != "ADMIN" and team.supervisor_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to manage or view this team",
        )


@router.post("", response_model=TeamRead, status_code=status.HTTP_201_CREATED)
def create_team(
    team_in: TeamCreate,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a new team (Admin only).
    """
    existing_team = db.query(Team).filter(Team.name == team_in.name.strip()).first()
    if existing_team:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A team with this name already exists",
        )

    if team_in.supervisor_id:
        supervisor = db.query(User).filter(User.id == team_in.supervisor_id).first()
        if not supervisor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Supervisor user does not exist",
            )
        # Ensure user has SUPERVISOR or ADMIN role
        if supervisor.role.name not in ["SUPERVISOR", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned supervisor must have SUPERVISOR or ADMIN role",
            )

    team = Team(
        name=team_in.name.strip(),
        description=team_in.description,
        supervisor_id=team_in.supervisor_id,
        is_active=True,
    )
    db.add(team)
    db.commit()
    db.refresh(team)

    return team


@router.get("", response_model=list[TeamRead])
def list_teams(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    List teams:
    - Admin: view all teams.
    - Supervisor: view teams they supervise.
    - Worker: view teams they are a member of.
    """
    if current_user.role.name == "ADMIN":
        return (
            db.query(Team)
            .options(joinedload(Team.supervisor), joinedload(Team.members).joinedload(TeamMember.user))
            .all()
        )

    if current_user.role.name == "SUPERVISOR":
        return (
            db.query(Team)
            .options(joinedload(Team.supervisor), joinedload(Team.members).joinedload(TeamMember.user))
            .filter(Team.supervisor_id == current_user.id)
            .all()
        )

    # Worker: teams where they are a member
    member_team_ids = [
        m.team_id for m in db.query(TeamMember.team_id).filter(TeamMember.user_id == current_user.id).all()
    ]
    return (
        db.query(Team)
        .options(joinedload(Team.supervisor))
        .filter(Team.id.in_(member_team_ids))
        .all()
    )


@router.get("/{team_id}", response_model=TeamRead)
def get_team_by_id(
    team_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get team details.
    """
    team = (
        db.query(Team)
        .options(joinedload(Team.supervisor), joinedload(Team.members).joinedload(TeamMember.user))
        .filter(Team.id == team_id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    if current_user.role.name == "ADMIN":
        return team

    if current_user.role.name == "SUPERVISOR" and team.supervisor_id == current_user.id:
        return team

    # Worker checking their own team
    is_member = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == current_user.id)
        .first()
    )
    if is_member:
        return team

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You are not authorized to view this team",
    )


@router.patch("/{team_id}", response_model=TeamRead)
def update_team(
    team_id: uuid.UUID,
    team_update: TeamUpdate,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update team settings or reassign supervisor (Admin only).
    """
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    if team_update.name is not None:
        new_name = team_update.name.strip()
        existing = db.query(Team).filter(Team.name == new_name, Team.id != team_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A team with this name already exists",
            )
        team.name = new_name

    if team_update.description is not None:
        team.description = team_update.description

    if team_update.supervisor_id is not None:
        supervisor = db.query(User).filter(User.id == team_update.supervisor_id).first()
        if not supervisor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Supervisor user does not exist",
            )
        if supervisor.role.name not in ["SUPERVISOR", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned supervisor must have SUPERVISOR or ADMIN role",
            )
        team.supervisor_id = team_update.supervisor_id

    if team_update.is_active is not None:
        team.is_active = team_update.is_active

    db.commit()
    db.refresh(team)
    return team


@router.post("/{team_id}/members", response_model=TeamMemberRead, status_code=status.HTTP_201_CREATED)
def add_team_member(
    team_id: uuid.UUID,
    member_in: TeamMemberAdd,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Add a worker to a team:
    - Admin can add to any team.
    - Supervisor can add to their supervised team.
    """
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    _check_team_supervisor_access(team, current_user)

    target_user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.id == member_in.user_id)
        .first()
    )
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User to add does not exist",
        )

    if target_user.role.name != "WORKER":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only users with the WORKER role can be added as team members",
        )

    # Check for duplicate membership
    existing_member = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == member_in.user_id)
        .first()
    )
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this team",
        )

    membership = TeamMember(team_id=team_id, user_id=member_in.user_id)
    db.add(membership)
    db.commit()
    db.refresh(membership)

    return membership


@router.delete("/{team_id}/members/{user_id}", status_code=status.HTTP_200_OK)
def remove_team_member(
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Remove a member from a team:
    - Admin can remove from any team.
    - Supervisor can remove from their supervised team.
    """
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    _check_team_supervisor_access(team, current_user)

    membership = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership record not found",
        )

    db.delete(membership)
    db.commit()

    return {"message": "Team member successfully removed"}
