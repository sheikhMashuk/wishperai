import json
import httpx
from typing import Dict, Any, List, Optional
from app.core.config import settings

SYSTEM_COPILOT_PROMPT = """You are WhisperAI — a world-class real-time technical interview copilot.
Your job is to provide direct, crisp, high-impact answers to interview questions.

Output MUST be valid JSON with this exact structure:
{
  "intent": "BEHAVIORAL" | "CODING_ALGORITHM" | "SYSTEM_DESIGN" | "TECHNICAL_KNOWLEDGE" | "GENERAL",
  "summary": "1-2 sentence crisp direct answer that the candidate can read immediately.",
  "bullet_points": ["Key technical detail or trade-off 1", "Key detail 2", "Key detail 3"],
  "code_snippet": {
    "language": "Language name",
    "code": "Clean, optimal code implementation",
    "complexity": "Time: O(...) | Space: O(...)"
  } (or null if not coding),
  "star_story": {
    "situation": "Context",
    "task": "Objective",
    "action": "What you specifically built/solved",
    "result": "Quantifiable outcome"
  } (or null if not behavioral)
}
Never output markdown fences around the JSON; return pure JSON only."""

class LLMService:
    @staticmethod
    def classify_intent(question: str) -> str:
        q_lower = question.lower()
        if any(w in q_lower for w in ["tell me about a time", "conflict", "disagreement", "proudest", "failed", "leadership"]):
            return "BEHAVIORAL"
        if any(w in q_lower for w in ["write a function", "algorithm", "binary tree", "leetcode", "time complexity", "implement", "lru", "two sum"]):
            return "CODING_ALGORITHM"
        if any(w in q_lower for w in ["design", "architecture", "scale", "microservice", "distributed", "rate limiter", "cache", "throughput"]):
            return "SYSTEM_DESIGN"
        return "TECHNICAL_KNOWLEDGE"

    # Backend realtime logic removed in favor of client-side streaming.
    pass

