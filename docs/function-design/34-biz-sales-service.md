## 19. BIZ-05: 売上集計ロジック

> **2026-06-30 REQ-401 redesign note**: 既存BIZ-05は `sale_records` 由来の商品別売上を日次/月次レポートとして返す。current operation の公式日報入力は Z001/Z002/Z005 であり、これは `daily_report_imports` / `daily_report_*_lines` 由来の集計データである。BIZ-05は今後、公式日報集計と商品別売上明細を分けて返す。日報集計を `sale_records` に擬似展開しない。

### 19.1 モジュール構成

```
src-tauri/src/
  biz/
    sales_service.rs  -- 日次・月次売上集計
```

### 19.2 型定義

**DailySalesReport構造体**:

```
struct DailySalesReport {
    date: String,                          // 対象日（YYYY-MM-DD）
    items: Vec<DailySaleItem>,             // 商品別売上一覧
    department_subtotals: Vec<DeptSubtotal>, // 部門小計
    grand_total: GrandTotal,               // 総合計
    official_daily_report: Option<OfficialDailyReportSummary>, // Z001/Z002/Z005日報集計。未取込みならNone
}
```

**DailySaleItem構造体**:

```
struct DailySaleItem {
    product_code: String,
    name: String,
    department_name: String,
    department_id: i64,
    quantity: i64,       // 売上帳票視点（+販売/-返品）
    amount: i64,         // 金額（円）
    source: String,      // "auto" / "manual"
}
```

**DeptSubtotal構造体**:

```
struct DeptSubtotal {
    department_id: i64,
    department_name: String,
    quantity: i64,
    amount: i64,
}
```

**GrandTotal構造体**:

```
struct GrandTotal {
    quantity: i64,
    amount: i64,
}
```

**OfficialDailyReportSummary構造体（REQ-401 redesign target）**:

```
struct OfficialDailyReportSummary {
    daily_report_import_id: i64,
    report_date: String,
    gross_amount: Option<i64>,
    net_amount: Option<i64>,
    payment_lines: Vec<OfficialDailyPaymentLine>,
    department_lines: Vec<OfficialDailyDepartmentLine>,
    warnings: Vec<String>,
}
```

**OfficialDailyPaymentLine構造体**:

```
struct OfficialDailyPaymentLine {
    payment_key: String,
    label: String,
    amount: Option<i64>,
    count: Option<i64>,
}
```

**OfficialDailyDepartmentLine構造体**:

```
struct OfficialDailyDepartmentLine {
    department_id: Option<i64>,
    raw_department_name: String,
    normalized_department_name: Option<String>,
    amount: i64,
    quantity: Option<i64>,
    count: Option<i64>,
}
```

**MonthlySalesReport構造体**:

```
struct MonthlySalesReport {
    month: String,                                  // 対象月（YYYY-MM）
    mode: SalesMode,                                // 集計モード
    items: Vec<MonthlySaleItem>,                    // 集計結果
    prev_month_comparison: Option<Vec<MonthlySaleItem>>, // 前月比較（取得できた場合）
    official_department_totals: Option<Vec<OfficialMonthlyDepartmentTotal>>, // Z005日報集計由来。日報未取込みならNone
}
```

**MonthlySaleItem構造体**:

```
struct MonthlySaleItem {
    key: String,            // 商品別: product_code / 部門別: department_id の文字列
    label: String,          // 商品別: 商品名 / 部門別: 部門名
    quantity: i64,
    amount: i64,
    ranking: u32,           // amount降順のランキング（1始まり）
}
```

**OfficialMonthlyDepartmentTotal構造体（REQ-401 redesign target）**:

```
struct OfficialMonthlyDepartmentTotal {
    department_id: Option<i64>,
    label: String,
    amount: i64,
    quantity: Option<i64>,
    count: Option<i64>,
}
```

**SalesMode列挙型**:

```
enum SalesMode {
    ByProduct,      // 商品別
    ByDepartment,   // 部門別
}
```

---

