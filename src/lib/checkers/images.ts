import type { CheerioAPI } from "cheerio";
import type { CheckResult, Checker } from "@/types";

/** 汎用的すぎるaltテキストのパターン */
const GENERIC_ALT_RE =
  /^(画像|image|photo|写真|img|picture|icon|アイコン|banner|バナー|logo|ロゴ|thumbnail|サムネイル|\d+)$/i;

/**
 * 画像・altチェッカー
 * alt属性の有無・品質、装飾画像の判定を行う
 */
export const checkImages: Checker = async (
  dom: CheerioAPI,
  _url
): Promise<CheckResult[]> => {
  const results: CheckResult[] = [];
  let seq = 0;

  function addResult(
    params: Omit<CheckResult, "id" | "category" | "status">
  ) {
    results.push({
      id: `images-${++seq}`,
      category: "images",
      status: "open",
      ...params,
    });
  }

  const images = dom("img");

  if (images.length === 0) {
    return results;
  }

  images.each((i, el) => {
    const $el = dom(el);
    const alt = $el.attr("alt");
    const src = $el.attr("src") ?? "(src未設定)";
    const selector = buildImgSelector(dom, el, i);
    const isDecorative =
      $el.attr("role") === "presentation" ||
      $el.attr("aria-hidden") === "true";

    // 装飾画像
    if (isDecorative) {
      if (alt && alt.trim() !== "") {
        addResult({
          severity: "info",
          title: "装飾画像にalt属性が設定されている",
          location: selector,
          locationHuman: `画像: ${truncate(src, 50)}`,
          currentValue: alt,
          recommendation:
            'role="presentation" または aria-hidden="true" の画像は alt="" にしてください',
        });
      } else {
        addResult({
          severity: "pass",
          title: "装飾画像が適切にマークされている",
          location: selector,
          locationHuman: `画像: ${truncate(src, 50)}`,
          currentValue: null,
          recommendation: "",
        });
      }
      return;
    }

    // alt属性なし
    if (alt === undefined || alt === null) {
      addResult({
        severity: "critical",
        title: "alt属性が未設定",
        location: selector,
        locationHuman: `画像: ${truncate(src, 50)}`,
        currentValue: null,
        recommendation:
          "スクリーンリーダー利用者のために画像の内容を説明するalt属性を追加してください",
        codeExample: `<img src="${truncate(src, 40)}" alt="画像の説明">`,
      });
      return;
    }

    // alt="" (空)
    if (alt.trim() === "") {
      addResult({
        severity: "warning",
        title: "alt属性が空",
        location: selector,
        locationHuman: `画像: ${truncate(src, 50)}`,
        currentValue: '""',
        recommendation:
          "装飾画像でなければ、画像の内容を説明するaltテキストを設定してください。装飾画像の場合は role=\"presentation\" を追加してください",
      });
      return;
    }

    // 汎用的すぎるalt
    if (GENERIC_ALT_RE.test(alt.trim())) {
      addResult({
        severity: "warning",
        title: `altテキストが汎用的すぎる（「${alt}」）`,
        location: selector,
        locationHuman: `画像: ${truncate(src, 50)}`,
        currentValue: alt,
        recommendation:
          "画像の具体的な内容がわかるテキストに変更してください（例: 「会社ロゴ」→「株式会社〇〇のロゴ」）",
      });
      return;
    }

    // alt が過度に長い
    if (alt.length > 125) {
      addResult({
        severity: "info",
        title: `altテキストが長すぎる（${alt.length}文字）`,
        location: selector,
        locationHuman: `画像: ${truncate(src, 50)}`,
        currentValue: truncate(alt, 80),
        recommendation:
          "altテキストは125文字以内が推奨です。詳細な説明が必要な場合は aria-describedby を使用してください",
      });
    }
  });

  return results;
};

function truncate(text: string, max: number): string {
  if (!text) return "(空)";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function buildImgSelector(
  dom: CheerioAPI,
  el: ReturnType<CheerioAPI>[number],
  index: number
): string {
  const $el = dom(el);
  const id = $el.attr("id");
  if (id) return `img#${id}`;
  const classes = $el
    .attr("class")
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(".");
  if (classes) return `img.${classes}`;
  return `img:nth-of-type(${index + 1})`;
}
