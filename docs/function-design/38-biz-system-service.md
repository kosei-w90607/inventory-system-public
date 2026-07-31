# BIZ-09 システム設定・操作ログサービス

## 38.1 概要

`biz::system_service` は、システム設定と操作ログに関する CMD 層からの要求を受け、`db::system_repo` を呼び出す BIZ 境界である。D-060 に従い、操作ログの日付 validation は本サービスが所有する。

## 38.2 get_all_settings

**関数要求**: 保存済みのシステム設定を一覧で返す。

**シグネチャ**:
```rust
pub fn get_all_settings(conn: &DbConnection) -> Result<Vec<AppSetting>, BizError>
```

**処理ステップ**:
1. `system_repo::get_all_settings(conn)` を呼び出す。
2. 取得した設定を順序を変えずに返す。

**エラーハンドリング**: `DbError` は `BizError::DatabaseError` へ変換する。

## 38.3 upsert_setting

**関数要求**: 指定キーの設定値を追加または更新する。

**シグネチャ**:
```rust
pub fn upsert_setting(
    conn: &DbConnection,
    key: &str,
    value: &str,
) -> Result<(), BizError>
```

**処理ステップ**:
1. `key` と `value` を `system_repo::upsert_setting` へ渡す。
2. repository の成功結果を返す。

**エラーハンドリング**: `DbError` は `BizError::DatabaseError` へ変換する。

## 38.4 list_operation_logs

**関数要求**: pagination、operation type、JST 暦日範囲の条件で操作ログを検索する。

**シグネチャ**:
```rust
pub fn list_operation_logs(
    conn: &DbConnection,
    page: u32,
    per_page: u32,
    operation_type: Option<&str>,
    start_date: Option<&str>,
    end_date: Option<&str>,
) -> Result<PaginatedResult<OperationLog>, BizError>
```

**処理ステップ**:
1. `start_date` と `end_date` が、ASCII 数字とハイフンによる 10 文字固定の `YYYY-MM-DD` であり、実在する暦日であることを検証する。
2. 両日が指定された場合は `start_date <= end_date` を検証する。同日は許可する。
3. 検証通過後、全検索条件を `system_repo::list_operation_logs` へ渡す。
4. repository が返す `PaginatedResult<OperationLog>` をそのまま返す。

`per_page` の上限は D-031 の共通定数に従い repository 層が 200 にクランプする。本サービスでは別の上限判定を重複させない。

**エラーハンドリング**:
- 日付形式または実在暦日の不正は `BizError::ValidationFailed("開始日・終了日はYYYY-MM-DD形式で入力してください")`。
- `start_date > end_date` は `BizError::ValidationFailed("開始日は終了日と同じ日か、それより前の日付にしてください")`。
- `DbError` は `BizError::DatabaseError` へ変換する。

## 38.5 list_distinct_operation_types

**関数要求**: 保存済み操作ログに存在する operation type の重複なし一覧を返す。

**シグネチャ**:
```rust
pub fn list_distinct_operation_types(
    conn: &DbConnection,
) -> Result<Vec<String>, BizError>
```

**処理ステップ**:
1. `system_repo::find_distinct_operation_types(conn)` を呼び出す。
2. repository が返す一覧を順序を変えずに返す。

**エラーハンドリング**: `DbError` は `BizError::DatabaseError` へ変換する。

## 38.6 テスト

- REQ-905: 初期設定一覧取得と設定 upsert の永続化を BIZ public 関数経由で検証する。
- REQ-902: strict ASCII `YYYY-MM-DD`、実在暦日、同日許可、範囲逆転の validation 契約を検証する。
- REQ-902: repository error が `BizError::DatabaseError` へ変換されることを検証する。
- REQ-902: operation type 一覧の repository 委譲を検証する。