### 19.3 get_daily_sales

**関数要求**: 指定日の売上データを商品別に集計し、部門小計と総合計を含むレポートを返す。is_voided=0 のレコードのみ対象

**シグネチャ**:
```
fn get_daily_sales(conn: &DbConnection, date: &str) -> Result<DailySalesReport, BizError>
```

**前提条件**: conn は &DbConnection（autocommit）。読み取り専用クエリのためTX不要

**処理ステップ**:

1. **日付バリデーション**
   - date が YYYY-MM-DD 形式でない → BizError::ValidationFailed("日付の形式が不正です（YYYY-MM-DD）")
   - chrono で暦妥当性チェック（2月30日等）→ BizError::ValidationFailed("存在しない日付です")

2. **商品別売上取得**
   - sales_repo::get_daily_sales_records(conn, date) → Vec<DailySaleItem>
   - SQL: SELECT sr.product_code, p.name, d.name as department_name, d.id as department_id, sr.quantity, sr.amount, sr.source FROM sale_records sr INNER JOIN products p ON sr.product_code = p.product_code INNER JOIN departments d ON p.department_id = d.id WHERE sr.sale_date = ? AND sr.is_voided = 0 ORDER BY d.id ASC, p.product_code ASC
   - 0件でも正常（データなしの日）

3. **公式日報集計取得（REQ-401 redesign target）**
   - sales_repo::get_latest_completed_daily_report(conn, date) → Option<OfficialDailyReportSummary>
   - `daily_report_imports.status='completed'` の最新1件を対象に、payment_lines / department_lines を取得する
   - 日報未取込みでも正常。`official_daily_report=None` とし、UIは「日報未取込み」と表示できる
   - SALES2-D5: `department_lines` に `department_id IS NULL` 行が n 件ある場合、`warnings` に「部門マスタと対応していない部門が n 件あります（部門名のまま表示しています）」を1件だけ追加する。NULL 行がなければ空配列。preview 時の詳細 warning は永続列を持たないため復元しない

4. **部門小計の計算**
   - items を department_id でグルーピング
   - 各グループの quantity, amount を合計 → Vec<DeptSubtotal>
   - 部門IDの昇順でソート

5. **総合計の計算**
   - 全 items の quantity, amount を合計 → GrandTotal

6. **結果返却**
   - DailySalesReport { date, items, department_subtotals, grand_total, official_daily_report }

**設計判断 — 日報集計と商品別明細を分ける**:
- `official_daily_report` はレジ日報の公式集計を表す。
- `items` / `department_subtotals` / `grand_total` はZ004または手動販売出庫に基づく商品別売上を表す。
- Z001/Z002/Z005は商品別明細を持たないため、`items` を水増ししない。
- UIは、日報集計と商品別明細の差を「日報集計」「商品別（PLU/Z004・手動販売）」のように日本語で分けて表示する。

**エラーハンドリング**:
- 日付形式不正 → BizError::ValidationFailed(メッセージ)
- 暦妥当性エラー → BizError::ValidationFailed(メッセージ)
- DB読み取り失敗 → BizError::DatabaseError(DbError)

**入力例**:
```
date: "2026-03-21"
```

**出力例**:
```
Ok(DailySalesReport {
    date: "2026-03-21",
    items: [
        DailySaleItem { product_code: "4976383262108", name: "ﾊﾏﾅｶ ｱﾐｱﾐ極太", department_name: "毛糸", quantity: 3, amount: 1782, source: "auto" },
        DailySaleItem { product_code: "HZ-0099", name: "ヘアゴムA", department_name: "ヘア雑貨", quantity: 1, amount: 880, source: "manual" },
    ],
    department_subtotals: [
        DeptSubtotal { department_id: 2, department_name: "ヘア雑貨", quantity: 1, amount: 880 },
        DeptSubtotal { department_id: 3, department_name: "毛糸", quantity: 3, amount: 1782 },
    ],
    grand_total: GrandTotal { quantity: 4, amount: 2662 },
})
```

---

