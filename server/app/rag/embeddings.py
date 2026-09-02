import re
from typing import List, Dict, Any

class RAGService:
    @staticmethod
    def chunk_document(text: str, chunk_size: int = 500, overlap: int = 100) -> List[str]:
        """
        Splits document text into semantic chunks with overlap.
        """
        paragraphs = re.split(r'\n{2,}', text)
        chunks = []
        current_chunk = []
        current_len = 0

        for p in paragraphs:
            p = p.strip()
            if not p:
                continue
            words = p.split()
            if current_len + len(words) > chunk_size:
                if current_chunk:
                    chunks.append(" ".join(current_chunk))
                current_chunk = words
                current_len = len(words)
            else:
                current_chunk.extend(words)
                current_len += len(words)

        if current_chunk:
            chunks.append(" ".join(current_chunk))

        return chunks if chunks else [text]

    @staticmethod
    def calculate_bm25_score(query_tokens: List[str], doc_tokens: List[str]) -> float:
        """
        Fast token frequency matching for sparse keyword scoring.
        """
        if not doc_tokens:
            return 0.0
        score = 0.0
        doc_set = set(doc_tokens)
        for token in query_tokens:
            if token in doc_set:
                score += 1.0 + (doc_tokens.count(token) * 0.5)
        return score / len(doc_tokens)

    @classmethod
    def retrieve_top_k(cls, query: str, chunks: List[str], top_k: int = 3) -> List[str]:
        """
        Hybrid retrieval matching question context against candidate resume chunks.
        """
        if not chunks:
            return []

        query_tokens = [t.lower() for t in re.findall(r'\w+', query) if len(t) > 2]
        scored_chunks = []

        for chunk in chunks:
            doc_tokens = [t.lower() for t in re.findall(r'\w+', chunk)]
            score = cls.calculate_bm25_score(query_tokens, doc_tokens)
            scored_chunks.append((score, chunk))

        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        return [chunk for score, chunk in scored_chunks[:top_k] if score > 0]
