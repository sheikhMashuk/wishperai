from fastapi import APIRouter
from app.api.v1.endpoints import auth, meetings, transcribe

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(meetings.router, prefix="/meetings", tags=["Meetings & Analytics"])
api_router.include_router(transcribe.router, prefix="/transcribe", tags=["Audio Transcription"])
