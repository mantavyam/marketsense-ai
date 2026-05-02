"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { mockReport } from "@/lib/mock-data";
import { FloatingChatWidget } from "@/components/uitripled/floating-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ── Chart components ──────────────────────────────────────────────────────────
import { AreaChart } from "@/components/charts/area-chart";
import { Area } from "@/components/charts/area";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { YAxis } from "@/components/charts/y-axis";
import { ChartTooltip } from "@/components/charts/tooltip/chart-tooltip";

import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { BarYAxis } from "@/components/charts/bar-y-axis";

import { CandlestickChart } from "@/components/charts/candlestick-chart";
import { Candlestick } from "@/components/charts/candlestick";


import { FunnelChart } from "@/components/charts/funnel-chart";

import { LineChart } from "@/components/charts/line-chart";
import { Line } from "@/components/charts/line";

import { LiveLineChart } from "@/components/charts/live-line-chart";
import { LiveLine } from "@/components/charts/live-line";
import { LiveXAxis } from "@/components/charts/live-x-axis";
import { LiveYAxis } from "@/components/charts/live-y-axis";

import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { PieCenter } from "@/components/charts/pie-center";

import { RadarChart } from "@/components/charts/radar-chart";
import { RadarArea } from "@/components/charts/radar-area";
import { RadarGrid } from "@/components/charts/radar-grid";
import { RadarAxis } from "@/components/charts/radar-axis";
import { RadarLabels } from "@/components/charts/radar-labels";

import { RingChart } from "@/components/charts/ring-chart";
import { Ring } from "@/components/charts/ring";
import { RingCenter } from "@/components/charts/ring-center";

import { SankeyChart } from "@/components/charts/sankey/sankey-chart";
import { SankeyNode } from "@/components/charts/sankey/sankey-node";
import { SankeyLink } from "@/components/charts/sankey/sankey-link";
import { SankeyTooltip } from "@/components/charts/sankey/sankey-tooltip";

import {
  DownloadIcon,
  MailIcon,
  CalendarIcon,
  NewspaperIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  BarChart3Icon,
} from "lucide-react";
import type { LiveLinePoint } from "@/components/charts/live-line-chart";

const { aggregate_data: data, brand_name, time_range, article_count, run_date, report_text } = mockReport;

// Frozen live line data (the analysis already completed)
const frozenLivePoints: LiveLinePoint[] = data.lineData.map((d, i) => ({
  time: d.date.getTime() / 1000,
  value: d.confidence,
}));
const frozenLiveValue = frozenLivePoints.at(-1)?.value ?? 0.75;

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </CardHeader>
      <CardContent className="flex-1 pt-0">{children}</CardContent>
    </Card>
  );
}

