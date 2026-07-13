# Z004 合成売上日報 fixture

Phase 2 8-2 UI-07 CSV 取込み画面 (PR #62) の残検証 8/10 (3/10〜10/10) 用の合成 Z004 売上日報 fixture。

本物 Z004 売上日報は Phase 4 UI-08 (PLU 書出し) 完成 → レジへ PLU 一括登録 → 1 日運用 → 翌日初取得というロングサイクルが必要で PR #62 完了の前提にできないため、UI-07 完成検証用の合成 fixture を分離する (memory `pr-merge-gate-scope-discipline.md` Plan B 採用根拠)。

## 仕様根拠

- parser docs `docs/function-design/23-io-z004-parser.md` §13.3 (parse_z004 処理ステップ) + §13.4 (parse_data_line) + §13.5 (normalize_jan)
- parser test `src-tauri/src/io/z004_parser.rs` L337-344 (`make_valid_z004` ヘルパー、本 fixture の format 根拠)
- 要求仕様 REQ-401 / REQ-122 / REQ-119 / REQ-128
- IO-02 z004_parser 仕様 (memory `casio-sr-s4000-z-prefix-reference.md` Z004 二態区分)

### ファイル format

```
1 行目: 精算日報 YYYY-MM-DD <任意テキスト>
2 行目: No,コード,名称,個数,金額
3 行目以降: "<record_no>","<JAN>","<name>",<quantity>,<amount>
```

- エンコーディング: **CP932 (Shift_JIS) strict**
- 改行: **CRLF (`\r\n`)**
- 区切り: カンマ + ダブルクォート囲み (5 フィールド固定)
- 空スロット行: `"<record_no>","00000000000000","",0,0` → parser `normalize_jan` で `Ok(None)` → biz `quantity==0 && amount==0` 二重防御で除外 (matched_rows + parse_errors どちらにも入らない)

## ファイル一覧

| ファイル | settlement_date | 行構成 | カバーシナリオ |
|---|---|---|---|
| `normal-small.csv` | 2026-03-21 | 6 行 (販売 matched 4 + 未収録 JAN 1 = `4900000099999` の R119 検証用 + 返品 matched 1 `quantity=-1, amount=-594` for JAN `4900000000001`)、13 桁 JAN×3 + 14 桁末尾 E×1 | 3/10 PreviewStep + 4/10 件数 + 5/10 OK commit (matched 5 含む販売 4 + 返品 1 + unmatched 1 ErrorRow 共存) |
| `duplicate-same-date.csv` | 2026-03-21 (= normal-small と同日) | 5 商品 (同 JAN range、別商品名 / 数量で別 file_hash) | 5'/10 `DuplicateStatus::OverwriteRequired` 経路 |
| `normal-large.csv` | 2026-03-22 | 50 商品 (matched 47 + 空スロット `"00000000000000"` ×3、record_no 15/30/45 位置) | 6/10 進捗 indicator 視認 + 7/10 SuccessStep (matched 47 + empty 3 + errors 0) |
| `normal-invalidate.csv` | 2026-03-23 | 3 商品 (軽量、matched 3) | 10/10 invalidation 検証 (primary=sqlite3 直接確認、secondary=lowStock 在庫少件数、warning 経路は除外) |
| `error-invalid-format.csv` | 2026-03-24 | 6 行 (matched 2 + parse_errors 3: `invalid_format` 1 + `invalid_jan` 1 + `invalid_number` 1 + 空スロット 1) | 8/10 PreviewStep + ErrorRowsAccordion 同居表示 (biz/parse.rs L156-161 で matched_rows ≥ 1 なら preview 進行、pure ErrorStep ではない) |
| `setup-products.sql` | - | 55 商品 INSERT (`product_code = 'Z004FIX-0001'`〜`'Z004FIX-0055'`、`jan_code = '4900000000001'`〜`'4900000000055'`、`department_id = 3` 毛糸) | 各 fixture commit で matched_rows が発生する前提を作る |

## JAN コード規約

| range | 用途 |
|---|---|
| `4900000000001`〜`4900000000050` | matched 用 13 桁 EAN-13 (seed_demo `gen_jan8` 8 桁とは数値範囲レベルで衝突回避) |
| `4900000000004E` (14 桁末尾 E) | normalize_jan で末尾 E 除去 → 13 桁化動作確認 (parser test §L524-528 準拠) |
| **`4900000099999`** (setup-products.sql 未収録) | **R119 検証用** (未登録枠除外フロー、parser で normalize 成功 → biz で `unmatched_product` ErrorRow + `csv_import_errors` 記録) |
| `00000000000000` (全桁ゼロ) | 空スロット (parser `normalize_jan` で `Ok(None)` → スキップ、parse_errors にも matched にも入らない) |

## 残検証 8/10 シナリオ対応表 (Windows native cargo tauri dev、user 作業)

| # | 入力 | 期待動作 |
|---|---|---|
| 1/10 | drag&drop で `normal-small.csv` | ファイル選択 → preview 自動遷移 |
| 2/10 | UTF-8 BOM 付き CSV (別途 `iconv -f CP932 -t UTF-8` で生成) | エンコーディング自動判定 |
| 3/10 | `normal-small.csv` | PreviewStep 表示、6 行 + matched 5 (販売 4 + 返品 1 `quantity=-1, amount=-594` for JAN `4900000000001`) / unmatched 1 (ErrorRowsAccordion に `unmatched_product: 4900000099999`)、settlement_date `2026-03-21` |
| 4/10 | `normal-small.csv` | preview 内に件数表示「合計 6 行 / 取込み 5 / エラー 1」 |
| 5/10 | `normal-small.csv` (初回) → commit | OK commit、SuccessStep、5 matched_rows (販売 4 + 返品 1)、`MatchedRow.quantity` 仕様「正=販売、負=返品」(`biz/csv_import_service/mod.rs` L122) を踏破。JAN `4900000000001` は販売 3 + 返品 -1 で net +2、他 3 商品は販売のみ、`stock_quantity` 4 商品変動、`sale_records` 5 行 (うち 1 行 `quantity=-1, amount=-594`) + `inventory_movements` 5 行 (うち 1 行負方向)、1 unmatched_row → `csv_import_errors` に記録 |
| 5'/10 | `duplicate-same-date.csv` (5/10 commit 後) | `DuplicateStatus::OverwriteRequired` 警告、overwrite 経路 (overwriteConfirmed=true で再 commit) |
| 6/10 | `normal-large.csv` (50 商品) → commit | 進捗 indicator が見える (parsing → importing)、record_no 15/30/45 は空スロットでスキップ |
| 7/10 | `normal-large.csv` commit 完了後 | SuccessStep、結果サマリ「合計 50 / matched 47 / empty 3 / errors 0」 |
| **8/10** | **`error-invalid-format.csv`** | **PreviewStep + ErrorRowsAccordion 同居表示** (biz/parse.rs L156-161 で matched_rows ≥ 1 なら preview に進む)、ErrorRowsAccordion に 3 件 (`invalid_format` 1 + `invalid_jan` 1 + `invalid_number` 1)、commit 押下で matched 2 のみ取込み、`csv_import_errors` に 3 件記録、Success サマリで `errors: 3` を観測 |
| 9/10 | `normal-large.csv` commit 進行中に navigation 試行 | `useBlocker` で beforeunload ダイアログ |
| **10/10** | `normal-invalidate.csv` commit → ホーム戻る | **(primary) sqlite3 で sale_records (settlement_date=2026-03-23、3 行追加) と inventory_movements (3 行追加) を直接確認** / (secondary、保証なし) ホーム summary の lowStock cards は setup-products.sql の `stock_quantity` 状態次第で変動可能性あり / (除外) 「昨日売上 cards」と「前日未取込み warning」は `useHomeSummary.ts` L62-65 ロジック + queryKey 不一致のため**変動しない** |

## 事前準備 (Windows native + WSL2 両対応)

### Step 0: 実 DB パス (`$DB_PATH`) を 1 つ定義

Tauri app が実 startup で開く `app_data_dir/inventory.db` を 1 変数に固定し、Step 1 (seed_demo) と Step 2 (setup-products.sql) で同一 DB を共有する。`src-tauri/tauri.conf.json` の `identifier` は `com.kosei.inventory` (確認: `rg identifier src-tauri/tauri.conf.json`)。

**Windows native (CMD):**
```cmd
set DB_PATH=%APPDATA%\com.kosei.inventory\inventory.db
```

**Windows native (PowerShell):**
```ps
$env:DB_PATH = "$env:APPDATA\com.kosei.inventory\inventory.db"
```

**WSL2 dev (bash):**
```bash
DB_PATH=~/.local/share/com.kosei.inventory/inventory.db
```

### Step 1: seed_demo で 100 商品 + 6 部門 + suppliers / sale_records / inventory_movements 投入

repository root から `--manifest-path` で `src-tauri` crate を指定して実行する (Tauri 2 標準構造で Rust crate は `src-tauri/` 配下にあり、repo root に `Cargo.toml` は存在しない)。`seed_demo_data` は `src-tauri/src/bin/seed_demo_data.rs` L107-114 で `--db <path>` を受付。

**Windows native (CMD):**
```cmd
cargo run --manifest-path src-tauri\Cargo.toml --bin seed_demo_data -- --db "%DB_PATH%" --reset
```

**Windows native (PowerShell):**
```ps
cargo run --manifest-path src-tauri\Cargo.toml --bin seed_demo_data -- --db "$env:DB_PATH" --reset
```

**WSL2 dev (bash):**
```bash
cargo run --manifest-path src-tauri/Cargo.toml --bin seed_demo_data -- --db "$DB_PATH" --reset
```

> 注記: `--reset` 指定時は `confirm_reset` (`src-tauri/src/bin/seed_demo_data.rs` L196-208) で tty 確認 prompt `本当に reset しますか？ (yes/no):` が表示される。`yes` 入力で続行。

### Step 2: setup-products.sql で 55 商品 fixture seed

Step 1 と同一 `$DB_PATH` に流す。**前提**: `sqlite3` CLI が PATH にインストール済であること (Windows native は標準で入っていないため別途インストール必要、WSL2 dev は apt / linuxbrew 等で導入済)。

**Windows native の sqlite3 CLI インストール手順**:
- winget: `winget install --id SQLite.SQLite`
- scoop: `scoop install sqlite`
- 公式: https://www.sqlite.org/download.html から `sqlite-tools-win-x64-*.zip` をダウンロード → PATH に追加

**Windows native (CMD):**
```cmd
sqlite3 "%DB_PATH%" < tests\fixtures\z004\setup-products.sql
```

**Windows native (PowerShell):**
```ps
Get-Content tests\fixtures\z004\setup-products.sql | sqlite3 "$env:DB_PATH"
```

> 注記: PowerShell 5.1 は `<` 演算子未サポート (`The '<' operator is reserved for future use.`) のため、`Get-Content ... | sqlite3 ...` パイプ形式必須。PowerShell 7+ は `<` も使用可能だが互換性のため `Get-Content` で統一。

**WSL2 dev (bash):**
```bash
sqlite3 "$DB_PATH" < tests/fixtures/z004/setup-products.sql
```

**代替**: Windows native に sqlite3 CLI 未導入で即時試行したい場合、WSL2 から `/mnt/c/...` クロスマウント経由で Windows 側 DB に直接流すことも可能 (Step 1 で Windows native に投入した seed データに対して、WSL2 sqlite3 で setup-products.sql を流す。同一 DB ファイル参照なので結果は同じ):

```bash
# WSL2 ターミナルで repo root から実行
sqlite3 "/mnt/c/Users/<USER>/AppData/Roaming/com.kosei.inventory/inventory.db" < tests/fixtures/z004/setup-products.sql
```

確認:
```sql
SELECT COUNT(*) FROM products WHERE product_code LIKE 'Z004FIX-%';  -- 期待: 55
```

### Step 3: cargo tauri dev (Windows native)

```cmd
cargo tauri dev
```

> Phase 2 以降は Tauri 2 on Linux 日本語 IME 制約 (memory `tauri2-linux-ime-limitation.md`) により Windows native 必須。WSL2 では英字入力検証のみ可能。

## **重要制約: CSV ファイルは CP932 + CRLF 必須**

**通常 editor 保存禁止** (UTF-8 + LF になり parser 失敗)。

### 変更時の生成手順 (iconv + sed 経由)

```bash
# 1. UTF-8 + LF の source を一時生成
cat > /tmp/normal-small.utf8.csv << 'EOF'
精算日報 2026-03-21 テスト店舗
No,コード,名称,個数,金額
"1","4900000000001","ﾊﾏﾅｶ ｱﾐｱﾐ極太",3,1782
...
EOF

# 2. iconv + sed で CP932 + CRLF に変換
iconv -f UTF-8 -t CP932 /tmp/normal-small.utf8.csv | sed 's/$/\r/' > tests/fixtures/z004/normal-small.csv
```

### 生成後の verification (3 ステップ必須)

```bash
# (1) encoding 確認
file tests/fixtures/z004/normal-small.csv
# 期待: "Non-ISO extended-ASCII text" 系 (UTF-8 ではない)

iconv -f CP932 -t UTF-8 tests/fixtures/z004/normal-small.csv | head -5
# 期待: 「精算日報 2026-03-21 テスト店舗」が文字化けせず読める

# (2) CRLF 確認
file tests/fixtures/z004/normal-small.csv | rg -i 'CRLF|carriage'
# 期待: CRLF 検出

od -c tests/fixtures/z004/normal-small.csv | head -3 | rg '\\r \\n'
# 期待: CRLF 出力多数

# (3) parser 通過確認
cargo test --test architecture_test
# または ad-hoc で fixture を encode_cp932 経由で parse_z004 に渡して ParseResult 確認
```

## R119 (未収録 JAN) 検証フロー

`normal-small.csv` の 5 商品目 `4900000099999` は **setup-products.sql に意図的に未収録**。

期待動作:
1. parser `normalize_jan` で正常 normalize → 13 桁
2. biz/parse.rs validate 段階で `find_product_by_jan_code` 失敗 → `ErrorRow { error_type: "unmatched_product", error_message: "未登録のJANコード: 4900000099999" }`
3. PreviewStep の ErrorRowsAccordion に表示
4. commit 押下で `csv_import_errors` テーブルに 1 行記録、`sale_records` / `inventory_movements` には記録されない (matched 5 行のみ取込み、販売 4 + 返品 1)

## 関連

- 親プラン: `docs/plans/2026-05-15-3-pr-progression.md` (3 PR 順次マージプラン §4 段階 B B7)
- PR #62: Phase 2 8-2 UI-07 CSV 取込み画面、Codex Round 2 Approve 相当 (commit `2136146`) + 本 fixture 追加で Round 3 想定
- memory `pr-merge-gate-scope-discipline.md`: Plan B 採用根拠 (合成 fixture + Vitest 別 PR δ' 分離)
- memory `casio-sr-s4000-z-prefix-reference.md`: Z004 二態区分 (PLU 設定書出し vs 売上日報)
- memory `feedback-z004-vs-plu-master-confusion.md`: 実機 `Z004_260311PLU(商品).CSV` が売上日報ではない判別
- 後続 PR δ' (Phase 2 8-3 着手前必須): Vitest 導入 + reducer/parser test + 本 fixture 共用
