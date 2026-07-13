# 記憶システム3系統の整理: auto-memory primary への移行 + 機械的保存トリガー整備

## Context

`/home/kosei/inventory-system` には3つの永続記憶システムが並走している:

1. **engram** (MCP plugin): 4箇所の音源（SKILL.md / session-start.sh / user-prompt-submit.sh / グローバルCLAUDE.md）で `MANDATORY / ALWAYS ACTIVE` を大声で宣言
2. **claude-mem** (MCP plugin): SessionStart hookで約32kトークンの観測ダンプを毎回注入。engramと役割重複
3. **auto-memory** (Claude Code native v2.1.59+): `~/.claude/projects/-home-kosei-inventory-system/memory/` に markdown 保存。13日間未使用で放置

### 決定事項

| 判断 | 内容 |
|------|------|
| **primary記憶** | auto-memory (純正機能) |
| **engram** | **完全退役**（search機能もProject SSOT規律で冗長と判断） |
| **claude-mem** | **完全退役** |
| **グローバル書き換え** | `~/.claude/CLAUDE.md` のEngram Protocol削除OK |
| **移植** | Subagent全量レビュー → 採用候補抽出 → memory/へ書き出し |

### 信頼性ギャップの認識

auto-memoryの保存は**Claudeの判断依存**。proactive saveプロトコルがあっても、以下の穴がある:

- Claudeが「保存すべき瞬間」を見落とすことがある（13日放置の実例あり）
- ユーザー自身も「覚えておいて」と言うことを忘れる（ユーザー自己申告）
- 小さい好み・feedbackが特に漏れやすい

→ **人間の意図に依存しない機械的トリガー**を hook で実装する必要がある。

## 実行順序（7フェーズ）

### Phase 0: 作業準備（保全 + 進捗追跡基盤）

**目的**: レート制限中断・セッション切断・圧縮イベントから復旧可能な状態を最初に作る。

#### 0.1 プラン保全
- 現プランファイル `/home/kosei/.claude/plans/wobbly-dreaming-naur.md` を git管理下にコピー
- コピー先: `/home/kosei/inventory-system/docs/plans/memory-migration-plan.md`
- 理由: `~/.claude/plans/` はlocal storage。プロジェクトの `docs/plans/` 配下に置けばgit管理され、コミット時点で永続化される
- 以降、プランに変更があれば **両方** を更新する（あるいは `docs/plans/` 側をマスターにして symlink に切り替え）

#### 0.2 タスク番号付けと進捗管理

TaskCreate で番号付きタスクを一括登録し、**この表のステータス列と TaskList を両方メンテナンス**する。`/clear` で TaskList が失われる可能性があるため、**このプランファイルがマスターソース**。

##### タスク進捗表

| タスク番号 | ステータス | タイトル | 対応Phase | 依存関係 |
|----------|----------|---------|----------|---------|
| T01 | ✅ completed | プラン保全とタスク登録 | 0.1, 0.2 | (なし) |
| T02 | ✅ completed | グローバル CLAUDE.md 書き換え | 1.1 | T01 |
| T03 | ✅ completed | プロジェクト CLAUDE.md 補強 | 1.2 | T01 |
| T04 | ✅ completed | engram 観測全量レビュー（Subagent） | 2.1 | T02, T03 |
| T05 | ✅ completed | claude-mem 観測全量レビュー（Subagent） | 2.2 | T02, T03 |
| T06 | ✅ completed | 採否判断 → memory/ 書き出し | 2.3 | T04, T05 |
| T07 | ✅ completed | feedback検出hook 実装 | 4.1 | (先行実装: hookはmemory内容と独立) |
| T08 | ✅ completed | PreCompactスキャンhook 実装 | 4.2 | (先行実装) |
| T09 | ✅ completed | SessionStart(compact)回復hook 実装 | 4.3 | (先行実装) |
| T10 | ✅ completed | git tag検知hook 実装 | 4.4 | (先行実装) |
| T11 | ✅ completed | プランファイル検知hook 実装 | 4.5 | (先行実装) |
| T12 | ✅ completed | age-based safety-net hook 実装 | 4.6 | (先行実装) |
| T13 | ✅ completed | settings.json hooks 登録 | 4.7 | T07-T12 |
| T14 | ✅ completed | CLAUDE.md プロトコル追記（sentinel含む） | 4.8 | T03 |
| T15 | ✅ completed | claude-mem / engram プラグイン無効化 | 3.1 | T06 |
| T16 | ⏳ pending | 初回検証（5.1） — **次セッションで実施** | 5.1 | T15 |
| T17 | ⏳ pending | 継続運用ルールの最終確認（Phase 6群） | 6.1-6.7 | T16 |

##### 2026-04-16 進捗メモ

- Subagent 2本 bg 起動中（T04: engram / T05: claude-mem 観測レビュー）
- hook 6本は T06 より先行実装完了（hook実装は memory/ 内容と独立しており、順序依存がない）
- hook 動作確認テスト済み: feedback検出 / git tag検出 / plan検出 / safety-net すべてexit 0でadditionalContext出力
- 次の作業: Subagent 完了 → T06 採否判断 → memory/ 書き出し → T15 プラグイン無効化 → T16 検証

