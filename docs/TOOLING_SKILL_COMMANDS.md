# ツール・プラグイン・Skill コマンド一覧（在庫管理システム）

最終更新: 2026-06-07
対象: `/home/kosei/Projects/inventory-system` 配下で確認できる設定・README相当（`CLAUDE.md`, `SKILL.md`, 各設定ファイル）

---

## 1. まずこれだけ（普段使いコマンド）

### 品質ゲート（バックエンド）
```bash
cd src-tauri
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
```

### フロントエンド
```bash
npm run dev
npm run build
```

### Tauri 実行
```bash
npm run tauri
```

---

## 2. プロジェクト標準コマンド

参照元:
- `package.json`
- `CLAUDE.md`
- `docs/DEV_SETUP_CHECKLIST.md`

### npm scripts（`package.json`）
- `npm run dev`: Vite開発サーバー起動
- `npm run build`: `tsc && vite build`
- `npm run preview`: build成果物をローカルプレビュー
- `npm run tauri`: Tauri CLI 実行

### Rust / DB（`CLAUDE.md` で推奨）
- `cargo check`: コンパイル確認
- `cargo test`: テスト実行
- `cargo clippy --all-targets --all-features -- -D warnings`: 警告ゼロチェック
- `cargo fmt` / `cargo fmt --check`: フォーマット整形/検査

> Docker は退役済み（2026-04-03、[DEV_SETUP_CHECKLIST.md §A.1](DEV_SETUP_CHECKLIST.md) 退役記録参照、WSL2 直接運用に切替済）。

---

## 3. Claude カスタムコマンド（`.claude/commands`）

参照元:
- `.claude/commands/check.md`
- `.claude/commands/design-review.md`
- `.claude/commands/phase-complete.md`
- `.claude/commands/test.md`

使い方（例）:
- `/check`
- `/test`
- `/design-review BIZ-02`
- `/phase-complete Phase 6`

### `/check`
- 実行内容:
  1. `cargo fmt`
  2. `cargo clippy --all-targets --all-features -- -D warnings`
  3. `cargo test`
- 目的: 一連の品質チェックをまとめて回す

### `/test`
- 実行内容: `cargo test`
- 目的: テスト実行 + 失敗時の原因分析

### `/design-review <module>`
- 実行内容: 設計ドキュメント読込（`ARCHITECTURE/FUNCTION_DESIGN/DB_DESIGN`）→実装前要件の要約
- 目的: 実装前の設計確認

### `/phase-complete <phase>`
- 実行内容:
  1. `cargo test`
  2. `cargo clippy --all-targets --all-features -- -D warnings`
  3. `cargo fmt --check`
  4. REQ対応のテスト一覧確認
- 目的: フェーズ完了判定

---

## 4. Claude Skills（導入済み）

実体:
- `.agents/skills/*/SKILL.md`
- `.claude/skills` は上記へのシンボリックリンク
- 外部Skillの出典管理: `skills-lock.json`
- repo-local Skill: `.agents/skills/` に実体を置き、必要に応じて `.claude/skills` から symlink する

### 4.1 Tauri 開発系
- `setting-up-tauri-projects`: Tauri初期構築手順
- `understanding-tauri-architecture`: Tauriアーキテクチャ理解
- `configuring-tauri-apps`: `tauri.conf.json`/`Cargo.toml`設定
- `configuring-tauri-capabilities`: capability設計
- `configuring-tauri-permissions`: permission設計
- `calling-rust-from-tauri-frontend`: frontend -> Rust invoke
- `calling-frontend-from-tauri-rust`: Rust -> frontend events/channels
- `listening-to-tauri-events`: frontend側イベント購読
- `testing-tauri-apps`: Tauriテスト戦略
- `debugging-tauri-apps`: Tauriデバッグ
- `distributing-tauri-for-windows`: Windows配布

### 4.2 開発プロセス系
- `test-driven-development`: TDD運用（先に失敗テスト）
- `systematic-debugging`: 根本原因分析を先に行う

### 4.3 UI/デザイン系
- `inventory-operator-ui`: 在庫管理向けの業務UI視認性、非色シグナル、実利用者L3観点

### 4.4 セキュリティ系
- `varlock`: 秘密情報/環境変数の安全運用

### Skill の呼び出し方（実用）
明示的に依頼文へ含めると使われやすい:
- `TDD skillを使って実装して`
- `systematic-debuggingで根本原因から見て`
- `configuring-tauri-permissionsに沿って見直して`

---

## 5. Skill の出典一覧（`skills-lock.json`）