### 19.4 get_monthly_sales

**関数要求**: 指定月の売上データを商品別または部門別に集計し、ランキングと前月比較を含むレポートを返す。is_voided=0 のレコードのみ対象

**シグネチャ**:
```
fn get_monthly_sales(
    conn: &DbConnection,
    month: &str,
    mode: SalesMode,
) -> Result<MonthlySalesReport, BizError>
```

**前提条件**: conn は &DbConnection（autocommit）。読み取り専用クエリのためTX不要

**処理ステップ**:

1. **月バリデーション**
   - month が YYYY-MM 形式でない → BizError::ValidationFailed("月の形式が不正です（YYYY-MM）")
   - 月の範囲チェック（01-12）→ BizError::ValidationFailed("存在しない月です")

2. **対象月の日付範囲を導出**
   - date_from = "{month}-01"
   - date_to = 月末日を計算（例: 2026-03 → "2026-03-31"）

3. **モード別集計（商品別売上明細）**
   - ByProduct:
     - sales_repo::get_monthly_sales_by_product(conn, date_from, date_to) → Vec<(product_code, name, quantity, amount)>
     - key = product_code, label = name
   - ByDepartment:
     - sales_repo::get_monthly_sales_by_department(conn, date_from, date_to) → Vec<(department_id, department_name, quantity, amount)>
     - key = department_id.to_string(), label = department_name

4. **ランキング付与（商品別売上明細）**
   - amount の降順でソート
   - 1始まりの ranking を付与
   - 同額の場合は同順位（dense rank ではなく row number）

5. **前月比較（商品別売上明細）**
   - 前月を計算: YYYY-MM → 1ヶ月前（2026-01 → 2025-12 の年境界に注意）
   - 前月の同集計をステップ3-4と同じ方法で取得
   - 取得できた場合は Some(prev_items)、前月データなしは Some(空Vec)

6. **公式日報部門集計（REQ-401 redesign target）**
   - sales_repo::get_monthly_official_department_totals(conn, date_from, date_to) → Option<Vec<OfficialMonthlyDepartmentTotal>>
   - `daily_report_department_lines` を `daily_report_imports.status='completed'` かつ `report_date BETWEEN date_from AND date_to` で集計する
   - mode に関係なく `official_department_totals` として返す
   - 日報取込みが1件もない月は `None`。一部日だけ日報がある月は取得済み日だけの合計とし、UIで「日報取込み済み日数」を表示する設計を後続UI PRで具体化する

7. **結果返却**
   - MonthlySalesReport { month, mode, items, prev_month_comparison, official_department_totals }

**エラーハンドリング**:
- 月形式不正 → BizError::ValidationFailed(メッセージ)
- DB読み取り失敗 → BizError::DatabaseError(DbError)

**設計判断 — ranking を items に埋め込む（architecture/cmd-task-specs.md との差異）**:
- architecture/cmd-task-specs.md CMD-09 は `MonthlySalesReport(items[], rankings[], prev_month_comparison)` と ranking を独立配列で記載
- 本設計では `MonthlySaleItem.ranking` として items に埋め込む。理由: ranking は items の amount 降順と1:1対応しており、別配列にすると items とのインデックス同期が必要になる。埋め込みの方がUI側の実装が単純

**設計判断 — 全件返却（ページングなし）**:
- 先決事項D-5 に基づき、初期実装では全件返却
- 4000商品の月次集計でもJSON応答は数MB（許容範囲）
- パフォーマンス問題が発生した場合は LIMIT/OFFSET を追加

**設計判断 — 前月比較の年境界処理**:
- 2026年1月 → 前月は2025年12月
- chrono の NaiveDate 演算で month - 1 を計算（年のロールオーバーを自動処理）
- テストで12月→1月の境界を明示的にカバーすること

---

### 19.5 export_sales_csv

**関数要求**: 指定日または指定月の売上データをCSVバイト列としてエクスポートする。日次・月次（商品別/部門別）の3種類のレポート形式をサポート

**型定義**:

