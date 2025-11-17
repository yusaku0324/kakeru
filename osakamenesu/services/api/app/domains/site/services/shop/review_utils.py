from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List

from app.schemas import ReviewItem, ReviewAspectScore


def _collect_review_aspect_stats(
    items: Iterable[ReviewItem],
) -> tuple[Dict[str, float], Dict[str, int]]:
    aspect_scores: Dict[str, List[int]] = defaultdict(list)
    for item in items:
        for key, data in (item.aspects or {}).items():
            score: int | float | None = None
            if isinstance(data, ReviewAspectScore):
                score = data.score
            elif isinstance(data, dict):
                raw = data.get("score")
                if isinstance(raw, (int, float)):
                    score = raw
            if isinstance(score, (int, float)):
                aspect_scores[key].append(int(score))

    aspect_averages = {
        key: round(sum(values) / len(values), 1)
        for key, values in aspect_scores.items()
        if values
    }
    aspect_counts = {
        key: len(values) for key, values in aspect_scores.items() if values
    }
    return aspect_averages, aspect_counts