export default function ReportPage() {
  const [hoveredPieIdx, setHoveredPieIdx] = useState<number | null>(null);
  const [hoveredRingIdx, setHoveredRingIdx] = useState<number | null>(null);
  const [hoveredRadarIdx, setHoveredRadarIdx] = useState<number | null>(null);

  const { summary } = data;
  const positivePercent = Math.round((summary.positive / summary.total) * 100);
  const negativePercent = Math.round((summary.negative / summary.total) * 100);
  const neutralPercent = 100 - positivePercent - negativePercent;

  const rangeLabel =
    time_range === "1m" ? "1 Month" : time_range === "3m" ? "3 Months" : time_range === "6m" ? "6 Months" : "1 Year";

  // Paragraph extraction from report_text
  const execSummary = report_text
    .split("\n\n")
    .find((p) => p.startsWith("## Executive Summary"))
    ?.replace("## Executive Summary\n", "") ?? "";

  const reportSections = report_text.split(/^## /m).filter(Boolean).map((section) => {
    const [heading, ...rest] = section.split("\n");
    return { heading: heading?.trim() ?? "", body: rest.join("\n").trim() };
  });

  return (
    <AppShell>
      {/* ── Report Header ──────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold">{brand_name}</h1>
            <Badge variant="secondary">{rangeLabel}</Badge>
            <Badge
              variant="secondary"
              className={
                summary.momentum === "improving"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : summary.momentum === "declining"
                    ? "bg-red-500/10 text-red-600"
                    : "bg-amber-500/10 text-amber-600"
              }
            >
              {summary.momentum === "improving" ? (
                <><TrendingUpIcon className="size-3 mr-1" />Improving</>
              ) : summary.momentum === "declining" ? (
                <><TrendingDownIcon className="size-3 mr-1" />Declining</>
              ) : (
                <><MinusIcon className="size-3 mr-1" />Stable</>
              )}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <NewspaperIcon className="size-3.5" />
              {article_count} articles
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="size-3.5" />
              {new Date(run_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline">
            <DownloadIcon className="size-4" />
            Download PDF
          </Button>
          <Button size="sm" variant="outline">
            <MailIcon className="size-4" />
            Send via Email
          </Button>
        </div>
      </div>

      {/* ── Executive Summary ──────────────────────────────────── */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3Icon className="size-4 text-primary" />
            <h2 className="font-semibold">Executive Summary</h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{execSummary}</p>
          <div className="mt-5 grid grid-cols-3 gap-4 rounded-xl bg-muted/40 p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{positivePercent}%</div>
              <div className="text-xs text-muted-foreground">Positive</div>
              <div className="text-xs text-muted-foreground">{summary.positive} articles</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{neutralPercent}%</div>
              <div className="text-xs text-muted-foreground">Neutral</div>
              <div className="text-xs text-muted-foreground">{summary.neutral} articles</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{negativePercent}%</div>
              <div className="text-xs text-muted-foreground">Negative</div>
              <div className="text-xs text-muted-foreground">{summary.negative} articles</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 11 Charts Grid ─────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">

        {/* 1. Area Chart */}
        <ChartCard
          title="Sentiment Over Time"
          description="Stacked area showing positive, neutral, and negative article counts per week."
        >
          <AreaChart data={data.areaData} xDataKey="date" aspectRatio="2 / 1">
            <Grid />
            <Area dataKey="positive" stroke="var(--chart-1)" fill="var(--chart-1)" />
            <Area dataKey="neutral" stroke="var(--chart-2)" fill="var(--chart-2)" />
            <Area dataKey="negative" stroke="var(--chart-3)" fill="var(--chart-3)" />
            <XAxis />
            <YAxis />
            <ChartTooltip />
          </AreaChart>
        </ChartCard>

        {/* 2. Bar Chart */}
        <ChartCard
          title="Article Volume by Period"
          description="Grouped bars showing article counts per time bucket split by sentiment."
        >
          <BarChart data={data.barData} xDataKey="name" aspectRatio="2 / 1">
            <Grid />
            <Bar dataKey="positive" fill="var(--chart-1)" />
            <Bar dataKey="neutral" fill="var(--chart-2)" />
            <Bar dataKey="negative" fill="var(--chart-3)" />
            <BarXAxis />
            <BarYAxis />
            <ChartTooltip />
          </BarChart>
        </ChartCard>

        {/* 3. Candlestick Chart */}
        <ChartCard
          title="Confidence Volatility"
          description="OHLC candles show how decisive the sentiment signal was per time bucket."
        >
          <CandlestickChart data={data.candlestickData} aspectRatio="2 / 1">
            <Grid />
            <Candlestick />
            <XAxis />
            <YAxis />
            <ChartTooltip />
          </CandlestickChart>
        </ChartCard>

        {/* 4. Line Chart */}
        <ChartCard
          title="Average Confidence Score"
          description="Single line showing model decisiveness over time. Declining values indicate ambiguous coverage."
        >
          <LineChart data={data.lineData} xDataKey="date" aspectRatio="2 / 1">
            <Grid />
            <Line dataKey="confidence" stroke="var(--chart-1)" />
            <XAxis />
            <YAxis />
            <ChartTooltip />
          </LineChart>
        </ChartCard>

        {/* 5. Pie Chart */}
        <ChartCard
          title="Overall Sentiment Distribution"
          description="Three slices showing positive, neutral, and negative share of all analysed articles."
        >
          <div className="flex items-center gap-6">
            <PieChart
              data={data.pieData}
              innerRadius={55}
              padAngle={0.03}
              cornerRadius={4}
              hoveredIndex={hoveredPieIdx}
              onHoverChange={setHoveredPieIdx}
              className="max-w-50"
            >
              {data.pieData.map((_, i) => (
                <PieSlice key={i} index={i} />
              ))}
              <PieCenter
                defaultLabel="positive"
                suffix="%"
                valueClassName="text-xl font-bold"
                labelClassName="text-xs text-muted-foreground"
              />
            </PieChart>
            <div className="flex flex-col gap-2">
              {data.pieData.map((slice, i) => (
                <div
                  key={slice.label}
                  className={`flex items-center gap-2 cursor-pointer rounded px-2 py-1 transition-colors ${hoveredPieIdx === i ? "bg-muted" : ""}`}
                  onMouseEnter={() => setHoveredPieIdx(i)}
                  onMouseLeave={() => setHoveredPieIdx(null)}
                >
                  <div className="size-3 rounded-full" style={{ background: slice.color }} />
                  <span className="text-sm">{slice.label}</span>
                  <span className="ml-auto text-sm font-medium text-muted-foreground">{slice.value}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* 6. Ring Chart */}
        <ChartCard
          title="Sentiment by Top Source Domains"
          description="Ring segments sized by article count per domain. Hover to see details."
        >
          <div className="flex items-center gap-6">
            <RingChart
              data={data.ringData}
              hoveredIndex={hoveredRingIdx}
              onHoverChange={setHoveredRingIdx}
              className="max-w-50"
            >
              {data.ringData.map((_, i) => (
                <Ring key={i} index={i} />
              ))}
              <RingCenter
                defaultLabel="articles"
                valueClassName="text-xl font-bold"
                labelClassName="text-xs text-muted-foreground"
              />
            </RingChart>
            <div className="flex flex-col gap-1.5">
              {data.ringData.map((ring, i) => (
                <div
                  key={ring.label}
                  className={`flex items-center gap-2 cursor-pointer rounded px-2 py-0.5 transition-colors text-sm ${hoveredRingIdx === i ? "bg-muted" : ""}`}
                  onMouseEnter={() => setHoveredRingIdx(i)}
                  onMouseLeave={() => setHoveredRingIdx(null)}
                >
                  <div className="size-2.5 rounded-full" style={{ background: ring.color }} />
                  <span>{ring.label}</span>
                  <span className="ml-auto text-muted-foreground">{ring.value}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* 7. Radar Chart */}
        <ChartCard
          title="Brand Health Score"
          description="Six-axis radar scoring sentiment, coverage volume, source diversity, confidence, momentum, and recency."
        >
          <RadarChart
            data={data.radarData}
            metrics={data.radarMetrics}
            hoveredIndex={hoveredRadarIdx}
            onHoverChange={setHoveredRadarIdx}
            className="aspect-square max-h-75 w-full"
          >
            <RadarGrid />
            <RadarAxis />
            <RadarLabels />
            {data.radarData.map((_, i) => (
              <RadarArea key={i} index={i} />
            ))}
          </RadarChart>
        </ChartCard>

        {/* 8. Funnel Chart */}
        <ChartCard
          title="Article Pipeline Attrition"
          description="Stages from URLs discovered to articles included in report."
        >
          <FunnelChart
            data={data.funnelData}
            showLabels
            showValues
            showPercentage
            className="aspect-3/2 w-full"
            color="var(--chart-1)"
          />
        </ChartCard>

        {/* 9. Live Line Chart (frozen) */}
        <ChartCard
          title="Real-Time Sentiment Feed"
          description="Chronological confidence scores as articles were processed. Frozen post-analysis."
        >
          <LiveLineChart
            data={frozenLivePoints}
            value={frozenLiveValue}
            dataKey="value"
            window={frozenLivePoints.length > 0
              ? (frozenLivePoints.at(-1)!.time - frozenLivePoints[0]!.time) * 1.1
              : 60}
            paused
            style={{ height: 200 }}
          >
            <Grid />
            <LiveXAxis />
            <LiveYAxis />
            <LiveLine dataKey="value" stroke="var(--chart-1)" strokeWidth={2} />
          </LiveLineChart>
        </ChartCard>

        {/* 10. Sankey Chart */}
        <ChartCard
          title="Sentiment Flow: Source → Category"
          description="Link width represents article count flowing from each news domain to its sentiment category."
        >
          <SankeyChart
            data={data.sankeyData}
            aspectRatio="2 / 1"
            nodeWidth={12}
            nodePadding={20}
          >
            <SankeyNode />
            <SankeyLink />
            <SankeyTooltip />
          </SankeyChart>
        </ChartCard>

        {/* 11. Geographic Coverage — bar chart (Choropleth requires world GeoJSON in production) */}
        <div className="md:col-span-2">
          <ChartCard
            title="Geographic Coverage Distribution"
            description="Article volume by inferred source country. In production this renders as an interactive world choropleth map."
          >
            <BarChart
              data={[
                { name: "United States", articles: 22 },
                { name: "Germany", articles: 6 },
                { name: "Australia", articles: 5 },
                { name: "France", articles: 3 },
                { name: "Canada", articles: 2 },
                { name: "United Kingdom", articles: 4 },
              ]}
              xDataKey="name"
              aspectRatio="3 / 1"
              orientation="horizontal"
            >
              <Grid />
              <Bar dataKey="articles" fill="var(--chart-1)" />
              <BarXAxis />
              <BarYAxis />
              <ChartTooltip />
            </BarChart>
          </ChartCard>
        </div>
      </div>

      {/* ── Top headlines ──────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUpIcon className="size-4 text-emerald-500" />
              Top Positive Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.top_positive.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 size-5 shrink-0 rounded-full bg-emerald-500/10 text-xs font-semibold text-emerald-600 flex items-center justify-center">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{item.title}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.source}</span>
                    <span className="text-emerald-600 font-medium">
                      {(item.confidence * 100).toFixed(0)}% confident
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingDownIcon className="size-4 text-red-500" />
              Top Negative Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.top_negative.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 size-5 shrink-0 rounded-full bg-red-500/10 text-xs font-semibold text-red-600 flex items-center justify-center">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{item.title}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.source}</span>
                    <span className="text-red-600 font-medium">
                      {(item.confidence * 100).toFixed(0)}% confident
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Full AI Report ─────────────────────────────────────── */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Full AI Report</CardTitle>
          <p className="text-xs text-muted-foreground">
            Generated by OpenRouter · mistralai/mistral-7b-instruct:free
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {reportSections.map(({ heading, body }) => (
              <div key={heading}>
                <h3 className="mb-2 text-sm font-semibold text-foreground">{heading}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{body}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Floating chatbot */}
      <FloatingChatWidget />
    </AppShell>
  );
}
