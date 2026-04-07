import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { checkMeta } from "@/lib/checkers/meta";
import { checkImages } from "@/lib/checkers/images";
import { checkLinks } from "@/lib/checkers/links";
import { checkText } from "@/lib/checkers/text";
import type { CheckReport, CheckResult } from "@/types";

/**
 * POST /api/check
 * URLを受け取り、メタ情報チェックを実行してCheckReportを返す
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, basicAuth } = body as {
      url: string;
      basicAuth?: { username: string; password: string };
    };

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URLを入力してください" },
        { status: 400 }
      );
    }

    // プロトコルバリデーション（http/https のみ許可）
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "有効なURLを入力してください" },
        { status: 400 }
      );
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: "http または https のURLを入力してください" },
        { status: 400 }
      );
    }

    // プライベートIPブロック（SSRF防止）
    const hostname = parsedUrl.hostname;
    if (isPrivateHost(hostname)) {
      return NextResponse.json(
        { error: "プライベートネットワークのURLにはアクセスできません" },
        { status: 400 }
      );
    }

    // HTMLを取得
    const headers: Record<string, string> = {
      "User-Agent": "WebCheck/1.0",
      Accept: "text/html",
    };
    if (basicAuth?.username) {
      const credentials = Buffer.from(
        `${basicAuth.username}:${basicAuth.password}`
      ).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
    }

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `ページの取得に失敗しました（HTTP ${response.status}）`,
        },
        { status: 502 }
      );
    }

    const html = await response.text();
    const dom = cheerio.load(html);

    // 全チェッカーを並列実行（各チェッカーの失敗が他に影響しない）
    const checkerResults = await Promise.allSettled([
      checkMeta(dom, url),
      checkImages(dom, url),
      checkLinks(dom, url, basicAuth?.username ? { Authorization: headers["Authorization"] } : undefined),
      checkText(dom, url),
    ]);

    const results: CheckResult[] = [];
    const skipped: string[] = [];
    const checkerNames = ["meta", "images", "links", "text"];

    checkerResults.forEach((result, i) => {
      if (result.status === "fulfilled") {
        results.push(...result.value);
      } else {
        console.error(`Checker ${checkerNames[i]} failed:`, result.reason);
        skipped.push(checkerNames[i]);
      }
    });

    // サマリー集計
    const summary = {
      critical: results.filter((r) => r.severity === "critical").length,
      warning: results.filter((r) => r.severity === "warning").length,
      info: results.filter((r) => r.severity === "info").length,
      pass: results.filter((r) => r.severity === "pass").length,
      total: results.length,
    };

    const report: CheckReport = {
      id: crypto.randomUUID(),
      url,
      checkedAt: new Date().toISOString(),
      results,
      summary,
    };

    return NextResponse.json({ report });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "不明なエラーが発生しました";
    const cause =
      error instanceof Error && error.cause instanceof Error
        ? error.cause.message
        : "";

    console.error("Check API error:", message, cause, error);

    if (message.includes("abort") || message.includes("timeout")) {
      return NextResponse.json(
        { error: "ページの読み込みに時間がかかっています（30秒タイムアウト）" },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: `チェック中にエラーが発生しました: ${message}${cause ? ` (${cause})` : ""}` },
      { status: 500 }
    );
  }
}

/** プライベートIPアドレスかどうかを判定 */
function isPrivateHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return true;
  }
  // 10.x.x.x, 172.16-31.x.x, 192.168.x.x
  const parts = hostname.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const a = parseInt(parts[0], 10);
    const b = parseInt(parts[1], 10);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
  }
  return false;
}
