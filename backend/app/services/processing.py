"""Headline cleaning, dedupe, and domain filtering."""

from __future__ import annotations

import html
import re
import string
from typing import List, Optional, Sequence

from app.services.news import Headline


_PUNCT_RE = re.compile(rf"[{re.escape(string.punctuation)}]")
_WS_RE = re.compile(r"\s+")


def _normalise(title: str) -> str:
    decoded = html.unescape(title)
    decoded = decoded.encode("ascii", errors="ignore").decode()
    cleaned = _PUNCT_RE.sub(" ", decoded.lower())
    return _WS_RE.sub(" ", cleaned).strip()


def _truncate_for_finbert(text: str, max_chars: int = 1800) -> str:
    # FinBERT tokeniser caps at 512 tokens; ~1.5KB of chars is safe.
    return text[:max_chars]


def _domain_allowed(
    domain: Optional[str],
    include: Optional[Sequence[str]],
    exclude: Optional[Sequence[str]],
) -> bool:
    if include:
        if not domain:
            return False
        if not any(allow.lower() in domain for allow in include):
            return False
    if exclude and domain:
        if any(block.lower() in domain for block in exclude):
            return False
    return True


def clean_and_dedupe(
    headlines: List[Headline],
    *,
    include_domains: Optional[Sequence[str]] = None,
    exclude_domains: Optional[Sequence[str]] = None,
) -> List[Headline]:
    seen: set[str] = set()
    out: List[Headline] = []
    for h in headlines:
        if not _domain_allowed(h.source_domain, include_domains, exclude_domains):
            continue
        cleaned_title = html.unescape(h.title).encode("ascii", errors="ignore").decode().strip()
        if not cleaned_title:
            continue
        cleaned_title = _truncate_for_finbert(cleaned_title)
        key = _normalise(cleaned_title)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(
            Headline(
                title=cleaned_title,
                url=h.url,
                source_domain=h.source_domain,
                published_at=h.published_at,
            )
        )
    return out
