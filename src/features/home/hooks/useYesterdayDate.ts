// src/features/home/hooks/useYesterdayDate.ts
//
// JST 昨日の YYYY-MM-DD + Visibility API listener（24:00 またぎ再計算）。
// 設計: docs/function-design/53-ui-home.md §53.3 / D-9 / P2-A

import { useEffect, useState } from "react";

function computeYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  // Swedish locale が ISO 8601 互換 "YYYY-MM-DD" を返す
  return d.toLocaleDateString("sv-SE");
}

/// JST 昨日の YYYY-MM-DD を返す。
/// 24:00 またぎでホーム画面を再フォーカスした際、
/// Visibility API listener が `visible` 検知時に再計算 → setState で
/// queryKey を変化させて TanStack Query が自動再 fetch する。
export function useYesterdayDate(): string {
  const [date, setDate] = useState<string>(() => computeYesterday());

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setDate(computeYesterday());
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return date;
}
