# テーブル定義（POS連携）

> **親文書**: [DB_DESIGN.md](../DB_DESIGN.md)

---

## 12. csv_imports（CSV取込み履歴）

### 役割
Z004ファイルの取込み履歴。重複取込み防止、ロールバック管理の基盤。

### カラム定義

| カラム名 | 型 | 制約 | 説明 |
|---------|---|----|------|
| id | INTEGER | PK AUTOINCREMENT | 取込みID |
| filename | TEXT | NOT NULL | ファイル名（例: Z004_260321） |
| settlement_date | TEXT | NOT NULL | 精算日（YYYY-MM-DD） |
| file_hash | TEXT | NOT NULL, INDEX | ファイルのSHA-256ハッシュ。重複チェックはアプリ側で status IN ('completed','completed_partial') と組み合わせて判定 |
| total_items | INTEGER | NOT NULL | 取込み件数（正常に紐付けできた商品数） |
| total_amount | INTEGER | NOT NULL | 売上合計金額（正常取込み分のみ） |
| skipped_count | INTEGER | NOT NULL, DEFAULT 0 | スキップされた行数（マスタ未登録＋行エラー） |
| status | TEXT | NOT NULL, CHECK(status IN ('completed','completed_partial','rolled_back')) | 状態 |
| imported_at | TEXT | NOT NULL | 取込み日時（YYYY-MM-DDTHH:MM:SS） |

### statusの値

| 値 | 意味 | 発生条件 |
|---|------|---------|
| completed | 全行正常取込み | error_rows=0 |
| completed_partial | 一部スキップあり | error_rows>0 |
| rolled_back | 取込み取消済み | 利用者が巻き戻し操作 |

**Parse失敗時の扱い（2026-03-29 確定）**: Parse段階（Stage 1）で失敗した場合、csv_importsにレコードを作成しない。Parse失敗はファイル形式の問題であり、取込み処理自体が開始されていないため。失敗の記録はoperation_logs（operation_type='csv_import_parse_failed'）に残す。同じファイルの再取込みはfile_hashで制御しないため、ファイルを修正して再試行可能。

### 設計意図
- **file_hashの理由（SP-401-12）**: 同じファイルを誤って2回取り込むと在庫が二重に減る。ハッシュ値で同一ファイルを検知してブロック
- **statusの3値設計（B-4対応、2026-03-29確定）**: Parse失敗時はcsv_importsにレコードを作成しない方針のためfailedは不要。completed_partialは「部分成功」を正式に認める仕組み
- **skipped_countの理由**: CSV取込み完了画面で「3件の商品がスキップされました」と表示するため。詳細はcsv_import_errorsテーブルに記録
- **total_items / total_amountの理由**: CSV取込み画面の完了サマリに表示する値。正常取込み分のみをカウント

### 困りそうなケースと対応方針（2026-03-28 確定）

**ケース1: 同じファイルを2回取り込もうとした**
- file_hashが一致 ＋ statusが'completed'または'completed_partial' → ブロック（「取込み済みです」）
- file_hashが一致 ＋ statusが'rolled_back' → 許可（ロールバック後の再取込み）
- 重複チェックSQL: `WHERE file_hash = ? AND status IN ('completed','completed_partial')`

**ケース2: 同じ精算日の別ファイル（精算前後に2回CSV出力した等）**
- settlement_dateが同じ ＋ 別のfile_hash ＋ 既存がcompleted/completed_partial → 警告（「この日のデータは取込み済みです。上書きしますか？」）
- 上書き選択時: 旧レコードをロールバック（status='rolled_back'、関連sale_records/inventory_movementsをis_voided=1）→ 新規取込み
- キャンセル選択時: 何もしない

**ケース3: ファイル名が同じだが中身が違う（同じ日に2回精算した等）**
- file_hashが異なるためケース2として処理される

**ケース4: completed_partialの取込みを完全にしたい（スキップ商品を後から登録した）**
- 現在のcsv_importをロールバック→同じファイルで再取込み。今度はmatchedになる
- csv_import_errorsの情報から「何を登録すればいいか」が追える

**file_hashのUNIQUE制約の修正**: 当初UNIQUE制約を付けていたが、ロールバック後の再取込みで同じハッシュのレコードが2件できる可能性がある（rolled_back + completed）。UNIQUE制約を外し、アプリ側でチェックに変更する

