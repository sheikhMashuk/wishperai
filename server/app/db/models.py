import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Float,
    Text,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.db.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    subscription_tier = Column(String(20), default="free")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    documents = relationship("UserDocument", back_populates="user", cascade="all, delete-orphan")
    meetings = relationship("MeetingSession", back_populates="user", cascade="all, delete-orphan")


class UserDocument(Base):
    __tablename__ = "user_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    doc_type = Column(String(50), default="resume")
    raw_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("user_documents.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("UserDocument", back_populates="chunks")


class MeetingSession(Base):
    __tablename__ = "meeting_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), default="Interview Session")
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0)

    user = relationship("User", back_populates="meetings")
    transcripts = relationship("TranscriptSegment", back_populates="session", cascade="all, delete-orphan")
    suggestions = relationship("CopilotSuggestion", back_populates="session", cascade="all, delete-orphan")
    analytics = relationship("SessionAnalytics", back_populates="session", uselist=False, cascade="all, delete-orphan")


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("meeting_sessions.id", ondelete="CASCADE"), nullable=False)
    speaker = Column(String(20), nullable=False)  # 'interviewer' or 'candidate'
    text = Column(Text, nullable=False)
    start_time_ms = Column(Integer, default=0)
    end_time_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("MeetingSession", back_populates="transcripts")


class CopilotSuggestion(Base):
    __tablename__ = "copilot_suggestions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("meeting_sessions.id", ondelete="CASCADE"), nullable=False)
    question_detected = Column(Text, nullable=False)
    intent_category = Column(String(50), default="GENERAL")
    summary = Column(Text, nullable=False)
    bullet_points = Column(JSON, default=list)
    code_snippet = Column(JSON, nullable=True)
    star_story = Column(JSON, nullable=True)
    latency_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("MeetingSession", back_populates="suggestions")


class SessionAnalytics(Base):
    __tablename__ = "session_analytics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("meeting_sessions.id", ondelete="CASCADE"), unique=True, nullable=False)
    speaking_ratio_candidate = Column(Float, default=0.0)
    words_per_minute_avg = Column(Integer, default=0)
    filler_words_count = Column(JSON, default=dict)
    overall_score = Column(Integer, default=85)
    strengths = Column(ARRAY(String), default=list)
    improvements = Column(ARRAY(String), default=list)
    executive_summary = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("MeetingSession", back_populates="analytics")
