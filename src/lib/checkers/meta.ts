import type { CheerioAPI } from "cheerio";
import type { CheckResult, Checker } from "@/types";

/**
 * メタ情報チェッカー
 * HTMLの<head>内のメタタグを検証し、SEO・OGP・基本設定の問題を検出する
 */
export const checkMeta: Checker = async (
  dom: CheerioAPI,
  _url: string
): Promise<CheckResult[]> => {
  const results: CheckResult[] = [];
  let seq = 0;

  function addResult(
    params: Omit<CheckResult, "id" | "category" | "location" | "status">
  ) {
    results.push({
      id: `meta-${++seq}`,
      category: "meta",
      location: "head",
      status: "open",
      ...params,
    });
  }

  // title タグ
  const title = dom("title").text().trim();
  if (!title) {
    addResult({
      severity: "critical",
      title: "title タグが未設定",
      locationHuman: "<head>内",
      currentValue: null,
      recommendation: "ページの内容を表すtitleタグを設定してください",
      codeExample: "<title>ページタイトル</title>",
    });
  } else if (title.length < 10 || title.length > 60) {
    addResult({
      severity: "warning",
      title: `title の文字数が推奨範囲外（${title.length}文字）`,
      locationHuman: "<head>内",
      currentValue: title,
      recommendation: "titleは10〜60文字が推奨されます",
    });
  } else {
    addResult({
      severity: "pass",
      title: "title タグが適切に設定されている",
      locationHuman: "<head>内",
      currentValue: title,
      recommendation: "",
    });
  }

  // meta description
  const description =
    dom('meta[name="description"]').attr("content")?.trim() ?? null;
  if (!description) {
    addResult({
      severity: "warning",
      title: "meta description が未設定",
      locationHuman: "<head>内",
      currentValue: null,
      recommendation: "ページの説明文をmeta descriptionに設定してください",
      codeExample:
        '<meta name="description" content="ページの説明文をここに記述">',
    });
  } else if (description.length < 50 || description.length > 160) {
    addResult({
      severity: "info",
      title: `meta description の文字数が推奨範囲外（${description.length}文字）`,
      locationHuman: "<head>内",
      currentValue: description,
      recommendation: "meta descriptionは50〜160文字が推奨されます",
    });
  } else {
    addResult({
      severity: "pass",
      title: "meta description が適切に設定されている",
      locationHuman: "<head>内",
      currentValue: description,
      recommendation: "",
    });
  }

  // OGP: og:title
  const ogTitle =
    dom('meta[property="og:title"]').attr("content")?.trim() ?? null;
  if (!ogTitle) {
    addResult({
      severity: "warning",
      title: "og:title が未設定",
      locationHuman: "<head>内",
      currentValue: null,
      recommendation:
        "SNSシェア時のタイトルとしてog:titleを設定してください",
      codeExample: '<meta property="og:title" content="ページタイトル">',
    });
  }

  // OGP: og:description
  const ogDesc =
    dom('meta[property="og:description"]').attr("content")?.trim() ?? null;
  if (!ogDesc) {
    addResult({
      severity: "warning",
      title: "og:description が未設定",
      locationHuman: "<head>内",
      currentValue: null,
      recommendation:
        "SNSシェア時の説明文としてog:descriptionを設定してください",
      codeExample:
        '<meta property="og:description" content="ページの説明文">',
    });
  }

  // OGP: og:image
  const ogImage =
    dom('meta[property="og:image"]').attr("content")?.trim() ?? null;
  if (!ogImage) {
    addResult({
      severity: "critical",
      title: "og:image が未設定",
      locationHuman: "<head>内",
      currentValue: null,
      recommendation:
        "SNSシェア時の画像としてog:imageを設定してください（推奨: 1200x630px）",
      codeExample:
        '<meta property="og:image" content="https://example.com/og.png">',
    });
  }

  // OGP: og:url
  const ogUrl =
    dom('meta[property="og:url"]').attr("content")?.trim() ?? null;
  if (!ogUrl) {
    addResult({
      severity: "info",
      title: "og:url が未設定",
      locationHuman: "<head>内",
      currentValue: null,
      recommendation: "ページの正規URLとしてog:urlを設定してください",
    });
  }

  // twitter:card
  const twitterCard =
    dom('meta[name="twitter:card"]').attr("content")?.trim() ?? null;
  if (!twitterCard) {
    addResult({
      severity: "info",
      title: "twitter:card が未設定",
      locationHuman: "<head>内",
      currentValue: null,
      recommendation:
        "Xでのカード表示のためtwitter:cardを設定してください",
      codeExample:
        '<meta name="twitter:card" content="summary_large_image">',
    });
  }

  // canonical URL
  const canonical = dom('link[rel="canonical"]').attr("href")?.trim() ?? null;
  if (!canonical) {
    addResult({
      severity: "warning",
      title: "canonical URL が未設定",
      locationHuman: "<head>内",
      currentValue: null,
      recommendation: "重複コンテンツ防止のためcanonical URLを設定してください",
      codeExample:
        '<link rel="canonical" href="https://example.com/page">',
    });
  } else if (canonical !== _url) {
    addResult({
      severity: "warning",
      title: "canonical URL がページURLと一致しない",
      locationHuman: "<head>内",
      currentValue: canonical,
      recommendation: `canonical URL がアクセスURL（${_url}）と異なります。意図的でなければ修正してください`,
    });
  }

  // favicon
  const favicon =
    dom('link[rel="icon"], link[rel="shortcut icon"]').length > 0;
  if (!favicon) {
    addResult({
      severity: "warning",
      title: "favicon が未設定",
      locationHuman: "<head>内",
      currentValue: null,
      recommendation: "ブラウザタブ等に表示されるfaviconを設定してください",
      codeExample: '<link rel="icon" href="/favicon.ico">',
    });
  }

  // html lang 属性
  const lang = dom("html").attr("lang")?.trim() ?? null;
  if (!lang) {
    addResult({
      severity: "warning",
      title: "html lang 属性が未設定",
      locationHuman: "<html>要素",
      currentValue: null,
      recommendation:
        "アクセシビリティと検索エンジン向けにlang属性を設定してください",
      codeExample: '<html lang="ja">',
    });
  }

  // viewport meta
  const viewport =
    dom('meta[name="viewport"]').attr("content")?.trim() ?? null;
  if (!viewport) {
    addResult({
      severity: "critical",
      title: "viewport meta が未設定",
      locationHuman: "<head>内",
      currentValue: null,
      recommendation:
        "モバイル表示のためにviewportメタタグを設定してください",
      codeExample:
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
    });
  }

  // charset
  const charsetMeta = dom('meta[charset]').attr("charset")?.trim() ?? null;
  const charsetContentType =
    dom('meta[http-equiv="Content-Type"]').attr("content") ?? null;
  const charset =
    charsetMeta ??
    (charsetContentType?.match(/charset=([^\s;]+)/i)?.[1] ?? null);
  if (!charset) {
    addResult({
      severity: "info",
      title: "charset が未設定",
      locationHuman: "<head>内",
      currentValue: null,
      recommendation: "文字エンコーディングとしてUTF-8を明示してください",
      codeExample: '<meta charset="utf-8">',
    });
  } else if (charset.toLowerCase() !== "utf-8") {
    addResult({
      severity: "info",
      title: `charset が UTF-8 以外（${charset}）`,
      locationHuman: "<head>内",
      currentValue: charset,
      recommendation: "UTF-8の使用を推奨します",
    });
  }

  return results;
};
