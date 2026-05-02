// ─── Mock Analysis Runs ─────────────────────────────────────────────────────

export type RunStatus = "complete" | "running" | "failed" | "pending";

export interface MockRun {
  id: string;
  brand_name: string;
  time_range: "1m" | "3m" | "6m" | "1y";
  created_at: string;
  completed_at?: string;
  status: RunStatus;
  news_source_used?: string;
  article_count?: number;
  failure_stage?: string;
  failure_message?: string;
  sentiment?: { positive: number; neutral: number; negative: number };
}

export const mockRuns: MockRun[] = [
  {
    id: "run-001",
    brand_name: "Nike",
    time_range: "3m",
    created_at: "2026-04-28T10:30:00Z",
    completed_at: "2026-04-28T10:35:22Z",
    status: "complete",
    news_source_used: "gnews",
    article_count: 42,
    sentiment: { positive: 28, neutral: 10, negative: 4 },
  },
  {
    id: "run-002",
    brand_name: "Tesla",
    time_range: "1m",
    created_at: "2026-04-25T14:00:00Z",
    completed_at: "2026-04-25T14:04:18Z",
    status: "complete",
    news_source_used: "gnews",
    article_count: 20,
    sentiment: { positive: 8, neutral: 5, negative: 7 },
  },
  {
    id: "run-003",
    brand_name: "Apple",
    time_range: "6m",
    created_at: "2026-04-20T09:15:00Z",
    completed_at: "2026-04-20T09:21:44Z",
    status: "complete",
    news_source_used: "newsapi",
    article_count: 68,
    sentiment: { positive: 45, neutral: 18, negative: 5 },
  },
  {
    id: "run-004",
    brand_name: "Amazon",
    time_range: "1y",
    created_at: "2026-04-15T16:45:00Z",
    completed_at: "2026-04-15T16:53:10Z",
    status: "complete",
    news_source_used: "gnews",
    article_count: 97,
    sentiment: { positive: 52, neutral: 30, negative: 15 },
  },
  {
    id: "run-005",
    brand_name: "OpenAI",
    time_range: "3m",
    created_at: "2026-05-01T11:00:00Z",
    status: "running",
    news_source_used: "gnews",
  },
  {
    id: "run-006",
    brand_name: "Meta",
    time_range: "1m",
    created_at: "2026-04-10T08:30:00Z",
    status: "failed",
    failure_stage: "news_discovery",
    failure_message: "All news sources rate-limited. Try again later.",
  },
];

// ─── Shared Time Buckets ─────────────────────────────────────────────────────

const weeks = [
  "Jan 20", "Jan 27", "Feb 3", "Feb 10", "Feb 17",
  "Feb 24", "Mar 3", "Mar 10", "Mar 17", "Mar 24",
  "Mar 31", "Apr 7",
];

// ─── Mock Report: Nike 3-Month Analysis ──────────────────────────────────────

