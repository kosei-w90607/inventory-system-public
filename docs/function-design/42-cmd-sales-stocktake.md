## 22. CMD-09: 売上集計コマンド群 / CMD-10: 棚卸しコマンド群 / CMD-01 追加: 一括インポート / CMD-11 部分: 整合性チェック

### 22.1 モジュール構成

```
src-tauri/src/
  cmd/
    mod.rs               -- pub mod sales_cmd, stocktake_cmd, integrity_cmd を追加
    product_cmd.rs       -- CMD-01（既存スタブ → 5.4節の実装 + import追加）
    sales_cmd.rs         -- 売上集計関連のTauriコマンド（CMD-09）
    stocktake_cmd.rs     -- 棚卸し関連のTauriコマンド（CMD-10）
    integrity_cmd.rs     -- 整合性チェックのTauriコマンド（CMD-11部分）
    csv_import_cmd.rs    -- 既存（CMD-07）
    plu_export_cmd.rs    -- 既存（CMD-08）
```

---

### 22.2 CMD層の原則（17.2節を継承）

17.2節（41-cmd-pos.md）の原則をそのまま適用:
- 薄いラッパー: state.db.lock() → BIZ呼出し → BizError→CmdError変換
- 業務バリデーション、ビジネスロジックは持たない
- wire の有限文字列を内部 enum へ変換する境界処理はCMD責務とする。変換後の値に対する業務条件はBIZだけが判定する

**Phase 5 追加コマンドでのキャッシュ**: CMD-09/10/整合性コマンドは preview_cache を使用しない。DB接続のみ。

---

### 22.3 BizError → CmdError 変換（Phase 5 追加分）

40-cmd-product.md 5.3節 と 41-cmd-pos.md 17.4節 の既存変換ルールに以下を追加:

| BizError | CmdError.kind | CmdError.message |
|----------|--------------|------------------|
| ValidationFailedAt { message, field } | "validation" | message をそのまま使用し、field も保持 |
| StocktakeInProgress(msg) | "stocktake_in_progress" | msg をそのまま使用 |
| StocktakeNotInProgress(msg) | "stocktake_not_in_progress" | msg をそのまま使用 |

**stocktake_in_progress を新設した理由**: 棚卸し開始時の「既に進行中」は一般的なバリデーションエラーとは性質が異なる。UI側で「進行中の棚卸しに移動」等の案内を出すために種別を分ける。

**未入力商品の警告**: BIZ-06 は未入力時に `ValidationFailed` を返す（メッセージに件数含む）。CMD層は既存の `ValidationFailed → "validation"` 変換で対応。

---

### 22.4 CMD-09 コマンド

#### get_daily_sales

**関数要求**: 指定日の売上レポートを取得する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn get_daily_sales(
    state: State<AppState>,
    date: String,
) -> Result<DailySalesReport, CmdError>
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得
2. biz::sales_service::get_daily_sales(&conn, &date) を呼ぶ
3. Ok → DailySalesReport をそのまま返す
4. Err(BizError) → CmdError に変換して返す

#### get_monthly_sales

**関数要求**: 指定月の売上レポートを取得する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn get_monthly_sales(
    state: State<AppState>,
    month: String,
    mode: String,
) -> Result<MonthlySalesReport, CmdError>
```

**処理ステップ**:
1. mode を SalesMode に変換: "by_product" → ByProduct, "by_department" → ByDepartment, その他 → CmdError { kind: "validation", message: "不正な集計モードです" }
2. state.db.lock() でDB接続を取得
3. biz::sales_service::get_monthly_sales(&conn, &month, mode) を呼ぶ
4. Ok → MonthlySalesReport をそのまま返す
5. Err(BizError) → CmdError に変換して返す

**設計判断 — mode を String で受ける理由**: Tauriコマンドの引数はフロントエンドからJSON経由で渡される。Rust enum を直接受けるよりも String で受けて CMD 層で変換する方がフロントエンド側の実装が単純。
これは業務 validation ではなく wire→内部型変換であり、CMDに残す
（**CMD-09-CONV-D1**）。`SalesMode` の generated enum 化は監査是正 順14の
別契約であり、本変更では行わない。

#### export_sales_csv

**関数要求**: 指定日または指定月の売上データをCSVファイルとしてエクスポートする

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
#[specta::specta]
fn export_sales_csv(
    state: State<AppState>,
    report_type: SalesReportType,
    target: String,
) -> Result<SalesExportResponse, CmdError>
```

