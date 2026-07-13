## 13. IO-02: Z004パーサー

> **2026-06-30 field-check note**: 本書は既存実装の Z004 parser contract を記録する。現場確認では、現在の店舗日報主入力は `Z001`/`Z002`/`Z005` であり、`Z004` は PLU(商品) / 商品別トラックとして再評価する対象になった。REQ-401 の current SALES import を変更する場合は、本書を拡張するのではなく SALES redesign で `Z001`/`Z002`/`Z005` parser contract を別途定義する。

### 13.1 モジュール構成

```
src-tauri/src/
  io/
    mod.rs            -- pub mod z004_parser
    z004_parser.rs    -- Z004ファイルパーサー（純関数、DB非依存）
```

IO層の新ディレクトリ。DB操作を伴わない純粋なファイルフォーマット変換を配置する。
`db/` とは異なり `DbConnection` を一切受け取らない。

---

### 13.2 型定義

#### ParseResult構造体

Z004ファイルのパース成功時の結果。行単位エラーがあっても返る（致命的エラーでなければ）。

- settlement_date: String（YYYY-MM-DD。1行目から抽出した精算日）
- parsed_rows: Vec\<ParsedRow\>（正常にパースできたデータ行）
- parse_errors: Vec\<ParseError\>（行単位のパースエラー）
- total_data_lines: usize（改行正規化後、3行目以降の非空行でフィールド分割を試みた行の総数。Ok(Some)=正常行、Ok(None)=空スロット、Err=エラー行すべてカウント。空文字列のみの行は除外）
- file_hash: String（SHA-256、生バイト列から算出、hex小文字64文字。INV-6準拠）

#### ParsedRow構造体

正常にパースできた1データ行。

- line_no: usize（ファイル内の行番号。1始まり）
- normalized_jan: String（正規化後の13桁JANコード）
- name: String（Z004上の商品名。半角カナ等そのまま）
- quantity: i32（数量。マイナスあり＝返品）
- amount: i32（金額。マイナスあり＝返品）

#### ParseError構造体

行単位のパースエラー。他の行の処理は継続する。

- line_no: usize（エラーが発生した行番号。1始まり）
- error_type: ParseErrorType
- error_message: String（日本語、利用者向けメッセージ）
- raw_name: Option\<String\>（パース途中で取得できた商品名。フィールド分割前のエラーではNone）
- raw_quantity: Option\<String\>（パース途中で取得できた数量生値）
- raw_amount: Option\<String\>（パース途中で取得できた金額生値）

#### ParseErrorType列挙型

```
enum ParseErrorType {
    InvalidFormat,   // フィールド数不正等の構造エラー
    InvalidJan,      // JANコード正規化失敗
    InvalidNumber,   // 数量・金額の数値変換失敗
}
```

#### Z004ParseError列挙型（致命的エラー）

ファイル全体の処理を中断する致命的エラー。Result::Errとして返す。

```
enum Z004ParseError {
    DecodeFailed(String),       // CP932デコード失敗
    NoDataLines(String),        // 2行未満（ヘッダ行すらない）
    NoSettlementDate(String),   // 1行目から日付パターン抽出不能
}
```

**設計意図**: 行単位エラー（ParseError）と致命的エラー（Z004ParseError）を分離する。行単位エラーは「他の行は処理できた」を意味し、致命的エラーは「ファイル自体が不正」を意味する。BIZ-03はこの区別を使って、operation_logsへの記録パターンを分岐する。

---

### 13.3 parse_z004（公開関数）

**関数要求**: Z004ファイルの生バイト列を受け取り、構造化データに変換する。純粋関数。DB非依存。副作用なし

**シグネチャ**:
```
fn parse_z004(raw_bytes: &[u8]) -> Result<ParseResult, Z004ParseError>
```

**処理ステップ**:
1. file_hash算出: SHA-256(raw_bytes) → hex小文字64文字
2. CP932 strictデコード
   - 失敗 → Err(Z004ParseError::DecodeFailed("CP932デコードに失敗しました。ファイル形式を確認してください"))
3. 改行正規化: `\u{0085}`（NEL）/ `\r\n` / `\n` / `\r` → `\n` に統一
   - 順序: `\r\n` → `\n` を先に処理し、その後 `\r` → `\n`（順序を逆にすると `\r\n` が `\n\n` になる）
   - `\u{0085}` → `\n` は独立して処理可能
4. `\n` で行分割。空行は除去しない（行番号を保持するため）
5. 2行未満 → Err(Z004ParseError::NoDataLines("データ行がありません。ファイル形式を確認してください"))
6. 1行目: YYYY-MM-DD パターンを正規表現で抽出 → settlement_date
   - パターン: `\d{4}-\d{2}-\d{2}`
   - マッチなし → Err(Z004ParseError::NoSettlementDate("1行目から精算日（YYYY-MM-DD）を抽出できません"))
