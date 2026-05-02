"""End-to-end analysis pipeline.

Yields SSE-shaped dict events per PRD §8/§9/§10/§11. The /analyze endpoint
serialises these as Server-Sent Events for the frontend.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, List, Optional

from sqlalchemy import select

from app.db import session_scope
from app.models import AnalysisRun, Article, Report
from app.services import sentiment as sentiment_svc
from app.services.metrics import compute_aggregates
from app.services.news import Headline, discover_headlines
from app.services.processing import clean_and_dedupe
from app.services.report import generate_report

log = logging.getLogger(__name__)

DEFAULT_CAPS = {"1m": 20, "3m": 40, "6m": 70, "1y": 100}


def _event(stage: str, status: str, **extra) -> Dict[str, Any]:
    return {"stage": stage, "status": status, **extra}


async def _persist_failure(run_id: str, stage: str, message: str) -> None:
    async with session_scope() as session:
        run = await session.get(AnalysisRun, run_id)
        if run:
            run.status = "failed"
            run.failure_stage = stage
            run.failure_message = message
            run.completed_at = datetime.now(timezone.utc)


async def run_analysis(
    *,
    run_id: str,
    brand: str,
    time_range: str,
    article_cap: Optional[int] = None,
    confidence_threshold: float = 0.55,
    include_domains: Optional[List[str]] = None,
    exclude_domains: Optional[List[str]] = None,
) -> AsyncIterator[Dict[str, Any]]:
    cap = article_cap or DEFAULT_CAPS.get(time_range, 40)

    # ── News discovery ─────────────────────────────────────────
    yield _event("news_discovery", "started", message="Identifying best news source...")
    try:
        headlines, source_used = await discover_headlines(brand, time_range, cap)
    except Exception as exc:  # noqa: BLE001
        log.exception("News discovery error")
        await _persist_failure(run_id, "news_discovery", str(exc))
        yield _event("news_discovery", "error", message=str(exc))
        return

    if not headlines:
        msg = "All news sources are rate-limited or returned no results for this brand and time range."
        await _persist_failure(run_id, "news_discovery", msg)
        yield _event("news_discovery", "error", message=msg)
        return

    async with session_scope() as session:
        run = await session.get(AnalysisRun, run_id)
        if run:
            run.news_source_used = source_used

    yield _event("news_discovery", "complete", message=f"Using {source_used}", source=source_used)

    # ── URL collection (synthetic from headlines list) ─────────
    yield _event("url_collection", "complete", message=f"{len(headlines)} URLs collected")

    # ── Extraction (headline-only; no fetch needed) ────────────
    yield _event("extraction", "progress", current=len(headlines), total=len(headlines))
    yield _event(
        "extraction",
        "complete",
        message=f"{len(headlines)} headlines extracted",
    )

    # ── Processing / dedupe ────────────────────────────────────
    yield _event("processing", "started", message="Processing and formatting headlines...")
    cleaned = clean_and_dedupe(
        headlines,
        include_domains=include_domains,
        exclude_domains=exclude_domains,
    )
    cleaned = cleaned[:cap]
    if not cleaned:
        msg = "Insufficient articles after cleaning. The brand may have limited news coverage in the selected time range."
        await _persist_failure(run_id, "processing", msg)
        yield _event("processing", "error", message=msg)
        return
    yield _event(
        "processing",
        "complete",
        message=f"{len(cleaned)} unique headlines ready for analysis",
    )

    # ── Sentiment scoring ──────────────────────────────────────
    if not sentiment_svc.is_loaded():
        try:
            await asyncio.to_thread(sentiment_svc.load_model)
        except Exception as exc:  # noqa: BLE001
            await _persist_failure(run_id, "sentiment", str(exc))
            yield _event("sentiment", "error", message=str(exc))
            return

    yield _event("sentiment", "started", message="Running sentiment analysis...")

    scored_articles: List[Dict[str, Any]] = []
    total = len(cleaned)
    for i, h in enumerate(cleaned):
        result = await asyncio.to_thread(sentiment_svc.score_one, h.title)
        if not result:
            continue
        low_conf = result.confidence < confidence_threshold
        record: Dict[str, Any] = {
            "id": str(uuid.uuid4()),
            "title": h.title,
            "url": h.url,
            "source_domain": h.source_domain,
            "published_at": h.published_at,
            "sentiment": result.sentiment,
            "confidence": result.confidence,
            "scores": result.scores,
            "low_confidence": low_conf,
        }
        scored_articles.append(record)

        yield _event(
            "sentiment",
            "progress",
            current=i + 1,
            total=total,
            latest={
                "title": h.title,
                "sentiment": result.sentiment,
                "confidence": result.confidence,
            },
        )

    pie_pos = sum(1 for a in scored_articles if a["sentiment"] == "positive" and not a["low_confidence"])
    pie_neu = sum(1 for a in scored_articles if a["sentiment"] == "neutral" and not a["low_confidence"])
    pie_neg = sum(1 for a in scored_articles if a["sentiment"] == "negative" and not a["low_confidence"])
    pie_low = sum(1 for a in scored_articles if a["low_confidence"])
    yield _event(
        "sentiment",
        "complete",
        summary={"positive": pie_pos, "neutral": pie_neu, "negative": pie_neg, "low_confidence": pie_low},
    )

    # Persist articles
    async with session_scope() as session:
        for a in scored_articles:
            session.add(
                Article(
                    id=a["id"],
                    run_id=run_id,
                    title=a["title"],
                    url=a["url"],
                    source_domain=a["source_domain"],
                    published_at=a["published_at"],
                    sentiment=a["sentiment"],
                    confidence=a["confidence"],
                    scores=a["scores"],
                    low_confidence=a["low_confidence"],
                )
            )

    # ── Aggregate metrics + report ─────────────────────────────
    aggregates = compute_aggregates(
        brand=brand,
        time_range=time_range,
        articles=scored_articles,
        pipeline_counts={
            "urls_discovered": len(headlines),
            "headlines_extracted": len(headlines),
            "after_dedup": len(cleaned),
        },
        confidence_threshold=confidence_threshold,
    )

    yield _event(
        "report_generation",
        "started",
        message="Generating report...",
    )
    try:
        report_text, model_id = await generate_report(brand, time_range, aggregates)
    except Exception as exc:  # noqa: BLE001
        log.exception("Report generation error")
        await _persist_failure(run_id, "report_generation", str(exc))
        yield _event("report_generation", "error", message=str(exc))
        return

    async with session_scope() as session:
        run = await session.get(AnalysisRun, run_id)
        if run:
            run.report_model_id = model_id
            run.status = "complete"
            run.completed_at = datetime.now(timezone.utc)
        session.add(
            Report(
                id=str(uuid.uuid4()),
                run_id=run_id,
                report_text=report_text,
                aggregate_data=aggregates,
            )
        )

    yield _event(
        "report_generation",
        "complete",
        message="Report ready" + (f" (model: {model_id})" if model_id else " (template fallback)"),
    )

    yield _event("run_complete", "complete", run_id=run_id, redirect=f"/report/{run_id}")
