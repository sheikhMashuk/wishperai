from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.analytics_service import AnalyticsService

router = APIRouter()

class SessionEvaluateRequest(BaseModel):
    session_id: str
    duration_seconds: int = 1800
    transcripts: List[Dict[str, Any]]

@router.post("/evaluate")
async def evaluate_meeting(payload: SessionEvaluateRequest):
    metrics = AnalyticsService.evaluate_session(
        transcripts=payload.transcripts,
        duration_seconds=payload.duration_seconds,
    )
    return {
        "session_id": payload.session_id,
        "analytics": metrics,
    }
