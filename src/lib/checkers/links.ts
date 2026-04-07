import type { CheerioAPI } from "cheerio";
import pLimit from "p-limit";
import type { CheckResult } from "@/types";

const CONCURRENT_REQUESTS = 5;
const MAX_LINKS = 100;
const TIMEOUT_MS = 10000;

/** 曖昧なアンカーテキストの正規表現 */
const VAGUE_ANCHOR_RE =
  /^(こちら|ここ|ここをクリック|click here|here|more|詳細|詳しくはこちら|リンク|link)$/i;

/**
 * リンクチェッカー
 * リンク切れ、ダミーリンク、リダイレクト、曖昧アンカーテキストを検出する
 */
export const checkLinks = async (
  dom: CheerioAPI,
  url: string,
  authHeaders?: Record<string, string>
): Promise<CheckResult[]> => {
  const results: CheckResult[] = [];
  let seq = 0;
  const baseUrl = new URL(url);

  function addResult(
    params: Omit<CheckResult, "id" | "category" | "status">
  ) {
    results.push({
      id: `links-${++seq}`,
      category: "links",
      status: "open",
      ...params,
    });
  }

  const anchors = dom("a[href]");
  const linkEntries: { href: string; text: string; selector: string }[] = [];

  anchors.each((i, el) => {
    const href = dom(el).attr("href")?.trim() ?? "";
    const text = dom(el).text().trim();
    const selector = buildSelector(dom, el, i);
    linkEntries.push({ href, text, selector });
  });

  // 空href・ダミーリンクのチェック
  for (const entry of linkEntries) {
    if (entry.href === "" || entry.href === "#") {
      addResult({
        severity: "warning",
        title: `空またはダミーリンク（href="${entry.href}"）`,
        location: entry.selector,
        locationHuman: `リンクテキスト「${truncate(entry.text, 30)}」`,
        currentValue: entry.href,
        recommendation:
          "リンク先が未設定です。正しいURLを設定するか、リンクを削除してください",
      });
    }

    // javascript:void(0) 等
    if (entry.href.startsWith("javascript:")) {
      addResult({
        severity: "warning",
        title: "javascript: スキームのリンク",
        location: entry.selector,
        locationHuman: `リンクテキスト「${truncate(entry.text, 30)}」`,
        currentValue: entry.href,
        recommendation:
          "javascript:リンクはアクセシビリティ上の問題があります。buttonタグの使用を検討してください",
      });
    }

    // 曖昧なアンカーテキスト
    if (entry.text && VAGUE_ANCHOR_RE.test(entry.text)) {
      addResult({
        severity: "warning",
        title: `曖昧なアンカーテキスト「${entry.text}」`,
        location: entry.selector,
        locationHuman: `リンク先: ${truncate(entry.href, 50)}`,
        currentValue: entry.text,
        recommendation:
          "リンク先の内容がわかる具体的なテキストに変更してください（例: 「お問い合わせフォーム」）",
      });
    }

    // mailto: / tel: フォーマットチェック
    if (entry.href.startsWith("mailto:")) {
      const email = entry.href.replace("mailto:", "").split("?")[0];
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        addResult({
          severity: "info",
          title: `mailto: のメールアドレスが不正`,
          location: entry.selector,
          locationHuman: `リンクテキスト「${truncate(entry.text, 30)}」`,
          currentValue: entry.href,
          recommendation: "正しいメールアドレス形式か確認してください",
        });
      }
    }

    if (entry.href.startsWith("tel:")) {
      const tel = entry.href.replace("tel:", "");
      if (!/^[+\d\-().\s]+$/.test(tel)) {
        addResult({
          severity: "info",
          title: `tel: の電話番号フォーマットが不正`,
          location: entry.selector,
          locationHuman: `リンクテキスト「${truncate(entry.text, 30)}」`,
          currentValue: entry.href,
          recommendation: "正しい電話番号形式か確認してください",
        });
      }
    }
  }

  // HTTP リンクの生存チェック
  const httpLinks = linkEntries.filter((e) => {
    try {
      const resolved = new URL(e.href, baseUrl);
      return ["http:", "https:"].includes(resolved.protocol);
    } catch {
      return false;
    }
  });

  if (httpLinks.length > MAX_LINKS) {
    addResult({
      severity: "info",
      title: `リンク数が${httpLinks.length}件あり、先頭${MAX_LINKS}件のみチェックしました`,
      location: "body",
      locationHuman: "ページ全体",
      currentValue: `${httpLinks.length}件`,
      recommendation: "すべてのリンクを確認するには個別にチェックしてください",
    });
  }

  const toCheck = httpLinks.slice(0, MAX_LINKS);
  const limit = pLimit(CONCURRENT_REQUESTS);

  const checks = await Promise.allSettled(
    toCheck.map((entry) =>
      limit(async () => {
        const resolved = new URL(entry.href, baseUrl).toString();
        try {
          const res = await fetch(resolved, {
            method: "HEAD",
            headers: { "User-Agent": "WebCheck/1.0", ...authHeaders },
            redirect: "manual",
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });

          return { entry, status: res.status, resolved };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "unknown";
          return { entry, status: -1, resolved, error: message };
        }
      })
    )
  );

  for (const result of checks) {
    if (result.status === "rejected") continue;
    const { entry, status, resolved, error } = result.value;

    if (status === -1) {
      addResult({
        severity: "warning",
        title: `リンク先に接続できません`,
        location: entry.selector,
        locationHuman: `リンクテキスト「${truncate(entry.text, 30)}」`,
        currentValue: `${resolved}（${error ?? "タイムアウト"}）`,
        recommendation: "リンク先のURLが正しいか、サーバーが稼働しているか確認してください",
      });
    } else if (status >= 400 && status < 500) {
      addResult({
        severity: "critical",
        title: `リンク切れ（HTTP ${status}）`,
        location: entry.selector,
        locationHuman: `リンクテキスト「${truncate(entry.text, 30)}」`,
        currentValue: resolved,
        recommendation: "リンク先が見つかりません。URLを修正するかリンクを削除してください",
      });
    } else if (status >= 500) {
      addResult({
        severity: "critical",
        title: `リンク先サーバーエラー（HTTP ${status}）`,
        location: entry.selector,
        locationHuman: `リンクテキスト「${truncate(entry.text, 30)}」`,
        currentValue: resolved,
        recommendation: "リンク先サーバーがエラーを返しています。管理者に確認してください",
      });
    } else if (status === 301 || status === 302) {
      addResult({
        severity: "info",
        title: `リダイレクトリンク（HTTP ${status}）`,
        location: entry.selector,
        locationHuman: `リンクテキスト「${truncate(entry.text, 30)}」`,
        currentValue: resolved,
        recommendation: "リダイレクト先のURLに直接リンクすることを検討してください",
      });
    }
  }

  return results;
};

function truncate(text: string, max: number): string {
  if (!text) return "(空)";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function buildSelector(
  dom: CheerioAPI,
  el: ReturnType<CheerioAPI>[number],
  index: number
): string {
  const id = dom(el).attr("id");
  if (id) return `a#${id}`;
  const classes = dom(el).attr("class")?.split(/\s+/).filter(Boolean).slice(0, 2).join(".");
  if (classes) return `a.${classes}`;
  return `a:nth-of-type(${index + 1})`;
}