```
enum SalesReportType {
    Daily,              // 日次（target: YYYY-MM-DD）
    MonthlyByProduct,   // 月次・商品別（target: YYYY-MM）
    MonthlyByDepartment,// 月次・部門別（target: YYYY-MM）
}

struct SalesCsvExportResult {
    csv_bytes: Vec<u8>,          // UTF-8 BOM付きCSVバイト列
    count: usize,                // レコード件数
    suggested_filename: String,  // 推奨ファイル名
}
```

**シグネチャ**:
```
fn export_sales_csv(
    conn: &DbConnection,
    report_type: &SalesReportType,
    target: &str,
) -> Result<SalesCsvExportResult, BizError>
```

**前提条件**: conn は &DbConnection（autocommit）。読み取り専用クエリのためTX不要

**処理ステップ**:

1. **report_type で分岐してデータ取得 + CSV構築**
   - Daily:
     - get_daily_sales(conn, target) を呼ぶ
     - ヘッダ: `["商品コード", "商品名", "部門", "数量", "金額", "記録元"]`
     - rows: items → [product_code, name, department_name, quantity, amount, translate_source(source)]
     - suggested_filename: `sales_daily_{target}.csv`
   - MonthlyByProduct:
     - get_monthly_sales(conn, target, SalesMode::ByProduct) を呼ぶ
     - ヘッダ: `["ランク", "商品コード", "商品名", "数量", "金額"]`
     - rows: items → [ranking, key, label, quantity, amount]
     - suggested_filename: `sales_monthly_product_{target}.csv`
   - MonthlyByDepartment:
     - get_monthly_sales(conn, target, SalesMode::ByDepartment) を呼ぶ
     - ヘッダ: `["ランク", "部門名", "数量", "金額"]`
     - rows: items → [ranking, label, quantity, amount]
     - suggested_filename: `sales_monthly_dept_{target}.csv`

2. **CSV生成**
   - report_csv_exporter::export_csv(&headers, &rows) → Vec<u8>（UTF-8 BOM付き、CRLF改行）

3. **結果返却**
   - SalesCsvExportResult { csv_bytes, count: items.len(), suggested_filename }

**エラーハンドリング**:
- 日付/月形式不正 → BizError::ValidationFailed（get_daily_sales/get_monthly_sales 内でバリデーション済み）
- DB読み取り失敗 → BizError::DatabaseError(DbError)

**設計判断 — source の日本語変換**:
- CSV出力では "auto" → "POS"、"manual" → "手動" に変換。利用者向け帳票のため英語識別子のままでは不親切
- 内部ヘルパー translate_source で変換。未知の値は防御的にそのまま通す

**設計判断 — 既存関数の再利用**:
- get_daily_sales / get_monthly_sales を内部で呼び出す。日付バリデーション・DBクエリ・集計ロジックの重複を避ける
- CSV列構造のみが新規ロジック。IO-05 export_csv は純関数で既実装

---

### 19.6 非目的

このモジュールが**やらないこと**を明示する。責務境界の誤解を防ぐため。

| やらないこと | 理由 | 責務を持つモジュール |
|------------|------|-----------------|
| sale_records への書き込み | 読み取り専用モジュール | BIZ-03（CSV取込み）, BIZ-02（手動販売） |
| is_voided レコードの操作 | ロールバック処理 | BIZ-03 rollback_csv_import |
| 在庫変動の集計 | 在庫変動履歴は別ドメイン | BIZ-02 / CMD-06 list_movements |
| ページング処理 | 初期実装では全件返却（先決事項D-5） | 将来追加時はこのモジュール内 |

### 19.7 対応不変条件

| 不変条件 | 本モジュールでの対応 |
|---------|-----------------|
| INV-1: quantity符号規約 | sale_records.quantity を売上帳票視点でそのまま返す（+販売/-返品）。符号変換しない |
| INV-4: is_voided の使用範囲 | WHERE is_voided = 0 で voided レコードを除外。voided を操作する処理は持たない |
