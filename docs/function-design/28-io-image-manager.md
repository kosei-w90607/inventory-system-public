## IO-06: 画像ファイル管理

### 28.1 モジュール構成

```
src-tauri/src/
  io/
    mod.rs            -- pub mod image_manager を追加
    image_manager.rs  -- レシート画像の保存・パス管理（本セクション）
```

---

### 28.2 依存クレート

追加なし。`chrono`（既存依存）と標準ライブラリを使用。

---

### 28.3 型定義

なし。入力はバイト列+メタ情報、出力は相対パス文字列。

---

### 28.4 save_receipt_image

**関数要求**: レシート画像のバイト列を受け取り、アプリデータフォルダ配下に保存して相対パスを返す。返品・交換記録（return_records.receipt_image_path）に格納するパスを生成する

**シグネチャ**:
```
fn save_receipt_image(
    app_data_dir: &Path,
    image_bytes: &[u8],
    extension: &str,
) -> Result<String, std::io::Error>
```

戻り値: 相対パス（例: `images/receipts/2026-04-13_001.jpg`）

**処理ステップ**:
1. 保存ディレクトリを決定: `{app_data_dir}/images/receipts/`
2. ディレクトリが存在しなければ `std::fs::create_dir_all` で作成
3. 今日の日付を `YYYY-MM-DD` 形式で取得（`chrono::Local::now()`）
4. 連番を決定: 同ディレクトリ内の `{YYYY-MM-DD}_` プレフィックスを持つファイルから最大連番+1
   - ファイルなし → 連番1
   - `strip_prefix("{date}_")` + `split('.')` で連番部分を抽出し `parse::<u32>()` でパース（regex不使用）
5. ファイル名を生成: `{YYYY-MM-DD}_{NNN:03}.{extension}`（NNNは3桁ゼロ埋め）
6. `{app_data_dir}/images/receipts/{ファイル名}` に `image_bytes` を書き込む
7. 相対パス `images/receipts/{ファイル名}` を返す

**extensionのバリデーション**:
- 許可する拡張子: `jpg`, `jpeg`, `png`, `gif`, `webp`
- それ以外 → `std::io::Error` を返す（`InvalidInput`）

**エラーハンドリング**:
- ディレクトリ作成失敗 → `std::io::Error` をそのまま返す
- ファイル書き込み失敗 → `std::io::Error` をそのまま返す
- 不正な拡張子 → `std::io::Error(InvalidInput)` を返す

---

### 28.5 テスト方針

| テスト名 | 検証内容 |
|---------|---------|
| `test_save_image_io06_creates_file` | バイト列がファイルとして保存される |
| `test_save_image_io06_relative_path` | 戻り値が `images/receipts/` から始まる相対パス |
| `test_save_image_io06_sequential_numbering` | 同日2回保存で `_001`, `_002` の連番 |
| `test_save_image_io06_directory_creation` | 存在しないディレクトリが自動作成される |
| `test_save_image_io06_date_prefix` | ファイル名に今日の日付が含まれる |
| `test_save_image_io06_extension_preserved` | `.jpg`, `.png` が正しく付与される |
| `test_save_image_io06_invalid_extension` | 不正な拡張子でエラー |
