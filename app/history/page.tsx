"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockRuns, type MockRun } from "@/lib/mock-data";
import {
  SearchIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  Trash2Icon,
  LoaderIcon,
  ChevronDownIcon,
  ClockIcon,
  NewspaperIcon,
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    complete: "bg-emerald-500/10 text-emerald-600",
    running: "bg-blue-500/10 text-blue-600",
    failed: "bg-red-500/10 text-red-600",
    pending: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="secondary" className={`text-xs ${map[status] ?? ""}`}>
      {status === "running" && <LoaderIcon className="size-3 mr-1 animate-spin" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function SentimentBar({ sentiment }: { sentiment: MockRun["sentiment"] }) {
  if (!sentiment) return <span className="text-xs text-muted-foreground">—</span>;
  const total = sentiment.positive + sentiment.neutral + sentiment.negative;
  const pos = (sentiment.positive / total) * 100;
  const neu = (sentiment.neutral / total) * 100;
  const neg = (sentiment.negative / total) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 w-28 overflow-hidden rounded-full bg-muted">
        <div className="bg-emerald-500" style={{ width: `${pos}%` }} />
        <div className="bg-amber-400" style={{ width: `${neu}%` }} />
        <div className="bg-red-500" style={{ width: `${neg}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">
        {Math.round(pos)}% <span className="text-emerald-600">pos</span>
      </span>
    </div>
  );
}

function RunRow({ run, expanded, onToggle }: { run: MockRun; expanded: boolean; onToggle: () => void }) {
  const rangeLabel =
    run.time_range === "1m" ? "1 Month" : run.time_range === "3m" ? "3 Months" : run.time_range === "6m" ? "6 Months" : "1 Year";

  return (
    <>
      <motion.button
        onClick={onToggle}
        className="w-full p-4 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex flex-wrap items-center gap-4">
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </motion.div>

          <div className="min-w-[120px]">
            <div className="font-medium text-sm">{run.brand_name}</div>
            <div className="text-xs text-muted-foreground">{rangeLabel}</div>
          </div>

          <div className="hidden sm:block min-w-[110px]">
            <SentimentBar sentiment={run.sentiment} />
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground min-w-[100px]">
            <NewspaperIcon className="size-3.5" />
            {run.article_count ? `${run.article_count} articles` : "—"}
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground min-w-[100px]">
            <ClockIcon className="size-3.5" />
            {new Date(run.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <StatusBadge status={run.status} />
            {run.status === "complete" && (
              <Link
                href={`/report/${run.id}`}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLinkIcon className="size-3.5" />
                <span className="hidden sm:inline">Report</span>
              </Link>
            )}
          </div>
        </div>
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expand"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border bg-muted/30"
          >
            <div className="grid grid-cols-2 gap-4 p-4 text-sm sm:grid-cols-3 md:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Run ID</p>
                <p className="font-mono text-xs text-foreground">{run.id}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">News Source</p>
                <p className="text-foreground">{run.news_source_used ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Completed</p>
                <p className="text-foreground">
                  {run.completed_at
                    ? new Date(run.completed_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </p>
              </div>
              {run.status === "failed" && (
                <div className="col-span-full">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Failure</p>
                  <p className="text-red-600 text-xs">{run.failure_message}</p>
                </div>
              )}
              <div className="col-span-full flex gap-2">
                {run.status === "complete" && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/report/${run.id}`}>
                      <ExternalLinkIcon className="size-3.5" />
                      View Report
                    </Link>
                  </Button>
                )}
                {run.status === "failed" && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/dashboard`}>
                      <RefreshCwIcon className="size-3.5" />
                      Retry
                    </Link>
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                  <Trash2Icon className="size-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function HistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      mockRuns.filter((r) =>
        r.brand_name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [searchQuery]
  );

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Analysis History</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} of {mockRuns.length} runs
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by brand name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" asChild>
          <Link href="/dashboard">New Analysis</Link>
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="hidden sm:grid border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          style={{ gridTemplateColumns: "1.5rem 1fr 8rem 7rem 7rem 8rem" }}>
          <span />
          <span>Brand</span>
          <span>Sentiment</span>
          <span>Articles</span>
          <span>Date</span>
          <span className="text-right pr-6">Status</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          <AnimatePresence mode="popLayout">
            {filtered.length > 0 ? (
              filtered.map((run, idx) => (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, delay: idx * 0.03 }}
                >
                  <RunRow
                    run={run}
                    expanded={expandedId === run.id}
                    onToggle={() => setExpandedId((c) => (c === run.id ? null : run.id))}
                  />
                </motion.div>
              ))
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-12 text-center text-sm text-muted-foreground"
              >
                No runs match your search.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppShell>
  );
}