---

## 12a. csv_import_errors（CSV取込みエラー・スキップ行）

### 役割
CSV取込み時にスキップされた行（マスタ未登録、フォーマットエラー等）を保存する。利用者が「何を直せばいいか」を追跡するためのテーブル。

### カラム定義

| カラム名 | 型 | 制約 | 説明 |
|---------|---|----|------|
| id | INTEGER | PK AUTOINCREMENT | ID |
| csv_import_id | INTEGER | FK → csv_imports.id, NOT NULL | 親の取込みレコード |
| source_line_no | INTEGER | NOT NULL | Z004のレコード番号 |
| normalized_jan | TEXT | NULLABLE | 正規化後のJANコード（正規化前にエラーならNULL） |
| raw_name | TEXT | NOT NULL | Z004上の商品名（そのまま保存） |
| raw_quantity | TEXT | NOT NULL | Z004上の個数（数値変換前の生値） |
| raw_amount | TEXT | NOT NULL | Z004上の金額（数値変換前の生値） |
| error_type | TEXT | NOT NULL, CHECK(error_type IN ('unmatched_product','invalid_format','invalid_jan','invalid_number')) | エラー種別 |
| error_message | TEXT | NOT NULL | エラー詳細（例: 「JAN 4973167064078 に該当する商品がありません」） |
| created_at | TEXT | NOT NULL | 作成日時（YYYY-MM-DDTHH:MM:SS） |

### error_typeの値

| 値 | 意味 | 発生段階 |
|---|------|---------|
| unmatched_product | マスタ未登録商品 | Validate |
| invalid_format | フィールド数不正等 | Parse |
| invalid_jan | JAN正規化不能 | Parse |
| invalid_number | 個数・金額が数値でない | Parse |

### 設計意図
- **raw_quantity / raw_amountをTEXTで持つ理由**: 数値変換に失敗した行も保存するため。INTEGERだと変換失敗時に保存できない
- **normalized_janがNULLABLEな理由**: JAN正規化自体が失敗した場合（invalid_jan）は正規化後の値がない
- **error_messageの理由**: 利用者向けの日本語メッセージをそのまま保存。画面表示時に再生成しなくて済む

---

## 12b. daily_report_imports（日報取込み履歴）

### 役割
Z001/Z002/Z005 の1営業日分ファイル束を1つの日報取込みとして管理する。日報取込みは売上集計の正本だが、商品別明細ではないため `sale_records` とは分ける。

### カラム定義

| カラム名 | 型 | 制約 | 説明 |
|---------|---|----|------|
| id | INTEGER | PK AUTOINCREMENT | 日報取込みID |
| report_date | TEXT | NOT NULL | 対象営業日（YYYY-MM-DD） |
| source_adapter | TEXT | NOT NULL, CHECK(source_adapter IN ('casio_sr_s4000')) | 取込み元adapter。外部レジ差し替え時の境界 |
| bundle_hash | TEXT | NOT NULL, INDEX | Z001/Z002/Z005の生バイトhashを安定順で束ねたSHA-256。重複取込み判定に使う |
| source_files_json | TEXT | NOT NULL | ファイル名、個別hash、サイズ、adapter内source名（Z001/Z002/Z005）のJSON。実CSV本文は保存しない |
| gross_amount | INTEGER | NULLABLE | Z001/Z005から導出できる総売上額。未確定・欠損時はNULL |
| net_amount | INTEGER | NULLABLE | 返品・値引等を反映した日報上の純売上額。未確定・欠損時はNULL |
| status | TEXT | NOT NULL, CHECK(status IN ('completed','rolled_back')) | 状態 |
| imported_at | TEXT | NOT NULL | 取込み日時（YYYY-MM-DDTHH:MM:SS） |
| rolled_back_at | TEXT | NULLABLE | 取消日時（YYYY-MM-DDTHH:MM:SS） |
| note | TEXT | NULLABLE | operator向け補足、adapter警告要約 |

