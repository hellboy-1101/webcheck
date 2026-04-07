import type { CheerioAPI } from "cheerio";
import type { CheckResult, Checker } from "@/types";

/**
 * テキスト・表記チェッカー（ルールベース）
 * 不自然な半角スペース、表記ゆれ、ダミーテキストなどを検出する
 */
export const checkText: Checker = async (
  dom: CheerioAPI,
  _url
): Promise<CheckResult[]> => {
  const results: CheckResult[] = [];
  let seq = 0;

  function addResult(
    params: Omit<CheckResult, "id" | "category" | "status">
  ) {
    results.push({
      id: `text-${++seq}`,
      category: "text",
      status: "open",
      ...params,
    });
  }

  // body内のテキストをセクション単位で抽出（script, style, noscript を除外）
  const sections = extractSections(dom);

  for (const section of sections) {
    // 不自然な半角スペース
    checkUnnaturalSpaces(section, addResult);

    // ダミー・プレースホルダーテキスト
    checkDummyText(section, addResult);

    // 表記ゆれの候補
    checkInconsistency(section, addResult);

    // 年号チェック
    checkOutdatedYear(section, addResult);
  }

  // ページ全体での表記ゆれチェック
  const fullText = sections.map((s) => s.text).join("\n");
  checkCrossPageInconsistency(fullText, addResult);

  return results;
};

type Section = {
  heading: string;
  text: string;
  selector: string;
};

type AddResult = (
  params: Omit<CheckResult, "id" | "category" | "status">
) => void;

function extractSections(dom: CheerioAPI): Section[] {
  const sections: Section[] = [];

  // script, style, noscript を除去してテキスト取得
  dom("script, style, noscript, svg").remove();

  let currentHeading = "(ページ先頭)";
  let currentText = "";
  let currentSelector = "body";

  dom("body")
    .find("h1, h2, h3, h4, h5, h6, p, li, td, th, dt, dd, span, div, a, label, figcaption")
    .each((_, el) => {
      const $el = dom(el);
      const tagName = (el as unknown as { tagName: string }).tagName?.toLowerCase();

      if (tagName && /^h[1-6]$/.test(tagName)) {
        // 前のセクションを保存
        if (currentText.trim()) {
          sections.push({
            heading: currentHeading,
            text: currentText.trim(),
            selector: currentSelector,
          });
        }
        currentHeading = $el.text().trim();
        currentText = "";
        currentSelector = tagName;
      } else {
        const text = $el
          .clone()
          .children()
          .remove()
          .end()
          .text()
          .trim();
        if (text) {
          currentText += text + "\n";
        }
      }
    });

  // 最後のセクションを保存
  if (currentText.trim()) {
    sections.push({
      heading: currentHeading,
      text: currentText.trim(),
      selector: currentSelector,
    });
  }

  return sections;
}

/**
 * 不自然な半角スペースを検出
 * - 日本語文字間の半角スペース（例: 「東京 タワー」）
 * - 全角文字と全角文字の間の半角スペース
 * - 句読点直後の不要な半角スペース
 *
 * 除外: 日本語と英数字の間のスペース（正しい表記）
 */
function checkUnnaturalSpaces(section: Section, addResult: AddResult) {
  const lines = section.text.split("\n");

  for (const line of lines) {
    // 日本語（ひらがな・カタカナ・漢字）間の半角スペース
    const jaSpaceJa =
      /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF])\s+([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF])/g;

    let match: RegExpExecArray | null;
    while ((match = jaSpaceJa.exec(line)) !== null) {
      const context = extractContext(line, match.index, 20);
      addResult({
        severity: "warning",
        title: "日本語文字間の不自然な半角スペース",
        location: section.selector,
        locationHuman: `セクション「${truncate(section.heading, 20)}」`,
        currentValue: `「${context}」`,
        recommendation:
          "日本語の文字間に半角スペースが入っています。意図的でなければ削除してください",
      });
    }

    // 句読点直後の半角スペース + 日本語（改行除く）
    const punctSpaceJa =
      /([。、！？）」』】])\s+([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF])/g;

    while ((match = punctSpaceJa.exec(line)) !== null) {
      const context = extractContext(line, match.index, 20);
      addResult({
        severity: "info",
        title: "句読点後の不要な半角スペース",
        location: section.selector,
        locationHuman: `セクション「${truncate(section.heading, 20)}」`,
        currentValue: `「${context}」`,
        recommendation:
          "日本語の句読点の後に半角スペースは通常不要です",
      });
    }

    // 全角スペースの検出（意図しない可能性）
    if (/\u3000/.test(line)) {
      const idx = line.indexOf("\u3000");
      const context = extractContext(line, idx, 20);
      addResult({
        severity: "info",
        title: "全角スペースの使用",
        location: section.selector,
        locationHuman: `セクション「${truncate(section.heading, 20)}」`,
        currentValue: `「${context}」（全角スペースを含む）`,
        recommendation:
          "全角スペースが含まれています。意図的でなければ半角スペースまたは削除を検討してください",
      });
    }
  }
}

