from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from app.core.security import create_access_token, get_password_hash, verify_password

router = APIRouter()

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str = ""

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str

@router.post("/register", response_model=TokenResponse)
async def register(payload: UserRegister):
    # Generates JWT access token
    token = create_access_token(payload.email)
    return TokenResponse(
        access_token=token,
        user_id="usr-dev-12345",
        email=payload.email,
    )

@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin):
    token = create_access_token(payload.email)
    return TokenResponse(
        access_token=token,
        user_id="usr-dev-12345",
        email=payload.email,
    )
