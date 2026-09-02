from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router
from app.ws.audio_stream import handle_audio_websocket

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST Routers
app.include_router(api_router, prefix=settings.API_V1_STR)

# Real-time Streaming WebSocket Endpoint
@app.websocket("/ws/session/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await handle_audio_websocket(websocket, session_id)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "WhisperAI Cloud Gateway", "version": "1.0.0"}
