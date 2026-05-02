"""Report generation via OpenRouter with deterministic template fallback."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional, Tuple

import httpx

from app.config import settings

log = logging.getLogger(__name__)

FALLBACK_MODEL = "mistralai/mistral-7b-instruct:free"
SECTIONS = [
    "Executive Summary",
    "Overall Sentiment Overview",
    "Sentiment Trend Analysis",
    "Source-by-Source Breakdown",
    "Top Positive Coverage",
    "Top Negative Coverage",
    "Risk Assessment",
    "Strategic Recommendations",
    "Conclusion",
]

RANGE_LABELS = {"1m": "1 Month", "3m": "3 Months", "6m": "6 Months", "1y": "1 Year"}


def _build_prompt(brand: str, time_range: str, aggregates: Dict[str, Any]) -> str:
    summary = aggregates["summary"]
    top_pos = "\n".join(
        f"- {a['title']} ({a['source']}, conf {a['confidence']:.2f})"
        for a in summary["top_positive"]
    ) or "- (none)"
    top_neg = "\n".join(
        f"- {a['title']} ({a['source']}, conf {a['confidence']:.2f})"
        for a in summary["top_negative"]
    ) or "- (none)"

    sources = "\n".join(
        f"- {r['label']}: {r['value']} articles" for r in aggregates["ringData"]
    ) or "- (none)"

    sections_block = "\n".join(f"## {s}" for s in SECTIONS)

    return f"""You are a professional brand reputation analyst. Produce a structured sentiment analysis report based STRICTLY on the data below. Use plain prose under each heading. No nested markdown tables, no code fences. Keep section headers exactly as listed.

Brand: {brand}
Time Range: {RANGE_LABELS.get(time_range, time_range)}
Articles Analysed: {summary['total']} (low-confidence excluded: {summary['low_confidence']})
Sentiment Distribution: positive={summary['positive']}, neutral={summary['neutral']}, negative={summary['negative']}
Average Confidence: {summary['avg_confidence']:.2f}
Momentum: {summary['momentum']}
Unique Source Domains: {summary['unique_domains']}

Top Positive Headlines:
{top_pos}

Top Negative Headlines:
{top_neg}

Source Volume (top 5):
{sources}

Use exactly these section headers in this order:

{sections_block}

Begin the report now.
"""


async def _select_free_model() -> str:
    """Pick the highest context-length OpenRouter free model."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {settings.openrouter_api_key}"} if settings.openrouter_api_key else {},
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
        free = [
            m for m in data
            if (m.get("pricing") or {}).get("prompt") in ("0", 0, "0.0")
            and (m.get("pricing") or {}).get("completion") in ("0", 0, "0.0")
        ]
        if not free:
            return FALLBACK_MODEL
        free.sort(key=lambda m: m.get("context_length") or 0, reverse=True)
        return free[0]["id"]
    except Exception as exc:  # noqa: BLE001
        log.warning("OpenRouter model listing failed: %s", exc)
        return FALLBACK_MODEL


async def _call_openrouter(model: str, prompt: str) -> Optional[str]:
    if not settings.openrouter_api_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://marketsense.local",
                    "X-Title": "MarketSense",
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.4,
                },
            )
            if resp.status_code != 200:
                log.warning("OpenRouter %s returned %s: %s", model, resp.status_code, resp.text[:200])
                return None
            data = resp.json()
        choices = data.get("choices") or []
        if not choices:
            return None
        return (choices[0].get("message") or {}).get("content")
    except Exception as exc:  # noqa: BLE001
        log.warning("OpenRouter call failed: %s", exc)
        return None


def _template_report(brand: str, time_range: str, aggregates: Dict[str, Any]) -> str:
    s = aggregates["summary"]
    total = s["total"] or 1
    pos_pct = round(s["positive"] / total * 100)
    neu_pct = round(s["neutral"] / total * 100)
    neg_pct = round(s["negative"] / total * 100)
    range_label = RANGE_LABELS.get(time_range, time_range)
    momentum = s["momentum"]

    top_pos_lines = "\n".join(
        f"{i + 1}. \"{a['title']}\" — {a['source']} (confidence {a['confidence']:.2f})"
        for i, a in enumerate(s["top_positive"])
    ) or "No high-confidence positive coverage was found in this period."
    top_neg_lines = "\n".join(
        f"{i + 1}. \"{a['title']}\" — {a['source']} (confidence {a['confidence']:.2f})"
        for i, a in enumerate(s["top_negative"])
    ) or "No high-confidence negative coverage was found in this period."

    top_domain = aggregates["ringData"][0]["label"] if aggregates["ringData"] else "n/a"

    momentum_phrase = {
        "improving": "trending positively over the analysed window",
        "declining": "showing a deteriorating sentiment trajectory",
        "stable": "holding steady without a clear directional trend",
    }[momentum]

    return f"""## Executive Summary
Across {s['total']} confidence-filtered articles covering {brand} over the past {range_label.lower()}, sentiment is {momentum_phrase}. {pos_pct}% of coverage was positive, {neu_pct}% neutral, and {neg_pct}% negative. Average model confidence was {s['avg_confidence']:.2f}. {s['low_confidence']} additional articles were excluded as low-confidence.

## Overall Sentiment Overview
The dominant tone of media coverage for {brand} skews {('positive' if pos_pct >= max(neu_pct, neg_pct) else 'negative' if neg_pct >= neu_pct else 'neutral')}. Coverage was sourced from {s['unique_domains']} distinct domains, indicating {('broad' if s['unique_domains'] >= 8 else 'concentrated')} attention across the news landscape.

## Sentiment Trend Analysis
Time-bucketed scores indicate momentum is {momentum}. Bucket-level distribution is rendered in the area, bar, and line charts on the report dashboard.

## Source-by-Source Breakdown
The most active outlet covering {brand} in this window was {top_domain}. The full source-to-sentiment flow is rendered in the Sankey diagram on the dashboard.

## Top Positive Coverage
{top_pos_lines}

## Top Negative Coverage
{top_neg_lines}

## Risk Assessment
{"Coverage skew is broadly favourable; reputational risk in this window is low." if pos_pct > neg_pct + 10 else "Coverage carries a meaningful negative component; monitor for amplification of critical narratives." if neg_pct > pos_pct else "Coverage is mixed; sentiment is contested and warrants ongoing monitoring."}

## Strategic Recommendations
1. Sustain narratives appearing in top-positive coverage to anchor the brand story.
2. Prepare proactive responses to themes appearing in top-negative coverage.
3. Track sentiment momentum on the next analysis cycle to confirm direction.

## Conclusion
{brand}'s sentiment profile across the analysis period reflects a {momentum} trajectory. The full quantitative breakdown is available in the visualisation layer of this report.
"""


async def generate_report(
    brand: str,
    time_range: str,
    aggregates: Dict[str, Any],
) -> Tuple[str, Optional[str]]:
    """Returns (report_text, model_id_or_None)."""
    if not settings.openrouter_api_key:
        return _template_report(brand, time_range, aggregates), None

    prompt = _build_prompt(brand, time_range, aggregates)
    model = await _select_free_model()

    text = await _call_openrouter(model, prompt)
    if not text and model != FALLBACK_MODEL:
        text = await _call_openrouter(FALLBACK_MODEL, prompt)
        if text:
            model = FALLBACK_MODEL

    if not text:
        return _template_report(brand, time_range, aggregates), None

    return text.strip(), model
