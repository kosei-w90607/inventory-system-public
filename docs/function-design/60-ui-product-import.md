# 60. UI-01c: 商品一括インポート

> 対応仕様: REQ-104 / UI-01c
>
> 入力ドキュメント: `docs/architecture/ui-task-specs.md` UI-01c、`docs/SCREEN_DESIGN.md` 一括インポート画面、`docs/UI_TECH_STACK.md` §6.5.4、`docs/function-design/26-io-product-csv-importer.md`、`docs/function-design/30-biz-product-service.md` `preview_import` / `commit_import`、`docs/function-design/40-cmd-product.md`、`docs/function-design/42-cmd-sales-stocktake.md` §22.6

商品一括インポートは、初期導入や大きな商品マスタ更新時に CSV から商品をまとめて登録・更新する operator-facing flow である。通常の個別登録 UI-01b と同じ BIZ-01 / CMD-01 契約を使い、UI はファイル選択、プレビュー、重複行の扱い、確定結果の確認を担当する。CSV のパース・業務バリデーション・DB 書込みは UI に置かない。

## 60.0 関数要求 / シグネチャ / 処理ステップの扱い

**関数要求**: UI-01c は frontend page / reducer / component 群として、商品マスタ CSV の file bytes を generated CMD へ渡し、preview 結果を表示し、利用者が選んだ import target だけを commit する。

**シグネチャ**: frontend の境界は `commands.previewImport(fileBytes)` と `commands.commitImport(validRows, overwriteCodes)` である。React component の詳細 props は §60.2 で定義し、Rust command / DTO の詳細は §60.4 で定義する。

**処理ステップ**: 画面全体の状態遷移は §60.3、利用者操作と表示分岐は §60.5、エラー復旧は §60.6 に定義する。

## 60.1 設計判断

| Spec | Decision ID | 決定 | 理由 / 不採用案 |
|---|---|---|---|
| REQ-104 / UI-01c | UI-01c-D1 | route は `/products/import` とし、file route は `src/routes/products/import.tsx`、画面本体は `src/features/products/ProductImportPage.tsx` に置く。 | 商品管理エリア内の独立作業であり、商品一覧や商品フォームの query param で mode を切り替えると preview / commit state が混ざる。 |
| REQ-104 / CMD-01 | UI-01c-D2 | UI は generated `commands.previewImport(fileBytes)` / `commands.commitImport(validRows, overwriteCodes)` のみを使う。実装 PR では既存 Rust command に `#[specta::specta]` を付け、`ImportRow` / `ImportErrorRow` / `ImportDuplicateRow` / `ImportPreview` / `ProductImportResult` を generated binding に出す。既存 `product_service::ImportResult` は `ProductImportResult` に rename して、売上 CSV 取込みの `ImportResult` と TS 名を衝突させない。 | Rust 側 command は存在するが、現状 `src/lib/bindings.ts` に商品一括インポート用 command がない。`typedInvoke` fallback は退役済みなので、ad hoc invoke は採用しない。 |
| REQ-104 / UI-01c | UI-01c-D3 | ファイル選択は UI-07 と同じ plain `<input type="file" accept=".csv,.txt">` + drag/drop で始める。`@tauri-apps/plugin-dialog` は導入しない。Windows native では HTML5 drag/drop を frontend に届かせるため、Tauri main window の `dragDropEnabled` を `false` にする。 | plugin-dialog は npm / cargo 依存、Tauri 登録、capability 追加を伴う。UI-01c 単独で導入すると scope が増える。Tauri 既定の file-drop event は Windows で HTML drop event を奪うため、今回の dropzone 実装とは相性が悪い。将来のネイティブダイアログ統合は UI_TECH_STACK §6.5.4 の再検討対象に残す。 |
| REQ-104 / UI-01c | UI-01c-D4 | 画面状態は `idle` / `previewing` / `preview` / `committing` / `result` / `error` の discriminated union + reducer にする。preview 結果は画面 state に保持し、server cache は作らない。 | BIZ-01 設計が「プレビュー結果はフロントエンド側で保持し、commit 時に送信」としている。Zustand / XState は cancel/resume/並行状態がない初回実装では過剰。 |
| REQ-104 / UI-01c | UI-01c-D5 | プレビューは 3 系統を同時に見せる: 新規登録可能行、エラー行、重複行。画面上部に件数サマリを置き、詳細テーブルは先頭 50 行までを既定表示にする。 | 商品マスタは数千行規模になり得る。全行を無制限に描画すると重く、利用者の判断に必要な先頭確認と件数確認を優先する。 |
| REQ-104 / duplicate | UI-01c-D6 | 重複行は既定で「スキップ」にし、行ごとに「上書き」を選べる。全重複をまとめて上書きする操作は初回実装では置かない。 | 上書きは既存商品情報を変える操作で影響が大きい。大量一括上書きは誤操作時の被害が大きいため、初回は行単位で明示選択させる。 |
| REQ-104 / duplicate | UI-01c-D7 | `上書き` を 1 件以上選んで「取り込む」を押した場合は確認ダイアログを出す。全件新規または重複全スキップなら確認なしで commit する。 | 上書きは破壊的に近い状態変更で、DSR-07 の確認境界に該当する。新規登録だけなら通常の保存操作であり、不要な確認は挟まない。 |
| REQ-104 / UI-01c | UI-01c-D8 | `error_rows.length > 0` でも commit は許可する。ただし取り込む対象は `valid_rows` + 上書き選択済み duplicate のみで、エラー行は取り込まない。 | IO/BIZ はエラー行と正常行を同じ preview に返す。正常行まで止めると初期投入作業が進まない。エラー行の除外は件数と文言で明示する。 |
| REQ-104 / UI-01c | UI-01c-D9 | `valid_rows.length === 0` かつ上書き選択 0 件の場合、「取り込む」ボタンは disabled にし、理由を日本語で表示する。 | 操作可能に見えて何も起きない状態は避ける。disabled だけにせず、何が不足しているかをテキストで伝える。 |
| REQ-104 / products cache | UI-01c-D10 | commit 成功後の invalidation は [D-052](../decision-log.md) C3 と `src/lib/invalidation-contract.ts` を正本とし、結果画面から `/products` へ戻る導線を出す。 | 商品 master・在庫・PLU・棚卸し consumer を一貫して stale 化し、画面側の key 列挙を廃止する。 |
| REQ-104 / UI-01c | UI-01c-D11 | 完了画面は `created_count` / `updated_count` / `skipped_count` をサマリカードまたは数値帯で示し、「商品一覧へ戻る」「別のCSVを取り込む」の 2 動線に絞る。 | 初期投入作業では連続取込もあり得る。完了後の次の一手を明示しつつ、余分な action を増やさない。 |
| REQ-104 / UI-01c | UI-01c-D12 | 画面を離れても DB 書込み途中の cancel/resume は提供しない。`committing` 中は画面内操作を disabled にし、commit 完了後の結果で確認する。 | backend commit は単一 TX。途中 cancel は設計されておらず、UI だけでキャンセル可能に見せると誤認を招く。 |
| REQ-104 / UI-01c | UI-01c-D13 | Windows native L3 は owner 目視確認を必須にする。確認対象は file input / drag&drop、エラー行と重複行の区別、上書き確認、日本語文言、結果サマリ、商品一覧への戻り導線。 | 新規 operator-facing screen であり、CSV 作業は初期導入時に失敗影響が大きい。CI / unit test だけでは視認性と操作の分かりやすさを判断できない。 |