**SalesExportResponse構造体**:
```
struct SalesExportResponse {
    bytes_base64: String,        // UTF-8 BOM付きCSVバイト列のbase64エンコード
    suggested_filename: String,  // 推奨ファイル名
    content_type: String,        // "text/csv"
    encoding: String,            // "UTF-8"
    record_count: usize,         // エクスポート件数
}
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得（`report_type` は serde で `SalesReportType` enum に deserialize 済、CMD 層手動 validation 不要）
2. biz::sales_service::export_sales_csv(&conn, &report_type, &target) を呼ぶ
3. csv_bytes を base64 エンコード
4. SalesExportResponse を構築して返す
5. Err(BizError) → CmdError に変換して返す

**設計判断 — report_type を `SalesReportType` 直受けにする理由**（PR #66 Q-6 A 案、Codex R1 P3 由来）: `SalesReportType` は `#[derive(specta::Type, serde::Deserialize)]` + `#[serde(rename_all = "snake_case")]` で snake_case literal union (`"daily" | "monthly_by_product" | "monthly_by_department"`) として bindings.ts に export される。フロントエンドは bindings 由来の `SalesReportType` を直接渡し、serde が deserialize 段階で不正値を拒否する（CMD 層の手動 String → enum 変換不要、型安全性最大化）。

**設計判断 — get_monthly_sales の mode が String のままの理由**: `get_monthly_sales(month: String, mode: String)` は `#[specta::specta]` 化で bindings に snake_case `string` として export される（commit `daa4fef` 時点で mode のみ String 据え置き、SalesMode enum 化は別タイミングで実施判断）。`export_sales_csv` 側で `SalesReportType` 直受けを先行採用したのは、フロントエンドが `useExportFile({ reportType })` で同型 enum を共有する設計動機が強かったため。`get_monthly_sales(mode)` の enum 化は SalesMode の specta::Type derive + CMD signature 変更 + bindings 再生成を伴う drift 案件として Backlog 行き（Plans.md「specta 化対象 commands 段階化リスト」参照）。

---

### 22.5 CMD-10 コマンド

#### start_stocktake

**関数要求**: 新しい棚卸しを開始する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn start_stocktake(
    state: State<AppState>,
) -> Result<StartStocktakeResult, CmdError>
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得
2. biz::stocktake_service::start_stocktake(&mut conn) を呼ぶ
3. Ok → StartStocktakeResult を返す
4. Err(BizError::StocktakeInProgress(msg)) → CmdError { kind: "stocktake_in_progress", message: msg }
5. Err(other) → CmdError に通常変換

#### get_stocktake_items

**関数要求**: 棚卸しアイテム一覧を取得する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn get_stocktake_items(
    state: State<AppState>,
    stocktake_id: i64,
    department_id: Option<i64>,
    counted_only: Option<bool>,
    page: u32,
    per_page: u32,  // 下限はBIZが検証。上限はBIZ経由のIO層でD-031共有定数により200クランプ
) -> Result<StocktakeItemListResponse, CmdError>
```

**StocktakeItemListResponse構造体**:
```
struct StocktakeItemListResponse {
    items: Vec<StocktakeItemDetail>,   // 商品名・部門名付きのアイテム一覧
    progress: StocktakeProgress,        // 進捗（counted/total）
    total_count: u32,                   // ページング用の総件数
    page: u32,
    per_page: u32,
}
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得
2. biz::stocktake_service::get_stocktake_items(conn, stocktake_id, department_id, counted_only, page, per_page) を呼ぶ
3. BIZ層が page / per_page の下限を検証し、stocktake_repo::list_stocktake_items と stocktake_repo::get_stocktake_progress を呼んで items と progress をまとめる
4. 結果を StocktakeItemListResponse に組み立てて返す。BIZの field 付き validation は `CmdError.field` を保持する

**設計判断**: 現行実装の get_stocktake_items は BIZ 層（stocktake_service）を経由する。初期設計では読み取り専用のため CMD から stocktake_repo 直呼びとしていたが、2026-04-13 commit 882cec6 で BIZ wrapper が追加され、CMD は UI -> CMD -> BIZ -> IO の境界を保つ。

**pagination 実態**: stocktake_repo::list_stocktake_items は per_page を D-031 の `PAGINATION_MAX_PER_PAGE = 200` でクランプし、レスポンスの per_page もクランプ後の値を返す。

#### update_count

**関数要求**: 棚卸しアイテムのカウントを更新する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn update_count(
    state: State<AppState>,
    stocktake_item_id: i64,
    actual_count: i64,
) -> Result<UpdateCountResult, CmdError>
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得
2. UpdateCountRequest { stocktake_item_id, actual_count } を構築
3. biz::stocktake_service::update_count(&conn, req) を呼ぶ
4. BIZ層が actual_count < 0 を `ValidationFailed("カウント数は0以上で入力してください")` として拒否する
5. Ok → UpdateCountResult を返す
6. Err(BizError) → CmdError に変換

#### complete_stocktake

