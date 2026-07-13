# UI-07 日報取込みファイルダイアログの前回使用フォルダ記憶

> **Status**: 完了（PR #147 squash merge `835d506`、2026-07-06。Windows native L3 3項目合格。同日 closeout で archive）

## Risk

Risk: R2

Reason:
UI 層 hook 1 ファイルの小さい振る舞い追加（ダイアログ初期フォルダ + localStorage 永続）。CMD/BIZ/IO 契約、DTO、画面構成、文言は変更しない。operator 操作動線に影響するため R1 ではなく R2 とする。

## Goal

日報取込み（UI-07 日報トラック）のファイル選択ダイアログが、前回選択したフォルダから開くようにする。CASIO PCツールの保存領域（`EcrDatas` 配下の深い年/月ディレクトリ、または SDカード）を毎回辿り直す operator 負担を除く。

## Scope

- `useDailyReportImportFlow.ts` の `chooseFiles`: 選択成功時に選択パスからディレクトリを導出し localStorage（key `inventory:daily-report-import:last-dir:v1`）へ保存、次回 `open()` に `defaultPath` として渡す。
- localStorage アクセスは既存前例（`PLU_EXPORT_PENDING_STORAGE_KEY` / `display-scale.ts`）と同じく try/catch guard で restricted WebView を許容する。
- `useDailyReportImportFlow.test.tsx` へのテスト追加。
- `docs/function-design/55-ui-csv-import.md` への最小追記と Plans.md 同期。

## Non-scope

- UI-11b バックアップ・復元のフォルダ選択ダイアログ（別 follow-up、共通 `FilePicker` 部品化 backlog と統合判断）。
- Z004 商品別トラックのファイル選択（plain file input のまま。共通化 backlog 参照）。
- 日報取込み手順書の主手順決定（CV17 運用ヒアリング待ち、Plans.md Backlog 参照）。
- ダイアログ以外の画面表示・文言変更。

## Acceptance Criteria

