"use client";

import { useState } from "react";
import { UrlInput, type CheckParams } from "@/components/url-input";
import type { CheckReport, CheckResult, Severity } from "@/types";

const severityConfig: Record<
  Severity,
  { label: string; bgClass: string; textClass: string; borderClass: string }
> = {
  critical: {
    label: "Critical",
    bgClass: "bg-[var(--critical-bg)]",
    textClass: "text-[var(--critical-text)]",
    borderClass: "border-l-[var(--critical-text)]",
  },
  warning: {
    label: "Warning",
    bgClass: "bg-[var(--warning-bg)]",
    textClass: "text-[var(--warning-text)]",
    borderClass: "border-l-[var(--warning-text)]",
  },
  info: {
    label: "Info",
    bgClass: "bg-[var(--info-bg)]",
    textClass: "text-[var(--info-text)]",
    borderClass: "border-l-[var(--info-text)]",
  },
  pass: {
    label: "Pass",
    bgClass: "bg-[var(--pass-bg)]",
    textClass: "text-[var(--pass-text)]",
    borderClass: "border-l-[var(--pass-text)]",
  },
};

export default function Home() {
  const [report, setReport] = useState<CheckReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck(params: CheckParams) {
    setIsLoading(true);
    setError(null);
    setReport(null);

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "チェック中にエラーが発生しました");
        return;
      }

      setReport(data.report);
    } catch {
      setError("サーバーとの通信に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-4">
      {/* Header */}
      <h1
        className="text-2xl font-semibold tracking-[-0.02em] mb-6"
        style={{ color: "var(--ink)" }}
      >
        WebCheck
      </h1>

      {/* URL Input */}
      <section className="mb-6">
        <UrlInput onCheck={handleCheck} isLoading={isLoading} />
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-[var(--critical-border)] bg-[var(--critical-bg)] p-4 mb-6 text-sm text-[var(--critical-text)]">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-[var(--surface)] border border-[var(--border-color)] animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Results */}
      {report && (
        <>
          {/* Summary Bar */}
          <div className="flex gap-4 p-3 px-4 bg-[var(--surface)] rounded-lg border border-[var(--border-color)] mb-6">
            <SummaryStat
              label="Critical"
              count={report.summary.critical}
              colorVar="--critical-text"
            />
            <SummaryStat
              label="Warning"
              count={report.summary.warning}
              colorVar="--warning-text"
            />
            <SummaryStat
              label="Info"
              count={report.summary.info}
              colorVar="--info-text"
            />
            <SummaryStat
              label="Pass"
              count={report.summary.pass}
              colorVar="--pass-text"
            />
          </div>

          {/* Result Cards */}
          <div className="space-y-2">
            {report.results.map((result) => (
              <ResultCard key={result.id} result={result} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  count,
  colorVar,
}: {
  label: string;
  count: number;
  colorVar: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm font-medium">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: `var(${colorVar})` }}
      />
      <span style={{ color: `var(${colorVar})` }}>{count}</span>
      <span className="text-[var(--mist)]">{label}</span>
    </div>
  );
}

function ResultCard({ result }: { result: CheckResult }) {
  const [isOpen, setIsOpen] = useState(false);
  const config = severityConfig[result.severity];

  return (
    <div
      className={`rounded-lg border border-[var(--border-color)] border-l-[3px] ${config.borderClass} bg-white p-4 transition-shadow hover:shadow-[var(--shadow-2)] cursor-pointer`}
      onClick={() => setIsOpen(!isOpen)}
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bgClass} ${config.textClass}`}
          style={{ letterSpacing: "0.02em" }}
        >
          {config.label}
        </span>
        <span
          className="text-[15px] font-medium"
          style={{ color: "var(--ink)" }}
        >
          {result.title}
        </span>
      </div>

      {/* Expanded detail */}
      {isOpen && (
        <div className="mt-3 pt-3 border-t border-[var(--border-color)] space-y-2 text-sm">
          <div>
            <span className="text-[var(--mist)]">場所: </span>
            <code className="bg-[var(--surface)] border border-[var(--border-color)] rounded px-1.5 py-0.5 text-[13px] font-mono text-[var(--ink)]">
              {result.location}
            </code>
            <span className="text-[var(--slate)] ml-2">
              ({result.locationHuman})
            </span>
          </div>

          {result.currentValue !== null && (
            <div>
              <span className="text-[var(--mist)]">現在の値: </span>
              <span className="text-[var(--slate)]">{result.currentValue}</span>
            </div>
          )}

          {result.recommendation && (
            <div>
              <span className="text-[var(--mist)]">推奨: </span>
              <span className="text-[var(--slate)]">
                {result.recommendation}
              </span>
            </div>
          )}

          {result.codeExample && (
            <div>
              <span className="text-[var(--mist)]">コード例:</span>
              <pre className="mt-1 bg-[var(--surface)] border border-[var(--border-color)] rounded p-2 text-[13px] font-mono text-[var(--ink)] overflow-x-auto">
                {result.codeExample}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