export const mockReport = {
  run_id: "run-001",
  brand_name: "Nike",
  time_range: "3m",
  article_count: 42,
  run_date: "2026-04-28",
  report_text: `## Executive Summary
Nike's brand sentiment over the past 3 months demonstrates a markedly positive trajectory, driven by high-profile athlete signings, strong quarterly earnings, and sustained product innovation coverage. Of the 42 articles analyzed with sufficient confidence, 28 (67%) carried a positive sentiment label, 10 (24%) were neutral, and only 4 (9%) were negative. The overall sentiment momentum is improving, with the most recent two-week bucket showing the highest positive-to-negative ratio of the entire period.

## Overall Sentiment Overview
The dominant narrative across global sports and business media is one of brand strength and athlete alignment. The Caitlin Clark partnership generated the single largest burst of positive coverage in the dataset — 11 articles in a 72-hour window, with an average confidence of 0.89. Quarterly earnings beat expectations by 4%, generating additional positive financial coverage.

## Sentiment Trend Analysis
Weeks 1–4 (late January): Neutral-to-positive split, dominated by Super Bowl adjacent marketing coverage. Weeks 5–8 (February): Positive spike around athlete announcements. Weeks 9–12 (March–April): Sustained positive with a brief negative dip in week 10 related to a supply-chain story that ran on three outlets.

## Source-by-Source Breakdown
ESPN contributed the highest volume (9 articles, 89% positive). Reuters and AP provided balanced coverage with mixed sentiment. Bloomberg's articles focused on financials and skewed positive. The Guardian ran the two most negative pieces relating to labor practices.

## Top Positive Coverage
1. "Nike signs Caitlin Clark as newest signature athlete" — ESPN (confidence: 0.91)
2. "Nike Q3 earnings beat expectations, stock surges 6%" — Bloomberg (confidence: 0.88)
3. "Nike's Air Max 2026 launch breaks pre-order records" — SportsBusiness (confidence: 0.85)
4. "Nike named most innovative brand in sports tech for second year" — Fast Company (confidence: 0.83)
5. "Nike Foundation announces $50M commitment to youth sports" — AP (confidence: 0.81)

## Top Negative Coverage
1. "Nike supplier audit reveals overtime violations in Vietnam factory" — The Guardian (confidence: 0.79)
2. "Nike's DTC channel faces headwinds as wholesale orders recover" — Reuters (confidence: 0.72)

## Risk Assessment
Low risk overall. The supply-chain story did not generate amplification beyond 3 outlets. Financial coverage remains strongly positive. The primary risk vector is continued labor-practice scrutiny which could escalate if new investigations emerge.

## Strategic Recommendations
1. Amplify athlete storytelling — Caitlin Clark coverage demonstrates that authentic athlete partnerships generate disproportionate positive coverage volume.
2. Proactively address supply-chain narrative — One Guardian follow-up could escalate. Prepare a factual response statement in advance.
3. Sustain innovation coverage — Air Max launch coverage was high-confidence positive; maintain cadence of product news to anchor sentiment in the innovation narrative.

## Conclusion
Nike's sentiment profile across the analysis period is robust. The brand demonstrates strong media favorability, with positive coverage concentrated in high-authority sports and financial outlets. Near-term risk is limited to one ongoing supply-chain inquiry that warrants monitoring.`,

  aggregate_data: {
    // 1. Area Chart — sentiment over time
    areaData: weeks.map((week, i) => ({
      date: new Date(2026, 0, 20 + i * 7),
      positive: [2, 3, 4, 5, 7, 6, 5, 4, 6, 7, 5, 4][i] ?? 3,
      neutral: [1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 1][i] ?? 1,
      negative: [1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0][i] ?? 0,
    })),

    // 2. Bar Chart — article volume by sentiment per time bucket
    barData: weeks.map((week, i) => ({
      name: week,
      positive: [2, 3, 4, 5, 7, 6, 5, 4, 6, 7, 5, 4][i] ?? 3,
      neutral: [1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 1][i] ?? 1,
      negative: [1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0][i] ?? 0,
    })),

    // 3. Candlestick Chart — confidence volatility per bucket
    candlestickData: weeks.map((week, i) => ({
      date: new Date(2026, 0, 20 + i * 7),
      open: 0.62 + Math.random() * 0.1,
      high: 0.85 + Math.random() * 0.1,
      low: 0.52 + Math.random() * 0.1,
      close: 0.70 + Math.random() * 0.1,
    })),

    // 4. Choropleth Chart — country sentiment
    choroplethData: [
      { countryCode: "US", sentiment: "positive", count: 22 },
      { countryCode: "GB", sentiment: "negative", count: 4 },
      { countryCode: "DE", sentiment: "neutral", count: 6 },
      { countryCode: "AU", sentiment: "positive", count: 5 },
      { countryCode: "FR", sentiment: "neutral", count: 3 },
      { countryCode: "CA", sentiment: "positive", count: 2 },
    ],

    // 5. Funnel Chart — article pipeline
    funnelData: [
      { label: "URLs Discovered", value: 58 },
      { label: "Headlines Extracted", value: 51 },
      { label: "After Deduplication", value: 44 },
      { label: "Above Confidence Threshold", value: 42 },
      { label: "Included in Report", value: 42 },
    ],

    // 6. Line Chart — avg confidence per bucket
    lineData: weeks.map((week, i) => ({
      date: new Date(2026, 0, 20 + i * 7),
      confidence: 0.68 + i * 0.015 + (Math.random() - 0.5) * 0.05,
    })),

    // 7. Pie Chart — overall distribution
    pieData: [
      { label: "Positive", value: 28, color: "var(--chart-1)" },
      { label: "Neutral", value: 10, color: "var(--chart-2)" },
      { label: "Negative", value: 4, color: "var(--chart-3)" },
    ],

    // 8. Radar Chart — brand health dimensions
    radarMetrics: [
      { key: "sentiment", label: "Sentiment Score", max: 100 },
      { key: "volume", label: "Coverage Volume", max: 100 },
      { key: "diversity", label: "Source Diversity", max: 100 },
      { key: "confidence", label: "Confidence Level", max: 100 },
      { key: "momentum", label: "Sentiment Momentum", max: 100 },
      { key: "recency", label: "Recency", max: 100 },
    ],
    radarData: [
      {
        label: "Nike",
        color: "var(--chart-1)",
        values: {
          sentiment: 78,
          volume: 84,
          diversity: 72,
          confidence: 81,
          momentum: 88,
          recency: 90,
        },
      },
    ],

    // 9. Ring Chart — sentiment by top 5 source domains
    ringData: [
      { label: "ESPN", value: 9, maxValue: 10, color: "var(--chart-1)" },
      { label: "Reuters", value: 7, maxValue: 10, color: "var(--chart-2)" },
      { label: "Bloomberg", value: 6, maxValue: 10, color: "var(--chart-3)" },
      { label: "AP News", value: 5, maxValue: 10, color: "var(--chart-4)" },
      { label: "The Guardian", value: 3, maxValue: 10, color: "var(--chart-5)" },
    ],

    // 10. Sankey Chart — source → sentiment flow
    // Node indices: ESPN=0, Reuters=1, Bloomberg=2, AP=3, Guardian=4, Positive=5, Neutral=6, Negative=7
    sankeyData: {
      nodes: [
        { name: "ESPN", category: "source" as const },
        { name: "Reuters", category: "source" as const },
        { name: "Bloomberg", category: "source" as const },
        { name: "AP News", category: "source" as const },
        { name: "The Guardian", category: "source" as const },
        { name: "Positive", category: "outcome" as const },
        { name: "Neutral", category: "outcome" as const },
        { name: "Negative", category: "outcome" as const },
      ],
      links: [
        { source: 0, target: 5, value: 8 },
        { source: 0, target: 6, value: 1 },
        { source: 1, target: 5, value: 3 },
        { source: 1, target: 6, value: 3 },
        { source: 1, target: 7, value: 1 },
        { source: 2, target: 5, value: 5 },
        { source: 2, target: 6, value: 1 },
        { source: 3, target: 5, value: 3 },
        { source: 3, target: 6, value: 2 },
        { source: 4, target: 6, value: 1 },
        { source: 4, target: 7, value: 2 },
      ],
    },

    // Summary stats
    summary: {
      positive: 28,
      neutral: 10,
      negative: 4,
      low_confidence: 2,
      total: 42,
      momentum: "improving",
      top_positive: [
        { title: "Nike signs Caitlin Clark as newest signature athlete", source: "ESPN", confidence: 0.91 },
        { title: "Nike Q3 earnings beat expectations, stock surges 6%", source: "Bloomberg", confidence: 0.88 },
        { title: "Nike's Air Max 2026 launch breaks pre-order records", source: "SportsBusiness", confidence: 0.85 },
        { title: "Nike named most innovative brand in sports tech", source: "Fast Company", confidence: 0.83 },
        { title: "Nike Foundation announces $50M commitment to youth sports", source: "AP", confidence: 0.81 },
      ],
      top_negative: [
        { title: "Nike supplier audit reveals overtime violations", source: "The Guardian", confidence: 0.79 },
        { title: "Nike DTC channel faces headwinds as wholesale recovers", source: "Reuters", confidence: 0.72 },
      ],
    },
  },
};

