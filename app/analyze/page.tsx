"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { AIUnlockAnimation } from "@/components/uitripled/ai-unlock-animation";
import { LiveLineChart } from "@/components/charts/live-line-chart";
import { LiveLine } from "@/components/charts/live-line";
import { LiveXAxis } from "@/components/charts/live-x-axis";
import { LiveYAxis } from "@/components/charts/live-y-axis";
import { Grid } from "@/components/charts/grid";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { buildAnalyzeUrl, type SSEEvent } from "@/lib/api";
import { useSSE } from "@/lib/use-sse";
import {
  CheckCircle2Icon,
  XCircleIcon,
  LoaderIcon,
  CircleDotIcon,
  NewspaperIcon,
  LinkIcon,
  FileTextIcon,
  WrenchIcon,
  BrainCircuitIcon,
  FileBarChartIcon,
  RocketIcon,
} from "lucide-react";
import type { LiveLinePoint } from "@/components/charts/live-line-chart";

const STAGE_ICONS = {
  news_discovery: NewspaperIcon,
  url_collection: LinkIcon,
  extraction: FileTextIcon,
  processing: WrenchIcon,
  sentiment: BrainCircuitIcon,
  report_generation: FileBarChartIcon,
  run_complete: RocketIcon,
};

const STAGE_LABELS: Record<string, string> = {
  news_discovery: "Identifying best news source",
  url_collection: "Collecting article URLs",
  extraction: "Extracting headlines",
  processing: "Processing and formatting data",
  sentiment: "Running sentiment analysis",
  report_generation: "Generating professional report",
  run_complete: "Analysis complete",
};

const STAGE_ORDER = [
  "news_discovery",
  "url_collection",
  "extraction",
  "processing",
  "sentiment",
  "report_generation",
  "run_complete",
];

type StageStatus = "pending" | "active" | "complete" | "error";

interface StageState {
  stage: string;
  label: string;
  status: StageStatus;
  message?: string;
  current?: number;
  total?: number;
}

export default function AnalyzePage() {
  return (
    <Suspense>
      <AnalyzePageInner />
    </Suspense>
  );
}

function initialStages(): StageState[] {
  return STAGE_ORDER.map((s) => ({
    stage: s,
    label: STAGE_LABELS[s] ?? s,
    status: "pending",
  }));
}

function AnalyzePageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const brand = params.get("brand") ?? "";
  const range = params.get("range") ?? "3m";
  const articleCap = params.get("article_cap");
  const confidenceThreshold = params.get("confidence_threshold");
  const includeDomains = params.get("include_domains");
  const excludeDomains = params.get("exclude_domains");

  const sseUrl = useMemo(() => {
    if (!brand) return null;
    return buildAnalyzeUrl({
      brand,
      range: range as "1m" | "3m" | "6m" | "1y",
      article_cap: articleCap ? Number(articleCap) : undefined,
      confidence_threshold: confidenceThreshold ? Number(confidenceThreshold) : undefined,
      include_domains: includeDomains || undefined,
      exclude_domains: excludeDomains || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, range, articleCap, confidenceThreshold, includeDomains, excludeDomains]);

  const { events, error } = useSSE(sseUrl);

  const [stages, setStages] = useState<StageState[]>(initialStages());
  const [livePoints, setLivePoints] = useState<LiveLinePoint[]>([]);
  const [liveValue, setLiveValue] = useState(0.5);
  const [showUnlock, setShowUnlock] = useState(false);
  const [chainOpen, setChainOpen] = useState(true);
  const [navigated, setNavigated] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const lastEventRef = useRef<number>(-1);

  // Reset on URL change
  useEffect(() => {
    setStages(initialStages());
    setLivePoints([]);
    setLiveValue(0.5);
    setShowUnlock(false);
    setNavigated(false);
    startTimeRef.current = null;
    lastEventRef.current = -1;
  }, [sseUrl]);

  // Apply incoming events
  useEffect(() => {
    if (events.length <= lastEventRef.current + 1) return;
    if (startTimeRef.current === null && events.length > 0) {
      startTimeRef.current = Date.now();
    }

    for (let i = lastEventRef.current + 1; i < events.length; i++) {
      const evt = events[i] as SSEEvent;
      applyEvent(evt);
    }
    lastEventRef.current = events.length - 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  function applyEvent(evt: SSEEvent) {
    if ("status" in evt && evt.status === "error") {
      setStages((prev) => {
        const idx = prev.findIndex((s) => s.stage === (evt as { stage: string }).stage);
        if (idx === -1) return prev;
        return prev.map((s, i) =>
          i === idx ? { ...s, status: "error" as StageStatus, message: evt.message } : s
        );
      });
      return;
    }

    if (evt.stage === "run_complete") {
      setStages((prev) => prev.map((s) => (s.stage === "run_complete" ? { ...s, status: "complete" } : s)));
      const runId = (evt as { run_id: string }).run_id;
      setShowUnlock(true);
      window.setTimeout(() => {
        if (!navigated) {
          setNavigated(true);
          router.push(`/report/${runId}`);
        }
      }, 2200);
      return;
    }

    setStages((prev) => {
      const idx = prev.findIndex((s) => s.stage === evt.stage);
      if (idx === -1) return prev;
      const status: StageStatus = evt.status === "complete" ? "complete" : "active";
      const next = [...prev];
      const previous = next[idx]!;
      const current = (evt as { current?: number }).current;
      const total = (evt as { total?: number }).total;
      next[idx] = {
        ...previous,
        status,
        message:
          (evt as { message?: string }).message ??
          (current && total ? `${current} / ${total}` : previous.message),
        current,
        total,
      };
      // Mark earlier stages complete if this one is active/complete
      for (let i = 0; i < idx; i++) {
        if (next[i]!.status === "pending" || next[i]!.status === "active") {
          next[i] = { ...next[i]!, status: "complete" };
        }
      }
      return next;
    });

    if (evt.stage === "sentiment" && evt.status === "progress" && "latest" in evt && evt.latest) {
      const now = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
      const point: LiveLinePoint = { time: now, value: evt.latest.confidence };
      setLivePoints((prev) => [...prev, point]);
      setLiveValue(evt.latest.confidence);
    }
  }

  const rangeLabel =
    range === "1m" ? "1 Month" : range === "3m" ? "3 Months" : range === "6m" ? "6 Months" : "1 Year";

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Logo className="h-5" />
        <div className="text-sm text-muted-foreground">
          Analysing <span className="font-semibold text-foreground">{brand || "—"}</span>
          {" · "}
          <span>{rangeLabel}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
          Cancel
        </Button>
      </header>

      <div className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-2xl space-y-8">
          <AnimatePresence>
            {showUnlock && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex justify-center"
              >
                <AIUnlockAnimation autoPlay />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!showUnlock && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="rounded-2xl border border-border/60 bg-card p-6"
              >
                <ChainOfThought open={chainOpen} onOpenChange={setChainOpen}>
                  <ChainOfThoughtHeader>Analysis Pipeline</ChainOfThoughtHeader>
                  <ChainOfThoughtContent>
                    {stages.map((s) => {
                      const Icon = STAGE_ICONS[s.stage as keyof typeof STAGE_ICONS] ?? CircleDotIcon;

                      const statusIcon =
                        s.status === "complete" ? (
                          <CheckCircle2Icon className="size-4 text-emerald-500" />
                        ) : s.status === "active" ? (
                          <LoaderIcon className="size-4 animate-spin text-primary" />
                        ) : s.status === "error" ? (
                          <XCircleIcon className="size-4 text-destructive" />
                        ) : (
                          <CircleDotIcon className="size-4 text-muted-foreground/40" />
                        );

                      return (
                        <ChainOfThoughtStep
                          key={s.stage}
                          icon={Icon}
                          label={
                            <div className="flex items-center justify-between gap-3">
                              <span>{s.label}</span>
                              {statusIcon}
                            </div>
                          }
                          description={
                            s.status !== "pending" && s.message
                              ? s.message
                              : s.status === "active" && !s.message
                                ? "In progress..."
                                : undefined
                          }
                          status={
                            s.status === "complete"
                              ? "complete"
                              : s.status === "active"
                                ? "active"
                                : "pending"
                          }
                        />
                      );
                    })}
                  </ChainOfThoughtContent>
                </ChainOfThought>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {livePoints.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-border/60 bg-card p-6"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Live Sentiment Feed</h3>
                    <p className="text-xs text-muted-foreground">
                      Confidence score per article as scored by FinBERT
                    </p>
                  </div>
                  <div className="font-mono text-2xl font-bold text-primary">
                    {(liveValue * 100).toFixed(0)}
                    <span className="text-sm font-normal text-muted-foreground">%</span>
                  </div>
                </div>
                <LiveLineChart
                  data={livePoints}
                  value={liveValue}
                  dataKey="value"
                  window={60}
                  paused={showUnlock}
                  style={{ height: 180 }}
                >
                  <Grid />
                  <LiveXAxis />
                  <LiveYAxis />
                  <LiveLine dataKey="value" stroke="var(--primary)" strokeWidth={2} />
                </LiveLineChart>
              </motion.div>
            )}
          </AnimatePresence>

          {error && !showUnlock && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600">
              <p className="font-medium">Pipeline error</p>
              <p className="mt-1 text-xs">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => router.push("/dashboard")}
              >
                Return to dashboard
              </Button>
            </div>
          )}

          <AnimatePresence>
            {showUnlock && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-sm text-muted-foreground"
              >
                Redirecting to your report…
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
