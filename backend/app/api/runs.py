"""Runs and reports CRUD endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import AnalysisRun, Article, Report
from app.schemas import ReportResponse, RunDetail, RunListItem, SentimentSummary

router = APIRouter()


async def _sentiment_summary(session: AsyncSession, run_id: str) -> SentimentSummary | None:
    result = await session.execute(
        select(Article.sentiment, func.count(Article.id))
        .where(Article.run_id == run_id, Article.low_confidence.is_(False))
        .group_by(Article.sentiment)
    )
    counts = {"positive": 0, "neutral": 0, "negative": 0}
    found = False
    for sentiment, n in result.all():
        if sentiment in counts:
            counts[sentiment] = n
            found = True
    if not found:
        return None
    return SentimentSummary(**counts)


async def _article_count(session: AsyncSession, run_id: str) -> int:
    result = await session.execute(
        select(func.count(Article.id)).where(Article.run_id == run_id)
    )
    return int(result.scalar() or 0)


@router.get("/runs", response_model=List[RunListItem])
async def list_runs(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(AnalysisRun)
        .where(AnalysisRun.status != "deleted")
        .order_by(desc(AnalysisRun.created_at))
    )
    runs = result.scalars().all()
    items: list[RunListItem] = []
    for r in runs:
        sentiment = await _sentiment_summary(session, r.id)
        cnt = await _article_count(session, r.id)
        items.append(
            RunListItem(
                id=r.id,
                brand_name=r.brand_name,
                time_range=r.time_range,
                created_at=r.created_at,
                completed_at=r.completed_at,
                status=r.status,
                news_source_used=r.news_source_used,
                article_count=cnt or None,
                failure_stage=r.failure_stage,
                failure_message=r.failure_message,
                sentiment=sentiment,
            )
        )
    return items


@router.get("/runs/{run_id}", response_model=RunDetail)
async def get_run(run_id: str, session: AsyncSession = Depends(get_session)):
    run = await session.get(AnalysisRun, run_id)
    if not run or run.status == "deleted":
        raise HTTPException(status_code=404, detail="Run not found")
    sentiment = await _sentiment_summary(session, run.id)
    cnt = await _article_count(session, run.id)
    return RunDetail(
        id=run.id,
        brand_name=run.brand_name,
        time_range=run.time_range,
        created_at=run.created_at,
        completed_at=run.completed_at,
        status=run.status,
        news_source_used=run.news_source_used,
        article_count=cnt or None,
        failure_stage=run.failure_stage,
        failure_message=run.failure_message,
        sentiment=sentiment,
        article_cap=run.article_cap,
        confidence_threshold=run.confidence_threshold,
        include_domains=run.include_domains,
        exclude_domains=run.exclude_domains,
        report_model_id=run.report_model_id,
    )


@router.delete("/runs/{run_id}")
async def delete_run(run_id: str, session: AsyncSession = Depends(get_session)):
    run = await session.get(AnalysisRun, run_id)
    if not run or run.status == "deleted":
        raise HTTPException(status_code=404, detail="Run not found")
    run.status = "deleted"
    await session.commit()
    return {"deleted": True}


@router.get("/reports/{run_id}", response_model=ReportResponse)
async def get_report(run_id: str, session: AsyncSession = Depends(get_session)):
    run = await session.get(AnalysisRun, run_id)
    if not run or run.status == "deleted":
        raise HTTPException(status_code=404, detail="Run not found")
    result = await session.execute(select(Report).where(Report.run_id == run_id))
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not yet available")
    cnt = await _article_count(session, run_id)
    return ReportResponse(
        run_id=run.id,
        brand_name=run.brand_name,
        time_range=run.time_range,
        article_count=cnt,
        run_date=run.created_at.date().isoformat(),
        report_text=report.report_text,
        aggregate_data=report.aggregate_data,
        report_model_id=run.report_model_id,
    )
