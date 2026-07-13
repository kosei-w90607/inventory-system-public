## 18. IO-03: 商品マスタCSVインポーター

### 18.1 モジュール構成

```
src-tauri/src/
  io/
    product_csv_importer.rs  -- 商品マスタCSVパース（純関数、DB非依存）
```

### 18.2 型定義

**ImportParseResult構造体**:

```
struct ImportParseResult {
    headers: Vec<String>,                    // ヘッダ行のカラム名一覧
    rows: Vec<ParsedRow>,                    // データ行（元CSV行番号付き）
    parse_errors: Vec<ImportParseError>,      // パースエラー一覧
}

struct ParsedRow {
    line_no: usize,                          // 元CSVの行番号（1始まり、ヘッダ行=1）
    fields: HashMap<String, String>,         // フィールド値（ヘッダ名→値のマップ）
}
```

**設計判断 — ParsedRow 構造体の導入（PR #22、元は `Vec<HashMap<String, String>>`）**:
- **変更理由**: BIZ-01 `preview_import` が `idx + 2` で行番号を計算していたが、IO-03 がパースエラー行を除外した後の配列インデックスでは元CSVの行番号と一致しないケースがある。エラー表示時にユーザーが正しい行を特定できない
- **検討した代替案**: (1) 近似値としてコメント明記のみ → カバーする仕組みがない (2) parse_errors件数からオフセット計算 → 複雑で不正確
- **採用理由**: `ImportParseError` が既に `line_no` を持っており、成功行にも持たせることで一貫性が向上。呼出元は `preview_import` の1箇所のみで影響が限定的。テスト修正は `row.get()` → `row.fields.get()` の機械的置換のみ

**ImportParseError構造体**:

```
struct ImportParseError {
    line_no: usize,        // 行番号（1始まり、ヘッダ行=1）
    error_type: String,    // "field_count_mismatch"（デコード失敗は関数全体のErr返却で処理し、行エラーにはならない）
    error_message: String, // 利用者向け日本語メッセージ
}
```

**設計**: IO-02（Z004パーサー）の ParseError と構造は類似するが、error_type の値域が異なるため別型とする。

### 18.3 parse_product_csv

**関数要求**: 利用者が作成したCSVファイル（バイト列）を読み込み、エンコーディングを自動判定してパースし、構造化データに変換する。純粋なフォーマット変換のみ、業務ロジック（ヘッダ検証・重複チェック等）は BIZ-01 側の責務

**シグネチャ**:
```
fn parse_product_csv(bytes: &[u8]) -> Result<ImportParseResult, String>
```

**前提条件**: ステートレス。DB接続不要。副作用なし

**処理ステップ**:

1. **空ファイルチェック**
   - bytes.len() == 0 → Err("ファイルが空です")

2. **エンコーディング判定とデコード**
   - 先頭3バイトが BOM（0xEF, 0xBB, 0xBF）→ UTF-8としてデコード（BOM除去）
   - それ以外 → CP932 として strict デコード（encoding_rs::SHIFT_JIS）
   - デコード失敗 → Err("ファイルの文字コードが判別できません。Excelで保存し直してください")

3. **改行で分割**
   - 改行候補: `\r\n` / `\n` / `\r`（`\r\n` を先に処理して二重分割を防ぐ）
   - 末尾の空行は除去

4. **ヘッダ行パース**（1行目）
   - 行数が0 → Err("ファイルにデータがありません")
   - 1行目をカンマ区切りで分割 → headers: Vec<String>
   - 各ヘッダ値の前後空白をトリム
   - ヘッダが空（カンマのみ等）→ Err("ヘッダ行が不正です")

5. **データ行パース**（2行目以降）
   - 各行をカンマ区切りで分割
   - フィールド数がヘッダと一致しない → parse_errors に追加（error_type="field_count_mismatch", error_message="行{line_no}: フィールド数が不一致です（期待{expected}、実際{actual}）"）、この行はスキップ
   - フィールド数一致 → HashMap<String, String> を構築（ヘッダ名→値、値の前後空白トリム）
   - 空行（全フィールドが空文字）→ スキップ（エラーにもカウントしない）

6. **結果返却**
   - ImportParseResult { headers, rows, parse_errors } を返す
   - rows が 0件でもエラーではない（全行がエラーまたは空の場合。BIZ-01側で判断）

**エラーハンドリング**:
- 空ファイル → Err("ファイルが空です")
- デコード失敗 → Err("ファイルの文字コードが判別できません。Excelで保存し直してください")
- ヘッダなし → Err("ファイルにデータがありません")
- ヘッダ不正 → Err("ヘッダ行が不正です")
- 行単位エラー → parse_errors に蓄積（処理は継続）

**設計判断 — Err vs parse_errors の使い分け**:
- Err: ファイル全体が処理不能（デコード失敗、ヘッダなし）。呼び出し元に即座にエラーを返す
- parse_errors: 行単位の問題。他の行は正常にパースできるため、結果と一緒に返す
- IO-02（Z004パーサー）と同じ方針

**設計判断 — CSVパースの簡易実装**:
- ダブルクォート囲み対応: 値がダブルクォートで囲まれている場合、囲みを除去する
- エスケープされたダブルクォート（""）は単一のダブルクォートに変換
- 改行を含むフィールド: 非対応（Excelの標準CSV出力では通常発生しない）
- 理由: 外部CSVパーサーライブラリの追加を避けるため簡易実装。4000行程度の商品マスタCSVでは十分

**入力例**:
```
bytes: [BOM] + "商品コード,商品名,部門ID,売価,原価,税率\n4976383262108,ﾊﾏﾅｶ ｱﾐｱﾐ極太,3,594,111,10\n"
```

**出力例**:
```
Ok(ImportParseResult {
    headers: ["商品コード", "商品名", "部門ID", "売価", "原価", "税率"],
    rows: [
        {"商品コード": "4976383262108", "商品名": "ﾊﾏﾅｶ ｱﾐｱﾐ極太", "部門ID": "3", "売価": "594", "原価": "111", "税率": "10"}
    ],
    parse_errors: [],
})
```

---

### 18.4 非目的

このモジュールが**やらないこと**を明示する。責務境界の誤解を防ぐため。

| やらないこと | 理由 | 責務を持つモジュール |
|------------|------|-----------------|
| ヘッダ検証（必須列の確認） | 業務ルール | BIZ-01 preview_import |
| 重複チェック（product_code の既存確認） | DB操作が必要 | BIZ-01 preview_import |
| 数値バリデーション（売価・原価の型変換） | 業務ルール | BIZ-01 preview_import |
| DB操作（INSERT/UPDATE） | IO層の純関数 | BIZ-01 commit_import |
| Z004ファイルのパース | 別フォーマット | IO-02 z004_parser |

### 18.5 対応不変条件

| 不変条件 | 本モジュールでの対応 |
|---------|-----------------|
| INV-8: products物理DELETE禁止 | IO-03 は読み取り専用（パースのみ）。DELETE 操作なし |

他の INV はDB操作を伴うため、本モジュールのスコープ外。BIZ-01 側で対応。

---

### 更新履歴

| 日付 | PR | 内容 |
|------|-----|------|
| 2026-04-12 | PR #19 | 初版作成（IO-03 parse_product_csv 設計） |
| 2026-04-13 | PR #22 | ParsedRow 構造体導入。rows を `Vec<HashMap>` → `Vec<ParsedRow>` に変更し、元CSV行番号を保持 |