### 設計意図
- **bundle_hashの理由**: Z001/Z002/Z005は3ファイルで1日報を構成するため、個別ファイルではなく束単位で同一取込みを検知する。
- **source_files_jsonの理由**: 外部adapterの証跡（ファイル名、個別hash、サイズ、source名）を残すが、実店舗のCSV本文や金額明細をそのまま保存しない。検索・集計に使う値は下位行テーブルへ正規化する。
- **statusの2値設計**: Parse/Validate失敗時は取込みレコードを作らない。成功後の取消は物理削除せず `rolled_back` にする。

### 重複・上書き方針
- `bundle_hash` が一致し `status='completed'` の取込みがある場合はブロックする。
- `report_date` が一致し別 `bundle_hash` の `completed` がある場合は上書き確認を要求する。上書き時は旧 `daily_report_imports` を `rolled_back` にしてから新規取込みを作る。
- `rolled_back` の同一bundleは再取込み可能。

---

## 12c. daily_report_summary_lines（日計サマリ行）

### 役割
Z001由来の日計サマリを、アプリ内部の表示・照合に使える行データとして保存する。外部ファイルの列名をそのまま業務ルールにしないため、adapterが `line_key` / `label` / 数値項目へ正規化する。

### カラム定義

| カラム名 | 型 | 制約 | 説明 |
|---------|---|----|------|
| id | INTEGER | PK AUTOINCREMENT | 行ID |
| daily_report_import_id | INTEGER | FK → daily_report_imports.id, NOT NULL | 親の日報取込み |
| source_file | TEXT | NOT NULL, CHECK(source_file IN ('Z001')) | adapter内source名 |
| line_key | TEXT | NOT NULL | adapterが正規化した行キー（例: gross_sales, net_sales, tax_10） |
| label | TEXT | NOT NULL | operator表示用ラベル |
| amount | INTEGER | NULLABLE | 金額。該当しない行はNULL |
| quantity | INTEGER | NULLABLE | 数量。該当しない行はNULL |
| count | INTEGER | NULLABLE | 件数。該当しない行はNULL |
| sort_order | INTEGER | NOT NULL | 表示順 |

### 設計意図
- Z001の4列データや事前行はCASIO adapterの事実であり、app coreは日報サマリ行として扱う。
- `amount` / `quantity` / `count` をNULL許容にすることで、レジ側の行意味が金額・数量・件数のどれかに偏っても同じ行モデルで保持できる。

---

## 12d. daily_report_payment_lines（取引キー・支払集計行）

### 役割
Z002由来の取引キー・支払・現金等の集計行を保存する。日報の支払内訳やレジ締め確認に使うが、商品別売上や在庫変動には使わない。

### カラム定義

| カラム名 | 型 | 制約 | 説明 |
|---------|---|----|------|
| id | INTEGER | PK AUTOINCREMENT | 行ID |
| daily_report_import_id | INTEGER | FK → daily_report_imports.id, NOT NULL | 親の日報取込み |
| source_file | TEXT | NOT NULL, CHECK(source_file IN ('Z002')) | adapter内source名 |
| payment_key | TEXT | NOT NULL | adapterが正規化した支払・取引キー |
| label | TEXT | NOT NULL | operator表示用ラベル |
| amount | INTEGER | NULLABLE | 金額 |
| count | INTEGER | NULLABLE | 件数 |
| sort_order | INTEGER | NOT NULL | 表示順 |

### 設計意図
- Z002はNEL / raw 0x85 を含む可能性があるため、改行・文字コード処理はIO parserで閉じる。
- 支払・取引キーはreporting/accounting意味を持つが、在庫引落しの根拠にはならない。

---

## 12e. daily_report_department_lines（部門別売上集計行）

### 役割
Z005由来の部門別売上を保存する。日次・月次レポートの部門合計や、REQ-403の将来照合候補として使う。

### カラム定義

| カラム名 | 型 | 制約 | 説明 |
|---------|---|----|------|
| id | INTEGER | PK AUTOINCREMENT | 行ID |
| daily_report_import_id | INTEGER | FK → daily_report_imports.id, NOT NULL | 親の日報取込み |
| source_file | TEXT | NOT NULL, CHECK(source_file IN ('Z005')) | adapter内source名 |
| department_id | INTEGER | FK → departments.id, NULLABLE | app部門マスタに対応できた場合のID |
| raw_department_name | TEXT | NOT NULL | Z005上の部門名または部門表示 |
| normalized_department_name | TEXT | NULLABLE | adapterが正規化した部門名 |
| amount | INTEGER | NOT NULL | 部門別売上金額 |
| quantity | INTEGER | NULLABLE | 部門別数量。取得できない場合はNULL |
| count | INTEGER | NULLABLE | 部門別件数。取得できない場合はNULL |
| sort_order | INTEGER | NOT NULL | 表示順 |