## 60.2 Component / Route 構成

```text
src/
  routes/
    products/
      import.tsx
  features/
    products/
      ProductImportPage.tsx
      import/
        product-import-reducer.ts
        product-import-types.ts
        product-import-summary.ts
        ProductImportDropzone.tsx
        ProductImportPreview.tsx
        ProductImportResult.tsx
        OverwriteRowsDialog.tsx
```

`products/import.tsx` は route と title を管理し、画面本体は `ProductImportPage` に委譲する。`ProductImportPage` は reducer、mutation、query invalidation、子コンポーネントへの props 配線を担当する。`ProductImportPreview` は preview 結果の表示だけを担い、上書き対象の選択 state は reducer に集約する。

## 60.3 State Machine

| State | 意味 | 主な表示 | 次の action |
|---|---|---|---|
| `idle` | ファイル未選択 | ドロップゾーン、CSV列の説明、注意文 | `file_selected` |
| `previewing` | CSV を backend で preview 中 | spinner + 「CSVを確認しています」 | `preview_succeeded` / `preview_failed` |
| `preview` | preview 表示中 | 件数サマリ、エラー行、重複行、取込ボタン | `toggle_overwrite` / `commit_requested` / `reset` |
| `committing` | commit 実行中 | 操作 disabled、spinner + 「取り込んでいます」 | `commit_succeeded` / `commit_failed` |
| `result` | commit 完了 | 新規/更新/スキップ件数、次の導線 | `reset` / `/products` へ遷移 |
| `error` | ファイル全体エラーまたは commit 失敗 | Alert + 再試行 / ファイル選択へ戻る | `reset` / `retry_preview` |

`preview` state は `preview: ImportPreview` と `overwriteCodes: string[]` を持つ。`overwriteCodes` は重複行の `product_code` だけを含める。`commit` payload は以下で組み立てる。

```text
validRows = [
  ...preview.valid_rows,
  ...preview.duplicate_rows
    .filter(row => overwriteCodes.has(row.import_row.product_code))
    .map(row => row.import_row)
]
overwriteCodes = Array.from(overwriteCodes)
```

## 60.4 Command / DTO Contract

UI-01c 実装 PR では以下を generated binding に出す。

