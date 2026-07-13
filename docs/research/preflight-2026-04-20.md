# Preflight Report: 第7段階 Phase 1 P0 検証 着手前チェック

- 日付: 2026-04-20
- ステータス: 完了（4/4 項目 OK）
- 関連プラン: `/home/kosei/.claude/plans/7-phase-1-ui-fluttering-hamming.md`
- 関連 Plans.md: L65-68（7-4 / 7-5a / 7-5b）

## 目的

第7段階 Phase 1 P0 検証（Task 1 以降）で 4h 以上詰まるリスクを事前に解消する。

## 項目 1: WSL2 + Tauri GUI 動作確認

### 結果: OK

### 確認内容

- WSLg 環境変数
  - `WAYLAND_DISPLAY=wayland-0` ✅
  - `DISPLAY=:0` ✅
- WSLg mount: `/mnt/wslg/` 配下に `.X11-unix/` と `PulseAudioRDPSink` 存在 ✅
- X11 socket: `/tmp/.X11-unix/X0` 存在（`kosei` 所有）✅
- Tauri Linux 依存パッケージ（dpkg -l で確認）
  - `libwebkit2gtk-4.1-0` 2.50.4-0ubuntu0.24.04.1 ✅
  - `libwebkit2gtk-4.1-dev` 2.50.4-0ubuntu0.24.04.1 ✅
  - `librsvg2-dev` 2.58.0+dfsg-1build1 ✅
  - `libssl-dev` 3.0.13-0ubuntu3.9 ✅
  - `build-essential` 12.10ubuntu1 ✅
- Rust コンパイル確認: `cargo check` が 0.8s で finished（キャッシュ済み）✅

### 判定

WSLg + WebView2 エコシステム（Linux 側は WebKitGTK）が揃っており、`npm run tauri dev` で Windows に GUI ウィンドウを表示できる前提が整っている。Task 1 の評価指標「DevTools Network タブで Time to Interactive」は **そのまま採用可能**。

### 残タスク

- [ ] Task 1 着手直前に **1 回だけ** `npm run tauri dev` を手動実行し、実際にウィンドウが起動することを目視確認（5-10min、初回 cargo build 含む）。失敗時は本レポートに追記して代替方針（Vite only）に切替

## 項目 2: pre-push hook の挙動方針確定

### 結果: OK

### 確認内容

`scripts/pre-push.sh` を精読。トリガー条件とチェック項目:

| 条件 | トリガー対象ファイル | 実行チェック |
|------|---------------------|------------|
| Rust 変更 | `src-tauri/.*\.rs$` または `src-tauri/Cargo*` | cargo fmt --check / clippy -D warnings / test / REQ 番号チェック |
| 設計書変更 | `docs/function-design/.*\.md$` または `docs/FUNCTION_DESIGN.md` | doc-consistency-check.sh |
| 対象なし | 上記以外のみ変更 | 全 skip（`no-target-changes`） |

### 分析

- **Router spike**（`spike/router-tanstack` / `spike/router-react-router`）
  - Rust 変更: なし（pure React / TypeScript / package.json のみ）
  - 設計書変更: なし（docs/research/ は hook 対象外）
  - → **hook は `no-target-changes` で skip される**、`--no-verify` 不要
- **Specta spike**（`spike/invoke-specta`）
  - Rust 変更: あり（`Cargo.toml` + `build.rs` + `product_cmd.rs` の一部）
  - → **Rust チェック 4 種（fmt / clippy / test / REQ 番号）が trigger**
  - specta の derive 追加で既存 test が落ちる可能性あり。落ちた場合は `--no-verify` 明示許可（本プラン認可済み）
  - ADR の Verification Evidence に「--no-verify 使用有無」と「失敗した hook 項目」を記録

### 判定

Router spike は通常 push で OK。Specta spike のみ `--no-verify` 認可。main 反映時は全 hook 通過必須。

## 項目 3: React 19 + TanStack Router peer dep 確認

### 結果: OK

### 確認内容

```bash
$ npm info @tanstack/react-router version peerDependencies
version = '1.168.23'
peerDependencies = {
  react: '>=18.0.0 || >=19.0.0',
  react-dom: '>=18.0.0 || >=19.0.0'
}
```

### 判定

- TanStack Router v1.168.23 stable、**React 19 正式対応** ✅
- プロジェクトは React 19.1.0 使用（`package.json` L22）→ peer dep 要件満たす
- Task 1 の TanStack Router 試行は **阻害要因なし** で進行可能

## 項目 4: doc-consistency-check.sh の docs/research/ 許容確認

### 結果: OK（条件付き、ADR 作成時のルール遵守で問題なし）

### 確認内容

`scripts/doc-consistency-check.sh` を精読。`docs/research/` 配下への影響:

| チェック関数 | 対象 | docs/research/ への影響 |
|------------|------|----------------------|
| `check_markdown_link_targets` (R3) | `docs/` 配下全 .md | ADR 内の Markdown リンクが実在ファイルを指せば OK |
| `check_stale_markers` (M3) | `docs/` 配下全 .md | ADR に TODO/TBD/FIXME/未確定 を残さず埋めれば OK |
| `check_ambiguous_language` (M1) | `docs/` + `architecture/` | 「適切に」「など。」を使わなければ OK |
| `check_db_schema_references` (C1) | function-design/*.md | docs/research/ は対象外 |
| 他チェック（CSV/TSV、エラー型、TX境界 等） | 特定パス指定 | docs/research/ は対象外 |

### ADR 作成時の遵守ルール

1. Markdown リンクは実在ファイルのみ指す（相対パスで `../UI_TECH_STACK.md` 等）
2. 「ステータス」フィールドは「決定」「保留」「棄却」のいずれか（TBD / 未確定 は使わない）
3. Verification Evidence の実測値は **必ず埋める**（"TBD" 残置 NG）
4. 曖昧表現（適切に / 必要に応じて / 適宜 / 文末の「など。」）を使わない

### 判定

上記ルールを守れば doc-consistency-check.sh に影響なし。**スクリプト修正不要**、docs/research/ 配下は自然に許容される。

## 総合判定

4/4 項目すべて OK。**Task 1 に着手可能**。

### 次アクション

1. Task 1 着手直前に `npm run tauri dev` を 1 回だけ実行して GUI 起動確認（5-10min）
2. `spike/router-tanstack` branch を作成して TanStack Router + 最小 TanStack Query 導入、3 route 実装
3. 2h 以内に動作すれば `spike/router-react-router` branch で同作業、バンドルサイズ比較

## 更新履歴

- 2026-04-20: 初版作成。Task 0 完了、4/4 項目 OK 判定
