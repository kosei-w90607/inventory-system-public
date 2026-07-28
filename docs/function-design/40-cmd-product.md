## 5. CMD-01: 商品コマンド群

### 5.1 モジュール構成

```
src-tauri/src/
  cmd/
    mod.rs
    product_cmd.rs  -- 商品関連のTauriコマンド
```

### 5.2 CMD層のDB接続取得方針

BIZ層の関数が `&mut DbConnection` を要求するため、CMD層では `Mutex<Connection>` を AppState に保持し、
`.lock()` で可変借用を取得する。poison 時は `CmdError { kind: "internal" }` に変換する（unwrap() は使わない）。

```
// AppState 内
db: Mutex<Connection>

// CMD 関数内
let mut conn = state.db.lock().map_err(|_| CmdError { kind: "internal", message: "DB接続エラー", field: None })?;
biz::product_service::create_product(&mut conn, req)?;
```

### 5.3 CMD層のエラー返却方針

TauriコマンドはUI向けのエラー種別に正規化して返す。String一本ではなく構造化されたエラー型を使い、UI側でエラー種別に応じた分岐（バリデーションエラーならフィールドハイライト、重複エラーなら特定メッセージ等）を可能にする。

```
struct CmdError {
    kind: String,     // "validation" / "duplicate" / "not_found" / "internal" ほか（POS連携追加分は41-cmd-pos.md 17.4。全kindのenum化は監査是正 順14で扱う）
    message: String,  // 利用者向け日本語メッセージ（rawな技術詳細を含めない。CMD-ERR-D2）
    field: Option<String>,  // バリデーションエラー時のフィールド名
    error_id: Option<String>,  // 診断ログ相関ID（CMD-ERR-D1）。internal / restore_*系でのみSome
}
```

**エラーID契約（CMD-ERR-D1）**: raw な失敗詳細を wire に載せず診断ログ側にのみ記録する kind（`internal` と `restore_failed_recovered` / `restore_failed_unrecoverable` / `restore_durability_unknown`）は、生成時に `error_id`（形式 `E-<YYYYMMDD-HHMMSS>-<4hex>`。chrono ローカル時刻 + uuid v4 短縮、新規依存なし）を発行し、response と `tracing::error!` の両方に同一値を載せる。利用者は画面に表示された error_id と診断ログ（[70-mnt-diagnostic-log.md](70-mnt-diagnostic-log.md)）の同一 error_id で事象を突合できる。日次ローテーションのログファイル特定を助けるため時刻併記形式とする。他の kind は None。

**internal の sanitize 契約（CMD-ERR-D2）**: `CmdError::internal(user_message, detail)` は
- `message` には操作文脈の日本語定型文言のみを載せる。raw な error Display（SQLite メッセージ、OS error、ファイルパス等）を `message` に混ぜてはならない（`format!("...: {}", e)` パターンの禁止）
- `detail`（raw な失敗詳細）は error_id とともに `tracing::error!` で診断ログへ記録する
- 旧記載の「操作ログID（operation_logs）」による相関は実装と乖離していたため、相関キーは error_id × 診断ログに確定した（D-053）

BizError → CmdError の変換ルール:
- BizError::ValidationFailed(msg) → CmdError { kind: "validation", message: msg, field: None }
- BizError::ValidationFailedAt { message, field } → CmdError { kind: "validation", message, field: Some(field) }
- BizError::DuplicateProductCode(code) → CmdError { kind: "duplicate", message: "この商品コードは既に使用されています: {code}" }
- BizError::NotFound(msg) → CmdError { kind: "not_found", message: msg }
- BizError::DatabaseError(_) → CmdError { kind: "internal", message: "データベースエラーが発生しました。もう一度お試しください", error_id: Some(発行) }
- POS連携追加分（ImportError / IdempotencyConflict / ExportError）は 41-cmd-pos.md 17.4 を参照

### 5.4 各コマンドの関数仕様

CMD層は薄いラッパー。型変換→BIZ呼び出し→エラー正規化のみ。

#### create_product コマンド

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
#[specta::specta]
fn create_product(state: State<AppState>, req: ProductCreateRequest) -> Result<ProductCreateResult, CmdError>
```

**処理ステップ**:
1. state.db.lock() で接続を取得
2. biz::product_service::create_product(conn, req) を呼ぶ
3. Ok → ProductCreateResultをそのまま返す
4. Err(BizError) → CmdErrorに変換して返す

#### update_product コマンド

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
#[specta::specta]
fn update_product(state: State<AppState>, product_code: String, req: ProductUpdateRequest) -> Result<ProductUpdateResult, CmdError>
```

**部分更新wire契約（PRODUCT-PATCH-D1 / REQ-102）**:

- 通常field（`name`, `department_id`, `selling_price`, `cost_price`, `tax_rate`, `pos_stock_sync`, `plu_target`）は、JSON omitted / nullのどちらも「更新しない」、valueは「設定する」。
- clear可能field（`supplier_id`, `maker_code`）は、JSON omittedが「更新しない」、nullが「clearする」、valueが「設定する」。
- generated commandの入力型は `ProductUpdateRequest_Deserialize` とし、全propertyをoptionalにする。frontend側の `Partial` aliasや型assertionでgenerated契約を迂回しない。
- command名、引数名、response、`CmdError`、BIZ呼出し順は変更しない。

**処理ステップ**: create_productと同パターン。biz::product_service::update_product()を呼ぶ

#### toggle_discontinue コマンド

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
#[specta::specta]
fn toggle_discontinue(state: State<AppState>, product_code: String) -> Result<bool, CmdError>
```

**処理ステップ**: biz::product_service::toggle_discontinue()を呼ぶ

#### search_products コマンド

**処理ステップ**: biz::product_service::search_products()を呼ぶ

#### list_departments コマンド

**関数要求**: UI-01a / UI-01b の部門選択候補として、部門マスタ全件を取得する。

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
#[specta::specta]
fn list_departments(state: State<AppState>) -> Result<Vec<Department>, CmdError>
```

**処理ステップ**:
1. state.db.lock() で接続を取得
2. biz::product_service::list_departments(&conn) を呼ぶ
3. Ok → `Vec<Department>` をそのまま返す
4. Err(BizError) → CmdErrorに変換して返す

**設計判断**: UI-01a の部門フィルタは、検索結果の現在ページから候補を派生しない。候補は departments 初期データ 21 件を正とし、`product_repo::list_departments` を BIZ 経由で公開する。

#### list_suppliers コマンド

**関数要求**: UI-01b の取引先選択候補として、取引先マスタ全件を取得する。

**シグネチャ（Tauriコマンド）**:
```
#[tauri::command]
#[specta::specta]
fn list_suppliers(state: State<AppState>) -> Result<Vec<Supplier>, CmdError>
```

**処理ステップ**:
1. state.db.lock() で接続を取得
2. biz::product_service::list_suppliers(&conn) を呼ぶ
3. Ok → `Vec<Supplier>` をそのまま返す
4. Err(BizError) → CmdErrorに変換して返す

**設計判断**: UI-01b の取引先候補は complete master data から取得する。inline 新規取引先作成は初回 UI-01b 実装では非 scope とし、`find_or_create_supplier` の公開 CMD は別 Design Phase で扱う。

#### get_product コマンド

**処理ステップ**: product_repo::find_by_product_code()を呼ぶ。None → CmdError { kind: "not_found" }
