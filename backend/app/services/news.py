"""News headline discovery.

Returns a list of headline records from the first source that yields results.
Headlines are the only field needed downstream (PRD §8.3).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from urllib.parse import quote_plus, urlparse

import feedparser
import httpx

from app.config import settings

log = logging.getLogger(__name__)

TIME_RANGE_DAYS = {"1m": 30, "3m": 90, "6m": 180, "1y": 365}


@dataclass
class Headline:
    title: str
    url: Optional[str]
    source_domain: Optional[str]
    published_at: Optional[datetime]


def _domain_from_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    try:
        netloc = urlparse(url).netloc.lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]
        return netloc or None
    except Exception:
        return None


def _within_range(published: Optional[datetime], days: int) -> bool:
    if not published:
        return True  # keep when we cannot parse the date
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    if published.tzinfo is None:
        published = published.replace(tzinfo=timezone.utc)
    return published >= cutoff


# ── Google News RSS (no API key required) ──────────────────────────────────


def fetch_google_news_rss(query: str, days: int, limit: int) -> List[Headline]:
    encoded = quote_plus(f"{query} when:{days}d")
    url = f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en"
    parsed = feedparser.parse(url)
    out: List[Headline] = []
    for entry in parsed.entries[: limit * 2]:
        title = (entry.get("title") or "").strip()
        if not title:
            continue
        link = entry.get("link")
        published = None
        if entry.get("published_parsed"):
            try:
                published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            except Exception:
                published = None
        # Google News titles often end with " - Source"
        source = None
        if " - " in title:
            head, _, tail = title.rpartition(" - ")
            if head and tail and len(tail) <= 60:
                title = head.strip()
                source = tail.strip()
        # Prefer the trailing source when the link is a Google News redirector
        link_domain = _domain_from_url(link)
        is_redirector = link_domain in {"news.google.com", "google.com"}
        source_domain_guess = source.lower().replace(" ", "") + ".com" if source else None
        domain = source_domain_guess if is_redirector and source_domain_guess else (link_domain or source_domain_guess)
        out.append(Headline(title=title, url=link, source_domain=domain, published_at=published))
    return out


# ── GNews API ──────────────────────────────────────────────────────────────


async def fetch_gnews_api(query: str, days: int, limit: int) -> List[Headline]:
    if not settings.gnews_api_key:
        return []
    frm = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    params = {
        "q": query,
        "lang": "en",
        "max": min(limit, 100),
        "from": frm,
        "apikey": settings.gnews_api_key,
        "sortby": "publishedAt",
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get("https://gnews.io/api/v4/search", params=params)
        if resp.status_code == 429:
            log.warning("GNews rate-limited; falling back")
            return []
        resp.raise_for_status()
        data = resp.json()
    out: List[Headline] = []
    for item in data.get("articles", []):
        title = (item.get("title") or "").strip()
        if not title:
            continue
        url_ = item.get("url")
        pub = item.get("publishedAt")
        published = None
        if pub:
            try:
                published = datetime.fromisoformat(pub.replace("Z", "+00:00"))
            except Exception:
                published = None
        source_name = (item.get("source") or {}).get("name")
        domain = _domain_from_url(url_) or (source_name.lower().replace(" ", "") + ".com" if source_name else None)
        out.append(Headline(title=title, url=url_, source_domain=domain, published_at=published))
    return out


# ── NewsAPI.org ────────────────────────────────────────────────────────────


async def fetch_newsapi(query: str, days: int, limit: int) -> List[Headline]:
    if not settings.newsapi_key:
        return []
    days = min(days, 30)  # Free tier limited to 1 month
    frm = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    params = {
        "q": query,
        "language": "en",
        "pageSize": min(limit, 100),
        "from": frm,
        "sortBy": "publishedAt",
        "apiKey": settings.newsapi_key,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get("https://newsapi.org/v2/everything", params=params)
        if resp.status_code == 429:
            log.warning("NewsAPI rate-limited")
            return []
        resp.raise_for_status()
        data = resp.json()
    out: List[Headline] = []
    for item in data.get("articles", []):
        title = (item.get("title") or "").strip()
        if not title:
            continue
        url_ = item.get("url")
        pub = item.get("publishedAt")
        published = None
        if pub:
            try:
                published = datetime.fromisoformat(pub.replace("Z", "+00:00"))
            except Exception:
                published = None
        source_name = (item.get("source") or {}).get("name")
        domain = _domain_from_url(url_) or (source_name.lower().replace(" ", "") + ".com" if source_name else None)
        out.append(Headline(title=title, url=url_, source_domain=domain, published_at=published))
    return out


# ── Discovery orchestration ────────────────────────────────────────────────


def _query_variants(brand: str) -> List[str]:
    return [brand.strip(), f'"{brand.strip()}"']


async def discover_headlines(
    brand: str,
    time_range: str,
    article_cap: int,
) -> Tuple[List[Headline], str]:
    """Return (headlines, source_used). Tries paid APIs first when keys exist,
    then falls back to Google News RSS which has no key requirement."""

    days = TIME_RANGE_DAYS.get(time_range, 90)
    all_headlines: List[Headline] = []

    sources_to_try: List[Tuple[str, callable]] = []
    if settings.gnews_api_key:
        sources_to_try.append(("gnews", lambda q: fetch_gnews_api(q, days, article_cap)))
    sources_to_try.append(("google_news_rss", lambda q: _async_wrap(fetch_google_news_rss, q, days, article_cap)))
    if settings.newsapi_key:
        sources_to_try.append(("newsapi", lambda q: fetch_newsapi(q, days, article_cap)))

    for name, fn in sources_to_try:
        try:
            for variant in _query_variants(brand):
                results = await fn(variant)
                all_headlines.extend(results)
                if len(all_headlines) >= article_cap:
                    break
            if all_headlines:
                # Filter by time range when published_at is known
                all_headlines = [h for h in all_headlines if _within_range(h.published_at, days)]
                if all_headlines:
                    return all_headlines, name
        except Exception as exc:  # noqa: BLE001
            log.warning("News source %s failed: %s", name, exc)
            continue

    return [], "none"


async def _async_wrap(sync_fn, *args, **kwargs):
    import asyncio

    return await asyncio.to_thread(sync_fn, *args, **kwargs)
