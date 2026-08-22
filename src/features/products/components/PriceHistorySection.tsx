import { useCallback, useEffect, useState } from "react";

import { FormSection } from "@/components/patterns/FormSection";
import { Button } from "@/components/ui/button";
import { commands, type PriceHistoryEntry } from "@/lib/bindings";
import { describeError } from "@/lib/describe-error";
import { unwrapResult } from "@/lib/invoke";

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

export function PriceHistorySection({ productCode }: { productCode: string }) {
  const [limit, setLimit] = useState(10);
  const [entries, setEntries] = useState<PriceHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await unwrapResult(commands.listPriceHistory(productCode, limit), {
        source: "commands",
        cmd: "list_price_history",
      });
      setEntries(result);
    } catch (loadError) {
      setError(describeError(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [limit, productCode]);

  useEffect(() => {
    void load();
  }, [load, retryKey]);

  return (
    <FormSection title="価格履歴" description="直近の売価・原価の変更を新しい順に表示します。">
      {isLoading ? <p>読み込み中…</p> : null}
      {!isLoading && error !== null ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive" role="alert">
            価格履歴を取得できませんでした: {error}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setRetryKey((value) => value + 1);
            }}
          >
            再試行
          </Button>
        </div>
      ) : null}
      {!isLoading && error === null && entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">価格履歴はまだありません</p>
      ) : null}
      {!isLoading && error === null && entries.length > 0 ? (
        <ul className="divide-y rounded-md border">
          {entries.map((entry) => (
            <li key={entry.id} className="grid gap-1 px-3 py-2 text-sm md:grid-cols-3">
              <span>{entry.changed_at}</span>
              <span className="tabular-nums">
                売価 {yenFormatter.format(entry.old_selling_price)} →{" "}
                {yenFormatter.format(entry.new_selling_price)}
              </span>
              <span className="tabular-nums">
                原価 {yenFormatter.format(entry.old_cost_price)} →{" "}
                {yenFormatter.format(entry.new_cost_price)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {limit === 10 && !isLoading && error === null ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setLimit(100);
          }}
        >
          すべて表示
        </Button>
      ) : null}
    </FormSection>
  );
}
