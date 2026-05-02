// API client for the FastAPI backend.
// Auth is intentionally absent at this stage — endpoints are anonymous.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

// ── Shared types ────────────────────────────────────────────────────────────

export type RunStatus = "pending" | "running" | "complete" | "failed" | "deleted";

export interface SentimentSummary {
  positive: number;
  neutral: number;
  negative: number;
}

export interface RunListItem {
  id: string;
  brand_name: string;
  time_range: "1m" | "3m" | "6m" | "1y";
  created_at: string;
  completed_at: string | null;
  status: RunStatus;
  news_source_used: string | null;
  article_count: number | null;
  failure_stage: string | null;
  failure_message: string | null;
  sentiment: SentimentSummary | null;
}

export interface RunDetail extends RunListItem {
  article_cap: number;
  confidence_threshold: number;
  include_domains: string[] | null;
  exclude_domains: string[] | null;
  report_model_id: string | null;
}

export interface AggregateData {
  areaData: Array<{ date: string; positive: number; neutral: number; negative: number }>;
  barData: Array<{ name: string; positive: number; neutral: number; negative: number }>;
  candlestickData: Array<{ date: string; open: number; close: number; high: number; low: number }>;
  lineData: Array<{ date: string; confidence: number }>;
  pieData: Array<{ label: string; value: number; color: string }>;
  ringData: Array<{ label: string; value: number; maxValue: number; color: string }>;
  sankeyData: {
    nodes: Array<{ name: string; category: "source" | "outcome" }>;
    links: Array<{ source: number; target: number; value: number }>;
  };
  choroplethData: Array<{ countryCode: string; sentiment: string; count: number }>;
  choroplethAvailable: boolean;
  funnelData: Array<{ label: string; value: number }>;
  radarMetrics: Array<{ key: string; label: string; max: number }>;
  radarData: Array<{ label: string; color: string; values: Record<string, number> }>;
  summary: {
    positive: number;
    neutral: number;
    negative: number;
    low_confidence: number;
    total: number;
    momentum: "improving" | "stable" | "declining";
    top_positive: Array<{ title: string; source: string; confidence: number }>;
    top_negative: Array<{ title: string; source: string; confidence: number }>;
    avg_confidence: number;
    confidence_threshold: number;
    unique_domains: number;
  };
}

export interface ReportResponse {
  run_id: string;
  brand_name: string;
  time_range: "1m" | "3m" | "6m" | "1y";
  article_count: number;
  run_date: string;
  report_text: string;
  aggregate_data: AggregateData;
  report_model_id: string | null;
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function listRuns() {
  return request<RunListItem[]>("/runs");
}

export function getRun(runId: string) {
  return request<RunDetail>(`/runs/${runId}`);
}

export function deleteRun(runId: string) {
  return request<{ deleted: boolean }>(`/runs/${runId}`, { method: "DELETE" });
}

export function getReport(runId: string) {
  return request<ReportResponse>(`/reports/${runId}`);
}

export interface PdfRequestBody {
  sections: Record<string, boolean>;
  chart_svgs: Record<string, string>;
}

export async function downloadPdf(runId: string, body: PdfRequestBody) {
  const res = await fetch(`${API_BASE}/pdf/${runId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || res.statusText);
  }
  return res.blob();
}

// ── SSE for /analyze ────────────────────────────────────────────────────────

export interface AnalyzeQuery {
  brand: string;
  range: "1m" | "3m" | "6m" | "1y";
  article_cap?: number;
  confidence_threshold?: number;
  include_domains?: string;
  exclude_domains?: string;
}

export type SSEEvent =
  | { stage: string; status: "started" | "complete"; message?: string; source?: string }
  | { stage: "url_collection"; status: "progress" | "complete"; message?: string }
  | { stage: "extraction"; status: "progress" | "complete"; current?: number; total?: number; message?: string }
  | {
      stage: "sentiment";
      status: "started" | "progress" | "complete";
      current?: number;
      total?: number;
      latest?: { title: string; sentiment: "positive" | "neutral" | "negative"; confidence: number };
      summary?: { positive: number; neutral: number; negative: number; low_confidence: number };
      message?: string;
    }
  | { stage: "run_complete"; status: "complete"; run_id: string; redirect: string }
  | { stage: string; status: "error"; message: string };

export function buildAnalyzeUrl(q: AnalyzeQuery): string {
  const params = new URLSearchParams();
  params.set("brand", q.brand);
  params.set("range", q.range);
  if (q.article_cap != null) params.set("article_cap", String(q.article_cap));
  if (q.confidence_threshold != null)
    params.set("confidence_threshold", String(q.confidence_threshold));
  if (q.include_domains) params.set("include_domains", q.include_domains);
  if (q.exclude_domains) params.set("exclude_domains", q.exclude_domains);
  return `${API_BASE}/analyze?${params.toString()}`;
}