### 設計意図
- `department_id` はNULL許容にする。レジ側部門名とアプリ部門マスタが一致しない日でも日報は取り込めるようにし、未対応は警告として表示する。
- 部門別日報は公式日報集計の根拠だが、商品別数量・在庫減算を復元できない。`sale_records` への展開は禁止する。

---

## B-2: Z001/Z002/Z005日報取込み仕様（2026-06-30 設計）

### 処理パイプライン: Parse bundle → Validate bundle → Preview → Commit

**入力単位**:
- 1営業日の日報取込みは `Z001`、`Z002`、`Z005` の3ファイルを必須束として扱う。
- adapterはファイル名・内容からsourceを判定し、欠損、重複、未知sourceをPreview前にエラーにする。
- CV17 1.1.1のZ001/Z002/Z005は、ツール内部ディレクトリ常在ファイルの layout A（7行プリアンブル、1行ヘッダ、4列データ行）と、エクスポート機能出力の layout B（先頭メタフィールド、ヘッダ、4列反復の連結）を両方サポートする。adapterはどちらも `record_code, label, quantity_or_count, amount` 系の4列行へ正規化してから内部行へ変換する。
- 日付はsource/layoutにより `YYYY/M/D` または `YYYY-MM-DD` で出力されるため、IO-07で `YYYY-MM-DD` に正規化してからBIZ-08へ渡す。
- Excel帳票はsource of truthではない。PCツール / SDカードから得たZ001/Z002/Z005が日報取込み元であり、Excelは印刷用containerとして扱う。sanitized版のExcelは数値突合に使わず、列構成・ラベル・行の並びの参照に限定する。
- PCツール上には `Z006`（グループ）、`Z009`（時間帯別）、`Z011`（担当者）も存在するが、個人店の初期日報に必要な業務用途が未確認のため、初期DBモデルには保存しない。必要性が確認された場合は adapter 入力とDB保存先を別設計で追加する。

**Stage 1: Parse bundle（IO-07に委譲）**
1. 各ファイルを生バイトで受け取り、CP932 strict decodeする。
2. 改行はCP932デコード後に `\u0085` / CRLF / LF / CR を正規化する。
3. adapter内source（Z001/Z002/Z005）ごとにプリアンブル、ヘッダ、4列データ行を解釈し、`DailyReportParseResult` を返す。
4. parse失敗時は `daily_report_imports` を作らず、operation_logsに `daily_report_parse_failed` を記録する。

**Stage 2: Validate bundle**
1. 3ファイルの対象日が一致することを確認する。
2. Z005の部門名を `departments.name` に照合する。未一致はエラーではなく警告にし、`department_id=NULL` でpreview可能にする。
3. 必須集計行（総売上または純売上など、adapterが定義する最低限のサマリ）が欠ける場合はcommit不可エラーにする。
4. `bundle_hash` と `report_date` で重複・上書き判定を作る。

**Stage 3: Preview**
- 表示内容: 対象日、読み込む3ファイル、総売上/純売上、支払集計、部門別集計、部門未対応警告、重複/上書き判定。
- 利用者は「取り込む」「ファイルを選び直す」「上書き確認」を選べる。
- previewは30分有効のtokenでCMD層cacheに保持する。Z004のpreview cacheと同じAppStateを使ってよいが、型は分ける。

**Stage 4: Commit**
BEGIN TRANSACTION内で:
1. 上書き確認済みなら同一 `report_date` の既存 `completed` 日報取込みを `rolled_back` に更新する。
2. `daily_report_imports` に1行INSERTする。
3. Z001由来行を `daily_report_summary_lines` にINSERTする。
4. Z002由来行を `daily_report_payment_lines` にINSERTする。
5. Z005由来行を `daily_report_department_lines` にINSERTする。
6. COMMIT。

COMMIT後に:
7. operation_logsに `daily_report_import` を記録する。
   - operation_logs記録失敗は日報取込み自体をROLLBACKせず、診断ログまたは後続確認対象として扱う。

