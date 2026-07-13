## IO-05: レポートCSVエクスポーター

### 27.1 モジュール構成

```
src-tauri/src/
  io/
    mod.rs                  -- pub mod report_csv_exporter を追加
    report_csv_exporter.rs  -- CSV生成（本セクション）
```

---

### 27.2 依存クレート

追加なし。標準ライブラリのみ使用。

---

### 27.3 型定義

なし。入力は `Vec<String>`（ヘッダ）+ `Vec<Vec<String>>`（データ行）、出力は `Vec<u8>`。

---

### 27.4 export_csv

**関数要求**: ヘッダとデータ行からUTF-8 BOM付きCSVバイト列を生成する。Excel互換のフォーマット

**シグネチャ**:
```
fn export_csv(headers: &[String], rows: &[Vec<String>]) -> Vec<u8>
```

戻り値: UTF-8 BOM付きCSVバイト列

**処理ステップ**:
1. 出力バッファ（`Vec<u8>`）を作成
2. UTF-8 BOM（`0xEF, 0xBB, 0xBF`）を先頭に書き込む
3. ヘッダ行を書き込む: 各フィールドを `escape_csv_field` でエスケープし、カンマで結合、末尾に `\r\n`
4. データ行を順に書き込む: 各フィールドを `escape_csv_field` でエスケープし、カンマで結合、末尾に `\r\n`
5. バイト列を返す

**エラーハンドリング**:
- エラーなし（純関数、失敗しない）
- 空のrows → ヘッダ行のみのCSVを返す
- 空のheaders → BOMのみ（呼び出し元の責務）

---

### 27.5 escape_csv_field（内部関数）

**関数要求**: CSVフィールド値をRFC 4180に準拠してエスケープする

**シグネチャ**:
```
fn escape_csv_field(field: &str) -> String
```

**処理ステップ**:
1. フィールドにカンマ（`,`）、ダブルクォート（`"`）、改行（`\n` or `\r`）が含まれるか判定
2. 含まれる場合:
   a. フィールド内のダブルクォートを `""` に置換
   b. フィールド全体をダブルクォートで囲む
3. 含まれない場合: そのまま返す

---

### 27.6 テスト方針

| テスト名 | 検証内容 |
|---------|---------|
| `test_export_csv_io05_basic_output` | ヘッダ+データ行が正しいCSV形式で出力される |
| `test_export_csv_io05_utf8_bom` | 出力の先頭3バイトが `[0xEF, 0xBB, 0xBF]` |
| `test_export_csv_io05_quoting` | カンマ・ダブルクォート・改行を含むフィールドが正しくエスケープされる |
| `test_export_csv_io05_empty_data` | rows空 → ヘッダ行のみのCSV |
| `test_export_csv_io05_japanese_content` | 日本語フィールドが正しくUTF-8で出力される |
| `test_export_csv_io05_crlf_line_ending` | 行末が `\r\n`（Excel互換） |