- 現在の進捗とターミナル内の君の出力全文が以下
  プラン両ファイル同期済み、TaskList も同期。このターンで T07-T13 を片付けた。

    現在の進捗

    ┌──────────────┬───────┬──────────────────────────────────────────────────────────┐
    │      T       │ 状態  │                           内容                           │
    ├──────────────┼───────┼──────────────────────────────────────────────────────────┤
    │ T01-T03      │ ✅    │ プラン保全 / グローバル・プロジェクト CLAUDE.md 書き換え │
    ├──────────────┼───────┼──────────────────────────────────────────────────────────┤
    │ T04, T05     │ 🔄 bg │ engram / claude-mem 観測レビュー Subagent 走行中         │
    ├──────────────┼───────┼──────────────────────────────────────────────────────────┤
    │ T07-T12      │ ✅    │ hook スクリプト6本実装 + 動作テスト済み                  │
    ├──────────────┼───────┼──────────────────────────────────────────────────────────┤
    │ T13          │ ✅    │ settings.json に hooks フィールド登録済み                │
    ├──────────────┼───────┼──────────────────────────────────────────────────────────┤
    │ T14          │ ✅    │ CLAUDE.md プロトコル（sentinel含む）                     │
    ├──────────────┼───────┼──────────────────────────────────────────────────────────┤
    │ T06, T15-T17 │ ⏳    │ Subagent 結果待ち                                        │
    └──────────────┴───────┴──────────────────────────────────────────────────────────┘

    hook 動作確認結果

  - feedback hook: 「覚えておいて」「その方針」「違う」でパターン検出 → additionalContext 生成 ✅
  - git tag hook: git tag v0.8.0-ui-daily で発火、git tag -l は非発火 ✅
  - plan hook: docs/plans/*.md で発火、src/main.rs は非発火 ✅
  - safety-net hook: sentinel不存在サイレント、古いsentinel（470日超）で警告 ✅
  - syntax check 6本全て OK、エラー時も exit 0（会話ブロックしない）

  先行実装の判断

  プランでは T07-T12 は T06 (memory/ 書き出し) 後に配置されてたが、hook 内容は memory/
  の中身に独立してる（パターン検出・sentinel操作のみ）ので並行して実装した。プランファイルに進捗メモで理由を残した。

  次の待機

  Subagent 2本が完了したら:
  1. T06: 親セッション側で採否判断 → memory/ 書き出し
  2. T15: ~/.claude/settings.json で claude-mem / engram を false（T06 前にやると Subagent が mem_search できなくなるので順序厳守）
  3. T16: 次セッション起動で検証

  bg なので通知待ち。レート節約のため一旦ここで止める。中断されてもプランファイルがマスターなので復旧可能。プラン両ファイル同期済み、TaskList も同期。このターンで T07-T13 を片付けた。

  現在の進捗

  ┌──────────────┬───────┬──────────────────────────────────────────────────────────┐
  │      T       │ 状態  │                           内容                           │
  ├──────────────┼───────┼──────────────────────────────────────────────────────────┤
  │ T01-T03      │ ✅    │ プラン保全 / グローバル・プロジェクト CLAUDE.md 書き換え │
  ├──────────────┼───────┼──────────────────────────────────────────────────────────┤
  │ T04, T05     │ 🔄 bg │ engram / claude-mem 観測レビュー Subagent 走行中         │
  ├──────────────┼───────┼──────────────────────────────────────────────────────────┤
  │ T07-T12      │ ✅    │ hook スクリプト6本実装 + 動作テスト済み                  │
  ├──────────────┼───────┼──────────────────────────────────────────────────────────┤
  │ T13          │ ✅    │ settings.json に hooks フィールド登録済み                │
  ├──────────────┼───────┼──────────────────────────────────────────────────────────┤
  │ T14          │ ✅    │ CLAUDE.md プロトコル（sentinel含む）                     │
  ├──────────────┼───────┼──────────────────────────────────────────────────────────┤
  │ T06, T15-T17 │ ⏳    │ Subagent 結果待ち                                        │
  └──────────────┴───────┴──────────────────────────────────────────────────────────┘

  hook 動作確認結果

  - feedback hook: 「覚えておいて」「その方針」「違う」でパターン検出 → additionalContext 生成 ✅
  - git tag hook: git tag v0.8.0-ui-daily で発火、git tag -l は非発火 ✅
  - plan hook: docs/plans/*.md で発火、src/main.rs は非発火 ✅
  - safety-net hook: sentinel不存在サイレント、古いsentinel（470日超）で警告 ✅
  - syntax check 6本全て OK、エラー時も exit 0（会話ブロックしない）

  先行実装の判断

  プランでは T07-T12 は T06 (memory/ 書き出し) 後に配置されてたが、hook 内容は memory/
  の中身に独立してる（パターン検出・sentinel操作のみ）ので並行して実装した。プランファイルに進捗メモで理由を残した。

  次の待機

  Subagent 2本が完了したら:
  1. T06: 親セッション側で採否判断 → memory/ 書き出し
  2. T15: ~/.claude/settings.json で claude-mem / engram を false（T06 前にやると Subagent が mem_search できなくなるので順序厳守）
  3. T16: 次セッション起動で検証

  bg なので通知待ち。レート節約のため一旦ここで止める。中断されてもプランファイルがマスターなので復旧可能。

##### 2026-04-16 進捗メモ (継続セッション)

前セッションで bg 起動した Subagent 2本が引き継がれていなかったため、新セッションで再起動して T04, T05, T06, T15 まで一気に完了。

**実施内容**:

1. **偵察 (本セッション内 mem_search で確認)**:
   - engram project名: `inventory-system` 確定 / 件数: 約60件 (74観測中 inventory-system 分)
   - claude-mem 件数: 1000件超 → 全件走査は非現実的、足切り戦略採用

2. **Subagent 2本を bg 並列再起動 (改訂プロンプト)**:
   - サブプラン: `~/.claude/plans/generic-sniffing-mochi.md` (改訂版)
   - 出力先を `/tmp/{engram,claude-mem}-review.md` にして親セッションへの注入を最小化
   - 結果: engram 採用6 / 除外50 / 昇格4、claude-mem 採用1 / 除外23 / 昇格2

3. **T06 採否判断 → memory/ Write (7件)**:
   - `docker-portfolio-dependency.md` (project)
   - `user-context-portfolio-goal.md` (user)
   - `review-convergence-pattern.md` (feedback)
   - `plan-stage-quality-check.md` (feedback)
   - `codex-review-workflow.md` (feedback)
   - `dev-environment-policy.md` (project)
   - `barcode_scanner_ux.md` (reference) ※UI_TECH_STACK.md §5.3 補足
   - MEMORY.md 索引をカテゴリ分け (user/feedback/project/reference) で再構成

4. **docs 昇格 2件**:
   - `.claude/rules/review-workflow.md` 新設 (engram #8/#34/#45 統合: PR レビュー 7 ステップ + Codex app 連携)
   - `.claude/rules/implementation-quality.md` 追記 (claude-mem #692/#693: WAL/SHM 補助ファイル warn ログ + read_dir catch-all 禁止)
   - **未着手** (要ユーザー確認): engram #56/#54/#30 → docs/function-design/{該当}.md 更新履歴

5. **T15 プラグイン無効化**:
   - `~/.claude/settings.json` で `engram@engram: false`, `claude-mem@thedotmack: false`
   - 次セッションで効果検証 (T16): ACTIVE PROTOCOL / CMEM ダンプが消えるか

6. **.last_audit sentinel 作成** (Phase 6.1 必須手順):
   - `touch ~/.claude/projects/-home-kosei-inventory-system/memory/.last_audit`
   - safety-net hook の age-based トリガーをリセット

**追加実施 (2026-04-17 ユーザー指摘によるフォロー)**:

- **function-design 更新履歴追記**:
  - `docs/function-design/26-io-product-csv-importer.md` — 既に PR #22 (ParsedRow) が記載済み（追記不要）
  - `docs/function-design/35-biz-stocktake-service.md` — PR #21 で StocktakeItemForComplete を 5フィールド→3フィールド統一した経緯を更新履歴に追記
  - `docs/function-design/32-biz-csv-import-service.md` — PR #14 で find_csv_import_by_id 設計書定義に対する実装欠落を解消した経緯 + PR #22 で preview キャッシュ所有責務を BIZ→CMD に移した経緯を追記
- **退役記録 memory/plugin-retirement-log.md 新設** (project型):
  - engram / claude-mem の導入動機・退役理由・移植内容・無効化手順を記録
  - 「将来同種の MCP 記憶プラグインを評価するときの判断材料」として残す
- **/tmp 出力削除**: `/tmp/engram-review.md`, `/tmp/claude-mem-review.md` を削除（内容のサマリは plugin-retirement-log.md に転写済み）

