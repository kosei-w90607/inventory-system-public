// src/features/home/HomePage.tsx
//
// UI-00 ホーム画面の最上位コンポーネント。
// 設計: docs/function-design/53-ui-home.md §53.1 / §53.4 / §53.5

import { useEffect } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/patterns/PageHeader";
import { InventoryActionGrid } from "./components/InventoryActionGrid";
import { MiscActionRow } from "./components/MiscActionRow";
import { PluNotificationBar } from "./components/PluNotificationBar";
import { QuickActionGrid } from "./components/QuickActionGrid";
import { SummaryCards } from "./components/SummaryCards";
import { useHomeSummary } from "./hooks/useHomeSummary";

const todayFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

export function HomePage() {
  const summary = useHomeSummary();
  const today = todayFormatter.format(new Date());

  // 53-ui-home.md §53.5 部分障害許容: pluDirty isError 時はバー非表示 + Sonner トースト
  // id 指定で React.StrictMode double-invoke + TanStack Query retry 時の重複発火を抑制
  useEffect(() => {
    if (summary.pluDirty.isError) {
      toast.error("PLU 通知の取得に失敗しました", { id: "plu-dirty-error" });
    }
  }, [summary.pluDirty.isError]);

  // 53-ui-home.md §53.5 部分障害許容: csvImports isError 時は警告非表示 + Sonner トースト
  useEffect(() => {
    if (summary.csvImports.isError) {
      toast.error("取込み履歴の取得に失敗しました", { id: "csv-imports-error" });
    }
  }, [summary.csvImports.isError]);

  // a11y: HTML5 main landmark は 1 ページ 1 つ。RootLayout の <main> 内側のため <div> を採用
  return (
    <div className="min-h-screen space-y-6 p-6">
      <PageHeader title="ホーム" subtitle={today} />

      <PluNotificationBar
        pluDirty={summary.pluDirty}
        pluDirtyCount={summary.derived.pluDirtyCount}
      />

      {summary.csvImports.isSuccess && summary.derived.needsImportWarning && (
        <Alert variant="destructive">
          <AlertTitle>前日分が未取込みです</AlertTitle>
          <AlertDescription>
            最後の取込み精算日: {summary.derived.lastImportSettlementDate ?? "—"}
          </AlertDescription>
        </Alert>
      )}

      <SummaryCards summary={summary} />

      <section className="space-y-2">
        <h2 className="text-lg font-medium">毎日の作業</h2>
        <QuickActionGrid />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">入庫・出庫</h2>
        <InventoryActionGrid />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">その他</h2>
        <MiscActionRow />
      </section>
    </div>
  );
}
