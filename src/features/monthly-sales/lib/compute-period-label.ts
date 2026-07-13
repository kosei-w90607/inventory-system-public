// src/features/monthly-sales/lib/compute-period-label.ts
//
// 「YYYY/MM/DD-MM/DD」期間表示文字列生成（Q-1 B 案、F-10 文字列操作 + G-9 不正月 fallback）。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.6 compute-period-label

const INVALID = "—";

/// "YYYY-MM" → "YYYY/MM/DD-MM/DD"（月初〜月末、slash 区切り）。
/// 月番号 1-12 範囲外（13 / 00 等）は "—" 返却、throw しない（G-9）。
export function computePeriodLabel(month: string): string {
  const parts = month.split("-");
  if (parts.length !== 2) return INVALID;
  const yearStr = parts[0];
  const monthStr = parts[1];
  if (!yearStr || !monthStr) return INVALID;
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  if (!Number.isInteger(year) || !Number.isInteger(monthNum)) return INVALID;
  if (monthNum < 1 || monthNum > 12) return INVALID;
  if (year < 1900 || year > 9999) return INVALID;

  // JS Date は month 0-based。`new Date(year, monthNum, 0)` で「翌月の 0 日 = 当月末日」を取得。
  const lastDay = new Date(year, monthNum, 0).getDate();
  const mm = String(monthNum).padStart(2, "0");
  const ddEnd = String(lastDay).padStart(2, "0");
  return `${String(year)}/${mm}/01-${mm}/${ddEnd}`;
}
