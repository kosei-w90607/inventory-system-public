import { Link } from "@tanstack/react-router";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/patterns/PageHeader";
import { ProductImportDropzone } from "./import/ProductImportDropzone";
import { ProductImportPreview } from "./import/ProductImportPreview";
import { useProductImportFlow } from "./import/useProductImportFlow";

export function ProductImportPage() {
  const flow = useProductImportFlow();
  const { state } = flow;
  const isCommitting = state.status === "committing";

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="商品一括インポート"
        actions={
          isCommitting ? undefined : (
            <Button type="button" variant="outline" asChild>
              <Link to="/products">
                <ArrowLeft aria-hidden="true" />
                商品一覧へ戻る
              </Link>
            </Button>
          )
        }
      />

      {state.status === "idle" || state.status === "previewing" ? (
        <ProductImportDropzone
          onFileSelect={(file) => {
            void flow.selectFile(file);
          }}
          disabled={flow.isPreviewing}
        />
      ) : null}

      {state.status === "previewing" ? (
        <p className="text-sm text-muted-foreground">CSVを確認しています...</p>
      ) : null}

      {state.status === "preview" ? (
        <ProductImportPreview
          filename={state.filename}
          preview={state.preview}
          overwriteCodes={state.overwriteCodes}
          targetCount={flow.targetRows.length}
          isCommitting={flow.isCommitting}
          onToggleOverwrite={flow.toggleOverwrite}
          onCommit={flow.confirmImport}
          onReselect={(file) => {
            void flow.selectFile(file);
          }}
        />
      ) : null}

      {state.status === "committing" ? (
        <ProductImportPreview
          filename={state.filename}
          preview={state.preview}
          overwriteCodes={state.overwriteCodes}
          targetCount={state.targetRows.length}
          isCommitting
          onToggleOverwrite={flow.toggleOverwrite}
          onCommit={flow.confirmImport}
          onReselect={(file) => {
            void flow.selectFile(file);
          }}
        />
      ) : null}

      {state.status === "result" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5" aria-hidden="true" />
              インポート完了
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <ResultCount label="新規登録" value={state.result.created_count} />
              <ResultCount label="上書き更新" value={state.result.updated_count} />
              <ResultCount label="スキップ" value={state.result.skipped_count} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={flow.reset}>
                続けてインポート
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/products">商品一覧を確認</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>インポートに失敗しました</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{state.error.cmdError.message}</p>
            <Button type="button" variant="outline" onClick={flow.dismissError}>
              戻る
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function ResultCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value.toLocaleString()} 件</p>
    </div>
  );
}
