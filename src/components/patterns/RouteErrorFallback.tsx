import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { CircleAlert, House, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RouteErrorFallback({
  error,
  reset,
  fullScreen = false,
}: ErrorComponentProps & { fullScreen?: boolean }) {
  return (
    <div
      data-testid="route-error-fallback"
      className={cn(
        "flex items-center justify-center bg-background p-6 text-foreground",
        fullScreen ? "min-h-screen" : "min-h-[60vh]",
      )}
    >
      <div className="w-full max-w-2xl rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <CircleAlert className="mt-0.5 size-8 shrink-0 text-destructive" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold">画面の表示中に問題が発生しました</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              保存済みのデータは失われていません。
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              再試行しても直らない場合は、ホームへ戻って操作をやり直してください。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" onClick={reset}>
                <RotateCcw aria-hidden="true" />
                再試行
              </Button>
              <Button asChild variant="outline">
                <Link to="/">
                  <House aria-hidden="true" />
                  ホームへ戻る
                </Link>
              </Button>
            </div>
            <details className="mt-5 rounded-md border p-3 text-sm">
              <summary className="cursor-pointer font-medium">技術詳細</summary>
              <pre className="mt-3 overflow-auto text-xs break-words whitespace-pre-wrap text-muted-foreground">
                {error.message}
              </pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