7. 2行目: スキップ（カラムヘッダ行）
8. 3行目以降: 各行について
   - 空行（trimして空文字列）→ スキップ（エラーにもカウントしない）
   - parse_data_line(line, line_no) を呼び出し
     - Ok(Some(row)) → parsed_rowsに追加
     - Ok(None) → 全桁ゼロの空スロット。スキップ（エラーにもカウントしない）
     - Err(error) → parse_errorsに追加
9. ParseResult { settlement_date, parsed_rows, parse_errors, total_data_lines, file_hash } を返す

**入力例**:
```
raw_bytes: CP932エンコードされたZ004ファイル
  1行目: "精算日報 2026-03-21 ..."
  2行目: "No,コード,名称,個数,金額"
  3行目: "1","4976383262108","ﾊﾏﾅｶ ｱﾐｱﾐ極太",3,1782
  4行目: "2","00000000000000","",0,0
  ...
```

**出力例**:
```
Ok(ParseResult {
    settlement_date: "2026-03-21",
    parsed_rows: [
        ParsedRow { line_no: 3, normalized_jan: "4976383262108", name: "ﾊﾏﾅｶ ｱﾐｱﾐ極太", quantity: 3, amount: 1782 },
        ...
    ],
    parse_errors: [],
    total_data_lines: 150,
    file_hash: "a1b2c3d4e5f6..."
})
```

**エラーハンドリング**:
- CP932デコード失敗 → Z004ParseError::DecodeFailed（即リターン）
- 2行未満 → Z004ParseError::NoDataLines（即リターン）
- 日付抽出不能 → Z004ParseError::NoSettlementDate（即リターン）
- 行単位エラーはparse_errorsに蓄積し、他の行の処理は継続

---

### 13.4 parse_data_line（内部関数）

**関数要求**: Z004の1データ行をパースし、ParsedRowに変換する。空スロット行はOk(None)で返す

**シグネチャ**:
```
fn parse_data_line(line: &str, line_no: usize) -> Result<Option<ParsedRow>, ParseError>
```

**処理ステップ**:
1. ダブルクォート囲みCSV分割 → 5フィールド取得
   - フィールド: record_no, scanning_code_raw, name_raw, quantity_raw, amount_raw
   - フィールド数 ≠ 5 → Err(ParseError { line_no, error_type: InvalidFormat, error_message: "行{line_no}: フィールド数が不正です（期待: 5, 実際: {n}）" })
2. scanning_code_raw → normalize_jan(scanning_code_raw, line_no) 呼び出し
   - Ok(None) → Ok(None) を返す（全桁ゼロ＝空スロット。エラーにもカウントしない）
   - Err(msg) → Err(ParseError { line_no, error_type: InvalidJan, error_message: msg })
   - Ok(Some(normalized_jan)) → 次ステップへ
3. quantity_raw.trim() → i32パース
   - 失敗 → Err(ParseError { line_no, error_type: InvalidNumber, error_message: "行{line_no}: 数量が数値ではありません: '{raw}'" })
4. amount_raw.trim() → i32パース
   - 失敗 → Err(ParseError { line_no, error_type: InvalidNumber, error_message: "行{line_no}: 金額が数値ではありません: '{raw}'" })
5. Ok(Some(ParsedRow { line_no, normalized_jan, name: name_raw.to_string(), quantity, amount }))

**CSVフィールド分割の仕様**:
- ダブルクォート囲み: フィールド値がダブルクォートで囲まれている場合は除去する
- ダブルクォート内のカンマ: フィールド区切りとして扱わない
- ダブルクォートのエスケープ: `""` → `"`
- 囲みなしフィールドも許容（Z004の実データで混在する可能性を考慮）

---

### 13.5 normalize_jan（内部関数）

**関数要求**: Z004のスキャニングコードをJANコード13桁に正規化する。全桁ゼロの空スロットはOk(None)で返す

**シグネチャ**:
```
fn normalize_jan(raw: &str, line_no: usize) -> Result<Option<String>, String>
```

**処理ステップ**:
1. 前後空白をtrim
2. 全桁ゼロ判定: 全文字が '0' → Ok(None)
   - 13桁ゼロ `0000000000000` も14桁ゼロ `00000000000000` もOk(None)
3. 14桁かつ末尾がASCIIアルファベット（a-z, A-Z）→ 末尾1文字を除去して13桁化
4. 結果が13桁かつ全文字が数字 → Ok(Some(normalized))
5. それ以外 → Err("行{line_no}: JANコード '{raw}' を正規化できません")

**正規化ルール**:
- 先頭ゼロは保持する（JANコードの正当な構成要素）
- チェックデジット検証はしない（レジ出力をそのまま信頼。DB_DESIGN.md準拠）
- 13桁未満は不正（Err）
- 14桁超は不正（Err）
- 14桁で末尾が数字の場合は不正（Err）。末尾アルファベット除去は末尾E等のレジ固有サフィックスへの対応

**入力→出力例**:

