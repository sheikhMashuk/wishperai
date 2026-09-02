from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "WhisperAI Cloud Services"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "whisperai_super_secret_jwt_key_production_grade_change_me_987654321"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "tauri://localhost",
        "https://tauri.localhost",
    ]
    
    # Database & Redis
    DATABASE_URL: str = "postgresql+asyncpg://whisperai:whisperai_secret@postgres:5432/whisperaidb"
    REDIS_URL: str = "redis://redis:6379/0"
    
    # AI API Keys
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    DEEPGRAM_API_KEY: str = ""

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
