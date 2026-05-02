"use client";

import { Suspense, useEffect, useRef, useState } from "react";
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
import { mockProcessingStages, mockLivePoints } from "@/lib/mock-data";
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

function AnalyzePageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const brand = params.get("brand") ?? "Nike";
  const range = params.get("range") ?? "3m";

  const [stages, setStages] = useState<StageState[]>(
    mockProcessingStages.map((s) => ({
      stage: s.stage,
      label: s.label,
      status: "pending" as StageStatus,
    }))
  );
  const [currentStageIdx, setCurrentStageIdx] = useState(-1);
  const [isComplete, setIsComplete] = useState(false);
  const [livePoints, setLivePoints] = useState<LiveLinePoint[]>([]);
  const [liveValue, setLiveValue] = useState(0.5);
  const [showUnlock, setShowUnlock] = useState(false);
  const [chainOpen, setChainOpen] = useState(true);

  const livePointsRef = useRef<LiveLinePoint[]>([]);
  const mockPointsRef = useRef([...mockLivePoints]);

  // Simulate SSE pipeline
  useEffect(() => {
    let cancelled = false;
    const startTime = Date.now();

    const runStage = async (idx: number) => {
      if (cancelled || idx >= mockProcessingStages.length) return;

      const stageDef = mockProcessingStages[idx]!;

      // Mark active
      setStages((prev) =>
        prev.map((s, i) =>
          i === idx ? { ...s, status: "active" } : s
        )
      );
      setCurrentStageIdx(idx);

      // Simulate sentiment progress with live chart updates
      if (stageDef.stage === "sentiment" && stageDef.total) {
        const total = stageDef.total;
        const interval = stageDef.duration / total;

        for (let i = 0; i < Math.min(total, mockLivePoints.length); i++) {
          await delay(interval);
          if (cancelled) return;

          const pt = mockLivePoints[i]!;
          const now = (Date.now() - startTime) / 1000;
          const newPt: LiveLinePoint = { time: now, value: pt.score };
          livePointsRef.current = [...livePointsRef.current, newPt];
          setLivePoints([...livePointsRef.current]);
          setLiveValue(pt.score);

          setStages((prev) =>
            prev.map((s, idx2) =>
              idx2 === idx
                ? { ...s, message: `${i + 1} / ${total} articles scored`, current: i + 1, total }
                : s
            )
          );
        }
      } else if (stageDef.stage === "extraction" && stageDef.total) {
        const total = stageDef.total;
        const steps = 5;
        const interval = stageDef.duration / steps;
        for (let i = 1; i <= steps; i++) {
          await delay(interval);
          if (cancelled) return;
          setStages((prev) =>
            prev.map((s, idx2) =>
              idx2 === idx
                ? { ...s, message: `${Math.round((i / steps) * total)} / ${total} extracted`, current: Math.round((i / steps) * total), total }
                : s
            )
          );
        }
      } else {
        await delay(stageDef.duration);
      }

      if (cancelled) return;

      // Mark complete
      setStages((prev) =>
        prev.map((s, i) =>
          i === idx
            ? { ...s, status: "complete", message: stageDef.message }
            : s
        )
      );

      // Proceed to next stage
      if (idx + 1 < mockProcessingStages.length) {
        await delay(300);
        runStage(idx + 1);
      } else {
        // All done
        await delay(600);
        if (!cancelled) {
          setShowUnlock(true);
          await delay(3200);
          if (!cancelled) {
            setIsComplete(true);
            await delay(800);
            if (!cancelled) {
              router.push("/report/run-001");
            }
          }
        }
      }
    };

    // Kick off after short delay
    delay(500).then(() => {
      if (!cancelled) runStage(0);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const rangeLabel =
    range === "1m" ? "1 Month" : range === "3m" ? "3 Months" : range === "6m" ? "6 Months" : "1 Year";

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Minimal nav */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Logo className="h-5" />
        <div className="text-sm text-muted-foreground">
          Analysing{" "}
          <span className="font-semibold text-foreground">{brand}</span>
          {" · "}
          <span>{rangeLabel}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard")}
        >
          Cancel
        </Button>
      </header>

      <div className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-2xl space-y-8">
          {/* AI Unlock animation — shown on completion */}
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

          {/* Chain of thought — hidden once unlock shows */}
          <AnimatePresence>
            {!showUnlock && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="rounded-2xl border border-border/60 bg-card p-6"
              >
                <ChainOfThought
                  open={chainOpen}
                  onOpenChange={setChainOpen}
                >
                  <ChainOfThoughtHeader>
                    Analysis Pipeline
                  </ChainOfThoughtHeader>
                  <ChainOfThoughtContent>
                    {stages.map((s) => {
                      const Icon =
                        STAGE_ICONS[s.stage as keyof typeof STAGE_ICONS] ?? CircleDotIcon;

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

          {/* Live sentiment chart */}
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
                  paused={isComplete}
                  style={{ height: 180 }}
                >
                  <Grid />
                  <LiveXAxis />
                  <LiveYAxis />
                  <LiveLine
                    dataKey="value"
                    stroke="var(--primary)"
                    strokeWidth={2}
                  />
                </LiveLineChart>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Redirect notice */}
          <AnimatePresence>
            {isComplete && (
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

function delay(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}
