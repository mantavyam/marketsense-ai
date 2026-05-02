from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SentimentSummary(BaseModel):
    positive: int
    neutral: int
    negative: int


class RunListItem(BaseModel):
    id: str
    brand_name: str
    time_range: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    status: str
    news_source_used: Optional[str] = None
    article_count: Optional[int] = None
    failure_stage: Optional[str] = None
    failure_message: Optional[str] = None
    sentiment: Optional[SentimentSummary] = None


class RunDetail(RunListItem):
    article_cap: int
    confidence_threshold: float
    include_domains: Optional[List[str]] = None
    exclude_domains: Optional[List[str]] = None
    report_model_id: Optional[str] = None


class ReportResponse(BaseModel):
    run_id: str
    brand_name: str
    time_range: str
    article_count: int
    run_date: str
    report_text: str
    aggregate_data: Dict[str, Any]
    report_model_id: Optional[str] = None


class PdfRequest(BaseModel):
    sections: Dict[str, bool] = Field(default_factory=dict)
    chart_svgs: Dict[str, str] = Field(default_factory=dict)