| 入力 | 出力 | 説明 |
|------|------|------|
| `"4976383262108"` | Ok(Some("4976383262108")) | 13桁そのまま |
| `"4976383262108E"` | Ok(Some("4976383262108")) | 14桁末尾E除去 |
| `"00000000000000"` | Ok(None) | 14桁全ゼロ＝空スロット |
| `"0000000000000"` | Ok(None) | 13桁全ゼロ＝空スロット |
| `"497638326210"` | Err(...) | 12桁＝桁数不足 |
| `"49763832621089"` | Err(...) | 14桁末尾数字＝不正 |
| `"ABCDEFGHIJKLM"` | Err(...) | 数字以外＝不正 |

---

### 13.6 入力境界仕様

| 項目 | 仕様 | 根拠 |
|------|------|------|
| エンコーディング | CP932 strict（デコード失敗は致命的エラー） | カシオSR-S4000のZ004出力形式 |
| 区切り文字 | カンマ、ダブルクォート囲み、5フィールド固定 | Z004実機検証結果 |
| 改行 | \u{0085} (NEL) / \r\n / \n / \r を正規化 | CP932デコード後に正規化。生バイトでの分割は誤判定リスクあり |
| 空行 | スキップ（エラーにもカウントしない） | ファイル末尾等の余白行 |
| 制御文字 | 改行正規化後は特別な処理なし | |
| 金額・数量 | i32整数のみ。浮動小数は不正（InvalidNumber） | レジ精算値は常に整数 |
| 入力上限 | 10,000行 / 20MB | IO-02では検査しない。BIZ-03でガードチェック |
| 返品値 | quantity < 0, amount < 0 を許容 | Z004のレジ戻しはマイナス値で出力される |

---

### 13.7 エラーハンドリングまとめ

| エラー | 型 | 影響範囲 | 後続処理 |
|--------|---|---------|---------|
| CP932デコード失敗 | Z004ParseError::DecodeFailed | ファイル全体 | 即リターン（Result::Err） |
| 2行未満 | Z004ParseError::NoDataLines | ファイル全体 | 即リターン（Result::Err） |
| 日付抽出不能 | Z004ParseError::NoSettlementDate | ファイル全体 | 即リターン（Result::Err） |
| フィールド数不正 | ParseError (InvalidFormat) | 1行のみ | parse_errorsに追加、他の行は処理継続 |
| JAN正規化失敗 | ParseError (InvalidJan) | 1行のみ | parse_errorsに追加、他の行は処理継続 |
| 数値変換失敗 | ParseError (InvalidNumber) | 1行のみ | parse_errorsに追加、他の行は処理継続 |

**致命的エラー（Z004ParseError）と行単位エラー（ParseError）の使い分け**:
- Z004ParseError: ファイル自体が処理不能。parsed_rowsを構築する前に判明するエラー。BIZ-03はoperation_logsに `csv_import_parse_failed` として記録
- ParseError: 特定の行が不正だが、他の行は正常にパースできた。BIZ-03はcsv_import_errorsテーブルに記録

---

### 13.8 非目的

このモジュールが**やらないこと**を明示する。責務境界の誤解を防ぐため。

| やらないこと | 理由 | 責務を持つモジュール |
|------------|------|-----------------|
| DB操作 | 純関数モジュール。DbConnectionを受け取らない | IO-01（db/） |
| マスタ照合（JAN→product_code紐付け） | 業務ロジック | BIZ-03 Stage 2 Validate |
| 重複チェック（file_hash照合） | 業務ロジック | BIZ-03 Stage 3 Preview |
| 符号変換（売上帳票視点→在庫視点） | INV-1の在庫視点変換 | BIZ-03 Stage 4 Commit |
| 空レコード除外（quantity=0 and amount=0） | 業務ルール判定 | BIZ-03 Stage 2 Validate |
| 入力サイズ上限チェック（10,000行/20MB） | 上流のガードチェック | BIZ-03（parse_z004呼び出し前） |

---

### 13.9 対応不変条件

| 不変条件 | 本モジュールでの対応 |
|---------|-----------------|
| INV-6: file_hashの算出 | parse_z004のステップ1でSHA-256(raw_bytes)を算出。hex小文字64文字。デコード前の生バイト列から計算（改行コード差異も区別される） |
| INV-1: quantity符号規約 | 本モジュールは関知しない。Z004の生値（マイナスあり）をそのまま返す。在庫視点への変換はBIZ-03の責務 |

---

### 13.10 依存ライブラリ

| クレート | 用途 | 備考 |
|---------|------|------|
| sha2 | file_hashの算出（SHA-256） | Cargo.toml に追加済み |
| encoding_rs | CP932（Shift_JIS）デコード | 新規追加が必要。`SHIFT_JIS` デコーダを使用 |
| regex | 1行目からのYYYY-MM-DD抽出 | 新規追加が必要 |

**encoding_rsの選定理由**: Rustの標準ライブラリにはCP932デコードがない。encoding_rsはWHATWG Encoding Standardの実装であり、`SHIFT_JIS` ラベルでCP932互換のデコードが可能。strictモード（`decode_without_bom_handling` + エラーチェック）で使用する。