**Rollback**
1. `daily_report_imports.id` で対象を取得する。
2. BEGIN TRANSACTION内で `status='rolled_back'` と `rolled_back_at` を更新する。
3. COMMIT。
4. operation_logsに `daily_report_rollback` を記録する。
   - operation_logs記録失敗はrollback済み状態を戻さず、診断ログまたは後続確認対象として扱う。
5. `sale_records` / `inventory_movements` / `products.stock_quantity` は変更しない。

### Z004との関係
- Z004はPLU登録後の商品別売上・在庫自動引落し候補として既存B-1仕様を維持する。
- Z001/Z002/Z005日報取込みの完了は、Z004取込み完了を意味しない。
- 商品別ランキング、商品別在庫自動引落し、返品のSKU単位反映はZ004または手動販売出庫が根拠になる。

---

## B-1: Z004パース仕様（2026-03-29 確定）

### 処理パイプライン: Parse → Validate → Preview → Commit

### Stage 1: Parse（バイトレベル → 構造化データ）

**ファイル読込**:
- 生バイトで読み込む
- CP932でstrictデコード（デコード失敗は即エラー → 取込み中断、operation_logsに記録）
- file_hashはデコード前の生バイトからSHA-256で計算

**改行処理**:
- CP932デコード後に改行を正規化する
- 区切り候補: `\u0085`（NEL）/ `\r\n` / `\n` / `\r`
- 理由: 生バイト0x85で切るとCP932のマルチバイト途中の誤判定リスクがある

**行構造**:
- 1行目: メタ情報（日付抽出元）
- 2行目: カラムヘッダ（読み飛ばし）
- 3行目以降: データ行
- 2行未満なら形式エラー → 取込み中断

**ヘッダ日付抽出**:
- 1行目からYYYY-MM-DDパターンを抽出 → settlement_dateに保存
- 抽出できなければ形式エラー → 取込み中断

**データ行パース**:
- ダブルクォート囲み、カンマ区切りの5フィールド固定
- フィールド: record_no / scanning_code_raw / name_raw / quantity_raw / amount_raw
- フィールド数不足/過剰 → 行単位エラー（error_type='invalid_format'）、他の行は処理継続

**JAN正規化**:
- scanning_code_rawが14桁かつ末尾がアルファベット（E等）→ 末尾を除去して13桁化
- `00000000000000` → 未登録スロット扱い（除外、エラーにもカウントしない）
- 正規化後が13桁でも全桁0埋め等の異常値 → 行エラー（error_type='invalid_jan'）

**数値変換**:
- quantity_raw / amount_raw を整数にパース
- パース失敗 → 行エラー（error_type='invalid_number'）

### Stage 2: Validate（構造化データ → 処理対象の選別）

**空レコード除外**（エラーにもカウントしない）:
- normalized_jan = `0000000000000`（13桁ゼロ）→ 除外
- quantity = 0 かつ amount = 0 → 除外（PLU登録あるが当日販売なし）

**実データ判定**:
- normalized_janが有効（非ゼロ）かつ（quantity ≠ 0 or amount ≠ 0）

**マスタ照合**:
- products.jan_codeで検索（product_codeへのfallbackはしない）
- ヒット1件 → matched（紐付け成功）
- ヒット0件 → unmatched（error_type='unmatched_product' → csv_import_errorsに記録）
- ヒット複数件 → `ORDER BY product_code ASC`で先頭に紐付け（グループコード商品は色を区別しない方針のため。常に同じ商品に紐付く決定的ルール）

**返品の扱い**:
- quantity < 0 または amount < 0 → 返品として許可（ここで弾かない）

**pos_stock_sync判定**:
- 紐付いた商品のpos_stock_sync=0 → 売上記録は作るが在庫減算しないフラグを立てる

**Validateの結果分類**:
```
validate_result
├── matched_rows[]        → 正常に紐付けできた行
├── error_rows[]          → マスタ未登録 + 行パースエラー
└── excluded_rows_count   → 空レコード + 販売なし（カウント不要）
```

### Stage 3: Preview（利用者に確認を求める）

**画面表示内容**:
- ファイル名、精算日
- 重複チェック結果（ブロック/上書き確認/問題なし）
- 「○○件の売上を取り込みます（合計 ¥○○○）」
- error_rowsがある場合: 「以下の○件はスキップされます」（JAN・商品名・個数・金額・理由を一覧表示）

