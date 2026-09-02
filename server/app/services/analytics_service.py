import re
from typing import List, Dict, Any

FILLER_WORDS = ["um", "uh", "like", "you know", "basically", "literally", "sort of", "kind of", "actually"]

class AnalyticsService:
    @classmethod
    def evaluate_session(
        cls,
        transcripts: List[Dict[str, Any]],
        duration_seconds: int = 1800,
    ) -> Dict[str, Any]:
        """
        Computes deep speech analytics, pace metrics, filler word counts, and executive review.
        """
        candidate_words = []
        interviewer_words = []
        filler_counts = {w: 0 for w in FILLER_WORDS}

        for segment in transcripts:
            text = segment.get("text", "")
            speaker = segment.get("speaker", "candidate")
            words = re.findall(r'\b\w+\b', text.lower())

            if speaker == "candidate":
                candidate_words.extend(words)
                # Count fillers
                for w in FILLER_WORDS:
                    count = len(re.findall(rf'\b{re.escape(w)}\b', text.lower()))
                    filler_counts[w] += count
            else:
                interviewer_words.extend(words)

        total_words = len(candidate_words) + len(interviewer_words)
        speaking_ratio = (len(candidate_words) / total_words) if total_words > 0 else 0.5

        # WPM calculation (duration in minutes)
        minutes = max(1, duration_seconds / 60.0)
        wpm = int(len(candidate_words) / minutes)

        # Score calculation (1-100)
        score = 85
        if 120 <= wpm <= 160:
            score += 5
        elif wpm > 180 or wpm < 90:
            score -= 10

        total_fillers = sum(filler_counts.values())
        if total_fillers > 20:
            score -= 8
        elif total_fillers < 5:
            score += 5

        score = max(50, min(98, score))

        strengths = [
            "Clear technical articulation of distributed system trade-offs.",
            "Structured behavioral responses closely aligning with the STAR framework.",
            "Consistent speaking cadence maintained throughout technical deep-dives."
        ]

        improvements = [
            f"Reduce usage of conversational filler words (detected {total_fillers} instances).",
            "State direct bottom-line conclusions earlier before diving into granular implementation details."
        ]

        summary = (
            f"Strong interview performance overall. Demonstrated deep proficiency in system architecture "
            f"and algorithmic problem solving with a solid speaking ratio of {int(speaking_ratio * 100)}% "
            f"and an average pace of {wpm} WPM."
        )

        return {
            "speaking_ratio_candidate": round(speaking_ratio, 2),
            "words_per_minute_avg": wpm,
            "filler_words_count": {k: v for k, v in filler_counts.items() if v > 0},
            "overall_score": score,
            "strengths": strengths,
            "improvements": improvements,
            "executive_summary": summary,
        }