**俺 (Claude) の選択肢設計の不備**:
T06 着手時の AskUserQuestion で「docs昇格を2件」と書いたが、これは `.claude/rules/review-workflow.md` 新設 + `.claude/rules/implementation-quality.md` 追記 の2件しか念頭になく、function-design 更新履歴 (engram #56/#54/#30) を選択肢から漏らしていた。ユーザー指摘で追加対応。

**次セッション (T16) で確認すべき項目**:
- engram の "ACTIVE PROTOCOL" / claude-mem の `$CMEM ...` ダンプが SessionStart で消えていること
- MCPツール `mem_save` 等が利用不可になっていること
- システムプロンプトに memory/MEMORY.md (8項目構成) がロードされていること
- hook 6本が正常動作 (UserPromptSubmit feedback / Plan / git tag / safety-net / PreCompact / SessionStart compact)
- トークン消費が冒頭で減少していること (前回 32k+ → ?)

##### ステータス記号

| 記号 | 意味 |
|------|------|
| ⏳ pending | 未着手 |
| 🔄 in_progress | 実施中 |
| ✅ completed | 完了 |
| ❌ blocked | ブロック中（依存未解決や障害） |

##### 進捗更新ルール（★/clear 耐性の核心）

タスクの状態が変わるたびに、以下を **必ず両方** 更新する:

1. **TaskUpdate** で TaskList のステータスを変更（`in_progress` / `completed`）
2. **このプランファイル**の進捗表のステータス列を対応する記号に更新

**さらに**、プランファイルは2箇所（docs側とClaude Code側）にあるため、**両方を同期**する:
- `/home/kosei/inventory-system/docs/plans/memory-migration-plan.md` ← git管理・マスターソース
- `/home/kosei/.claude/plans/wobbly-dreaming-naur.md` ← Claude Code側コピー

`/clear` 後の復旧手順:
1. 新セッション開始時、まず `docs/plans/memory-migration-plan.md` を Read
2. 進捗表を見て、`🔄 in_progress` / `✅ completed` から現在地を把握
3. TaskList が空なら TaskCreate で未完了タスクを再登録（`pending` と `in_progress` のみ）

##### 実行順序の注意

- **T15（プラグイン無効化）は T07-T14 完了後**。hook 実装前に無効化すると保存機会が途切れる
- T04 と T05 は並列実行可能（Subagent 2本）
- T07-T12 は並列実行可能（hook実装は独立）

#### 0.3 中断・復旧プロトコル

レート制限・セッション切断時の復旧手順:
1. 次セッション開始時、`/home/kosei/inventory-system/docs/plans/memory-migration-plan.md` を読む
2. TaskList で未完了タスク（`pending` / `in_progress`）を確認
3. `in_progress` は中断点なので、該当箇所から再開
4. CLAUDE.md 更新が途中だった場合は diff を確認してから続行（二重書きを避ける）

---

### Phase 1: 宣言の書き換え（次セッションでの指針を確立）

#### 1.1 `/home/kosei/.claude/CLAUDE.md` (グローバル) を編集
- バックアップ作成: `cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.bak`
- 既存 `## Engram Persistent Memory — Protocol` セクション (230-315行、全86行) を削除
- 代わりに `## 記憶システム優先順位` セクションを挿入:
  - primary: auto-memory (`~/.claude/projects/<project>/memory/`)
  - engram / claude-mem: 非推奨、プラグイン無効化予定
  - 保存判断の4型（user/feedback/project/reference）基準をここに集約

#### 1.2 `/home/kosei/inventory-system/CLAUDE.md` (プロジェクト) に補強セクション追加
- 「設計ドキュメント」セクション直後に `## 記憶システム運用` を挿入
- プロジェクト固有ルール:
  - docsに書くべき内容（設計判断・要件・スキーマ）は memory/ に入れない
  - memory/ は **ユーザーの好み・判断軸・feedback** を優先
  - MEMORY.md は200行以内を維持（ハード制限、詳細は Phase 6.2）
  - 監査はイベント駆動（git tag / プラン更新 / 30日保険）で自動発火、手順は Phase 6.1 参照
  - Staleness・昇格・git管理方針は Phase 6.3〜6.5 参照
- **機械的トリガー語**を明記（Phase 4のhookと連携）:
  - 明示保存: `覚えておいて` / `記憶して` / `残しておいて` / `feedback残す`
  - 俺が検出すべき暗黙のfeedback: 君のdisagreement・preference表明・採用判断

### Phase 2: 過去観測の監査と移植（退役前の資産救出）

#### 2.1 engram 観測全量レビュー（Subagent委託）
- general-purposeエージェント起動
- `mem_search` で全観測ID取得 → `mem_get_observation` で詳細取得
- 採用基準:
  - (a) docs/ARCHITECTURE.md §10, Plans.md, UI_TECH_STACK.md に未記載
  - (b) auto-memoryの4型（user/feedback/project/reference）に該当
  - (c) 現時点で有効（staleでない）
- 除外基準:
  - docsに既にある → 移植しない（docsが正）
  - 一時的セッション状態 → 捨てる
  - 技術決定のうちdocsに書くべきもの → docsに昇格させる（memory/ではなく）
- 出力形式: 移植候補リスト（ファイル名案 + frontmatter + 本文ドラフト）

#### 2.2 claude-mem 観測全量レビュー（別Subagent）
- `mcp__plugin_claude-mem_mcp-search__search` と `timeline` で走査
- 2.1と同じ採用・除外基準
- engramと重複する内容は一本化

#### 2.3 親セッションで採否判断 → memory/ 書き出し
- Subagentの候補リストを親セッションで確認
- 採用するものは memory/<name>.md として Write
- MEMORY.md 索引更新（200行以内）

### Phase 3: プラグイン完全退役

#### 3.1 `/home/kosei/.claude/settings.json` 編集
- `"claude-mem@thedotmack": true` → `false`
- `"engram@engram": true` → `false`
- `rust-analyzer-lsp` と `claude-code-harness` は維持

#### 3.2 確認
- 次セッション冒頭で engram の "ACTIVE PROTOCOL" / "CRITICAL FIRST ACTION" 注入が **消える**
- claude-mem の `$CMEM inventory-system` ダンプが **消える**
- MCPツール `mem_save` / `mem_search` 等が **使えなくなる**（検索不要と判断済み）

### Phase 4: 機械的保存トリガー整備 (★核心)

人間の意図に依存しない hook ベースの保存誘発機構を構築する。既存の `.claude/hooks/check-plan-on-exit.sh` のパターン（JSON in/out + `additionalContext` 注入）を踏襲する。

#### 4.1 hook #1: UserPromptSubmit — feedback パターン検出
- パス: `/home/kosei/inventory-system/.claude/hooks/memory-capture-feedback.sh`
- 発火条件: ユーザーメッセージが以下のいずれかのパターンを含む
  - **明示保存**: `覚えておいて|記憶して|残しておいて|feedback残す|save this|remember`
  - **反対・訂正**: `違う|そうじゃない|やめて|no, better|don't do|stop doing`
  - **好み表明**: `の方がいい|にして|は避けて|prefer|better to|dale mejor`
  - **採用・承認**: `採用|その方針|いいね|dale|go with|sounds good`
- 動作: パターンが一致したら `additionalContext` で Claude に注入:
  - 「feedback-worthy な発言を検出: 『[マッチ部分]』。**この turn の終了前に、memory/feedback_*.md への保存可否を判断し、該当するなら Write せよ**」
- 効果: 俺がその turn 内で必ず保存可否を判断する。忘却を構造的に防ぐ
- 失敗時: パターン不一致なら `additionalContext` 無しで通過（ノイズゼロ）

#### 4.2 hook #2: PreCompact — 圧縮前の強制スキャン
- パス: `/home/kosei/inventory-system/.claude/hooks/memory-precompact-scan.sh`
- 発火条件: コンテキスト圧縮イベント
- 動作: `additionalContext` で注入:
  - 「CRITICAL: このセッションで memory/ に未保存の feedback / 判断軸があれば、**圧縮前に今すぐ Write せよ**。圧縮後は詳細が消える」
- 効果: 圧縮で情報が失われる前に救出

#### 4.3 hook #3: SessionStart(compact) — 圧縮後の回復リマインダ
- パス: `/home/kosei/inventory-system/.claude/hooks/memory-postcompact-check.sh`
- 発火条件: `SessionStart` の `compact` matcher
- 動作: `additionalContext` で注入:
  - 「圧縮後セッション開始。MEMORY.md の内容と現セッション目的が整合するか確認せよ。不整合ならメモリ読み直しまたは更新を検討」
- 効果: 圧縮後の context ロス対策

#### 4.4 hook #4: PostToolUse(Bash) — 段階完了（git tag）検知
- パス: `/home/kosei/inventory-system/.claude/hooks/audit-trigger-phase.sh`
- 発火条件: Bash ツールの実行後、コマンド文字列が `git tag v*` パターンに一致
- 動作: `additionalContext` で**ソフト**注入:
  - 「段階完了を検出（git tag 作成）。次の自然な区切りで memory/ の監査を実施せよ。実施時は `touch memory/.last_audit` でsentinel更新」
- 効果: Phase 1-10 の段階移行時に監査機会が確実に発生
- Note: 強制ではなくリマインダ。君の作業を割り込まない

#### 4.5 hook #5: PostToolUse(Write|Edit|MultiEdit) — プラン作成・更新検知
- パス: `/home/kosei/inventory-system/.claude/hooks/audit-trigger-plan.sh`
- 発火条件: Write / Edit / MultiEdit ツールの実行後、`file_path` が `.claude/plans/*.md` または `docs/plans/*.md` にマッチし、かつ `tool_response.exit_code == 0`（失敗時は誤発火防止のため早期 exit）
- 動作: `additionalContext` で注入:
  - 「プランファイルの作成・更新を検出。次の区切りで memory/ の軽量監査を検討。実施時は sentinel 更新」
- 効果: 数日〜週1の中間チェックポイントを作る
- Note: ソフトリマインダ

#### 4.6 hook #6: SessionStart — 長期未監査の保険（age-based safety net）
- パス: `/home/kosei/inventory-system/.claude/hooks/audit-safety-net.sh`
- 発火条件: `SessionStart` イベント（startup / clear / compact 全matcherで発火）
- 動作:
  - `memory/.last_audit` sentinel file の存在と mtime を確認
  - sentinel 不存在時: **初回サイレント通過**（警告注入しない）。sentinel は最初の監査実施時に `touch` で作成する前提
  - sentinel 存在かつ mtime から30日超: `additionalContext` で注入:
    - 「30日以上 memory/ 監査が実施されていません。Phase 6.1 の監査手順を今セッション中に実行せよ」
  - sentinel 存在かつ30日以内: サイレント通過
- 効果: A/B トリガーが何らかの理由で不発でも、30日を超える放置は確実に検知
- `memory/.last_audit` は初回監査実施時に touch で作成（hook 側では作らない）

#### 4.7 hook 登録: `/home/kosei/inventory-system/.claude/settings.json` 更新
既存の `permissions` に加えて `hooks` フィールドを追加:
```json
"hooks": {
  "UserPromptSubmit": [
    { "hooks": [{ "type": "command", "command": ".claude/hooks/memory-capture-feedback.sh" }] }
  ],
  "PreCompact": [
    { "hooks": [{ "type": "command", "command": ".claude/hooks/memory-precompact-scan.sh" }] }
  ],
  "PostToolUse": [
    { "matcher": "Bash", "hooks": [{ "type": "command", "command": ".claude/hooks/audit-trigger-phase.sh" }] },
    { "matcher": "Write|Edit|MultiEdit", "hooks": [{ "type": "command", "command": ".claude/hooks/audit-trigger-plan.sh" }] }
  ],
  "SessionStart": [
    { "matcher": "compact", "hooks": [{ "type": "command", "command": ".claude/hooks/memory-postcompact-check.sh" }] },
    { "matcher": "startup|clear|compact", "hooks": [{ "type": "command", "command": ".claude/hooks/audit-safety-net.sh" }] }
  ]
}
```

#### 4.8 CLAUDE.md 側プロトコル（hook のバックアップ）
`/home/kosei/inventory-system/CLAUDE.md` の `## 記憶システム運用` セクションに追記:

- **明示トリガー語**: ユーザーが `覚えておいて` `記憶して` `残しておいて` `feedback残す` と言ったら、俺は即座に memory/ に Write する（例外なし）
- **暗黙トリガー（俺が自己判断）**:
  - ユーザーが俺の提案を否定した直後 → feedback型で保存
  - ユーザーが好み・判断軸を述べた瞬間 → feedback型で保存
  - ユーザーが俺の提案を採用した直後 → project型で「なぜ採用したか」含め保存
  - ユーザーがドキュメントに書いてない情報を提供した瞬間 → project / user型で保存
- **セッション終了時の自己監査**: turn を終える前に、そのturn で出た feedback / 判断軸が memory/ に反映されているか確認。未反映なら Write してから終える
- **監査実行時のsentinel更新**: Phase 6.1 の監査を実施したら必ず `touch memory/.last_audit` を実行する（Phase 4.6 safety-net のリセットに必須）

### Phase 5: 検証

次セッション起動時および数日運用後に以下を確認:

#### 5.1 初回セッション検証（Phase 1-4 完了直後）
1. **engram / claude-mem 静止確認**
   - SessionStart 時に `ACTIVE PROTOCOL` / `CRITICAL FIRST ACTION` が **出ない**
   - `$CMEM inventory-system ...` ダンプが **出ない**
   - MCPツール `mem_save` 等が存在しない（プラグイン無効化済み）
2. **auto-memory ロード確認**
   - システムプロンプトに `memory/MEMORY.md` 内容（移植済み）が読み込まれている
3. **hook 動作確認**
   - テスト発言「この色は避けた方がいいよ」→ UserPromptSubmit hook が発火し、俺が feedback 保存判断をする
   - テスト発言「この方針で採用」→ 同上
4. **hook 障害耐性確認**（Phase 6.6 対応）
   - hook スクリプトを一時的に壊して（例: 文法エラー挿入）会話が継続することを確認
   - 確認後すぐに復旧
5. **トークン計測**
   - 初回セッション起動時のトークン消費が **明確に減少**（前回は冒頭で 32k+ 消費）

#### 5.2 継続運用検証（1週間後）
1. memory/ ディレクトリが自然に成長しているか（新規ファイル or 既存ファイル更新）
2. MEMORY.md が 200行以内を維持できているか
3. hook のノイズ（過剰発火）がないか、逆に見落としがないか
4. `/memory` コマンドで監査して、残したかったのに残ってないものがあるか → あればパターン追加

### Phase 6: 継続運用ルール（★Phase 1-4 定着後の恒常運用）

Phase 5 が初動検証なら、Phase 6 は日常運用の規律。**ここを決めないと memory/ は半年で腐る**。

#### 6.1 監査の発火条件と具体手順（イベント駆動）

**時間ベース（月次）はClaudeに「月が跨いだ」を検知させる仕組みが無く脆い**。代わりにプロジェクトの自然なリズムに連動したイベント駆動に切り替える。

##### 発火条件（3段構え）

| 種別 | トリガー | hook | 頻度目安 | 役割 |
|-----|---------|------|--------|------|
| A | 段階完了（git tag作成） | Phase 4.4 `audit-trigger-phase.sh` | Phase単位（数週間〜数ヶ月） | 主要チェックポイント |
| B | プランファイル作成・更新 | Phase 4.5 `audit-trigger-plan.sh` | 数日〜週1 | 中間チェックポイント |
| C | 30日超の未監査（age-based） | Phase 4.6 `audit-safety-net.sh` | セーフティネット | 忘却防止 |

##### 監査の具体手順（どのトリガーで発火しても共通）

`/memory` + `ls memory/` を走査し、以下のチェックリスト:

| チェック項目 | アクション |
|------------|----------|
| MEMORY.md の行数が 180 を超えている | トピックファイルへ分割（6.2 参照） |
| "N days old" 警告が 90日超のファイル | 内容確認 → 有効なら更新、無効ならアーカイブ（6.3 参照） |
| docsに昇格すべき内容（設計判断・規約・パターン）がある | docsに移植して memory/ から削除（6.4 参照） |
| 新規hook発火パターンで漏れた feedback がある | hook の正規表現パターンを追加（Phase 4.1 更新） |
| 重複・矛盾する memory が存在 | 統合または古い方を削除 |

##### 監査完了時の必須手順

**`memory/.last_audit` sentinel file を touch で更新する**:
```bash
touch /home/kosei/.claude/projects/-home-kosei-inventory-system/memory/.last_audit
```
これにより Phase 4.6 の age-based safety net がリセットされる。

##### 実施方式

- トリガーA/B発火時: hookが `additionalContext` で通知 → 俺が「次の自然な区切り」を見つけて監査を提案 → 君が承認したら実行
- トリガーC発火時: 30日超えの警告が SessionStart 時に出る → 俺が「監査実施すべし」と明示的に提案
- 強制中断はしない。**割り込みではなくリマインダ**として機能させる

#### 6.2 サイズ管理ポリシー

- **MEMORY.md は 180行を目安に維持**（200行ハード制限の手前でバッファ確保）
- 超えそうになったら、**トピック単位で個別ファイルへ分割**:
  - MEMORY.md にはタイトル + 1行hookのみ残す
  - 詳細本文は `memory/feedback_naming_conventions.md` 等の個別ファイルへ
- 個別ファイルに on-demand 読み込まれるので、索引だけ軽く保つ
- 個別ファイルのサイズ制限は無い（Claudeが読み込める範囲で）

#### 6.3 Staleness（古さ）への対応方針

- memory/ ファイルを読み込むと `<system-reminder>This memory is N days old</system-reminder>` が自動付与される（純正機能、確認済み）
- **対応ルール**:
  - 30日以内: そのまま使用
  - 30-90日: 読むたびに現状と突合、矛盾があれば更新 or 削除
  - 90日超: 月次監査で個別レビュー。有効なら frontmatter の更新日を更新、無効なら `memory/archive/` へ移動
- **アーカイブ**: `memory/archive/<yyyy-mm>/<original-name>.md` に移す。削除しない（将来の参照用）
- アーカイブ内のファイルは MEMORY.md の索引から外す → on-demand ロード対象外になる

#### 6.4 memory → docs 昇格パス（重要）

memory/ が「docsの墓場」化するのを防ぐため、**昇格ルール**を明記:

| memory種別 | 熟成の兆候 | 昇格先 |
|-----------|----------|-------|
| feedback型 | 複数セッションで参照され続け、設計規約として定着 | `.claude/rules/*.md` または `docs/DOC_STYLE_GUIDE.md` |
| project型（決定） | 後続の実装で再利用される技術決定になった | `docs/ARCHITECTURE.md §10 設計判断ログ` |
| project型（課題） | 対応方針が確定した | `docs/ARCHITECTURE.md §4 未確定事項` から外す or `Plans.md` タスク化 |
| reference型 | 恒常的に使う外部リソース | `docs/` 配下の該当文書に取り込む |

**昇格タイミング**:
- 月次監査時に1ファイルずつ「これdocsに昇格させる？」を判断
- 昇格したら memory/ 側は削除（docsが正の原則を守る）

#### 6.5 memory/ の git管理方針

- **現状**: `~/.claude/projects/-home-kosei-inventory-system/memory/` は `~/.claude/` 配下。**プロジェクトrepoの外**
- **結論**: **machine-localで運用する**（git管理しない）
- 理由:
  - memory/ はあくまで「このマシン上のClaudeとの対話履歴」であり、他環境と共有すべきでない
  - 重要な決定・規約は Phase 6.4 で docs に昇格させるため、docsがgit管理されれば情報は失われない
  - マシン故障時のリスクは認識する（バックアップは後回し）
- **将来の選択肢**（今回は実施しない）:
  - 必要になれば `cp -r ~/.claude/projects/-home-kosei-inventory-system/memory/ docs/memory-snapshot/` で定期スナップショット
  - あるいは別 git repo として独立管理

#### 6.6 hook エラーハンドリング方針

hookスクリプトが落ちた場合の安全性確保:

- **基本原則**: hook が失敗しても会話は絶対ブロックしない
- 各 hook スクリプトの実装ルール:
  - 正常時: `{"hookSpecificOutput": {...}}` をstdoutに出力して `exit 0`
  - **異常時: エラーをstderrに吐きつつ、stdoutには `allow` 相当の最小JSONを出力して `exit 0`**
  - `set -e` は使わない（エラー時に即死を避ける）
  - `jq` など外部コマンド失敗時のフォールバック処理を書く
- テスト: 各 hook をわざと壊してみて、会話が継続することを確認する（Phase 5.1 に追加）

#### 6.7 複数セッション同時起動時の注意事項

- memory/ ディレクトリは**同じプロジェクトの全セッションで共有**される（シングルトン）
- 2つのセッションで同時に memory/ の同じファイルを書くと race condition の可能性
- 対応:
  - 個別ファイルは小さく保つ（書き込み一瞬で終わる）
  - 懸念が顕在化したら Phase 4 の hook で `flock` を導入
  - 当面は運用で気をつけるレベル（同時編集は避ける）

## Critical Files

### 編集対象

| ファイル | 編集内容 | Phase |
|---------|---------|-------|
| `/home/kosei/.claude/CLAUDE.md` | Engram Protocol セクション削除→記憶優先順位セクションに置換 | 1.1 |
| `/home/kosei/inventory-system/CLAUDE.md` | 記憶システム運用セクション追加（明示トリガー語+暗黙トリガー含む） | 1.2, 4.5 |
| `/home/kosei/inventory-system/.claude/settings.json` | hooks フィールド追加 | 4.4 |
| `/home/kosei/.claude/settings.json` | claude-mem, engram を false | 3.1 |

### 新規作成対象

| ファイル | 内容 | Phase |
|---------|------|-------|
| `/home/kosei/inventory-system/docs/plans/memory-migration-plan.md` | プラン保全コピー（git管理下） | 0.1 |
| `/home/kosei/inventory-system/.claude/hooks/memory-capture-feedback.sh` | feedbackパターン検出 | 4.1 |
| `/home/kosei/inventory-system/.claude/hooks/memory-precompact-scan.sh` | 圧縮前保存促し | 4.2 |
| `/home/kosei/inventory-system/.claude/hooks/memory-postcompact-check.sh` | 圧縮後整合確認 | 4.3 |
| `/home/kosei/inventory-system/.claude/hooks/audit-trigger-phase.sh` | git tag 検知→監査トリガー | 4.4 |
| `/home/kosei/inventory-system/.claude/hooks/audit-trigger-plan.sh` | プランファイル更新検知→監査トリガー | 4.5 |
| `/home/kosei/inventory-system/.claude/hooks/audit-safety-net.sh` | age-based保険監査トリガー | 4.6 |
| `/home/kosei/.claude/projects/-home-kosei-inventory-system/memory/.last_audit` | 監査実施時刻のsentinel（初回は監査後に作成） | 6.1 |
| `/home/kosei/.claude/projects/-home-kosei-inventory-system/memory/MEMORY.md` | 索引更新 | 2.3 |
| `/home/kosei/.claude/projects/-home-kosei-inventory-system/memory/*.md` | 移植候補から採用した個別メモリ | 2.3 |
| `/home/kosei/.claude/projects/-home-kosei-inventory-system/memory/archive/<yyyy-mm>/` | 90日超の古memory格納先（将来的に自然発生） | 6.3 |
| `/home/kosei/.claude/CLAUDE.md.bak` | グローバル編集前のバックアップ | 1.1 |

### 参照（編集不要）

| ファイル | 役割 |
|---------|------|
| `/home/kosei/inventory-system/.claude/hooks/check-plan-on-exit.sh` | hookスクリプト実装パターンの参考（JSON in/out + additionalContext） |

## 既存機能の活用

- **auto-memoryの4型スキーマ** (user/feedback/project/reference): システムプロンプト冒頭「# auto memory」セクション既定。これに準拠して書く
- **200行/25KB ハードリミット**: MEMORY.md はこの範囲を維持。超えそうなら個別ファイルへ分割
- **Staleness warning**: memory/ 読み込み時に自動で "N days old" 警告が付く（docker_repair_status.md で確認済み）
- **`/memory` コマンド**: 索引閲覧・CLAUDE.md編集の純正インターフェース。月次監査で使用
- **既存hookパターン**: `check-plan-on-exit.sh` の JSON in/out + `additionalContext` 機構をそのまま踏襲
- **Subagent パターン**: Phase 2 の移植レビューは親コンテキストを汚染しないよう general-purpose エージェントに委託

## ロールバック手順

各Phaseは独立してロールバック可能:

| Phase | ロールバック手段 |
|-------|----------------|
| 1.1 | `cp ~/.claude/CLAUDE.md.bak ~/.claude/CLAUDE.md` |
| 1.2, 4.5 | git で編集を revert (`~/inventory-system/CLAUDE.md` は git管理下) |
| 2 | memory/ の新規ファイルを削除。engram/claude-mem 側データは読み取り専用なので無傷 |
| 3 | `settings.json` の `false` を `true` に戻す。MCPサーバー・hook が即復活 |
| 4.1-4.6 | hook スクリプトを削除 or chmod -x で無効化 |
| 4.7 | settings.json の hooks フィールドを削除 |

## このプランで達成されること

1. **セッション起動時トークン消費の大幅削減**
   - claude-mem 32k ダンプ消滅
   - engram ACTIVE PROTOCOL ブロック + UserPromptSubmit 注入消滅
   - 残るのは純正 auto-memory（MEMORY.md 200行のみ）

2. **記憶の視覚的透明性**
   - `ls memory/` で全体像が一目で見える
   - `/memory` コマンドで索引閲覧
   - 純正の staleness 警告で古さが自動的に可視化

3. **機械的保存の実現**（★核心）
   - UserPromptSubmit hook が feedback パターンを検出 → 俺が強制的に保存判断
   - PreCompact hook が圧縮前に保存促し
   - CLAUDE.md プロトコルが hook のバックアップとして機能
   - **ユーザーも俺もトリガー語を忘れても、hookが発火して保存機会を作る**

4. **依存の最小化**
   - サードパーティMCPプラグイン2つ退役
   - Claude Code純正機能 + プロジェクト固有 hook のみで完結
   - 将来のプラグイン破損リスク消滅

5. **過去資産の保全**
   - engram / claude-mem の有用観測は memory/ に移植済み
   - docs / Plans.md / git log との重複は排除

6. **継続運用の規律（★腐らない仕組み）**
   - **イベント駆動の3段トリガー監査**（git tag / プラン更新 / 30日保険）で時間ベースの脆さを回避
   - memory → docs 昇格パスの明文化で memory/ が「docsの墓場」化するのを防ぐ
   - 200行ハード制限への具体的な分割ルール（180行でトピックファイル化）
   - staleness警告（純正機能）+ アーカイブ規約で古memoryの扱いを標準化
   - hook エラーハンドリング方針で運用中の事故に備える
