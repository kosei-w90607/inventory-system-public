# タスク仕様（IO層）

> **親文書**: [ARCHITECTURE.md](../ARCHITECTURE.md)
> **入力ドキュメント**: `docs/spec/requirements.md`、`docs/spec/requirements-coverage.md`、DB_DESIGN.md（テーブル定義書）

---

### IO-01: SQLiteデータアクセス層

**タスク要求**: 全18テーブルへのCRUD操作、DB接続管理、初期設定を提供する

**理由**: DB操作をIO層に集約することで、BIZ層がSQLを直接書かなくて済む。DB固有の設定（PRAGMA、WALモード等）もここで一元管理

**【データ構造】**

- 各テーブルに対応するRust構造体（Product, Department, Supplier, ReceivingRecord, ...）
- クエリ結果をRust構造体にマッピング

**【処理構造】**

**DB接続初期化:**
1. SQLiteファイルを開く（なければ作成）
2. PRAGMA foreign_keys = ON
3. PRAGMA journal_mode = WAL
4. PRAGMA busy_timeout = 5000
5. MNT-03（マイグレーション）を呼び出してスキーマを最新化

**リポジトリパターン（実装時の分割単位）:**
- product_repository: products, departments, suppliers, price_history のCRUD
- inventory_repository: inventory_movements, receiving_records/items, return_records/items, manual_sales/items, disposal_records/items のCRUD
- sales_repository: sale_records, csv_imports, csv_import_errors のCRUD
- stocktake_repository: stocktakes, stocktake_items のCRUD
- system_repository: operation_logs, app_settings のCRUD

**【制御構造】**
- コネクションプールは不要（1人運用デスクトップアプリ、単一接続で十分）
- トランザクション管理はBIZ層が開始/コミット/ロールバックを指示し、IO層が実行

---

### IO-02: Z004パーサー

**タスク要求**: Z004ファイルのバイト列を受け取り、構造化データに変換する。純粋なフォーマット変換のみ、業務ロジックなし

**理由**: カシオSR-S4000固有のCSV形式（CP932/NEL改行/14桁JAN末尾E）を汎用的なデータ構造に変換する。レジ移行時にはこのモジュールだけ差し替える

**【データ構造】**

入力: 生バイト列

出力: ParseResult
- settlement_date: String（YYYY-MM-DD）
- parsed_rows: Vec<ParsedRow>（line_no, normalized_jan, name, quantity: i32, amount: i32）
- parse_errors: Vec<ParseError>（line_no, error_type, error_message）

**【処理構造】**

※ 詳細はdb-design/pos-tables.mdの「B-1: Z004パース仕様 Stage 1: Parse」に記載。ここでは処理の流れのみ。

1. CP932 strictデコード（失敗 → ParseError返却、parsed_rows空）
2. 改行正規化（\u0085 / \r\n / \n / \r）
3. 1行目からYYYY-MM-DD抽出 → settlement_date（失敗 → エラー）
4. 2行目スキップ（ヘッダ）
5. 3行目以降を5フィールドCSVパース
   - フィールド数不正 → parse_errorsに追加、次の行へ
   - JAN正規化（末尾アルファベット除去→13桁化）。全桁ゼロは除外（エラーにもしない）
   - quantity/amountを整数パース。失敗 → parse_errorsに追加
6. ParseResultを返す

**【制御構造】**
- ステートレス。入力バイト列を受け取り、結果を返すだけ
- 行単位エラーは他の行をブロックしない

---

### IO-03: 商品マスタCSVインポーター

**タスク要求**: 利用者が作成したCSVファイルを読み込み、構造化データに変換する

**理由**: 初期データ投入（4000商品）やマスタ更新で、Excelで作ったCSVを取り込む。エンコーディングの違いを吸収する

**【データ構造】**

入力: 生バイト列

出力: ImportParseResult
- headers: Vec<String>
- rows: Vec<HashMap<String, String>>（ヘッダ名→値のマップ）
- parse_errors: Vec<ParseError>

**【処理構造】**

