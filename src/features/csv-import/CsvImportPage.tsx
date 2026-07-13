// src/features/csv-import/CsvImportPage.tsx
//
// UI-07 CSV取込み画面の最上位レイアウト。useCsvImportFlow() の戻り値を state.status で
// 4 step UI (Parse/Preview/Importing/Result) に振り分け、error variant は重ね描き。
// 設計: docs/function-design/55-ui-csv-import.md §55.1 / §55.4

import { PageHeader } from "@/components/patterns/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DailyReportImportPage } from "@/features/daily-report-import/DailyReportImportPage";
import { useCsvImportFlow } from "./hooks/useCsvImportFlow";
import { ErrorState } from "./components/ErrorState";
import { ImportingStep } from "./components/ImportingStep";
import { ParseStep } from "./components/ParseStep";
import { PreviewStep } from "./components/PreviewStep";
import { ResultStep } from "./components/ResultStep";
import { StepIndicator, type StepNumber } from "./components/StepIndicator";
import type { CsvImportState } from "./types";

/// state.status (error 時は previousState.status を使う) を 1/2/3 step に正規化。
/// 設計: 55-ui-csv-import.md §55.2 派生値 currentStep
function computeCurrentStep(status: CsvImportState["status"]): StepNumber {
  switch (status) {
    case "idle":
    case "parsing":
      return 1;
    case "preview":
      return 2;
    case "importing":
    case "result":
      return 3;
    case "error":
      // error は呼び出し側で previousState.status に展開済の想定。万一直接来た場合は idle 扱い。
      return 1;
  }
}

export function CsvImportPage() {
  return (
    <div className="min-h-screen space-y-6 p-6">
      <PageHeader
        title="売上データ取込み"
        subtitle="日報（Z001/Z002/Z005）と商品別CSV（Z004）を分けて取り込みます"
      />
      <Tabs defaultValue="daily-report" className="w-full">
        <TabsList>
          <TabsTrigger value="daily-report">日報取込み</TabsTrigger>
          <TabsTrigger value="z004">商品別CSV取込み（Z004）</TabsTrigger>
        </TabsList>
        <TabsContent value="daily-report">
          <DailyReportImportPage />
        </TabsContent>
        <TabsContent value="z004">
          <CsvImportFlowPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CsvImportFlowPanel() {
  const flow = useCsvImportFlow();
  const { state } = flow;

  // error variant の currentStep は previousState を見る。reducer 側で recoverTo に応じて
  // previousState を構築するため、importing 中の失敗でも recoverTo="preview" なら previousState
  // は再構築された preview variant となり step=2、recoverTo="idle" なら importing variant のまま
  // で step=3 が表示される (§55.2 import_failed reducer 経路の派生挙動)
  const visibleStatus = state.status === "error" ? state.previousState.status : state.status;
  const currentStep = computeCurrentStep(visibleStatus);

  // a11y: HTML5 main landmark は RootLayout の <main> が持つため <div> を採用 (HomePage.tsx と同方針)
  return (
    <div className="space-y-6">
      <StepIndicator currentStep={currentStep} />

      {renderBody(flow)}
    </div>
  );
}

/// state.status 6 variant の網羅描画。error は ErrorState で上書き、それ以外は対応 step component。
/// switch 内の exhaustiveness は TypeScript の discriminated union で静的検査される。
function renderBody(flow: ReturnType<typeof useCsvImportFlow>) {
  const {
    state,
    selectFile,
    confirmImport,
    rollback,
    dismissError,
    isParsing,
    isImporting,
    isRollingBack,
  } = flow;

  // selectFile / onReselect は Promise<void> を返すため、void 演算子で fire-and-forget 化。
  // useMutation の onError が拾うので unhandled rejection は発生しない (§55.3)。
  const handleFileSelect = (file: File) => {
    void selectFile(file);
  };

  switch (state.status) {
    case "error":
      return (
        <ErrorState error={state.error} recoverTo={state.recoverTo} onDismiss={dismissError} />
      );
    case "idle":
    case "parsing":
      return <ParseStep isParsing={isParsing} onFileSelect={handleFileSelect} />;
    case "preview":
      return (
        <PreviewStep
          preview={state.preview}
          filename={state.filename}
          onConfirm={confirmImport}
          onReselect={handleFileSelect}
          isImporting={isImporting}
        />
      );
    case "importing":
      return <ImportingStep filename={state.filename} />;
    case "result":
      return (
        <ResultStep
          result={state.result}
          settlementDate={state.settlementDate}
          onRollback={() => {
            rollback(state.result.csv_import_id);
          }}
          isRollingBack={isRollingBack}
        />
      );
  }
}