| Command / Type | Existing backend | UI-01c usage |
|---|---|---|
| `commands.previewImport(fileBytes)` | Rust command は既存、generated 未対応 | file bytes を preview し、行分類を表示 |
| `commands.commitImport(validRows, overwriteCodes)` | Rust command は既存、generated 未対応 | 新規行 + 上書き選択済み重複行を commit |
| `ImportRow` | Rust type は既存、`specta::Type` 未対応 | commit payload、preview table |
| `ImportErrorRow` | Rust type は既存、`specta::Type` 未対応 | error table |
| `ImportDuplicateRow` | Rust type は既存、`specta::Type` 未対応 | duplicate table、overwrite 選択 |
| `ImportPreview` | Rust type は既存、`specta::Type` 未対応 | preview state |
| `ProductImportResult` | 現 Rust 名 `ImportResult` を実装 PR で rename | generated では sales CSV import の `ImportResult` と衝突しない名前にする |

`ProductImportResult` は `created_count`, `updated_count`, `skipped_count` を持つ。既存の CSV 売上取込み `ImportResult` と同じ TypeScript 名にしない。実装 PR では `src-tauri/src/biz/product_service.rs` の商品一括インポート結果型を `ImportResult` から `ProductImportResult` に rename し、`product_cmd::commit_import` の戻り値も `product_service::ProductImportResult` にする。specta export 名だけの上書き案は、Rust 内で `ImportResult` が複数意味を持ち続けるため採用しない。

## 60.5 表示 / 操作

- PageHeader title は `一括インポート`、subtitle は初期投入・大量更新用の短い説明に留める。
- `idle` では必要列を明示する: `商品コード`, `商品名`, `部門ID`, `売価`, `原価`, `税率`。任意列は `在庫単位`, `初期在庫`, `JANコード`, `メーカー品番`, `取引先ID`, `POS在庫連動`。
- CSV テンプレート出力は初回 UI-01c 実装では非 scope。必要列の説明を画面内に置く。
- `preview` では上部に件数サマリを置く: 新規登録候補、エラー行、重複行、上書き選択数。
- エラー行は行番号 + エラーメッセージを日本語で表示する。色だけで示さない。
- 重複行は行番号 + 商品コード + 商品名 + `スキップ / 上書き` の二択で示す。既定はスキップ。
- 取込ボタンの label は、上書き選択がある場合 `選択した内容で取り込む`、新規のみの場合 `取り込む` とする。
- `committing` 中は取込ボタン、ファイル選択、上書き切替を disabled にする。戻る / reset は commit 完了後に出す。
- `result` では `created_count`, `updated_count`, `skipped_count` を数値で示し、`商品一覧へ戻る` と `別のCSVを取り込む` を出す。

## 60.6 Error / Recovery

- ファイル空: CMD validation error を Alert に表示し、ファイル選択へ戻れる。
- 文字コード判別不能 / 必須列不足: file-level error として Alert に表示し、別ファイルを選べる。
- 行エラー: preview 内で取り込まれない行として表示する。正常行があれば commit は可能。
- 全行エラーまたは取り込む対象 0 件: commit button は disabled。理由を「取り込める行がありません」と表示する。
- commit internal error: preview state を保持し、再度 commit できる状態へ戻す。ファイル再選択を強制しない。
- 上書き確認 cancel: preview state と overwrite selection を保持する。

## 60.7 Cache / Navigation

- commit 成功時は D-052-C3 の SSOT helper を適用する。具体的な query key 集合は `src/lib/invalidation-contract.ts` だけに置く。
- `/products` への戻りは既定検索条件でよい。UI-01c は一覧検索条件の `returnTo` を持たない。
- `navigation.ts` の UI-01c は `to: "/products/import"`, `status: "active"` に切り替える。

## 60.8 Non-scope / Follow-up

- CSV テンプレートのダウンロード。
- `@tauri-apps/plugin-dialog` によるネイティブファイル選択。
- preview 結果の server-side token / cache 化。
- CSV 列マッピング UI。
- 全重複行の一括上書き。
- import 中断 / cancel / resume。
- import 履歴画面。

## 60.9 Test Focus

- UI-01c-D1: `/products/import` route で page title と navigation active が一致する。
- UI-01c-D2: `previewImport` / `commitImport` が generated binding に存在し、ad hoc invoke を使わない。
- UI-01c-D3: file input / dragdrop から bytes を `previewImport` に渡せる。
- UI-01c-D4: reducer が `idle -> previewing -> preview -> committing -> result` と error / reset を正しく遷移する。
- UI-01c-D5: preview 件数サマリ、エラー行、重複行が日本語ラベルで読める。
- UI-01c-D6/D7: 重複行は既定スキップ、上書き選択時のみ確認ダイアログが出る。
- UI-01c-D8/D9: エラー行があっても正常行 commit は可能、対象 0 件では commit disabled + 理由表示。
- UI-01c-D10: commit 成功時の実呼出し集合が D-052-C3 の独立 test oracle と完全一致する。
- UI-01c-D11: result で `created_count` / `updated_count` / `skipped_count` と次の導線が表示される。
- UI-01c-D12: committing 中は操作が disabled になり、cancel 可能に見せない。
- UI-01c-D13: Windows native L3 で file input / dragdrop、エラー・重複の見分け、上書き確認、結果導線を確認する。

## 60.10 変更履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-06-25 | UI-01c Design Phase | route、generated command 方針、file input 例外、reducer state、preview/duplicate/commit UX、query invalidation、Windows native L3 を整理。 |
