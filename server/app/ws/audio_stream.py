import json
import asyncio
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect
from app.services.llm_service import LLMService
from app.rag.embeddings import RAGService

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.session_resumes: Dict[str, list] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = set()
        self.active_connections[session_id].add(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket):
        if session_id in self.active_connections:
            self.active_connections[session_id].discard(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast_to_session(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            data = json.dumps(message)
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_text(data)
                except Exception:
                    pass

manager = ConnectionManager()

async def handle_audio_websocket(websocket: WebSocket, session_id: str):
    await manager.connect(session_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            msg_type = payload.get("type")

            if msg_type == "INIT_CONTEXT":
                # Initialize candidate resume / JD context for this session
                resume_text = payload.get("resume_text", "")
                chunks = RAGService.chunk_document(resume_text)
                manager.session_resumes[session_id] = chunks
                await websocket.send_json({"type": "CONTEXT_READY", "chunk_count": len(chunks)})

            elif msg_type == "TRANSCRIPT_CHUNK":
                # Transcribed speech chunk arrived
                speaker = payload.get("speaker", "interviewer")
                text = payload.get("text", "")
                is_question = payload.get("is_question", False)

                # Broadcast transcript segment to client HUD
                await manager.broadcast_to_session(session_id, {
                    "type": "TRANSCRIPT_EVENT",
                    "speaker": speaker,
                    "text": text,
                    "timestamp": payload.get("timestamp"),
                })

                # If interviewer asked a question, trigger real-time RAG & LLM suggestion
                if speaker == "interviewer" or is_question:
                    chunks = manager.session_resumes.get(session_id, [])
                    retrieved_context = RAGService.retrieve_top_k(text, chunks, top_k=3)
                    
                    provider = payload.get("provider", "groq")
                    api_key = payload.get("api_key")

                    suggestion = await LLMService.generate_copilot_response(
                        question=text,
                        resume_context=retrieved_context,
                        provider=provider,
                        api_key=api_key,
                    )

                    await manager.broadcast_to_session(session_id, {
                        "type": "COPILOT_SUGGESTION",
                        "suggestion": {
                            "id": f"sug-{asyncio.get_event_loop().time()}",
                            "question": text,
                            "intent": suggestion.get("intent", "GENERAL"),
                            "summary": suggestion.get("summary", ""),
                            "bulletPoints": suggestion.get("bullet_points", []),
                            "codeSnippet": suggestion.get("code_snippet"),
                            "starStory": suggestion.get("star_story"),
                            "retrievedContext": retrieved_context,
                            "timestamp": payload.get("timestamp"),
                        }
                    })

            elif msg_type == "PING":
                await websocket.send_json({"type": "PONG"})

    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)
    except Exception as e:
        manager.disconnect(session_id, websocket)