- `dchuk/claude-code-tauri-skills`
  - calling-frontend-from-tauri-rust
  - calling-rust-from-tauri-frontend
  - configuring-tauri-apps
  - configuring-tauri-capabilities
  - configuring-tauri-permissions
  - debugging-tauri-apps
  - distributing-tauri-for-windows
  - listening-to-tauri-events
  - setting-up-tauri-projects
  - testing-tauri-apps
  - understanding-tauri-architecture

- `obra/superpowers`
  - systematic-debugging
  - test-driven-development

- `wrsmith108/varlock-claude-skill`
  - varlock

---

## 6. 「使えてない」を防ぐ運用ルール（最小）

1. 実装開始前に使うSkillを1つ決めて宣言する
- 例: `今回は test-driven-development で進める`

2. PR前は固定で品質チェックを回す（下記6.1参照）

3. レビュー時は `/check` か `/phase-complete` を使う

4. 設計変更前は `/design-review <module>` を使う

### 6.1 PR提出前チェックフロー

設計書PRとコードPRでチェック対象が異なる。**両方通してからpush**。

```bash
# ① 設計書の横断整合チェック（設計書を含むPRで必須）
./scripts/doc-consistency-check.sh
# → ERROR 0 を確認。WARN は内容を確認して許容判断

# ② プランの整合チェック（実装計画の承認前に推奨）
./scripts/doc-consistency-check.sh --target plan [file_or_dir]
# → ERROR 0 を確認。先決事項に TBD/未決が残っていたら解決してから実装開始

# ③ 設計-コード突合チェック（コードPRで必須）
cd src-tauri
cargo test --test architecture_test       # L1: レイヤー依存ルール
cargo test --test design_compliance_test  # L2: シグネチャ突合

# ④ コード品質チェック（コードを含むPRで必須）
cd src-tauri
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
```

| チェック対象 | ツール | タイミング |
|------------|--------|-----------|
| 設計書の横断整合（16項目: 用語/型/責務/TX/DB参照/関数整合/REQ/INV/エラー/曖昧/テンプレート/マーカー等） | `./scripts/doc-consistency-check.sh` | 設計書PRの提出前 |
| プランの整合（6項目: DB参照/関数名/曖昧表現/マーカー/設計矛盾/先決事項） | `./scripts/doc-consistency-check.sh --target plan` | 実装計画の承認前 |
| レイヤー依存ルール（db→biz禁止等の4層制約） | `cargo test --test architecture_test` | コードPRの提出前 |
| 設計-コード シグネチャ突合（関数名の存在チェック） | `cargo test --test design_compliance_test` | コードPRの提出前 |
| **設計書追加時のマッピング登録** | `design_compliance_test.rs` の `build_doc_to_modules_map()` に追記 | **設計書PRの提出前**（忘れるとCIが落ちる） |
| Rustコードの品質（型/lint/テスト） | `cargo fmt + clippy + test` | コードPRの提出前 |
| Rustコードの深いレビュー（セキュリティ/パフォーマンス） | `/harness-review` | 実装コードが多いPR |

### 6.2 設計書レビューの運用

レビュー往復の無限ループを防ぐため、以下の仕組みを導入済み。

**機械チェック**: `scripts/doc-consistency-check.sh`（16項目）
- 用語整合（CSV/TSV混在検出）
- エラー型整合（レイヤー違反検出）
- preview_cache責務（BIZ層にcache残存チェック）
- 手順番号欠番検出
- SQLパターン（LIMIT without ORDER BY、ページング上限未定義）
- レイヤー境界チェック（IO→BizError、CMD→DbError の違反検出）
- TX境界方針（operation_log がTX内で呼ばれていないか）
- 定数リテラル直書き検出
- C1: DBスキーマ参照検証（テーブル名/カラム名の実在チェック）
- C2: 関数シグネチャ呼び出し元−先整合
- H1: REQトレーサビリティ（タスクID経由）
- H2: INV不変条件の参照漏れ
- H3: エラーバリアント網羅（定義 vs 使用）
- M1: 曖昧表現検出（「適切に」「TBD」等）
- M2: ドキュメントテンプレート準拠
- M3: TODO/未確定マーカー残存

**プランチェック**: `scripts/doc-consistency-check.sh --target plan`（6項目）
- C1: DBスキーマ参照検証（プラン内のテーブル.カラム参照）
- C2: 関数名実在チェック（設計書に定義された関数との整合）
- M1: 曖昧表現検出
- M3: TODO/未確定マーカー残存
- P1: 設計書との矛盾検出（SQL操作対象テーブルの実在）
- P2: 先決事項の未解決検出（決定事項テーブル内のTBD/未決→ERROR）

