import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    brand_name: Mapped[str] = mapped_column(String, nullable=False)
    time_range: Mapped[str] = mapped_column(String, nullable=False)  # 1m | 3m | 6m | 1y
    article_cap: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.55)
    include_domains: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    exclude_domains: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)

    news_source_used: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    report_model_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    failure_stage: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    failure_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    articles: Mapped[List["Article"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    report: Mapped[Optional["Report"]] = relationship(back_populates="run", cascade="all, delete-orphan", uselist=False)


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(String, ForeignKey("analysis_runs.id"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_domain: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sentiment: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    scores: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    low_confidence: Mapped[bool] = mapped_column(Boolean, default=False)

    run: Mapped[AnalysisRun] = relationship(back_populates="articles")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(String, ForeignKey("analysis_runs.id"), unique=True, nullable=False)
    report_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    aggregate_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    run: Mapped[AnalysisRun] = relationship(back_populates="report")
