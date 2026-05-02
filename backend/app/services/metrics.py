"""Aggregate metric computation.

Output shape matches the frontend chart components in
`components/charts/*` and `lib/mock-data.ts`.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

CHART_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
]

# Minimal TLD → country mapping. PRD §15 (chart 4) accepts < 3 mappable as
# insufficient; we fall back to a flat list when that happens.
TLD_COUNTRY = {
    "uk": "GB", "co.uk": "GB",
    "de": "DE",
    "fr": "FR",
    "au": "AU", "com.au": "AU",
    "ca": "CA",
    "in": "IN", "co.in": "IN",
    "jp": "JP", "co.jp": "JP",
    "cn": "CN", "com.cn": "CN",
    "br": "BR", "com.br": "BR",
    "mx": "MX", "com.mx": "MX",
    "es": "ES", "it": "IT", "nl": "NL", "se": "SE", "no": "NO",
    "ru": "RU", "kr": "KR", "co.kr": "KR",
    "za": "ZA", "co.za": "ZA",
    "ie": "IE", "ch": "CH", "at": "AT", "be": "BE",
}

US_DOMAINS = {
    "nytimes.com", "washingtonpost.com", "wsj.com", "bloomberg.com",
    "cnbc.com", "cnn.com", "foxnews.com", "nbcnews.com", "abcnews.go.com",
    "espn.com", "yahoo.com", "forbes.com", "businessinsider.com",
    "reuters.com", "apnews.com", "axios.com", "techcrunch.com",
}


def _country_for_domain(domain: Optional[str]) -> Optional[str]:
    if not domain:
        return None
    if domain in US_DOMAINS or domain.endswith(".us") or domain.endswith(".gov"):
        return "US"
    parts = domain.split(".")
    if len(parts) >= 2:
        last_two = ".".join(parts[-2:])
        if last_two in TLD_COUNTRY:
            return TLD_COUNTRY[last_two]
    tld = parts[-1]
    if tld in TLD_COUNTRY:
        return TLD_COUNTRY[tld]
    return None


def _bucket_key(d: datetime, weekly: bool) -> Tuple[datetime, str]:
    d = d.astimezone(timezone.utc) if d.tzinfo else d.replace(tzinfo=timezone.utc)
    if weekly:
        # Monday of the week
        start = d - timedelta(days=d.weekday(), hours=d.hour, minutes=d.minute, seconds=d.second, microseconds=d.microsecond)
        label = start.strftime("%b %d")
        return start, label
    start = d.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    label = start.strftime("%b %Y")
    return start, label


def _slope(xs: List[float], ys: List[float]) -> float:
    n = len(xs)
    if n < 2:
        return 0.0
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    num = sum((xs[i] - mean_x) * (ys[i] - mean_y) for i in range(n))
    den = sum((xs[i] - mean_x) ** 2 for i in range(n))
    if den == 0:
        return 0.0
    return num / den


def compute_aggregates(
    *,
    brand: str,
    time_range: str,
    articles: List[Dict[str, Any]],
    pipeline_counts: Dict[str, int],
    confidence_threshold: float,
) -> Dict[str, Any]:
    """`articles` items: {title, url, source_domain, published_at (datetime|None),
    sentiment, confidence, scores, low_confidence}"""

    weekly = time_range in {"1m", "3m"}
    scored = [a for a in articles if a.get("sentiment") and not a.get("low_confidence")]
    total = len(scored)

    # ── Pie / summary distribution ─────────────────────────────
    pie_counts = Counter(a["sentiment"] for a in scored)
    positive = pie_counts.get("positive", 0)
    neutral = pie_counts.get("neutral", 0)
    negative = pie_counts.get("negative", 0)
    low_conf = sum(1 for a in articles if a.get("low_confidence"))

    pie_data = [
        {"label": "Positive", "value": positive, "color": "var(--chart-1)"},
        {"label": "Neutral", "value": neutral, "color": "var(--chart-2)"},
        {"label": "Negative", "value": negative, "color": "var(--chart-3)"},
    ]

    # ── Time bucketing ─────────────────────────────────────────
    buckets: Dict[datetime, Dict[str, Any]] = defaultdict(
        lambda: {"positive": 0, "neutral": 0, "negative": 0, "confs": [], "label": ""}
    )
    for a in scored:
        pub = a.get("published_at")
        if not pub:
            continue
        start, label = _bucket_key(pub, weekly)
        b = buckets[start]
        b["label"] = label
        b[a["sentiment"]] += 1
        b["confs"].append(a.get("confidence") or 0.0)

    sorted_buckets = sorted(buckets.items())

    area_data = []
    bar_data = []
    line_data = []
    candle_data = []
    for start, b in sorted_buckets:
        area_data.append({
            "date": start.isoformat(),
            "positive": b["positive"],
            "neutral": b["neutral"],
            "negative": b["negative"],
        })
        bar_data.append({
            "name": b["label"],
            "positive": b["positive"],
            "neutral": b["neutral"],
            "negative": b["negative"],
        })
        confs = b["confs"]
        if confs:
            line_data.append({"date": start.isoformat(), "confidence": sum(confs) / len(confs)})
            candle_data.append({
                "date": start.isoformat(),
                "open": confs[0],
                "close": confs[-1],
                "high": max(confs),
                "low": min(confs),
            })

    # ── Source breakdown ───────────────────────────────────────
    domain_counter: Counter = Counter()
    domain_sentiment: Dict[str, Counter] = defaultdict(Counter)
    for a in scored:
        d = a.get("source_domain") or "unknown"
        domain_counter[d] += 1
        domain_sentiment[d][a["sentiment"]] += 1

    top_domains = domain_counter.most_common(5)
    max_count = top_domains[0][1] if top_domains else 1

    ring_data = []
    for i, (domain, cnt) in enumerate(top_domains):
        ring_data.append({
            "label": domain,
            "value": cnt,
            "maxValue": max_count,
            "color": CHART_COLORS[i % len(CHART_COLORS)],
        })

    # ── Sankey: domain → sentiment ─────────────────────────────
    sankey_nodes = [{"name": d, "category": "source"} for d, _ in top_domains]
    sankey_nodes += [
        {"name": "Positive", "category": "outcome"},
        {"name": "Neutral", "category": "outcome"},
        {"name": "Negative", "category": "outcome"},
    ]
    pos_idx = len(top_domains)
    neu_idx = pos_idx + 1
    neg_idx = pos_idx + 2
    sankey_links = []
    for i, (domain, _) in enumerate(top_domains):
        s = domain_sentiment[domain]
        if s["positive"]:
            sankey_links.append({"source": i, "target": pos_idx, "value": s["positive"]})
        if s["neutral"]:
            sankey_links.append({"source": i, "target": neu_idx, "value": s["neutral"]})
        if s["negative"]:
            sankey_links.append({"source": i, "target": neg_idx, "value": s["negative"]})

    # ── Choropleth ─────────────────────────────────────────────
    country_counter: Counter = Counter()
    country_sentiment: Dict[str, Counter] = defaultdict(Counter)
    for a in scored:
        cc = _country_for_domain(a.get("source_domain"))
        if cc:
            country_counter[cc] += 1
            country_sentiment[cc][a["sentiment"]] += 1
    choropleth_data = []
    for cc, cnt in country_counter.most_common():
        s = country_sentiment[cc]
        dom = max(s.items(), key=lambda kv: kv[1])[0] if s else "neutral"
        choropleth_data.append({"countryCode": cc, "sentiment": dom, "count": cnt})
    choropleth_available = len(choropleth_data) >= 3

    # ── Funnel ─────────────────────────────────────────────────
    funnel_data = [
        {"label": "URLs Discovered", "value": pipeline_counts.get("urls_discovered", 0)},
        {"label": "Headlines Extracted", "value": pipeline_counts.get("headlines_extracted", 0)},
        {"label": "After Deduplication", "value": pipeline_counts.get("after_dedup", 0)},
        {"label": "Above Confidence Threshold", "value": total},
        {"label": "Included in Report", "value": total},
    ]

    # ── Top headlines ──────────────────────────────────────────
    by_conf = sorted(scored, key=lambda a: a.get("confidence") or 0, reverse=True)
    top_positive = [
        {"title": a["title"], "source": a.get("source_domain") or "", "confidence": a["confidence"]}
        for a in by_conf if a["sentiment"] == "positive"
    ][:5]
    top_negative = [
        {"title": a["title"], "source": a.get("source_domain") or "", "confidence": a["confidence"]}
        for a in by_conf if a["sentiment"] == "negative"
    ][:5]

    # ── Momentum ───────────────────────────────────────────────
    sentiment_value = {"positive": 1.0, "neutral": 0.0, "negative": -1.0}
    bucket_scores: List[float] = []
    for _, b in sorted_buckets:
        n = b["positive"] + b["neutral"] + b["negative"]
        if n == 0:
            continue
        avg = (b["positive"] - b["negative"]) / n
        bucket_scores.append(avg)
    if len(bucket_scores) >= 2:
        slope_val = _slope(list(range(len(bucket_scores))), bucket_scores)
        if slope_val > 0.02:
            momentum = "improving"
        elif slope_val < -0.02:
            momentum = "declining"
        else:
            momentum = "stable"
    else:
        momentum = "stable"

    # ── Radar ──────────────────────────────────────────────────
    avg_conf = (
        sum(a.get("confidence") or 0 for a in scored) / total if total else 0.0
    )
    most_recent = max((a.get("published_at") for a in scored if a.get("published_at")), default=None)
    if most_recent:
        if most_recent.tzinfo is None:
            most_recent = most_recent.replace(tzinfo=timezone.utc)
        days_old = (datetime.now(timezone.utc) - most_recent).days
        recency_score = max(0, 100 - days_old * 2)
    else:
        recency_score = 50
    radar_metrics = [
        {"key": "sentiment", "label": "Sentiment Score", "max": 100},
        {"key": "volume", "label": "Coverage Volume", "max": 100},
        {"key": "diversity", "label": "Source Diversity", "max": 100},
        {"key": "confidence", "label": "Confidence Level", "max": 100},
        {"key": "momentum", "label": "Sentiment Momentum", "max": 100},
        {"key": "recency", "label": "Recency", "max": 100},
    ]
    sentiment_score = round(((positive - negative) / total + 1) * 50) if total else 50
    volume_score = min(100, total * 2)
    diversity_score = min(100, len(domain_counter) * 8)
    confidence_score = round(avg_conf * 100)
    momentum_score = {"improving": 85, "stable": 55, "declining": 25}[momentum]
    radar_data = [
        {
            "label": brand,
            "color": "var(--chart-1)",
            "values": {
                "sentiment": sentiment_score,
                "volume": volume_score,
                "diversity": diversity_score,
                "confidence": confidence_score,
                "momentum": momentum_score,
                "recency": recency_score,
            },
        }
    ]

    return {
        "areaData": area_data,
        "barData": bar_data,
        "candlestickData": candle_data,
        "lineData": line_data,
        "pieData": pie_data,
        "ringData": ring_data,
        "sankeyData": {"nodes": sankey_nodes, "links": sankey_links},
        "choroplethData": choropleth_data if choropleth_available else [],
        "choroplethAvailable": choropleth_available,
        "funnelData": funnel_data,
        "radarMetrics": radar_metrics,
        "radarData": radar_data,
        "summary": {
            "positive": positive,
            "neutral": neutral,
            "negative": negative,
            "low_confidence": low_conf,
            "total": total,
            "momentum": momentum,
            "top_positive": top_positive,
            "top_negative": top_negative,
            "avg_confidence": avg_conf,
            "confidence_threshold": confidence_threshold,
            "unique_domains": len(domain_counter),
        },
    }