- 初回（記憶なし）は従来どおり `defaultPath` なしで開く。
- ファイル選択後（3ファイル一致チェックの前）にディレクトリが保存され、次回ダイアログが同フォルダから開く。
- 3ファイル不一致で選び直す場合も直前に browse したフォルダが記憶されている。
- localStorage が使えない環境でも選択フローが従来どおり動く（記憶だけ無効）。
- Windows パス（`\` 区切り）と POSIX パス（`/` 区切り）の両方でディレクトリ導出が正しい。
- 既存テスト green + 追加テスト green。

## Design Sources

- Architecture: [docs/ARCHITECTURE.md](../../ARCHITECTURE.md) UI-07
- Function / command / DTO: [docs/function-design/55-ui-csv-import.md](../../function-design/55-ui-csv-import.md)
- Screen / UI: [docs/SCREEN_DESIGN.md](../../SCREEN_DESIGN.md) 売上データ取込み
- Decision log / ADR: なし（端末ローカルな操作利便のため localStorage 前例に従う）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | none | not applicable（backend 変更なし） |
| Command / DTO / generated binding / wire shape | none | not applicable |
| DB / transaction / audit / rollback / migration | none | not applicable |
| Screen / UI / route state / Japanese wording | 55-ui-csv-import.md | existing sufficient; defaultPath 記憶の最小追記を本 PR で実施 |
| CSV / TSV / report / import / export format | none | not applicable |
| Durable decision / ADR | none | localStorage 前例（PLU pending / display-scale）踏襲のため新規 ADR 不要 |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-401（取込み操作動線） | 55-ui-csv-import.md 日報トラック ファイル選択 | なし（前例踏襲） | app_settings（DB）保存は業務設定と端末ローカル利便の混在になるため不採用。localStorage は PLU pending / display-scale で確立済み | `useDailyReportImportFlow.ts` | `useDailyReportImportFlow.test.tsx` |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history: yes（55-ui へ defaultPath 記憶を追記する）。
- Plan-only durable decisions found and promoted: なし（前例踏襲のため）。
- Assumptions and constraints: `@tauri-apps/plugin-dialog` の `open()` は `defaultPath` に存在しないパスを渡しても OS 側ダイアログが既定位置へフォールバックする（Windows 標準挙動）。壊れたパスで開けなくなる懸念はない。
- Deferred design gaps: 共通 `FilePicker` 部品化と Z004 トラックの plain file input 解消は既存 backlog。
- Test Design Matrix: R2 小変更のため packet 内 Test Plan で代替。

## Impact Review Lenses

Not applicable: POS boundary / CSV semantics / DB 契約に触れない端末ローカルの操作利便。日報取込み主手順の決定（SD / XZ_BKUP / EcrDatas）とは独立で、どの主手順に決まっても本変更は有効に働く。

## Design Readiness

- Existing design docs are sufficient because: 55-ui-csv-import.md がファイル選択フロー（plugin-dialog 化済み）を定義しており、本変更は同フローの初期フォルダのみ拡張する。
- Source docs updated in this PR: 55-ui-csv-import.md（defaultPath 記憶の追記）。
- Design gaps intentionally deferred: 共通 FilePicker / Z004 トラック。
- Durable decisions discovered in this plan and promoted to source docs: なし。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI 層内で完結。CMD 以下変更なし。
- Backend function design: unchanged。
- Command / DTO / data contract: unchanged。
- Persistence / transaction / audit impact: 業務データの永続なし（端末ローカル localStorage のみ）。
- Operator workflow / Japanese UI wording: 文言変更なし。ダイアログ初期位置のみ。
- Error, empty, retry, and recovery behavior: localStorage 不可時は記憶無効で従来動作。選び直し時も直前フォルダを記憶。
- Testability and traceability IDs: 既存 REQ-401 テスト維持 + 追加テストで defaultPath / 保存を検証。

## Test Plan

- targeted tests: `npx vitest run src/features/daily-report-import/hooks/useDailyReportImportFlow.test.tsx`
- negative tests: localStorage setItem が throw する場合に選択フローが継続すること / 記憶なし初回に defaultPath を渡さないこと。
- compatibility checks: `npm run typecheck`、`npm run lint`、既存 daily-report-import テスト一式。
- data safety checks: 実ファイル・実パスの commit なし（テストは合成パスのみ）。
- main wiring/integration checks: `bash scripts/doc-consistency-check.sh`、`bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-07-06-ui07-dialog-last-dir.md`。

## Boundary / Wire Contract

- producer/consumer: UI 層内（hook ↔ plugin-dialog / localStorage）。wire contract 変更なし。
- internal type: `string | null`（保存ディレクトリ）。
- invalid input: 空文字・区切りなしパスはディレクトリ導出不能として保存しない。存在しない保存済みパスは OS ダイアログのフォールバックに委ねる。
- compatibility: 保存 key に `:v1` を付け、将来形式変更時は key 更新で自然移行。

## Review Focus

- ディレクトリ導出が Windows `\` / POSIX `/` 混在で正しいか。
- localStorage guard が例外を握りつぶすのは記憶機能のみで、選択フロー本体のエラー処理（既存 catch）と分離されているか。
- useCallback 依存配列の整合。

## Self-Review

7 観点セルフレビュー実施（2026-07-06）:

1. 設計書整合: 55-ui-csv-import.md のファイル選択フロー定義と矛盾なし。追記は本 PR で実施。
2. スコープ: hook 1 ファイル + テスト + docs 追記に限定。UI-11b / Z004 トラックへ広げない根拠を Non-scope に明記。
3. レイヤー原則: UI 層内で完結、違反なし。
4. エラー処理: localStorage guard は記憶機能に限定し、既存の選択エラー処理と分離。
5. テスト: 正常系（保存 → defaultPath）+ 負系（storage throw / 初回）を追加。既存テストは変更しない。
6. データ安全: 実パス・実ファイルを repo に入れない。保存されるのは operator 端末の localStorage のみ。
7. 代替案検討: app_settings（DB）保存は業務設定との混在で不採用。tauri-plugin-store 追加は依存追加コスト（D-030 逐次投入判断が必要）に見合わず不採用。
