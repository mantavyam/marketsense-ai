"""PDF report endpoint via WeasyPrint."""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import AnalysisRun, Article, Report
from app.schemas import PdfRequest

log = logging.getLogger(__name__)
router = APIRouter()

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
_jinja = Environment(
    loader=FileSystemLoader(str(TEMPLATE_DIR)),
    autoescape=select_autoescape(["html"]),
)

DEFAULT_SECTIONS = {
    "cover_page": True,
    "executive_summary": True,
    "pie_chart": True,
    "area_line_charts": True,
    "bar_chart": True,
    "candlestick_chart": True,
    "funnel_chart": True,
    "radar_chart": True,
    "choropleth_chart": True,
    "ring_sankey_charts": True,
    "full_report_text": True,
    "recommendations": True,
    "ai_executive_summary": True,
    "raw_data_table": False,
}

RANGE_LABELS = {"1m": "1 Month", "3m": "3 Months", "6m": "6 Months", "1y": "1 Year"}


def _split_report(report_text: str):
    sections = []
    current_heading = None
    current_paragraphs: list[str] = []
    for line in report_text.splitlines():
        if line.startswith("## "):
            if current_heading is not None:
                sections.append({"heading": current_heading, "paragraphs": [p for p in current_paragraphs if p.strip()]})
            current_heading = line[3:].strip()
            current_paragraphs = []
        elif line.strip():
            current_paragraphs.append(line.strip())
        else:
            current_paragraphs.append("")
    if current_heading is not None:
        sections.append({"heading": current_heading, "paragraphs": [p for p in current_paragraphs if p.strip()]})
    return sections


@router.post("/pdf/{run_id}")
async def generate_pdf(
    run_id: str,
    body: PdfRequest,
    session: AsyncSession = Depends(get_session),
):
    try:
        from weasyprint import HTML
    except Exception as exc:  # noqa: BLE001
        log.warning("WeasyPrint unavailable: %s", exc)
        raise HTTPException(
            status_code=501,
            detail="PDF generation unavailable on this server (WeasyPrint not installed).",
        )

    run = await session.get(AnalysisRun, run_id)
    if not run or run.status == "deleted":
        raise HTTPException(status_code=404, detail="Run not found")
    result = await session.execute(select(Report).where(Report.run_id == run_id))
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not yet available")

    art_result = await session.execute(select(Article).where(Article.run_id == run_id))
    articles = art_result.scalars().all()

    sections = {**DEFAULT_SECTIONS, **(body.sections or {})}

    aggregate = report.aggregate_data
    summary = aggregate.get("summary", {})
    total = summary.get("total") or 1
    pos_pct = round((summary.get("positive", 0) / total) * 100)
    neu_pct = round((summary.get("neutral", 0) / total) * 100)
    neg_pct = 100 - pos_pct - neu_pct

    report_sections = _split_report(report.report_text)
    exec_section = next((s for s in report_sections if s["heading"].lower().startswith("executive")), None)
    exec_paragraphs = exec_section["paragraphs"] if exec_section else []

    template = _jinja.get_template("report.html")
    html = template.render(
        brand=run.brand_name,
        range_label=RANGE_LABELS.get(run.time_range, run.time_range),
        run_date=run.created_at.date().isoformat(),
        article_count=len(articles),
        sections=sections,
        chart_svgs=body.chart_svgs or {},
        aggregate=aggregate,
        summary=summary,
        pos_pct=pos_pct,
        neu_pct=neu_pct,
        neg_pct=neg_pct,
        report_sections=report_sections,
        exec_paragraphs=exec_paragraphs,
        articles=articles,
    )

    pdf_bytes = HTML(string=html).write_pdf()
    filename = f"MarketSense_{run.brand_name}_{run.created_at.date().isoformat()}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
