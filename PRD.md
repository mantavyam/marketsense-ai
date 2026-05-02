# Product Requirements Document
## MarketSense — AI-Powered Brand Sentiment Analysis Platform

**Version:** 1.1.0
**Status:** Revised Draft
**Last Updated:** May 2026
**Changes in v1.1:** Firebase replaced with Supabase Auth. Infrastructure fully decided. All 15 ambiguity gaps resolved.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Goals and Success Metrics](#2-goals-and-success-metrics)
3. [Tech Stack](#3-tech-stack)
4. [Infrastructure Decision and Rationale](#4-infrastructure-decision-and-rationale)
5. [System Architecture](#5-system-architecture)
6. [Authentication and User Management](#6-authentication-and-user-management)
7. [Phase 1 — User Input and Configuration](#7-phase-1--user-input-and-configuration)
8. [Phase 2 — News Source Identification and Data Extraction](#8-phase-2--news-source-identification-and-data-extraction)
9. [Phase 3 — Data Processing and Preparation](#9-phase-3--data-processing-and-preparation)
10. [Phase 4 — Sentiment Analysis Execution](#10-phase-4--sentiment-analysis-execution)
11. [Phase 5 — Report Generation](#11-phase-5--report-generation)
12. [Phase 6 — Report Delivery](#12-phase-6--report-delivery)
13. [Phase 7 — Interactive Chatbot](#13-phase-7--interactive-chatbot)
14. [Frontend — Pages and UI Specification](#14-frontend--pages-and-ui-specification)
15. [Visualisation Layer — Chart Mapping](#15-visualisation-layer--chart-mapping)
16. [Real-Time Processing Feedback UI](#16-real-time-processing-feedback-ui)
17. [PDF Report Customisation](#17-pdf-report-customisation)
18. [Database Schema](#18-database-schema)
19. [API Specification](#19-api-specification)
20. [Environment Variables](#20-environment-variables)
21. [Error States and Edge Cases](#21-error-states-and-edge-cases)
22. [Rate Limiting and Concurrency](#22-rate-limiting-and-concurrency)
23. [Future Scope](#23-future-scope)
24. [Out of Scope for v1.0](#24-out-of-scope-for-v10)

---

## 1. Product Overview

MarketSense is a full-stack AI-powered web application that enables users to perform deep sentiment analysis on news coverage for any brand. The user enters a brand name and a time range, and the system autonomously discovers the best available free news source, extracts relevant headlines, processes them through a pre-trained transformer sentiment model (FinBERT), generates a structured visual report backed by 11 chart types, and optionally delivers the report via email. A floating chatbot panel allows real-time conversational interaction grounded strictly in the generated sentiment report.

### Core Value Proposition

- Zero manual research: the system handles news discovery, extraction, and analysis end-to-end.
- Rich visual output: 11 distinct chart types from the bklit UI library present every dimension of the data.
- Flexible delivery: download as PDF or receive via email, with a fully customisable PDF scope.
- Conversational intelligence: a chatbot answers follow-up questions grounded in the report context.

---

## 2. Goals and Success Metrics

| Goal | Metric |
|---|---|
| End-to-end analysis completes without manual intervention | 100% of runs complete automatically |
| User can read the full report within the platform | Dashboard renders all 11 charts correctly |
| Report is deliverable via email | Resend API confirms delivery |
| Chatbot responds within 3 seconds per message | P95 latency under 3s |
| PDF downloads without error | Zero broken PDF downloads |
| Auth flow is stable | Zero auth regressions on login/register |

---

## 3. Tech Stack

### Frontend

| Concern | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI Components | shadcn/ui |
| Visualisation | bklit UI (`https://ui.bklit.com/docs/components`) |
| Processing Feedback UI | `@hextaui/ai-thinking`, `@ai-elements/chain-of-thought` via shadcn |
| Styling | Tailwind CSS |
| Auth Client | Supabase Auth JS SDK (`@supabase/ssr`) |
| Deployment | Vercel |

### Backend

| Concern | Technology |
|---|---|
| Framework | Python, FastAPI |
| News Extraction | newspaper4k |
| Sentiment Model | FinBERT (`ProsusAI/finbert`) — runs locally on host machine |
| LLM / Report Generation | OpenRouter API (free tier, highest context length model) |
| LLM / Chatbot | OpenRouter API (separate free model, lowest latency priority) |
| PDF Generation | WeasyPrint (requires system dependencies — see Section 4.5) |
| Email Delivery | Resend |
| Database | PostgreSQL via Supabase (direct connection, port 5432) |
| ORM | SQLAlchemy async with asyncpg driver |
| Auth Verification | Supabase JWT secret + python-jose (no Admin SDK required) |
| Real-time Streaming | FastAPI Server-Sent Events (SSE) |

### Infrastructure

| Layer | Host | Cost |
|---|---|---|
| Frontend | Vercel | Free |
| PostgreSQL + Auth | Supabase free tier | Free |
| Backend + FinBERT (dev / demo) | Local Mac, exposed via ngrok or Cloudflare Tunnel | Free |
| Backend + FinBERT (production) | Railway paid or Render paid, minimum 2 GB RAM instance | ~$5–10/month when needed |

---

## 4. Infrastructure Decision and Rationale

This section documents the reasoning behind every infrastructure choice so no decision needs to be revisited during implementation.

### 4.1 Why Supabase Replaces Firebase

Firebase Authentication is replaced with Supabase. Supabase provides both PostgreSQL and Auth under a single free-tier project, eliminating a second vendor entirely. Supabase Auth issues standard JWTs verifiable on the backend with a shared secret — no Admin SDK, service account JSON, or Google Cloud project is required. This simplifies the backend to a single environment variable (`SUPABASE_JWT_SECRET`) for auth verification and reduces setup friction significantly.

### 4.2 Supabase PostgreSQL Connection

The Supabase free tier provides 500 MB PostgreSQL storage, which is more than sufficient for the expected data volume (articles, reports, and chat messages stored as text and JSONB). The backend connects using the **direct connection string on port 5432**, not the connection pooler on port 6543. This is mandatory: SQLAlchemy's async session handling is incompatible with pgBouncer's transaction-mode pooling used on port 6543. The direct connection string format is:

```
postgresql+asyncpg://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

### 4.3 Why FinBERT Cannot Run on Any Free Cloud Tier

FinBERT (`ProsusAI/finbert`) requires approximately 1.2–1.8 GB of RAM when loaded into memory. Free tier RAM limits across all evaluated providers:

| Provider | Free RAM | Sufficient for FinBERT |
|---|---|---|
| Railway free | 0.5 GB | No — crashes at model load |
| Render free | 0.5 GB | No — same |
| Google Cloud Run free | 1 GB | No — OS + FastAPI overhead exceeds limit |
| Supabase | Database only | Not a compute host |

The practical decision is to run the FastAPI backend including FinBERT on the developer's local Mac during development and demo phases. The local server is exposed to the internet via `ngrok http 8000` (free tier) or Cloudflare Tunnel (free). The resulting public URL is set as `NEXT_PUBLIC_API_URL` on Vercel. The full system is functional end-to-end at zero cost.

When a persistent public deployment is required, Railway paid or Render paid with a 2 GB RAM instance is used.

### 4.4 FinBERT Model Caching

The model is downloaded from HuggingFace Hub on first startup and cached to the directory specified by the `TRANSFORMERS_CACHE` environment variable (default: `~/.cache/huggingface/hub`). The model is loaded once at FastAPI application startup using a lifespan context manager and held in a module-level variable for the lifetime of the process. Cold start time is approximately 5–15 seconds on an M-series Mac. This is acceptable for local and persistent server deployments. The model is not compatible with serverless or per-request cold-start environments and must not be deployed to such platforms.

On a production Railway or Render instance, the model weights are stored on a persistent volume so they are not re-downloaded on every deploy.

### 4.5 WeasyPrint System Dependencies

WeasyPrint requires `libpango-1.0`, `libcairo-2`, `libgdk-pixbuf-2.0`, and `libffi` as system libraries. On macOS these are installed via Homebrew (`brew install pango`). On a production Linux server these must be installed via `apt-get` in a Dockerfile.

A `Dockerfile` for the backend is written from day one using `python:3.11-slim` as the base image with the WeasyPrint system dependencies installed as an `apt-get` layer. This ensures environment parity between the developer's Mac (via Docker) and any future cloud deployment. Running locally without Docker is also supported for speed of iteration, provided the developer installs the system dependencies via Homebrew.

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     NEXT.JS FRONTEND                    │
│                                                         │
│  /login  /register  /  /report/[id]  /history           │
│                                                         │
│  shadcn/ui + bklit charts + SSE streaming UI            │
│  Supabase Auth JS SDK (session and token management)    │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS + SSE
┌────────────────────▼────────────────────────────────────┐
│           FASTAPI BACKEND (local Mac / Railway)         │
│                                                         │
│  /auth/sync   — Supabase JWT verification               │
│  /analyze     — SSE stream, orchestrates all phases     │
│  /report      — Fetch stored report by ID               │
│  /chat        — Chatbot endpoint (SSE streaming)        │
│  /pdf         — Generate and return PDF binary          │
│  /email       — Send report via Resend                  │
│                                                         │
│  Internal services:                                     │
│    NewsDiscovery → newspaper4k → FinBERT (in-process)   │
│    → OpenRouterReporter → OpenRouterChatbot             │
└──────┬──────────────┬────────────────┬──────────────────┘
       │              │                │
┌──────▼──────────┐ ┌─▼───────────┐ ┌─▼──────────────────┐
│ Supabase        │ │ OpenRouter  │ │ Resend / WeasyPrint │
│ PostgreSQL +    │ │ Report LLM  │ │ Email + PDF         │
│ Supabase Auth   │ │ Chat LLM    │ └────────────────────┘
└─────────────────┘ └─────────────┘
```

---

## 6. Authentication and User Management

### 6.1 Mechanism

Supabase Auth handles identity and session management. The Supabase JS SDK manages the session client-side. The backend verifies every incoming request by validating the Supabase JWT using the `SUPABASE_JWT_SECRET` — no HTTP call to Supabase is made per request. Verification is done with `python-jose` in a FastAPI dependency.

### 6.2 Supported Auth Methods (v1.0)

- Email and password via Supabase Auth

### 6.3 Future Auth Methods (post v1.0)

- OAuth via Google (Supabase dashboard configuration only, one frontend button added)
- OAuth via GitHub (same)

### 6.4 Token Management and Refresh

The Supabase JS SDK handles token refresh automatically and transparently. The SDK's `onAuthStateChange` listener fires on login, logout, and token refresh events. The session is managed internally by the SDK — no manual localStorage handling is written in application code. Every API request to the FastAPI backend attaches the current access token via `Authorization: Bearer <access_token>`. Because the SDK auto-refreshes before expiry, the attached token is always valid. Page refreshes do not log the user out.

### 6.5 Backend JWT Verification

The FastAPI backend verifies the JWT using `python-jose` with the `SUPABASE_JWT_SECRET` (found in Supabase project Settings > API > JWT Secret). The verified payload contains the `sub` claim (UUID), which is used as `supabase_uid` in the `users` table. A FastAPI dependency (`get_current_user`) handles verification and user lookup on every protected endpoint.

### 6.6 Protected Routes

All routes except `/login` and `/register` require a valid Supabase session. Next.js middleware using `@supabase/ssr` enforces this at the edge. Unauthenticated requests to protected routes are redirected to `/login`.

### 6.7 Database User Record

On first successful login, the frontend calls `POST /auth/sync`. The backend verifies the JWT, checks whether a `users` record exists for the `supabase_uid`, and creates one if not. All subsequent runs, reports, and messages are foreign-keyed to this record.

---

## 7. Phase 1 — User Input and Configuration

This is the landing page after login (`/`). The user configures the analysis run before submission.

### 7.1 Required Inputs

| Field | Type | Description |
|---|---|---|
| Brand Name | Text input | The brand to analyse, e.g. "Nike" |
| Time Range | Segmented control | 1 Month / 3 Months / 6 Months / 1 Year |

### 7.2 Advanced Configuration (Expandable Panel)

All fields are optional overrides. The panel is collapsed by default. Defaults are computed automatically.

| Field | Type | Default | Description |
|---|---|---|---|
| Max Articles | Number input | Dynamic per Section 7.3 | Override the article count cap |
| Include Source Domains | Text, comma-separated | Empty — no restriction | Whitelist specific news domains |
| Exclude Source Domains | Text, comma-separated | Empty | Blacklist specific news domains |
| Confidence Threshold | Slider 0.0–1.0 | 0.55 | Articles scored below this value are flagged as low-confidence and excluded from aggregate metrics |
| Report LLM | Select | Auto (highest context free) | Override the OpenRouter model for report generation |
| Chatbot LLM | Select | Auto (lowest latency free) | Override the OpenRouter model for the chatbot |

**Sentiment Model select field:** Not shown in v1.0. Only FinBERT is bundled. A single-option select is redundant and confusing. The field is reintroduced when a second model is added in a future version.

**News Language field:** English only in v1.0. Not shown in the UI.

### 7.3 Dynamic Article Count Logic

| Time Range | Default Article Cap |
|---|---|
| 1 Month | 20 |
| 3 Months | 40 |
| 6 Months | 70 |
| 1 Year | 100 |

There is no hard maximum enforced by the backend. A warning is shown inline in the advanced panel if the user sets the cap above 150: "Processing time will increase significantly for large article counts."

### 7.4 Concurrency Guard

If the authenticated user already has a run in `"running"` status, the "Run Analysis" button is disabled with a tooltip: "An analysis is already in progress." The backend also enforces this with an HTTP 409 response (see Section 22.1).

### 7.5 Submission

On clicking "Run Analysis", the frontend opens the SSE connection to `GET /analyze` with query parameters and transitions to the processing view. The form inputs are locked read-only while the connection is active.

---

## 8. Phase 2 — News Source Identification and Data Extraction

### 8.1 News Source Auto-Selection

| Priority | Source | Method | Notes |
|---|---|---|---|
| 1 | GNews API | REST API | Structured JSON, supports date range, free tier: 100 req/day |
| 2 | Google News RSS | feedparser | Free, no key required, limited date filtering |
| 3 | NewsAPI.org | REST API | Free developer tier: 100 req/day, 1-month history limit on free |

The backend attempts GNews first. On HTTP 429 or quota exhaustion it falls back to Google News RSS. If that returns zero results it falls back to NewsAPI. If all three fail, the run fails immediately at stage `"news_discovery"` with a descriptive error message.

### 8.2 Search Query Construction

Two queries are issued per brand:
- Primary: the brand name verbatim (`"Nike"`)
- Secondary: brand name plus most common associated noun (`"Nike shoes"`)

Duplicate URLs across both queries are deduplicated before extraction.

### 8.3 Article Extraction with newspaper4k

For each collected URL, newspaper4k extracts:
- Title / headline — primary input for sentiment analysis in v1.0
- Publication date — for time-series charting
- Source domain — for source attribution charts
- Author — stored but not used in analysis

Full article body extraction is not performed in v1.0. If newspaper4k fails to extract a headline from a URL (network error, paywall, parse failure), that article is skipped. If more than 80% of collected URLs fail extraction, the run fails at stage `"extraction"`.

### 8.4 SSE Events Emitted

```json
{ "stage": "news_discovery", "status": "started", "message": "Identifying best news source..." }
{ "stage": "news_discovery", "status": "complete", "message": "Using GNews API", "source": "gnews" }
{ "stage": "url_collection", "status": "progress", "message": "14 URLs found so far..." }
{ "stage": "url_collection", "status": "complete", "message": "32 URLs collected" }
{ "stage": "extraction", "status": "progress", "current": 12, "total": 32 }
{ "stage": "extraction", "status": "complete", "message": "29 headlines extracted, 3 skipped" }
```

---

## 9. Phase 3 — Data Processing and Preparation

### 9.1 Deduplication

Headlines are deduplicated by normalised title string (lowercased, punctuation stripped) to remove near-identical articles collected across multiple queries or sources.

### 9.2 Structured Format Per Article

```json
{
  "id": "uuid",
  "title": "Nike signs Caitlin Clark as newest signature athlete",
  "url": "https://espn.com/...",
  "published_at": "2025-08-15T10:30:00Z",
  "source_domain": "espn.com",
  "brand": "Nike",
  "query_variant": "Nike"
}
```

### 9.3 Sentiment-Ready Formatting

Each headline is cleaned before FinBERT inference:
- HTML entities decoded
- Non-ASCII characters stripped
- Truncated to 512 tokens (FinBERT's maximum input length)
- Brand name preserved — not stripped from the headline

### 9.4 SSE Events Emitted

```json
{ "stage": "processing", "status": "started", "message": "Processing and formatting headlines..." }
{ "stage": "processing", "status": "complete", "message": "27 unique headlines ready for analysis" }
```

---

## 10. Phase 4 — Sentiment Analysis Execution

### 10.1 Model

FinBERT (`ProsusAI/finbert`) is the sole sentiment model in v1.0. It outputs three labels — `positive`, `neutral`, `negative` — as softmax probabilities summing to 1.0. It is loaded once at FastAPI startup via a lifespan context manager and held in a module-level variable for the process lifetime.

### 10.2 Confidence Threshold Handling

The winning label's softmax score is used as the confidence value.

- Confidence >= threshold (default 0.55): article is included in all aggregate metrics and chart data.
- Confidence < threshold: article is stored with `low_confidence = true`. It appears in the raw data table on the report page but is excluded from all chart computations and from the OpenRouter report prompt.

### 10.3 Output Per Article

```json
{
  "id": "uuid",
  "title": "Nike signs Caitlin Clark as newest signature athlete",
  "sentiment": "positive",
  "confidence": 0.91,
  "scores": { "positive": 0.91, "neutral": 0.07, "negative": 0.02 },
  "low_confidence": false,
  "published_at": "2025-08-15T10:30:00Z",
  "source_domain": "espn.com"
}
```

### 10.4 Aggregate Metrics Computed

- Sentiment distribution: positive / neutral / negative counts and percentages (confidence-filtered only)
- Sentiment over time: bucketed by week for ranges ≤3 months, by month for ranges >3 months
- Sentiment by source domain: top 10 domains by article count
- Confidence score distribution across all articles
- Sentiment momentum: linear regression slope over time-bucketed scores (improving / stable / declining)
- Top 5 positive headlines by confidence
- Top 5 negative headlines by confidence
- Low-confidence article count and percentage

### 10.5 SSE Events Emitted

```json
{ "stage": "sentiment", "status": "started", "message": "Running sentiment analysis..." }
{ "stage": "sentiment", "status": "progress", "current": 10, "total": 27, "latest": { "title": "...", "sentiment": "positive", "confidence": 0.88 } }
{ "stage": "sentiment", "status": "complete", "summary": { "positive": 18, "neutral": 6, "negative": 3, "low_confidence": 2 } }
```

The `latest` field in progress events powers the Live Line Chart updating in real time during processing.

---

## 11. Phase 5 — Report Generation

### 11.1 OpenRouter Model Selection

The backend calls the OpenRouter `/models` endpoint, filters to models where `pricing.prompt == "0"` and `pricing.completion == "0"`, and selects the one with the highest `context_length`. The selected model ID is stored in `analysis_runs.report_model_id`.

Fallback if the model list call fails: `mistralai/mistral-7b-instruct:free`.

If the selected model's call fails: one retry after 5 seconds, then one retry with the fallback model. If all three attempts fail, the run fails at stage `"report_generation"`.

### 11.2 Report Prompt Structure

The prompt includes: brand name, time range, total article count, confidence-filtered article count, low-confidence count, all confidence-filtered per-article results, and all aggregate metrics. The model is instructed to produce output with the following `##` section headers in order:

- Executive Summary
- Overall Sentiment Overview
- Sentiment Trend Analysis
- Source-by-Source Breakdown
- Top Positive Coverage
- Top Negative Coverage
- Risk Assessment
- Strategic Recommendations
- Conclusion

The model is instructed to use plain prose under each heading with no nested markdown tables or code blocks, to ensure clean WeasyPrint rendering.

### 11.3 Storage

The generated report text is stored in `reports.report_text`. All per-article results and aggregate metrics are stored in `reports.aggregate_data` as JSONB. `analysis_runs.status` is set to `"complete"` and `completed_at` is recorded.

### 11.4 SSE Events Emitted

```json
{ "stage": "report_generation", "status": "started", "message": "Generating report using mistralai/mistral-7b-instruct:free..." }
{ "stage": "report_generation", "status": "complete", "message": "Report ready" }
{ "stage": "run_complete", "status": "complete", "run_id": "uuid", "redirect": "/report/uuid" }
```

---

## 12. Phase 6 — Report Delivery

### 12.1 Download as PDF

The user clicks "Download PDF" on the report page. A customisation modal opens (Section 17). On confirmation, the frontend serialises each visible bklit chart's SVG using `XMLSerializer`, then sends `POST /pdf/{run_id}` with the section config and chart SVG strings. WeasyPrint renders the PDF server-side and the backend responds with `Content-Type: application/pdf` and `Content-Disposition: attachment`.

If a chart's SVG capture fails (e.g. canvas-rendered chart), that chart is replaced in the PDF with a plain-text data summary derived from `reports.aggregate_data`.

There is no server-side chart reimplementation in matplotlib. SVG capture from the browser is the sole pipeline.

### 12.2 Send via Email

The user clicks "Send Report via Email". A modal appears with:
- Recipient email (pre-filled with the user's email, editable)
- Optional personal message (max 500 characters)
- Section selection (same toggles as PDF modal)
- "Attach PDF" checkbox (default: on)

The Resend email contains:
- AI-generated Executive Summary as the HTML email body
- Key metrics block: sentiment distribution, article count, time range, run date
- "View Full Report" button linking to `/report/{run_id}`
- PDF attachment if "Attach PDF" is checked

---

## 13. Phase 7 — Interactive Chatbot

### 13.1 Placement

Floating sidebar panel on the right side of the screen. A fixed-position toggle button (bottom-right) opens and closes it. The panel slides over the page content without pushing the layout. Defaults to open on `/report/[id]` on first visit, closed on all other pages.

### 13.2 OpenRouter Model for Chatbot

Selected from the same free-model list as the report model (Section 11.1) but ranked by lowest latency and best instruction-following rather than highest context length. In practice this prefers Llama 3 8B or Mistral 7B variants. The selected model ID is stored in `analysis_runs.chatbot_model_id`.

### 13.3 Context Scope Toggle

A visible selector in the chatbot panel header:

| Scope Label | Data Fetched | What the Model Receives |
|---|---|---|
| This Report | `reports` WHERE `run_id = current_run_id` | Current report text + aggregate data |
| All Runs — This Brand | `reports` JOIN `analysis_runs` WHERE `brand_name = current AND user_id = current` | All report texts and aggregate summaries for this brand |
| All Runs — All Brands | `reports` JOIN `analysis_runs` WHERE `user_id = current` | All report texts and aggregate summaries across all brands |

Changing the scope updates the system prompt for the next message. Chat history is not cleared on scope change. If the total token count of injected context would exceed the model's context window, the backend truncates older report texts first, always preserving the most recent report in full.

### 13.4 System Prompt

```
You are a professional news sentiment analyst and brand reputation advisor.
You are assisting a user who has run a sentiment analysis on news coverage for [brand_name].
Your responses must be based strictly and exclusively on the sentiment data and report text provided below.
Do not introduce external knowledge about the brand that is not present in the data.
If the user asks something that cannot be answered from the data, say so explicitly.

--- SENTIMENT DATA AND REPORT ---
[injected report text and aggregate metrics]
--- END OF DATA ---
```

### 13.5 Request Body for `/chat`

```json
{
  "message": "What is driving the negative sentiment this month?",
  "run_id": "uuid",
  "context_scope": "current",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

### 13.6 Streaming and History

Responses stream token-by-token via OpenRouter's streaming API, proxied as SSE to the frontend. All messages are stored in `chat_messages` and loaded on panel open, so conversations persist across page refreshes.

---

## 14. Frontend — Pages and UI Specification

### 14.1 Page Map

| Route | Description | Auth Required |
|---|---|---|
| `/login` | Login — email and password | No |
| `/register` | Registration | No |
| `/` | New analysis input form (post-login landing) | Yes |
| `/report/[id]` | Full report dashboard with all 11 charts | Yes |
| `/history` | Paginated list of all past analysis runs | Yes |

### 14.2 `/login` and `/register`

- Centered shadcn `Card`
- Email input, password input, submit button
- Inline validation errors below each field
- Toggle link between login and register
- On success: redirect to `/`
- On error: display Supabase Auth error message inline

### 14.3 `/` — New Analysis Input Form

- Brand name text input, auto-focused on page load
- Time range segmented control: 1 Month / 3 Months / 6 Months / 1 Year
- Advanced Configuration collapsible `Accordion` — collapsed by default
- "Run Analysis" primary button — disabled if a run is in progress
- Right sidebar: "Recent Runs" — last 5 completed runs as cards (brand, date, sentiment badge, link)

### 14.4 Processing View

Full-screen overlay replacing form content when a run is submitted. See Section 16.

### 14.5 `/report/[id]` — Report Dashboard

Top to bottom:
- Header bar: brand name, time range pill, article count, run date, "Download PDF" button, "Send via Email" button
- Executive Summary card: first section of the OpenRouter report, rendered as styled prose
- Charts grid: all 11 bklit charts in a responsive 2-column grid (single column on mobile), each with a title, one-sentence description, and info tooltip
- Full Report section: complete OpenRouter report rendered with section headings and prose paragraphs, no raw markdown
- Floating chatbot panel (right side)

**Error states:**

| Condition | Behaviour |
|---|---|
| `status === "failed"` | Error card showing `failure_stage` and `failure_message`. "Retry" button pre-fills and re-submits the form |
| `status === "running"` | Shows processing view, reconnects SSE stream automatically |
| `status === "deleted"` | 404 page |
| `run.user_id !== current user` | 404 page — do not confirm the run exists |
| `reports` row missing for a completed run | Charts unavailable message; report text shown if available |

### 14.6 `/history` — Past Runs

- Paginated table: 20 rows per page
- Columns: Brand Name, Time Range, Date, Articles Analysed, Sentiment Distribution, Status, Actions
- Default sort: `created_at DESC`. User-sortable by Brand Name and Date
- Client-side search by brand name
- Actions: "View Report" link, "Delete" button with confirmation dialog
- Runs with `status === "running"`: spinner in status column, links to processing view
- Runs with `status === "failed"`: red badge, "Retry" link

---

## 15. Visualisation Layer — Chart Mapping

All 11 charts from `https://ui.bklit.com/docs/components` are mandatory. Chart data is loaded from `reports.aggregate_data` (JSONB) on page load — no per-chart API calls.

| # | Chart Type | Data Mapped | Description |
|---|---|---|---|
| 1 | Area Chart | Sentiment count over time | Stacked area: positive, neutral, negative article counts per time bucket. X-axis: time buckets. Shows full coverage shape across the selected period |
| 2 | Bar Chart | Article volume by sentiment per time bucket | Grouped bars per time bucket. Identifies specific weeks or months with coverage spikes |
| 3 | Candlestick Chart | Confidence volatility per time bucket | Open = confidence of first article in bucket, Close = last, High = max, Low = min. Shows how decisive the sentiment signal was over time |
| 4 | Choropleth Chart | Sentiment by inferred source country | Country mapped from source domain using a curated domain-to-country lookup table. Generic `.com` domains unmappable by TLD are grouped as "Unknown / Global" with a note below the chart. If fewer than 3 countries are mappable, this chart is replaced with a plain table |
| 5 | Funnel Chart | Article pipeline attrition | Stages: URLs Discovered → Headlines Extracted → After Deduplication → Above Confidence Threshold → Included in Report |
| 6 | Line Chart | Average confidence score per time bucket | Single line showing model decisiveness over time. Declining confidence indicates increasingly ambiguous news coverage |
| 7 | Live Line Chart | Real-time sentiment score feed | Animates during a run as each article is scored (via SSE `latest` field). Freezes post-run showing chronological progression |
| 8 | Pie Chart | Overall sentiment distribution | Three slices: positive / neutral / negative. Percentages labelled. Confidence-filtered articles only |
| 9 | Radar Chart | Multi-dimension brand health score | Six axes: Sentiment Score, Coverage Volume, Source Diversity, Confidence Level, Sentiment Momentum, Recency |
| 10 | Ring Chart | Sentiment by top 5 source domains | Segment size = article count per domain. Segment colour = dominant sentiment for that domain |
| 11 | Sankey Chart | Sentiment flow: source domain → sentiment category | Left nodes: top source domains. Right nodes: Positive, Neutral, Negative. Link width = article count |

---

## 16. Real-Time Processing Feedback UI

### 16.1 Components

- `@hextaui/ai-thinking` — animated thinking indicator shown between stage completions
- `@ai-elements/chain-of-thought` — renders each stage as a chain node

### 16.2 Stage Display

| SSE `stage` | Display Label | Progress Counter |
|---|---|---|
| `news_discovery` | Identifying best news source | No |
| `url_collection` | Collecting article URLs | Yes — "N URLs found" |
| `extraction` | Extracting headlines | Yes — "N / total" |
| `processing` | Processing and formatting data | No |
| `sentiment` | Running sentiment analysis | Yes — "N / total scored" |
| `report_generation` | Generating professional report | No |
| `run_complete` | Analysis complete — redirecting | No |

Each node shows: spinner while in-progress, green check on complete, red cross on error with error message below, progress counter string where applicable.

### 16.3 Live Line Chart During Processing

Rendered below the stage chain. Starts empty. Adds one data point per scored article using the `latest` field from sentiment SSE progress events. X-axis: article index. Y-axis: winning sentiment score 0–1. Points are colour-coded by sentiment label.

### 16.4 Error Handling

On `status === "error"` in any SSE event, the stream is closed. The failed node is marked with a red cross. A "Retry" button re-submits the identical configuration without requiring the user to return to the form.

---

## 17. PDF Report Customisation

### 17.1 Scope Presets

| Preset | Effect |
|---|---|
| Full Report (default) | All sections on |
| Executive Summary Only | Cover page, executive summary, pie chart, radar chart only |
| Custom | User controls each toggle individually |

Selecting a preset sets all toggles to match. Any individual toggle change after selecting a preset automatically switches the preset selector to "Custom".

### 17.2 Toggleable Sections

| Section | Default |
|---|---|
| Cover page (brand name, date, time range, article count) | On |
| Executive Summary (AI-generated) | On |
| Overall Sentiment Overview — Pie Chart + key metrics | On |
| Sentiment Trend Analysis — Area Chart + Line Chart | On |
| Volume by Period — Bar Chart | On |
| Confidence Volatility — Candlestick Chart | On |
| Article Pipeline — Funnel Chart | On |
| Brand Health Score — Radar Chart | On |
| Geographic Coverage — Choropleth Chart | On |
| Source Breakdown — Ring Chart + Sankey Chart | On |
| Full AI Report Text | On |
| Strategic Recommendations | On |
| Personalised AI Executive Summary (appended page) | On |
| Raw Data Table (all articles with scores) | Off |

### 17.3 PDF Request Body Schema

`POST /pdf/{run_id}` body:

```json
{
  "sections": {
    "cover_page": true,
    "executive_summary": true,
    "pie_chart": true,
    "area_line_charts": true,
    "bar_chart": true,
    "candlestick_chart": true,
    "funnel_chart": true,
    "radar_chart": true,
    "choropleth_chart": true,
    "ring_sankey_charts": true,
    "full_report_text": true,
    "recommendations": true,
    "ai_executive_summary": true,
    "raw_data_table": false
  },
  "chart_svgs": {
    "area_chart": "<svg>...</svg>",
    "bar_chart": "<svg>...</svg>",
    "candlestick_chart": "<svg>...</svg>",
    "choropleth_chart": "<svg>...</svg>",
    "funnel_chart": "<svg>...</svg>",
    "line_chart": "<svg>...</svg>",
    "pie_chart": "<svg>...</svg>",
    "radar_chart": "<svg>...</svg>",
    "ring_chart": "<svg>...</svg>",
    "sankey_chart": "<svg>...</svg>"
  }
}
```

Any `chart_svgs` key that is absent or null causes the backend to substitute a plain-text data summary for that chart in the PDF.

### 17.4 PDF Rendering

WeasyPrint renders from a Jinja2 HTML template using inline CSS only (no external assets). Each SVG from `chart_svgs` is embedded as an inline `<svg>` element. Response: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="MarketSense_{brand}_{date}.pdf"`.

---

## 18. Database Schema

All tables use UUID primary keys generated by the application layer. All timestamps are `TIMESTAMPTZ` in UTC. `DEFAULT now()` is set at the database level.

### 18.1 `users`

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| supabase_uid | TEXT | UNIQUE NOT NULL |
| email | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### 18.2 `analysis_runs`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users NOT NULL | |
| brand_name | TEXT | NOT NULL | |
| time_range | TEXT | NOT NULL | "1m", "3m", "6m", "1y" |
| article_cap | INTEGER | NOT NULL | |
| confidence_threshold | FLOAT | NOT NULL DEFAULT 0.55 | |
| include_domains | TEXT[] | | Nullable |
| exclude_domains | TEXT[] | | Nullable |
| news_source_used | TEXT | | Populated after discovery |
| report_model_id | TEXT | | OpenRouter model ID |
| chatbot_model_id | TEXT | | OpenRouter model ID |
| status | TEXT | NOT NULL | "pending", "running", "complete", "failed", "deleted" |
| failure_stage | TEXT | | Nullable |
| failure_message | TEXT | | Nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| completed_at | TIMESTAMPTZ | | Nullable |

### 18.3 `articles`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| run_id | UUID | FK → analysis_runs NOT NULL | |
| title | TEXT | NOT NULL | |
| url | TEXT | | |
| source_domain | TEXT | | |
| published_at | TIMESTAMPTZ | | Nullable if not parseable |
| sentiment | TEXT | | "positive", "neutral", "negative" |
| confidence | FLOAT | | |
| scores | JSONB | | `{ "positive": 0.x, "neutral": 0.x, "negative": 0.x }` |
| low_confidence | BOOLEAN | DEFAULT false | |

### 18.4 `reports`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| run_id | UUID | FK → analysis_runs UNIQUE NOT NULL | |
| report_text | TEXT | | Full OpenRouter report |
| aggregate_data | JSONB | | All metrics for chart rendering |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

### 18.5 `chat_messages`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users NOT NULL | |
| run_id | UUID | FK → analysis_runs | Nullable for cross-run scope |
| role | TEXT | NOT NULL | "user" or "assistant" |
| content | TEXT | NOT NULL | |
| context_scope | TEXT | NOT NULL | "current", "brand", "all" |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

---

## 19. API Specification

All endpoints require `Authorization: Bearer <supabase_access_token>` unless marked public. The user identity is extracted from the verified JWT on every request.

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/sync` | Verifies JWT, creates `users` record on first login. Returns `{ "user_id": "uuid" }` |

### Analysis

| Method | Path | Description |
|---|---|---|
| GET | `/analyze` | SSE stream — starts pipeline, emits stage events |
| GET | `/runs` | List all runs for the user, ordered `created_at DESC` |
| GET | `/runs/{run_id}` | Get single run metadata and status |
| DELETE | `/runs/{run_id}` | Soft delete — sets `status = "deleted"` |

### Report

| Method | Path | Description |
|---|---|---|
| GET | `/report/{run_id}` | Returns `{ "report_text": "...", "aggregate_data": {...} }` |
| POST | `/pdf/{run_id}` | Body: section config + chart SVGs. Returns PDF binary |
| POST | `/email/{run_id}` | Body: `{ "to": "email", "message": "...", "sections": {...}, "chart_svgs": {...}, "attach_pdf": true }`. Returns `{ "delivered": true }` |

### Chatbot

| Method | Path | Description |
|---|---|---|
| POST | `/chat` | Body: `{ "message", "run_id", "context_scope", "history" }`. Returns SSE token stream |
| GET | `/chat/history/{run_id}` | Returns chat messages ordered `created_at ASC` |

### Query Parameters for `GET /analyze`

| Param | Type | Required | Description |
|---|---|---|---|
| brand | string | Yes | Brand name |
| range | string | Yes | "1m", "3m", "6m", "1y" |
| article_cap | integer | No | Override default cap |
| confidence_threshold | float | No | Default 0.55 |
| include_domains | string | No | Comma-separated whitelist |
| exclude_domains | string | No | Comma-separated blacklist |
| report_model | string | No | Override report OpenRouter model ID |
| chatbot_model | string | No | Override chatbot OpenRouter model ID |

---

## 20. Environment Variables

### Frontend (`.env.local`)

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Backend (`.env`)

```
# Database — use direct connection port 5432, NOT pooler port 6543
DATABASE_URL=postgresql+asyncpg://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# Supabase Auth — JWT secret from Supabase dashboard > Settings > API
SUPABASE_JWT_SECRET=your-jwt-secret

# OpenRouter
OPENROUTER_API_KEY=your-openrouter-key

# Email
RESEND_API_KEY=your-resend-key

# News sources
GNEWS_API_KEY=your-gnews-key
NEWSAPI_KEY=your-newsapi-key

# Sentiment model
SENTIMENT_MODEL_NAME=ProsusAI/finbert
TRANSFORMERS_CACHE=/path/to/model/cache

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://your-app.vercel.app
```

---

## 21. Error States and Edge Cases

### 21.1 Report Page Error States

| Condition | Behaviour |
|---|---|
| `status === "failed"` | Error card with `failure_stage` and `failure_message`. "Retry" button pre-fills and auto-submits the form |
| `status === "running"` | Processing view shown, SSE stream reconnected automatically |
| `status === "deleted"` | 404 page |
| `run.user_id !== current user` | 404 page — do not confirm the run's existence |
| `reports` row absent for a completed run | "Charts unavailable" message shown; report text displayed if present |

### 21.2 News Extraction Failures

If newspaper4k fails on a URL, the article is skipped. If more than 80% of collected URLs fail extraction, the run fails at stage `"extraction"` with message: "Insufficient articles extracted. The brand may have limited news coverage in the selected time range."

### 21.3 All News Sources Exhausted

If GNews, Google News RSS, and NewsAPI all fail or return zero results, the run fails at stage `"news_discovery"` with message: "All news sources are rate-limited or returned no results for this brand and time range. Please try again later."

### 21.4 OpenRouter Failures

On failure: retry once after 5 seconds with the same model. On second failure: retry with the hardcoded fallback model (`mistralai/mistral-7b-instruct:free`). On third failure: run fails at stage `"report_generation"`.

### 21.5 Choropleth with Insufficient Country Data

If fewer than 3 unique countries can be mapped from source domains, the Choropleth chart on the dashboard is replaced with: "Geographic breakdown unavailable — insufficient mappable source domains in this dataset." The chart is omitted from the PDF as well.

---

## 22. Rate Limiting and Concurrency

### 22.1 Per-User Concurrent Run Limit

One run in `"running"` status per user at any time. The backend checks `analysis_runs` before starting a new run. If a running run exists, HTTP 409 is returned: `{ "error": "A run is already in progress", "run_id": "..." }`. The frontend prevents submission at UI level (disabled button) and handles HTTP 409 by redirecting to the in-progress run's processing view.

### 22.2 External API Rate Limit Handling

| Service | Free Limit | Handling |
|---|---|---|
| GNews | 100 requests/day | HTTP 429 → fall back to next source immediately |
| NewsAPI | 100 requests/day | HTTP 429 → fall back to next source immediately |
| OpenRouter | Varies by model | HTTP 429 → retry after 5s, then try fallback model |
| Resend | 100 emails/day | On limit → return error to frontend, do not retry |

### 22.3 newspaper4k Request Pacing

Fetches are made sequentially with a 0.5-second delay between each request to avoid triggering anti-scraping measures. 100 articles therefore take approximately 50–100 seconds of extraction time. This is communicated to the user via the SSE progress counter during the extraction stage.

---

## 23. Future Scope

The following are explicitly deferred from v1.0. The architecture anticipates them.

- **OAuth login** via Google and GitHub — Supabase supports this natively with one dashboard configuration change and one frontend button per provider
- **Multi-brand comparison mode** — run analysis on two brands simultaneously, render side-by-side charts on a `/compare` route
- **Full article body extraction** — pass full article text to FinBERT for richer sentiment signal beyond the headline
- **Non-English news support** — language detection, translation to English before analysis
- **Scheduled recurring runs** — cron-based weekly or monthly automated monitoring with automatic email delivery
- **Sentiment alert system** — email notification if sentiment drops below a configurable threshold
- **Second sentiment model** — add a second HuggingFace model and expose the sentiment model selector in advanced config
- **Team workspaces** — share reports and chat history across a team account
- **Production Docker deployment** — Dockerfile is written from day one (Section 4.5) making this a straightforward transition

---

## 24. Out of Scope for v1.0

- Social media sentiment (Twitter/X, Reddit, Instagram)
- Competitor benchmarking
- Browser extension or mobile native app
- Admin panel
- Billing or subscription management
- White-label or multi-tenant support
- Real-time webhook delivery of reports
- Any database other than PostgreSQL via Supabase
- Server-side chart rendering via matplotlib or any Python charting library
- Any auth provider other than Supabase Auth
- Serverless backend deployment (incompatible with FinBERT in-process model loading)
