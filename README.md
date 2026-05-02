# MarketSense-AI
- MarketSense is a full-stack AI-powered web application that enables users to perform deep sentiment analysis on news coverage for any brand. The user enters a brand name and a time range, and the system autonomously discovers the best available free news source, extracts relevant headlines, processes them through a pre-trained transformer sentiment model (FinBERT), generates a structured visual report backed by 11 chart types, and optionally delivers the report via email. A floating chatbot panel allows real-time conversational interaction grounded strictly in the generated sentiment report.

Backend complete + frontend coupled + smoke-tested end-to-end. Summary:

  What shipped

  Backend (/backend):
  - FastAPI + SQLite (SQLAlchemy async). No auth — anonymous endpoints.
  - News: Google News RSS via feedparser (default, no key); GNews + NewsAPI used as fallbacks when GNEWS_API_KEY / NEWSAPI_KEY set. newspaper4k skipped — headlines come straight from
  RSS/API per PRD §8.3.
  - Sentiment: FinBERT (ProsusAI/finbert) loaded once at startup via lifespan, scored per-headline.
  - Aggregates: 11 chart payloads computed + summary metrics (momentum via slope, radar dimensions, sankey, ring, funnel, choropleth with TLD lookup).
  - Report: OpenRouter free-model selection with mistralai/mistral-7b-instruct:free fallback; deterministic template fallback when OPENROUTER_API_KEY absent.
  - PDF: WeasyPrint + Jinja2 template. Accepts client-captured chart SVGs; substitutes plain-text fallback per missing chart.
  - Endpoints: GET /analyze (SSE), GET /runs, GET /runs/{id}, DELETE /runs/{id}, GET /reports/{id}, POST /pdf/{id}, GET /health.

  Frontend coupling:
  - New lib/api.ts (typed client) + lib/use-sse.ts hook.
  - Dashboard, history, analyze, report wired to real backend.
  - lib/mock-data.ts deleted; landing page sample-link redirected to /dashboard.
  - Auth deferred — login still mock-redirects per existing flow.

  Verified:
  - End-to-end run on Tesla/Apple → SSE progressing through all stages → report persisted → report endpoint returns correct shape → PDF endpoint returns valid 53KB PDF → frontend pages
  render 200.
  - TypeScript clean.

  Run instructions

  # Backend
  cd backend
  source .venv/bin/activate   # already created
  uvicorn app.main:app --reload --port 8000

  # Frontend (separate terminal, repo root)
  cp .env.local.example .env.local
  pnpm dev

  Optional: set OPENROUTER_API_KEY in backend/.env for AI-generated reports (template fallback works without it).