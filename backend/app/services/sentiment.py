"""FinBERT sentiment scorer.

Loaded once at FastAPI startup; held module-level for the process lifetime.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional

from app.config import settings

log = logging.getLogger(__name__)

_pipeline = None  # type: ignore[assignment]


@dataclass
class SentimentResult:
    sentiment: str  # positive | neutral | negative
    confidence: float
    scores: Dict[str, float]


def load_model() -> None:
    """Eagerly load FinBERT into memory. Safe to call multiple times."""
    global _pipeline
    if _pipeline is not None:
        return

    from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline

    cache_kwargs = {}
    if settings.transformers_cache:
        cache_kwargs["cache_dir"] = settings.transformers_cache

    log.info("Loading sentiment model: %s", settings.sentiment_model_name)
    tokenizer = AutoTokenizer.from_pretrained(settings.sentiment_model_name, **cache_kwargs)
    model = AutoModelForSequenceClassification.from_pretrained(
        settings.sentiment_model_name, **cache_kwargs
    )
    _pipeline = pipeline(
        "text-classification",
        model=model,
        tokenizer=tokenizer,
        top_k=None,
        truncation=True,
        max_length=512,
    )
    log.info("Sentiment model ready")


def is_loaded() -> bool:
    return _pipeline is not None


def _normalise_label(label: str) -> str:
    label = label.lower()
    if label in {"positive", "neutral", "negative"}:
        return label
    return label


def score_one(text: str) -> Optional[SentimentResult]:
    if not _pipeline:
        return None
    try:
        raw = _pipeline(text)[0]  # list of {label, score}
    except Exception as exc:  # noqa: BLE001
        log.warning("Sentiment scoring failed: %s", exc)
        return None

    scores = {_normalise_label(item["label"]): float(item["score"]) for item in raw}
    for k in ("positive", "neutral", "negative"):
        scores.setdefault(k, 0.0)
    winner = max(scores.items(), key=lambda kv: kv[1])
    return SentimentResult(sentiment=winner[0], confidence=winner[1], scores=scores)


def score_batch(texts: List[str]) -> List[Optional[SentimentResult]]:
    return [score_one(t) for t in texts]
