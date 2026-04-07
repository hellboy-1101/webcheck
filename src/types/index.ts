import type { CheerioAPI } from "cheerio";

/** チェックカテゴリ */
export type Category =
  | "meta"
  | "images"
  | "links"
  | "a11y"
  | "performance"
  | "text";

/** 深刻度 */
export type Severity = "critical" | "warning" | "info" | "pass";

/** チェック結果のステータス */
export type ResultStatus = "open" | "fb_sent" | "fixed";

/** チェック結果1件 */
export type CheckResult = {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  location: string;
  locationHuman: string;
  currentValue: string | null;
  recommendation: string;
  codeExample?: string;
  status: ResultStatus;
};

/** チェック実行結果全体 */
export type CheckReport = {
  id: string;
  url: string;
  checkedAt: string;
  results: CheckResult[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    pass: number;
    total: number;
  };
};

/** FB出力リクエスト */
export type FBExportRequest = {
  reportId: string;
  selectedIds: string[];
  format: "markdown" | "csv";
};

/** 全チェッカーが準拠するインターフェース */
export type Checker = (
  dom: CheerioAPI,
  url: string
) => Promise<CheckResult[]>;
