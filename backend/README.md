# MarketSense Backend

FastAPI backend for MarketSense brand sentiment analysis.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: optionally set OPENROUTER_API_KEY for AI report generation
```

## Run

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

First boot downloads FinBERT (~440 MB) into the HuggingFace cache.

## Notes

- Auth is deferred — every request is treated as anonymous.
- Headlines are the sole input to FinBERT (PRD §8.3). `newspaper4k` is not used.
- Google News RSS is the default news source (no API key needed). GNews + NewsAPI are tried first if their keys are present.
- OpenRouter is optional; without a key the report falls back to a deterministic template synthesised from aggregate metrics.
- WeasyPrint requires system libraries (`brew install pango cairo gdk-pixbuf libffi` on macOS). The PDF endpoint degrades gracefully if WeasyPrint cannot import.