1. エンコーディング判定
   - 先頭3バイトがBOM（0xEF 0xBB 0xBF）→ UTF-8としてデコード（BOMは除去）
   - それ以外 → CP932としてstrictデコード
   - デコード失敗 → エラー
2. 改行で分割（\r\n / \n / \r）
3. 1行目をヘッダとしてパース（カンマ区切り）
4. 2行目以降をデータ行としてパース
   - フィールド数がヘッダと一致しない → parse_errorsに追加
5. ImportParseResultを返す

**【制御構造】**
- ステートレス
- ヘッダ検証（必須列の確認）はBIZ-01側の責務

---

### IO-04: PLUフォーマッター

**タスク要求**: 商品データをカシオレジスターツール（CV17）が読み込めるTSV形式に変換する

**理由**: レジにPLU商品を登録するには、カシオレジスターツール経由でTSVインポート→SDカード書出し→レジ読込みの手順が必要

> **E-4 仕様確定（2026-04-08）**: カシオ公式サポートサイトのマニュアル（CV17_MAN_V2P01.pdf）から仕様を確認。実機確認不要でフォーマットが判明した。残タスクは実機での動作確認のみ。

**【データ構造】**

入力: Vec<PluExportRow>（product_code, jan_code, name, selling_price, tax_rate, department_name）

出力: TSVファイルバイト列（CP932 / Shift-JIS エンコーディング）

**【処理構造】**

※ 以下はカシオレジスターツール（CV17）Ver.2.0.1 マニュアル セクション5.4.3「スキャニングPLU」に基づく確定仕様。

**ファイル形式**: タブ区切りテキスト（TSV）、CP932（Shift-JIS）エンコーディング
**1行目**: ヘッダ行（各列のタイトル名）
**2行目以降**: データ行

**スキャニングPLU列構成**:

| ヘッダ名 | 内容 | 元データ | 備考 |
|---------|------|---------|------|
| メモリーNo. | 内部連番（整数） | 連番自動生成 | 必須・先頭列 |
| スキャニングコード | JAN/EAN（最大13桁） | jan_code | 数値文字列 |
| 名称 | 商品名 | name（変換後） | 半角16文字/全角8文字。CP932。`_`はダブルサイズ制御文字のため使用不可 |
| 単価 | 売価（最大6桁、0-999999） | selling_price | 整数 |
| 課税方式 | 税区分テキスト | tax_rate（変換後） | 下記マッピング参照 |
| 単品売り | 「はい」固定 | - | デフォルト値 |
| 負単価 | 「いいえ」固定 | - | デフォルト値 |
| ゼロ単価 | 「いいえ」固定 | - | デフォルト値 |
| 品番PLU | 「いいえ」固定 | - | デフォルト値 |
| 入力桁制限 | 空 | - | 省略可 |
| 部門リンク | 部門名テキスト | department_name | departments.nameと一致させる |

**課税方式マッピング**:

| products.tax_rate | → 課税方式ヘッダ値 | 意味 |
|-------------------|-------------------|------|
| '10' | `税1(内税)` | 標準税率10%・内税 |
| '8' | `税2(内税)` | 軽減税率8%・内税 |
| '0' | `非課税` | 非課税 |

**処理手順**:
1. PluExportRowリストからTSVデータを構築
2. 1行目にヘッダ行を出力（タブ区切り）
3. 各行について:
   a. メモリーNo.を連番で付与（1始まり）
   b. スキャニングコード = jan_code（NULLの場合はproduct_codeを使用）
   c. 名称 = nameを半角カナ変換→CP932で16バイト以内に切り詰め
   d. 単価 = selling_price
   e. 課税方式 = tax_rateから上記マッピングで変換
   f. 固定列（単品売り=はい、負単価=いいえ、ゼロ単価=いいえ、品番PLU=いいえ）
   g. 部門リンク = department_name
4. 全体をCP932でエンコード
5. TSVファイルバイト列を返す

**【制御構造】**
- ステートレス
- インポート時、ツール側はヘッダ名で列を識別する（列順は任意だが、メモリーNo.は先頭必須）
- インポート対象外の列は省略可能（含める列のみ更新される）

