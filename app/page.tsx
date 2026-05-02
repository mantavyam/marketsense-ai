"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FloatingPaths } from "@/components/floating-paths";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  BarChart3Icon,
  BrainCircuitIcon,
  FileTextIcon,
  MessageSquareTextIcon,
  ArrowRightIcon,
  SparklesIcon,
} from "lucide-react";

const features = [
  {
    icon: BrainCircuitIcon,
    title: "FinBERT Sentiment Engine",
    desc: "Financial-domain transformer model scores every headline with positive, neutral, or negative confidence.",
  },
  {
    icon: BarChart3Icon,
    title: "11 Visual Chart Types",
    desc: "Area, Bar, Candlestick, Choropleth, Funnel, Line, Pie, Radar, Ring, Sankey, and Live Line charts.",
  },
  {
    icon: FileTextIcon,
    title: "AI-Generated Reports",
    desc: "Executive summaries and strategic recommendations powered by leading open-source LLMs via OpenRouter.",
  },
  {
    icon: MessageSquareTextIcon,
    title: "Conversational Insights",
    desc: "Ask follow-up questions grounded strictly in your report data through a floating chat panel.",
  },
];

export default function HeroPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* Background animated paths */}
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>

      {/* Radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, oklch(0.6 0.2 260 / 0.12), transparent)",
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <Logo className="h-5" />
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/login">Get started free</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pt-24 pb-16 text-center md:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur"
        >
          <SparklesIcon className="size-3.5 text-primary" />
          Powered by FinBERT + OpenRouter
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-6xl"
        >
          Understand how the world
          <br />
          <span className="bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            talks about your brand
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10 max-w-2xl text-lg text-muted-foreground"
        >
          Enter a brand name. MarketSense autonomously discovers news sources,
          runs FinBERT sentiment analysis on every headline, and delivers a
          rich visual report — no setup required.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button size="lg" className="gap-2 px-8" asChild>
            <Link href="/login">
              Start analysing free
              <ArrowRightIcon className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="px-8" asChild>
            <Link href="/report/run-001">View sample report</Link>
          </Button>
        </motion.div>
      </section>

      {/* Feature grid */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24 md:px-12">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {features.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-border/60 bg-card/70 p-6 backdrop-blur"
            >
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="size-5 text-primary" />
              </div>
              <h3 className="mb-1.5 text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="mt-12 grid grid-cols-3 gap-6 rounded-2xl border border-border/60 bg-card/60 px-8 py-6 text-center backdrop-blur"
        >
          {[
            { value: "11", label: "Chart types" },
            { value: "3", label: "News sources" },
            { value: "100%", label: "Automated" },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-3xl font-bold text-foreground">{value}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          ))}
        </motion.div>
      </section>
    </main>
  );
}
