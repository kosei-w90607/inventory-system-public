> **親文書**: [FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md)
> **入力ドキュメント**: [ARCHITECTURE.md](../ARCHITECTURE.md), [architecture/io-task-specs.md §IO-07](../architecture/io-task-specs.md), [db-design/pos-tables.md §B-2](../db-design/pos-tables.md), [plu-export-and-real-csv-verification.md](../plu-export-and-real-csv-verification.md)

## 29. IO-07: POS日報bundleパーサー

### 29.1 目的

`daily_report_parser` は、CASIO SR-S4000 adapter の Z001/Z002/Z005 ファイル束を app-internal daily report parse result に変換する純関数モジュールである。

この層はレジ依存の文字コード、改行、ファイルsource判定、メタ行、列位置を吸収する。DB参照、部門マスタ照合、重複判定、取込み可否判断は行わない。

### 29.2 型定義

```rust
struct DailyReportSourceFile {
    filename: String,
    bytes: Vec<u8>,
}

enum DailyReportSourceKind {
    Z001,
    Z002,
    Z005,
}

struct ParsedDailyReportSourceFile {
    source: DailyReportSourceKind,
    filename: String,
    file_hash: String,
    size_bytes: usize,
}

struct DailyReportSummaryLine {
    source_file: DailyReportSourceKind, // Z001
    line_key: String,
    label: String,
    amount: Option<i64>,
    quantity: Option<i64>,
    count: Option<i64>,
    sort_order: i64,
}

struct DailyReportPaymentLine {
    source_file: DailyReportSourceKind, // Z002
    payment_key: String,
    label: String,
    amount: Option<i64>,
    count: Option<i64>,
    sort_order: i64,
}

struct DailyReportDepartmentLine {
    source_file: DailyReportSourceKind, // Z005
    raw_department_name: String,
    normalized_department_name: Option<String>,
    amount: i64,
    quantity: Option<i64>,
    count: Option<i64>,
    sort_order: i64,
}

struct DailyReportParseError {
    source_file: Option<DailyReportSourceKind>,
    filename: Option<String>,
    line_no: Option<i64>,
    error_type: String,
    error_message: String,
}

struct DailyReportParseResult {
    report_date: Option<String>,
    source_files: Vec<ParsedDailyReportSourceFile>,
    summary_lines: Vec<DailyReportSummaryLine>,
    payment_lines: Vec<DailyReportPaymentLine>,
    department_lines: Vec<DailyReportDepartmentLine>,
    parse_errors: Vec<DailyReportParseError>,
}
```

### 29.3 parse_daily_report_bundle

**関数要求**: Z001/Z002/Z005 のファイル束を受け取り、正規化済みの日報行データとparse errorを返す。

**シグネチャ**:

```rust
fn parse_daily_report_bundle(files: Vec<DailyReportSourceFile>) -> DailyReportParseResult
```

**処理ステップ**:

1. 入力ファイル数とsource判定
   - filenameまたは先頭行の内容から `Z001` / `Z002` / `Z005` を判定する。
   - 欠損、重複、未知sourceは `parse_errors` に追加する。
2. 各ファイルのハッシュとサイズを記録する。
3. CP932 strict decodeを行う。
   - decode失敗は該当sourceのparse errorにする。
4. 改行正規化を行う。
   - CP932 decode後に `\u0085` / `\r\n` / `\n` / `\r` を統一する。
5. source別パース
   - Z001: 日計サマリ行を `summary_lines` に変換する。
   - Z002: 取引キー・支払集計行を `payment_lines` に変換する。
   - Z005: 部門別集計行を `department_lines` に変換する。
6. report_date抽出
   - 3ファイルから抽出できる日付が一致すれば `report_date=Some(YYYY-MM-DD)`。
   - 不一致または抽出不可ならparse errorにし、`report_date=None` または最初の抽出値を返す場合でもBIZ-08でcommit不可にする。
7. `DailyReportParseResult` を返す。

### 29.4 source別正規化方針

| Source | 入力の性質 | app-internal target | 備考 |
|---|---|---|---|
| Z001 | 日計サマリ系。CP932 CSV、layout A/B ともヘッダ後は4列データ | `DailyReportSummaryLine` | `line_key` はadapterが安定名を付ける |
| Z002 | 取引キー集計系。CP932 CSV、layout A/B ともヘッダ後は4列データ | `DailyReportPaymentLine` | 支払/取引キーの表示ラベルと件数/金額を分ける |
| Z005 | 部門別集計系。CP932 CSV、layout A/B ともヘッダ後は4列データ | `DailyReportDepartmentLine` | 部門マスタ照合はBIZ-08で行う |