**【レジへの反映ワークフロー】**（参考：運用手順書の範囲）
1. レジからSDカードに現在設定をエクスポート
2. SDカードをPCに挿し、カシオレジスターツールで読込み
3. ツール上でTSVファイルをインポート（本システムが生成するファイル）
4. ツールからSDカードに書出し
5. SDカードをレジに挿し、レジで読込み

---

### IO-05: レポートCSVエクスポーター

**タスク要求**: 売上集計データをCSVファイルに変換する

**理由**: 売上レポートをExcelで開いたり、会計ソフトに取り込んだりする利用者のニーズに対応

**【データ構造】**

入力: Vec<Vec<String>>（行列データ）+ Vec<String>（ヘッダ）

出力: CSVファイルバイト列（UTF-8 BOM付き）

**【処理構造】**

1. ヘッダ行を書き込み
2. データ行を書き込み（カンマ区切り、ダブルクォート囲み）
3. UTF-8 BOM（0xEF 0xBB 0xBF）を先頭に付与
4. バイト列を返す

**【制御構造】**
- ステートレス

---

### IO-06: 画像ファイル管理

**タスク要求**: レシート画像の保存とパス管理を行う

**理由**: 返品・交換記録にレシート画像を添付する機能（REQ-202）の基盤

**【データ構造】**

入力: 画像バイト列 + ファイル名

出力: 保存先の相対パス（例: images/receipts/2026-03-21_001.jpg）

**【処理構造】**

1. 保存ディレクトリの確認（なければ作成）
2. ファイル名の生成: {日付}_{連番}.{拡張子}
3. アプリデータフォルダ/images/receipts/ に保存
4. 相対パスを返す（DBにはこの相対パスを記録）

**【制御構造】**
- ファイル名の連番は同日内でインクリメント

---

### IO-07: POS日報bundleパーサー

**タスク要求**: CASIO SR-S4000 adapter の Z001/Z002/Z005 ファイル束を受け取り、アプリ内部の日報サマリ・支払集計・部門別集計データに変換する。純粋なフォーマット変換のみ、業務ロジックなし

**理由**: current operation の日報主入力は Z004 ではなく Z001/Z002/Z005 である。レジ依存の文字コード、改行、メタ行、ファイル名、列構造を IO adapter に閉じ、BIZ/UI/DB は stable app-internal daily report model を扱えるようにする

**【データ構造】**

入力:
- Vec\<DailyReportSourceFile\>（filename, bytes）

出力:
- DailyReportParseResult
  - report_date: String（YYYY-MM-DD）
  - source_files[]: source_file（Z001/Z002/Z005）, filename, file_hash, size_bytes
  - summary_lines[]: line_key, label, amount?, quantity?, count?, sort_order
  - payment_lines[]: payment_key, label, amount?, count?, sort_order
  - department_lines[]: raw_department_name, normalized_department_name?, amount, quantity?, count?, sort_order
  - parse_errors[]: source_file?, line_no?, error_type, error_message

**【処理構造】**

1. ファイル名または内容から adapter 内 source（Z001/Z002/Z005）を判定する
2. 3 source が1つずつ揃っていることを確認する。欠損・重複・未知sourceは parse_errors にする
3. 各ファイルを CP932 strict decode する
4. CP932 decode 後に改行を `\u0085` / CRLF / LF / CR で正規化する
5. sourceごとの行構造を parse する
   - Z001 → summary_lines
   - Z002 → payment_lines
   - Z005 → department_lines
6. 3 source で report_date が一致することを parse result に含める。一致しない場合は parse_errors にする
7. 生バイトから個別hashとbundle_hash素材を作る。bundle_hashの確定はBIZ-08で安定順に束ねて行う

**【制御構造】**
- ステートレス。DBを呼ばない
- CASIO 固有の表記、列位置、メタ行、改行、文字コードはこの層で吸収する
- app core が使う値は line_key / label / amount / quantity / count / department label に正規化して返す