**関数要求**: 棚卸しを確定する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn complete_stocktake(
    state: State<AppState>,
    stocktake_id: i64,
    force_fill: bool,
) -> Result<StocktakeResult, CmdError>
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得
2. CompleteStocktakeRequest { stocktake_id, force_fill } を構築
3. biz::stocktake_service::complete_stocktake(&mut conn, req) を呼ぶ
4. Ok → StocktakeResult を返す（整合性チェック結果を含む。PR-5 で BIZ-07 統合後）
5. Err(BizError::StocktakeNotInProgress(msg)) → CmdError { kind: "stocktake_not_in_progress" }
6. Err(other) → CmdError に通常変換（ValidationFailed → "validation" で未入力警告を含む）

---

### 22.6 CMD-01 追加: 一括インポートコマンド

40-cmd-product.md（5.4節）に以下のコマンドを追加する。

#### preview_import

**関数要求**: 商品マスタCSVのプレビューを返す

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn preview_import(
    state: State<AppState>,
    file_bytes: Vec<u8>,
) -> Result<ImportPreview, CmdError>
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得
2. biz::product_service::preview_import(&conn, &file_bytes) を呼ぶ
3. BIZ層が空ファイルを `ValidationFailed("ファイルが空です")` として拒否する
4. Ok → ImportPreview を返す
5. Err(BizError) → CmdError に変換

#### commit_import

**関数要求**: プレビュー済みの一括インポートを確定する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn commit_import(
    state: State<AppState>,
    valid_rows: Vec<ImportRow>,
    overwrite_codes: Vec<String>,
) -> Result<ImportResult, CmdError>
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得
2. biz::product_service::commit_import(&mut conn, valid_rows, overwrite_codes) を呼ぶ
3. Ok → ImportResult を返す
4. Err(BizError) → CmdError に変換

---

### 22.7 CMD-11 部分: 整合性チェックコマンド

CMD-11 のうち、BIZ-07 に対応する2コマンドのみ Phase 5 スコープ。
設定・ログ・バックアップコマンドは Phase 6（MNT-01/MNT-02 依存）。

#### run_integrity_check

**関数要求**: 在庫整合性チェックを実行する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn run_integrity_check(
    state: State<AppState>,
) -> Result<IntegrityResult, CmdError>
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得
2. biz::integrity_service::run_integrity_check(&conn) を呼ぶ
3. Ok → IntegrityResult を返す
4. Err(BizError) → CmdError に変換

#### fix_integrity

**関数要求**: 指定商品の在庫を整合性チェック結果に基づいて補正する

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
fn fix_integrity(
    state: State<AppState>,
    product_codes: Vec<String>,
) -> Result<IntegrityFixResult, CmdError>
```

**処理ステップ**:
1. state.db.lock() でDB接続を取得
2. biz::integrity_service::fix_integrity(&mut conn, &product_codes) を呼ぶ
3. BIZ層が空の product_codes を `ValidationFailed("補正対象の商品が指定されていません")` として拒否する
4. Ok → IntegrityFixResult を返す
5. Err(BizError) → CmdError に変換

---

### 22.8 lib.rs コマンド登録

Phase 5 で以下のコマンドを invoke_handler に追加登録:

```
// CMD-01 追加（product_cmd.rs — 5.4節の既存設計 + import）
create_product, update_product, toggle_discontinue, search_products, get_product,
preview_import, commit_import,

// CMD-09（sales_cmd.rs）
get_daily_sales, get_monthly_sales, export_sales_csv,

// CMD-10（stocktake_cmd.rs）
start_stocktake, get_stocktake_items, update_count, complete_stocktake,

// CMD-11 部分（integrity_cmd.rs）
run_integrity_check, fix_integrity,
```

合計 16 コマンド（CMD-01: 7, CMD-09: 3, CMD-10: 4, CMD-11部分: 2）。

---

### 22.9 非目的

| やらないこと | 理由 | 責務を持つモジュール |
|------------|------|-----------------|
| CMD-11 設定・ログ・バックアップ | MNT-01/MNT-02 依存（Phase 6） | Phase 6 で追加 |
| preview_cache 操作 | Phase 5 コマンドは DB のみ | CMD-07（既存） |
| 業務バリデーション | BIZ層の責務 | 各BIZサービス |

---

### 22.10 validation test contract

CMD-01 `preview_import`、CMD-09 `get_monthly_sales`、CMD-10
`get_stocktake_items` / `update_count`、CMD-11 `fix_integrity` のvalidation / conversion
testは、`tauri::test::mock_builder`でmanaged `AppState`を構築し、対象のproduction
command関数を呼ぶ。test内で `is_empty()`、閾値比較、mode変換、`CmdError`構築を
再実装してはならない。

error期待値はproduction定数・helperからimportせず、source designから独立転記した
`kind` / `message` / `field` を完全一致比較する。productionの各guard / mappingを
削除または反転したとき、対応testがredになることをmutationで確認する。
