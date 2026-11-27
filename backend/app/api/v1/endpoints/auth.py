from datetime import datetime, timedelta, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.api.deps import get_db, get_current_user
from app.core.config import settings
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    generate_refresh_token,
    hash_token,
)
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    TokenResponse,
    ChangePasswordRequest,
)
from app.schemas.user import UserRead

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Annotated[Session, Depends(get_db)]):
    """
    Authenticate user and issue access and refresh tokens.
    """
    user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.email == request.email.lower().strip())
        .first()
    )

    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact an administrator.",
        )

    # Generate tokens
    access_token = create_access_token(subject=str(user.id))
    raw_refresh_token = generate_refresh_token()
    token_hash = hash_token(raw_refresh_token)

    # Store hashed refresh token in DB
    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        is_revoked=False,
    )
    db.add(refresh_record)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserRead.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: RefreshTokenRequest, db: Annotated[Session, Depends(get_db)]):
    """
    Rotate refresh token: revoke current token and issue a fresh pair.
    Detects and rejects reuse of revoked tokens.
    """
    token_hash = hash_token(request.refresh_token)
    # Row-level lock to prevent concurrent refresh race conditions
    stored_token = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .with_for_update()
        .first()
    )

    if not stored_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    # Token reuse detection / revocation check
    if stored_token.is_revoked:
        # Revoke all tokens for this user for security
        db.query(RefreshToken).filter(RefreshToken.user_id == stored_token.user_id).update(
            {"is_revoked": True, "revoked_at": datetime.now(timezone.utc)}
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Revoked token reuse detected. All sessions terminated.",
        )

    # Check expiration
    if stored_token.expires_at < datetime.now(timezone.utc):
        stored_token.is_revoked = True
        stored_token.revoked_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
        )

    # Revoke current refresh token
    stored_token.is_revoked = True
    stored_token.revoked_at = datetime.now(timezone.utc)

    # Fetch user
    user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.id == stored_token.user_id)
        .first()
    )
    if not user or not user.is_active:
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or not found",
        )

    # Issue new token pair (Rotation)
    new_access_token = create_access_token(subject=str(user.id))
    new_raw_refresh_token = generate_refresh_token()
    new_token_hash = hash_token(new_raw_refresh_token)

    new_refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=new_token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        is_revoked=False,
    )
    db.add(new_refresh_record)
    db.commit()

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_raw_refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserRead.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    request: RefreshTokenRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Revoke a refresh token on logout.
    """
    token_hash = hash_token(request.refresh_token)
    stored_token = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash, RefreshToken.user_id == current_user.id)
        .first()
    )

    if stored_token and not stored_token.is_revoked:
        stored_token.is_revoked = True
        stored_token.revoked_at = datetime.now(timezone.utc)
        db.commit()

    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserRead)
def get_me(current_user: Annotated[User, Depends(get_current_user)]):
    """
    Get profile information of the currently authenticated user.
    """
    return current_user


@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    request: ChangePasswordRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Change user password and revoke all existing refresh tokens.
    """
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = get_password_hash(request.new_password)
    # Revoke all existing sessions
    db.query(RefreshToken).filter(RefreshToken.user_id == current_user.id).update(
        {"is_revoked": True, "revoked_at": datetime.now(timezone.utc)}
    )
    db.commit()

    return {"message": "Password changed successfully. Please log in again."}