#### 29.4.1 匿名化済み実CSV shape（2026-07-04）

CV17 1.1.1 では、SD取込み後にツール内部ディレクトリへ常在するファイル（layout A）と、レジスターツールのエクスポート機能出力（layout B）が確認されている。運用主経路は現地手順でなお確認中のため、IO-07 は両 layout を正式サポートし、layout 検出後に同じ4列行へ正規化する。gitに入れるfixtureは匿名化shapeを満たすsyntheticデータのみとし、実CSV本文・実店舗値は保存しない。

**layout A: プリアンブル型**

| Source | 匿名化shape | Parserでの扱い |
|---|---|---|
| 共通 | CRLF複数行。7行プリアンブル（マシン/ファイル/モード/精算回数/日付/時刻/空行）→ 1行ヘッダ → 4列データ行 | ヘッダ行を検出し、それ以前はメタとして読み飛ばす。ヘッダ後の非空行が4列でない場合は `invalid_format` |
| Z001 | 4列は `record_code, label, quantity_or_count, amount`。ヘッダの第3列は「個数/件数」、第4列は「金額」。日付は `YYYY/M/D` または `YYYY-MM-DD` を受けて `YYYY-MM-DD` へ正規化する | `record_code=101` または総売ラベルを `gross_sales`、`record_code=201` または純売ラベルを `net_sales` にする。総売は第3列を `quantity`、純売は第3列を `count`、第4列を `amount` として保存する |
| Z002 | 4列は `record_code, label, count, amount`。ヘッダの第3列は「個数/件数」、第4列は「金額」。日付は `YYYY/M/D` または `YYYY-MM-DD` を受けて `YYYY-MM-DD` へ正規化する | 第3列を `count`、第4列を `amount` として `payment_lines` に変換する。`record_code=01` または現金ラベルは `cash`、`record_code=03` またはクレジットラベルは `credit` |
| Z005 | 4列は `record_code, department_label, quantity, amount`。全フィールドがクォートされる場合がある。日付は `YYYY-MM-DD` または `YYYY/M/D` を受けて `YYYY-MM-DD` へ正規化する | 第2列を `raw_department_name`、第3列を `quantity`、第4列を必須 `amount` として `department_lines` に変換する。`count` は `None` |

**layout B: 連結型**

| Source | 匿名化shape | Parserでの扱い |
|---|---|---|
| 共通 | 通常の行改行を持たず、先頭メタフィールドの後に `レコード, キャラクター, 個数/件数または個数, 金額` ヘッダと4列データ行が連結される | quoted field の連続からヘッダ4フィールドを検出し、ヘッダ後を4フィールド単位にchunk化する。4列反復で割り切れない場合は `invalid_format` |
| Z001 | layout A 系のCRLF複数行で出る場合がある | layout A と同じ正規化を使う |
| Z002 | メタフィールド + `record_code, label, count, amount` の4列反復 | layout A と同じ `payment_lines` へ正規化する |
| Z005 | メタフィールド + `record_code, department_label, quantity, amount` の4列反復 | layout A と同じ `department_lines` へ正規化する |

数値列の意味は、CSV自身のヘッダ行（プリアンブル直後または連結フィールド中の4列テキスト行）と `SRS4000_JA3.pdf` / `ECRCV17.pdf` のレポート仕様を正とする。「レジ明細 - 見せる用.xlsx」は sanitized 版のため数値突合には使わず、列構成・ラベル・行の並びの参照に限定する。

どちらの layout にも該当しない構造、またはヘッダ後の4列反復が崩れた構造は `invalid_format` として安全に落とす。

### 29.5 エラーハンドリング

| error_type | 発生条件 | BIZ-08での扱い |
|---|---|---|
| missing_source | Z001/Z002/Z005のいずれかがない | commit不可 |
| duplicate_source | 同じsourceが複数ある | commit不可 |
| unknown_source | source判定できないファイルがある | commit不可 |
| decode_failed | CP932 strict decodeに失敗 | commit不可 |
| invalid_format | source別の最低限行構造に合わない | commit不可 |
| invalid_date | 日付抽出不可または不一致 | commit不可 |
| invalid_number | 金額/数量/件数の数値変換不可 | commit不可 |

### 29.6 非目的

- DBを読むこと。
- departmentsとの照合。
- bundle_hashによる重複判定。
- daily_report_importsへの保存。
- sale_recordsやinventory_movementsへの変換。
- Excel帳票を読み込むこと。
- `Z006`（グループ）、`Z009`（時間帯別）、`Z011`（担当者）のparse。個人店の初期日報用途が確認されるまでは対象外とし、必要になった時にadapter拡張として扱う。