// ─── Mock SSE Processing Stages ──────────────────────────────────────────────

export const mockProcessingStages = [
  {
    stage: "news_discovery",
    label: "Identifying best news source",
    duration: 1800,
    message: "Using GNews API",
    source: "gnews",
  },
  {
    stage: "url_collection",
    label: "Collecting article URLs",
    duration: 2200,
    message: "58 URLs collected",
    count: 58,
  },
  {
    stage: "extraction",
    label: "Extracting headlines",
    duration: 4500,
    message: "51 headlines extracted, 7 skipped",
    total: 58,
  },
  {
    stage: "processing",
    label: "Processing and formatting data",
    duration: 1200,
    message: "44 unique headlines ready for analysis",
  },
  {
    stage: "sentiment",
    label: "Running sentiment analysis",
    duration: 5000,
    message: "42 articles scored",
    total: 44,
  },
  {
    stage: "report_generation",
    label: "Generating professional report",
    duration: 3500,
    message: "Report ready",
  },
];

// ─── Mock Live Sentiment Points ───────────────────────────────────────────────

export const mockLivePoints = [
  { score: 0.88, sentiment: "positive" },
  { score: 0.72, sentiment: "positive" },
  { score: 0.61, sentiment: "neutral" },
  { score: 0.91, sentiment: "positive" },
  { score: 0.58, sentiment: "neutral" },
  { score: 0.79, sentiment: "negative" },
  { score: 0.83, sentiment: "positive" },
  { score: 0.68, sentiment: "positive" },
  { score: 0.55, sentiment: "neutral" },
  { score: 0.87, sentiment: "positive" },
  { score: 0.92, sentiment: "positive" },
  { score: 0.74, sentiment: "positive" },
  { score: 0.62, sentiment: "neutral" },
  { score: 0.85, sentiment: "positive" },
  { score: 0.77, sentiment: "positive" },
];
