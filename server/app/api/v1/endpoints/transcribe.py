import io
import httpx
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from app.core.config import settings

router = APIRouter()

@router.post("")
async def transcribe_audio(
    file: UploadFile = File(...),
    provider: str = Form("groq"),
    api_key: Optional[str] = Form(None),
    language: str = Form("en"),
):
    """
    High-speed audio transcription endpoint using Whisper-large-v3 via Groq or OpenAI.
    """
    audio_bytes = await file.read()
    key = api_key or (settings.GROQ_API_KEY if provider == "groq" else settings.OPENAI_API_KEY)

    if not key:
        return {
            "text": "Simulated transcription: Explain how you implement zero-copy networking in Rust.",
            "language": language,
            "provider": "offline-simulation",
        }

    try:
        if provider == "groq":
            async with httpx.AsyncClient(timeout=30.0) as client:
                files = {"file": (file.filename or "audio.wav", audio_bytes, file.content_type or "audio/wav")}
                data = {
                    "model": "whisper-large-v3-turbo",
                    "language": language,
                    "response_format": "json",
                }
                headers = {"Authorization": f"Bearer {key}"}
                response = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    files=files,
                    data=data,
                    headers=headers,
                )
                if response.status_code != 200:
                    raise HTTPException(status_code=response.status_code, detail=response.text)
                result = response.json()
                return {"text": result.get("text", ""), "provider": "groq-whisper-turbo"}

        elif provider == "openai":
            async with httpx.AsyncClient(timeout=30.0) as client:
                files = {"file": (file.filename or "audio.wav", audio_bytes, file.content_type or "audio/wav")}
                data = {
                    "model": "whisper-1",
                    "language": language,
                    "response_format": "json",
                }
                headers = {"Authorization": f"Bearer {key}"}
                response = await client.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    files=files,
                    data=data,
                    headers=headers,
                )
                if response.status_code != 200:
                    raise HTTPException(status_code=response.status_code, detail=response.text)
                result = response.json()
                return {"text": result.get("text", ""), "provider": "openai-whisper"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")
