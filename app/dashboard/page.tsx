"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { listRuns, type RunListItem } from "@/lib/api";
import {
  PlayIcon,
  ChevronDownIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  ClockIcon,
  ExternalLinkIcon,
  AlertCircleIcon,
  LoaderIcon,
} from "lucide-react";

const TIME_RANGES = [
  { value: "1m", label: "1 Month" },
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "1y", label: "1 Year" },
] as const;

const DEFAULT_CAPS: Record<string, number> = { "1m": 20, "3m": 40, "6m": 70, "1y": 100 };

function SentimentBadge({ sentiment }: { sentiment: NonNullable<RunListItem["sentiment"]> }) {
  const total = sentiment.positive + sentiment.neutral + sentiment.negative;
  if (total === 0) return null;
  const dominant =
    sentiment.positive >= sentiment.negative
      ? sentiment.positive >= sentiment.neutral
        ? "positive"
        : "neutral"
      : sentiment.negative >= sentiment.neutral
        ? "negative"
        : "neutral";

  const pct = Math.round((sentiment[dominant] / total) * 100);

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {dominant === "positive" && <TrendingUpIcon className="size-3 text-emerald-500" />}
      {dominant === "negative" && <TrendingDownIcon className="size-3 text-red-500" />}
      {dominant === "neutral" && <MinusIcon className="size-3 text-amber-500" />}
      <span
        className={
          dominant === "positive"
            ? "text-emerald-600"
            : dominant === "negative"
              ? "text-red-600"
              : "text-amber-600"
        }
      >
        {pct}% {dominant}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "complete")
    return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 text-xs">Complete</Badge>;
  if (status === "running")
    return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 text-xs">Running</Badge>;
  if (status === "failed")
    return <Badge variant="secondary" className="bg-red-500/10 text-red-600 text-xs">Failed</Badge>;
  return <Badge variant="secondary" className="text-xs">{status}</Badge>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [brand, setBrand] = useState("");
  const [timeRange, setTimeRange] = useState<"1m" | "3m" | "6m" | "1y">("3m");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [articleCap, setArticleCap] = useState<number | "">(DEFAULT_CAPS["3m"]);
  const [includeDomains, setIncludeDomains] = useState("");
  const [excludeDomains, setExcludeDomains] = useState("");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.55);

  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listRuns()
      .then((data) => {
        if (!cancelled) setRuns(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message ?? "Failed to load runs");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runningRun = runs.find((r) => r.status === "running");
  const recentRuns = runs.filter((r) => r.status === "complete").slice(0, 5);
  const capWarning = typeof articleCap === "number" && articleCap > 150;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim() || runningRun) return;
    const params = new URLSearchParams({
      brand: brand.trim(),
      range: timeRange,
    });
    if (typeof articleCap === "number" && articleCap !== DEFAULT_CAPS[timeRange]) {
      params.set("article_cap", String(articleCap));
    }
    if (confidenceThreshold !== 0.55) {
      params.set("confidence_threshold", String(confidenceThreshold));
    }
    if (includeDomains.trim()) params.set("include_domains", includeDomains.trim());
    if (excludeDomains.trim()) params.set("exclude_domains", excludeDomains.trim());
    router.push(`/analyze?${params.toString()}`);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">New Analysis</CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter a brand name and select a time range to begin autonomous sentiment analysis.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="brand-name">Brand Name</Label>
                  <Input
                    id="brand-name"
                    placeholder='e.g. "Nike", "Tesla", "Apple"'
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    autoFocus
                    required
                    disabled={!!runningRun}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Time Range</Label>
                  <div className="flex gap-2">
                    {TIME_RANGES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        disabled={!!runningRun}
                        onClick={() => {
                          setTimeRange(value);
                          setArticleCap(DEFAULT_CAPS[value]);
                        }}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 ${
                          timeRange === value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/40"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger
                    className="flex w-full items-center justify-between rounded-lg border border-border/60 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/30 cursor-pointer"
                  >
                    <span>Advanced Configuration</span>
                    <ChevronDownIcon
                      className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 space-y-4 rounded-lg border border-border/40 bg-muted/20 p-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="article-cap">
                          Max Articles{" "}
                          <span className="text-xs text-muted-foreground">
                            (default: {DEFAULT_CAPS[timeRange]})
                          </span>
                        </Label>
                        <Input
                          id="article-cap"
                          type="number"
                          min={1}
                          value={articleCap}
                          onChange={(e) =>
                            setArticleCap(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          disabled={!!runningRun}
                        />
                        {capWarning && (
                          <p className="flex items-center gap-1.5 text-xs text-amber-600">
                            <AlertCircleIcon className="size-3.5" />
                            Processing time will increase significantly for large article counts.
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="include-domains">Include Domains</Label>
                        <Input
                          id="include-domains"
                          placeholder="espn.com, reuters.com (comma-separated)"
                          value={includeDomains}
                          onChange={(e) => setIncludeDomains(e.target.value)}
                          disabled={!!runningRun}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="exclude-domains">Exclude Domains</Label>
                        <Input
                          id="exclude-domains"
                          placeholder="tabloid.com (comma-separated)"
                          value={excludeDomains}
                          onChange={(e) => setExcludeDomains(e.target.value)}
                          disabled={!!runningRun}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Confidence Threshold</Label>
                          <span className="font-mono text-sm text-muted-foreground">
                            {confidenceThreshold.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={confidenceThreshold}
                          onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                          disabled={!!runningRun}
                          className="w-full accent-primary"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0.0 (include all)</span>
                          <span>1.0 (only high-confidence)</span>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="pt-1">
                  {runningRun ? (
                    <Button type="button" className="w-full" disabled>
                      <LoaderIcon className="size-4 animate-spin" />
                      An analysis is already in progress
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={!brand.trim()}
                    >
                      <PlayIcon className="size-4" />
                      Run Analysis
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Recent Runs
            </h2>
            <Link href="/history" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>

          {loading && (
            <p className="text-sm text-muted-foreground">Loading runs…</p>
          )}
          {loadError && (
            <p className="text-sm text-red-600">Could not load runs: {loadError}</p>
          )}

          {runningRun && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                  <LoaderIcon className="size-4 animate-spin" />
                  Analysis in progress
                </div>
                <p className="text-xs text-muted-foreground">
                  {runningRun.brand_name} · {labelForRange(runningRun.time_range)}
                </p>
                <Link
                  href={`/analyze?brand=${encodeURIComponent(runningRun.brand_name)}&range=${runningRun.time_range}&run_id=${runningRun.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  View progress →
                </Link>
              </CardContent>
            </Card>
          )}

          {recentRuns.map((run) => (
            <Card key={run.id} className="group hover:border-primary/30 transition-colors">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{run.brand_name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {labelForRange(run.time_range)}
                    </div>
                  </div>
                  <StatusBadge status={run.status} />
                </div>

                {run.sentiment && <SentimentBadge sentiment={run.sentiment} />}

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ClockIcon className="size-3" />
                    {new Date(run.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  {run.status === "complete" && (
                    <Link
                      href={`/report/${run.id}`}
                      className="flex items-center gap-1 text-xs text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      View report
                      <ExternalLinkIcon className="size-3" />
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {!loading && !loadError && runs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No runs yet. Submit one above to get started.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function labelForRange(range: string) {
  return range === "1m" ? "1 Month" : range === "3m" ? "3 Months" : range === "6m" ? "6 Months" : "1 Year";
}
