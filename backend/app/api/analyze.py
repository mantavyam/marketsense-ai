"""Analyze endpoint — SSE stream of pipeline events."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import AsyncIterator, Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sse_starlette.sse import EventSourceResponse

from app.db import session_scope
from app.models import AnalysisRun
from app.services.pipeline import DEFAULT_CAPS, run_analysis

log = logging.getLogger(__name__)
router = APIRouter()


def _csv_to_list(s: Optional[str]) -> Optional[list[str]]:
    if not s:
        return None
    items = [x.strip() for x in s.split(",") if x.strip()]
    return items or None


@router.get("/analyze")
async def analyze(
    brand: str = Query(..., min_length=1),
    range: str = Query(..., pattern="^(1m|3m|6m|1y)$"),
    article_cap: Optional[int] = Query(None, ge=1, le=500),
    confidence_threshold: float = Query(0.55, ge=0.0, le=1.0),
    include_domains: Optional[str] = Query(None),
    exclude_domains: Optional[str] = Query(None),
):
    # Concurrency guard — auth deferred so this is a global lock.
    async with session_scope() as session:
        existing = await session.execute(
            select(AnalysisRun).where(AnalysisRun.status == "running")
        )
        if existing.scalars().first():
            raise HTTPException(status_code=409, detail="A run is already in progress")

        run_id = str(uuid.uuid4())
        cap = article_cap or DEFAULT_CAPS.get(range, 40)
        run = AnalysisRun(
            id=run_id,
            brand_name=brand,
            time_range=range,
            article_cap=cap,
            confidence_threshold=confidence_threshold,
            include_domains=_csv_to_list(include_domains),
            exclude_domains=_csv_to_list(exclude_domains),
            status="running",
        )
        session.add(run)

    async def event_stream() -> AsyncIterator[dict]:
        try:
            async for evt in run_analysis(
                run_id=run_id,
                brand=brand,
                time_range=range,
                article_cap=cap,
                confidence_threshold=confidence_threshold,
                include_domains=_csv_to_list(include_domains),
                exclude_domains=_csv_to_list(exclude_domains),
            ):
                yield {"event": "message", "data": json.dumps(evt)}
        except asyncio.CancelledError:
            log.info("Client disconnected from /analyze run %s", run_id)
            raise
        except Exception as exc:  # noqa: BLE001
            log.exception("Pipeline error for run %s", run_id)
            async with session_scope() as session:
                run = await session.get(AnalysisRun, run_id)
                if run and run.status == "running":
                    run.status = "failed"
                    run.failure_stage = "pipeline"
                    run.failure_message = str(exc)
            yield {"event": "message", "data": json.dumps({"stage": "pipeline", "status": "error", "message": str(exc)})}

    return EventSourceResponse(event_stream())
