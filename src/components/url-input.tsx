"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type CheckParams = {
  url: string;
  basicAuth?: { username: string; password: string };
};

type HistoryEntry = {
  url: string;
  username: string;
  password: string;
  checkedAt: string;
};

const STORAGE_KEY = "webcheck-history";
const MAX_HISTORY = 20;

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

type UrlInputProps = {
  onCheck: (params: CheckParams) => void;
  isLoading: boolean;
};

export function UrlInput({ onCheck, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // 外側クリックでドロップダウンを閉じる
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    // 履歴に保存（同じURLがあれば先頭に移動）
    const entry: HistoryEntry = {
      url: trimmed,
      username: showAuth ? username : "",
      password: showAuth ? password : "",
      checkedAt: new Date().toISOString(),
    };
    const filtered = history.filter((h) => h.url !== trimmed);
    const updated = [entry, ...filtered];
    setHistory(updated);
    saveHistory(updated);

    const params: CheckParams = { url: trimmed };
    if (showAuth && username) {
      params.basicAuth = { username, password };
    }
    onCheck(params);
    setShowHistory(false);
  }

  function selectHistory(entry: HistoryEntry) {
    setUrl(entry.url);
    if (entry.username) {
      setUsername(entry.username);
      setPassword(entry.password);
      setShowAuth(true);
    } else {
      setUsername("");
      setPassword("");
      setShowAuth(false);
    }
    setShowHistory(false);
  }

  function removeHistory(targetUrl: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = history.filter((h) => h.url !== targetUrl);
    setHistory(updated);
    saveHistory(updated);
  }

  const inputClass =
    "h-10 text-[15px] px-3.5 border-[var(--border-color)] focus-visible:border-[var(--accent-color)] focus-visible:ring-[var(--accent-light)]";

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-3">
      <div className="flex gap-3" ref={wrapperRef}>
        <div className="relative flex-1">
          <Input
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onFocus={() => history.length > 0 && setShowHistory(true)}
            required
            className={inputClass}
          />

          {/* 履歴ドロップダウン */}
          {showHistory && history.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-[var(--border-color)] bg-white shadow-[var(--shadow-3)] overflow-hidden">
              <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--mist)] border-b border-[var(--border-color)]">
                履歴
              </div>
              <div className="max-h-[240px] overflow-y-auto">
                {history.map((entry) => (
                  <div
                    key={entry.url}
                    onClick={() => selectHistory(entry)}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--hover-color)] transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[var(--ink)] truncate">
                        {entry.url}
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-[var(--mist)]">
                        {entry.username && (
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]" />
                            Basic認証
                          </span>
                        )}
                        <span>{formatDate(entry.checkedAt)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => removeHistory(entry.url, e)}
                      className="opacity-0 group-hover:opacity-100 text-[var(--mist)] hover:text-[var(--critical-text)] transition-all p-1"
                      title="履歴から削除"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="h-10 px-4 text-sm font-medium bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] shadow-[var(--shadow-1)] hover:shadow-[var(--shadow-2)]"
        >
          {isLoading ? "チェック中..." : "チェック開始"}
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setShowAuth(!showAuth)}
        className="text-[13px] text-[var(--mist)] hover:text-[var(--slate)] transition-colors"
      >
        {showAuth ? "- Basic認証を閉じる" : "+ Basic認証"}
      </button>

      {showAuth && (
        <div className="flex gap-3">
          <Input
            type="text"
            placeholder="ユーザー名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className={`flex-1 ${inputClass}`}
          />
          <Input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className={`flex-1 ${inputClass}`}
          />
        </div>
      )}
    </form>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60_000) return "たった今";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}時間前`;

  return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}
