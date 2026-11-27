from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, teams, roles, surveys, tasks, tracking

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(teams.router)
api_router.include_router(roles.router)
api_router.include_router(surveys.router)
api_router.include_router(tasks.router)
api_router.include_router(tracking.router)
