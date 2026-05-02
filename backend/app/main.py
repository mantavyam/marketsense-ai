import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.analyze import router as analyze_router
from app.api.pdf import router as pdf_router
from app.api.runs import router as runs_router
from app.config import settings
from app.db import init_db
from app.services import sentiment as sentiment_svc

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Initialising database...")
    await init_db()
    log.info("Loading sentiment model in background...")
    asyncio.create_task(asyncio.to_thread(sentiment_svc.load_model))
    yield


app = FastAPI(title="MarketSense Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": sentiment_svc.is_loaded()}


app.include_router(analyze_router)
app.include_router(runs_router)
app.include_router(pdf_router)