**利用者のアクション**:
- 「取り込む」→ Stage 4に進む（error_rowsはスキップ）
- 「キャンセル」→ 何もしない
- error_rowsを見て「商品登録忘れてた」→ キャンセル→商品登録→再取込み

### Stage 4: Commit（トランザクション内で一括書込み）

BEGIN TRANSACTION内で:
1. csv_importsにレコード作成（statusは仮値。ステップ4で確定）
2. matched_rowsの各行について:
   - sale_recordsにINSERT（source='auto', source_line_no=レコード番号）
   - pos_stock_sync=1の商品 → products.stock_quantity更新 + inventory_movementsにINSERT
   - pos_stock_sync=0の商品 → sale_recordsのみ（在庫は動かさない）
3. error_rowsがある場合 → csv_import_errorsテーブルにINSERT
4. csv_imports.status / total_items / total_amount / skipped_countを確定:
   - error_rows=0 → status='completed'
   - error_rows>0 → status='completed_partial'
5. COMMIT
6. operation_logsに取込みログを記録

---

## 13. sale_records（売上レコード）

### 役割
商品別の売上記録。CSV取込み（自動）と手動販売出庫の両方がここに入る。売上レポート（REQ-501/502）のデータソース。

### カラム定義

| カラム名 | 型 | 制約 | 説明 |
|---------|---|----|------|
| id | INTEGER | PK AUTOINCREMENT | 売上ID |
| csv_import_id | INTEGER | FK → csv_imports.id, NULLABLE | CSV取込み元。NULLなら手動 |
| product_code | TEXT | FK → products.product_code, NOT NULL | 商品コード |
| sale_date | TEXT | NOT NULL | 販売日（YYYY-MM-DD） |
| quantity | INTEGER | NOT NULL | 数量。マイナスなら返品（売上帳票視点） |
| amount | INTEGER | NOT NULL | 金額。マイナスなら返品（売上帳票視点） |
| source | TEXT | NOT NULL, CHECK(source IN ('auto','manual')) | 記録元 |
| source_line_no | INTEGER | NULLABLE | Z004のレコード番号。将来の原票追跡用 |
| reason | TEXT | NULLABLE | 手動の場合の理由 |
| note | TEXT | NULLABLE | 備考 |
| is_voided | BOOLEAN | NOT NULL, DEFAULT 0 | 論理無効化フラグ。ロールバック時に1 |
| created_at | TEXT | NOT NULL | 作成日時（YYYY-MM-DDTHH:MM:SS） |

### 設計意図
- **自動と手動を同じテーブルに統合した理由**: 売上レポート（日次・月次）では自動売上と手動売上をまとめて表示する。別テーブルだと毎回UNIONが必要になり、集計クエリが複雑になる。sourceカラムで区別すれば1テーブルで完結
- **quantityがマイナスの理由（Z004実機検証結果）**: Z004のレジ戻し処理はマイナス値で出力される。そのまま取り込む。「5個売れて1個返品」の日は、quantity=5の行とquantity=-1の行の2行ができるか、ネットでquantity=4の1行になるかはZ004の出力形式次第。実機検証結果ではPLU別のネット値（販売-戻し）で出力されるため、1行にまとまる
- **csv_import_idの理由**: ロールバック時にどの売上レコードを無効化するか特定するため

### 業務シナリオ例
```
CSV取込み: 2026/03/21の精算データ
  sale_records:
    id=1, csv_import_id=1, product_code="4976383262108", sale_date="2026-03-21",
    quantity=3, amount=1782, source="auto"
    （3個×594円。返品なし）

  sale_records:
    id=2, csv_import_id=1, product_code="4973167902615", sale_date="2026-03-21",
    quantity=-1, amount=-385, source="auto"
    （返品1個。Z004でマイナスが出た場合。ネット値なら売上と相殺された値で1行）

手動販売出庫:
  sale_records:
    id=3, csv_import_id=NULL, product_code="HZ-0099", sale_date="2026-03-21",
    quantity=1, amount=880, source="manual", reason="plu_unregistered"
    （PLU登録前の新商品ヘアゴムが1個売れた）
```