/** ダミー・プレースホルダーテキストの検出 */
function checkDummyText(section: Section, addResult: AddResult) {
  const dummyPatterns: { pattern: RegExp; label: string }[] = [
    { pattern: /lorem ipsum/i, label: "Lorem Ipsum" },
    { pattern: /ダミーテキスト/i, label: "ダミーテキスト" },
    { pattern: /テキストが入ります/i, label: "プレースホルダー" },
    { pattern: /ここにテキスト/i, label: "プレースホルダー" },
    { pattern: /サンプルテキスト/i, label: "サンプルテキスト" },
    { pattern: /〇〇〇/i, label: "〇〇〇（仮テキスト）" },
    { pattern: /×××/i, label: "×××（仮テキスト）" },
    { pattern: /hogehoge|fugafuga|piyopiyo/i, label: "テスト文字列" },
    { pattern: /test@example\.com/i, label: "テスト用メールアドレス" },
    { pattern: /000-0000-0000/i, label: "テスト用電話番号" },
    { pattern: /山田太郎|田中太郎/i, label: "仮の人名" },
  ];

  for (const { pattern, label } of dummyPatterns) {
    const match = section.text.match(pattern);
    if (match) {
      addResult({
        severity: "warning",
        title: `${label}の可能性あり`,
        location: section.selector,
        locationHuman: `セクション「${truncate(section.heading, 20)}」`,
        currentValue: `「${match[0]}」`,
        recommendation:
          "ダミーテキストまたはプレースホルダーが残っている可能性があります。本番用テキストに差し替えてください",
      });
    }
  }
}

/** セクション内の表記ゆれ候補 */
function checkInconsistency(section: Section, addResult: AddResult) {
  // 全角・半角の混在チェック
  const mixedPatterns: { full: string; half: string; label: string }[] = [
    { full: "（", half: "(", label: "丸括弧" },
    { full: "）", half: ")", label: "丸括弧" },
    { full: "：", half: ":", label: "コロン" },
    { full: "／", half: "/", label: "スラッシュ" },
  ];

  for (const { full, half, label } of mixedPatterns) {
    const hasFull = section.text.includes(full);
    const hasHalf = section.text.includes(half);
    if (hasFull && hasHalf) {
      addResult({
        severity: "info",
        title: `${label}の全角・半角が混在`,
        location: section.selector,
        locationHuman: `セクション「${truncate(section.heading, 20)}」`,
        currentValue: `全角「${full}」と半角「${half}」が混在`,
        recommendation: "同一セクション内で全角・半角を統一してください",
      });
    }
  }
}

/** 年号チェック: 古い年号のコピーライトなど */
function checkOutdatedYear(section: Section, addResult: AddResult) {
  const currentYear = new Date().getFullYear();
  const copyrightMatch = section.text.match(
    /(?:©|copyright)\s*(\d{4})/i
  );
  if (copyrightMatch) {
    const year = parseInt(copyrightMatch[1], 10);
    if (year < currentYear) {
      addResult({
        severity: "info",
        title: `コピーライト年号が古い（${year}年）`,
        location: section.selector,
        locationHuman: `セクション「${truncate(section.heading, 20)}」`,
        currentValue: copyrightMatch[0],
        recommendation: `コピーライトの年号を${currentYear}年に更新してください`,
      });
    }
  }
}

/** ページ全体での表記ゆれ */
function checkCrossPageInconsistency(
  fullText: string,
  addResult: AddResult
) {
  // よくある表記ゆれペア
  const pairs: [RegExp, RegExp, string][] = [
    [/お問い合わせ/, /お問合せ/, "お問い合わせ / お問合せ"],
    [/お申し込み/, /お申込み/, "お申し込み / お申込み"],
    [/ウェブ/, /Web(?!Check)/i, "ウェブ / Web"],
    [/サーバー/, /サーバ(?!ー)/, "サーバー / サーバ"],
    [/ユーザー/, /ユーザ(?!ー)/, "ユーザー / ユーザ"],
    [/コンピューター/, /コンピュータ(?!ー)/, "コンピューター / コンピュータ"],
    [/プリンター/, /プリンタ(?!ー)/, "プリンター / プリンタ"],
  ];

  for (const [a, b, label] of pairs) {
    if (a.test(fullText) && b.test(fullText)) {
      addResult({
        severity: "warning",
        title: `表記ゆれ: ${label}`,
        location: "body",
        locationHuman: "ページ全体",
        currentValue: label,
        recommendation: "ページ内で表記を統一してください",
      });
    }
  }
}

function truncate(text: string, max: number): string {
  if (!text) return "(空)";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function extractContext(
  text: string,
  index: number,
  radius: number
): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  let context = text.slice(start, end);
  if (start > 0) context = "..." + context;
  if (end < text.length) context = context + "...";
  return context;
}