**人手チェック**: `docs/quality/review-checklist.md`
- 7カテゴリ固定（型/責務/TX/エラー/用語/手順/防御）
- カテゴリ外の指摘は「次回の観点候補」として蓄積（後出し防止）
- 再レビューは前回指摘の修正確認のみ（新規観点追加禁止）

**`/harness-review` との使い分け**:
- `/harness-review` はコードレビュー専用（セキュリティ/パフォーマンス/品質/アクセシビリティ）
- 設計書（マークダウン）の横断整合チェックはスコープ外
- 実装コードが多いPR（PR #11以降）で `/harness-review` を併用すると二重監視になる

---

## 7. Claude プラグイン一覧（実機確認）

確認元:
- ~/.claude/settings.json の enabledPlugins
- ~/.claude/plugins/cache/*
- ~/.claude/plugins/data/*

現在有効:
- engram@engram
- rust-analyzer-lsp@claude-plugins-official
- claude-mem@thedotmack
- claude-code-harness@claude-code-harness-marketplace

メモ: claude-code-harness は現在「いったん脇に置く」方針でも、設定上は有効のまま残っている。

---

## 8. プラグイン別コマンド＆使い方（GitHub調査ベース）

### 8.1 engram（Gentleman-Programming/engram）

参照:
- https://github.com/Gentleman-Programming/engram

主な導入コマンド（README記載）:
- claude plugin marketplace add Gentleman-Programming/engram
- claude plugin install engram
- engram setup codex（Codex向けセットアップ）

主な運用コマンド:
- engram serve [port]: HTTP API起動（デフォルト7437）
- engram mcp: MCPサーバー起動
- engram search <query>: メモ検索
- engram save <title> <msg>: メモ保存
- engram context [project]: 最近の文脈表示
- engram timeline <obs_id>: 時系列コンテキスト表示
- engram stats: 統計表示
- engram tui: TUI起動

MCPツール名（README記載）:
- mem_save, mem_search, mem_context, mem_timeline, mem_get_observation
- mem_update, mem_delete, mem_stats
- mem_session_start, mem_session_end, mem_session_summary
- mem_save_prompt, mem_suggest_topic_key, mem_capture_passive

使いどころ:
- セッションをまたいだ知識保持
- 「以前どう直したか」を再検索したい時

### 8.2 claude-mem（thedotmack/claude-mem）

参照:
- https://github.com/thedotmack/claude-mem

主な導入コマンド（README記載）:
- npx claude-mem install
- /plugin marketplace add thedotmack/claude-mem
- /plugin install claude-mem

設定ファイル:
- ~/.claude-mem/settings.json

主な使い方:
- 基本は自動動作（セッション中の作業を自動記録）
- Web Viewer: http://localhost:37777

MCPツール（README記載）:
- search
- timeline
- get_observations
- save_memory

使いどころ:
- 過去の作業文脈の再利用
- 長期運用での「同じ調査のやり直し」削減

### 8.3 rust-analyzer-lsp（anthropics/claude-plugins-official）

参照:
- https://github.com/anthropics/claude-plugins-official/tree/main/plugins/rust-analyzer-lsp
- https://claude.com/plugins/rust-analyzer-lsp

前提コマンド（README記載）:
- rustup component add rust-analyzer（推奨）
- brew install rust-analyzer（macOS）
- sudo apt install rust-analyzer（Ubuntu/Debian）

使い方:
- 明示コマンドよりも「Rustファイルで自動有効化」が中心
- Claudeへの依頼例:
  - このRustコードを分析して
  - この関数の参照箇所を探して
  - この構造体の定義にジャンプして
  - clippy警告を確認して

使いどころ:
- Rustコード読解の高速化
- 定義・参照・診断の補助

### 8.4 claude-code-harness（Chachamaru127/claude-code-harness）

参照:
- https://github.com/Chachamaru127/claude-code-harness

導入コマンド（README記載）:
- /plugin marketplace add Chachamaru127/claude-code-harness
- /plugin install claude-code-harness@claude-code-harness-marketplace
- /harness-setup

主要コマンド（README記載）:
- /harness-plan
- /harness-work
- /harness-review

使いどころ:
- Plan → Work → Review の自律サイクルを統一
- ただし現状は init で詰まりがあったため、再導入時に段階的検証推奨

---

## 9. プラグイン管理の基本コマンド（Claude Code共通）

参照:
- https://docs.claude.com/en/docs/claude-code/plugins

- /plugin: プラグイン管理UIを開く
- /plugin marketplace add <org/repo>: マーケットプレイス追加
- /plugin install <plugin>@<marketplace>: インストール
- /plugin enable <plugin>@<marketplace>: 有効化
- /plugin disable <plugin>@<marketplace>: 無効化
- /plugin uninstall <plugin>@<marketplace>: アンインストール
