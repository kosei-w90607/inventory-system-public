// src/features/monthly-sales/lib/format-month-label.ts
//
// 月ラベル UI 表示 + ISO 月文字列の前後月計算（H-3、F-10 文字列操作）。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.6 format-month-label

const INVALID = "—";

/// "YYYY-MM" → "YYYY年M月"（UI 表示、zero-pad なし、H-3）。
/// モックアップ + UI-09a Intl 出力「2026年5月17日」整合。
/// 月番号 1-12 範囲外（13 / 00 等）は "—" 返却、throw しない。
export function formatMonthLabel(month: string): string {
  const { year, monthNum } = parseIsoMonth(month);
  if (year === null || monthNum === null) return INVALID;
  return `${String(year)}年${String(monthNum)}月`;
}

/// "YYYY-MM" → 前月の "YYYY-MM"（zero-pad あり、ISO 再構築）。
/// 1 月 → 前年 12 月で年またぎ。不正月は "" 返却。
export function prevMonth(month: string): string {
  const { year, monthNum } = parseIsoMonth(month);
  if (year === null || monthNum === null) return "";
  if (monthNum === 1) return `${String(year - 1)}-12`;
  return `${String(year)}-${String(monthNum - 1).padStart(2, "0")}`;
}

/// "YYYY-MM" → 翌月の "YYYY-MM"（zero-pad あり、ISO 再構築）。
/// 12 月 → 翌年 1 月で年またぎ。不正月は "" 返却。
export function nextMonth(month: string): string {
  const { year, monthNum } = parseIsoMonth(month);
  if (year === null || monthNum === null) return "";
  if (monthNum === 12) return `${String(year + 1)}-01`;
  return `${String(year)}-${String(monthNum + 1).padStart(2, "0")}`;
}

interface ParsedIsoMonth {
  year: number | null;
  monthNum: number | null;
}

function parseIsoMonth(month: string): ParsedIsoMonth {
  const parts = month.split("-");
  if (parts.length !== 2) return { year: null, monthNum: null };
  const yearStr = parts[0];
  const monthStr = parts[1];
  if (!yearStr || !monthStr) return { year: null, monthNum: null };
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  if (!Number.isInteger(year) || !Number.isInteger(monthNum)) {
    return { year: null, monthNum: null };
  }
  if (monthNum < 1 || monthNum > 12) return { year: null, monthNum: null };
  if (year < 1900 || year > 9999) return { year: null, monthNum: null };
  return { year, monthNum };
}

/// 当月の "YYYY-MM" を返す（JST、UI-00 useYesterdayDate 同型）。
export function formatYearMonth(date: Date): string {
  const year = date.getFullYear();
  const monthNum = date.getMonth() + 1;
  return `${String(year)}-${String(monthNum).padStart(2, "0")}`;
}
