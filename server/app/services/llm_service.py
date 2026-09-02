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

    @classmethod
    async def generate_copilot_response(
        cls,
        question: str,
        resume_context: List[str],
        provider: str = "groq",
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generates real-time interview suggestions using the designated LLM provider.
        """
        context_str = "\n".join([f"- {c}" for c in resume_context]) if resume_context else "None provided."
        user_prompt = f"""Candidate Resume Context:
{context_str}

Interviewer Question:
"{question}"

Generate the optimal copilot response in JSON format."""

        key = api_key or (settings.GROQ_API_KEY if provider == "groq" else settings.OPENAI_API_KEY)

        # Fallback simulation if no API key is provided during offline development
        if not key:
            intent = cls.classify_intent(question)
            return cls._build_mock_response(question, intent)

        if provider == "groq":
            return await cls._call_groq(user_prompt, key)
        elif provider == "openai":
            return await cls._call_openai(user_prompt, key)
        else:
            intent = cls.classify_intent(question)
            return cls._build_mock_response(question, intent)

    @classmethod
    async def _call_groq(cls, prompt: str, api_key: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "messages": [
                            {"role": "system", "content": SYSTEM_COPILOT_PROMPT},
                            {"role": "user", "content": prompt},
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.2,
                    },
                )
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return json.loads(content)
            except Exception as e:
                return cls._build_mock_response("Error querying Groq: " + str(e), "GENERAL")

    @classmethod
    async def _call_openai(cls, prompt: str, api_key: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": "gpt-4o",
                        "messages": [
                            {"role": "system", "content": SYSTEM_COPILOT_PROMPT},
                            {"role": "user", "content": prompt},
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.2,
                    },
                )
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return json.loads(content)
            except Exception as e:
                return cls._build_mock_response("Error querying OpenAI: " + str(e), "GENERAL")

    @classmethod
    def _build_mock_response(cls, question: str, intent: str) -> Dict[str, Any]:
        if intent == "BEHAVIORAL":
            return {
                "intent": "BEHAVIORAL",
                "summary": "Demonstrated technical leadership by introducing distributed caching and atomic transactions to eliminate race conditions under heavy load.",
                "bullet_points": [
                    "Identified sub-millisecond database lock contention across microservices.",
                    "Implemented atomic Redis Lua scripts to achieve lock-free consistency.",
                    "Improved overall throughput by 4x while eliminating double-spending bugs."
                ],
                "star_story": {
                    "situation": "A high-concurrency payment pipeline suffered from database deadlocks during peak events.",
                    "task": "Refactor the transaction settlement system to support 50k req/sec without latency spikes.",
                    "action": "Engineered an event-driven queue with Redis distributed locks and idempotent consumer workers.",
                    "result": "Zero transaction inconsistencies and reduced p99 latency from 120ms to 24ms."
                },
                "code_snippet": None
            }
        elif intent == "CODING_ALGORITHM":
            return {
                "intent": "CODING_ALGORITHM",
                "summary": "Use a Hash Map with a Doubly Linked List to achieve O(1) time complexity for both get and put operations.",
                "bullet_points": [
                    "Hash Map provides direct O(1) node pointer lookup.",
                    "Doubly Linked List allows O(1) removal and re-insertion at the head.",
                    "Maintain dummy head/tail pointers to eliminate edge-case null checks."
                ],
                "code_snippet": {
                    "language": "TypeScript / Rust",
                    "code": "class LRUCache {\n  private capacity: number;\n  private map: Map<number, Node> = new Map();\n  // O(1) get & put with Doubly Linked List pointers\n}",
                    "complexity": "Time: O(1) | Space: O(N)"
                },
                "star_story": None
            }
        else:
            return {
                "intent": intent,
                "summary": "Leverage an asynchronous event loop with connection multiplexing and epoll/kqueue to handle high-concurrency socket loads.",
                "bullet_points": [
                    "Avoid 1-thread-per-connection thread models in favor of non-blocking I/O.",
                    "Use Redis Pub/Sub or NATS cluster for multi-node room broadcasts.",
                    "Implement ring buffer backpressure to drop degraded client frames gracefully."
                ],
                "code_snippet": None,
                "star_story": None
            }
