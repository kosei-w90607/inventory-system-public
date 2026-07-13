# CLAUDE.md ルール再編と Opus 4.7 運用最適化

> **このプランは context clear 後の fresh Claude へのハンドオフ用**。
> 実装開始前に本ファイルを全文通読し、不明瞭な点があれば実装前にユーザーへ確認する。
> 実装本体の手順は本ファイル末尾の「実装順序」セクションを起点とする。
> 進め方: 探索 → Red → Green → Refactoring の TDD サイクル。KPI は「CLAUDE.md ≤ 110行、検証全 pass、1 commit でまとめる」。

## Context

**なぜ今やるのか**:

- Anthropic Labs から Opus 4.7 がリリースされ、公式 migration guide（https://platform.claude.com/docs/en/about-claude/models/migration-guide）で挙動変化が明言された
- 特に **literal 解釈の強化**と**adherence が CLAUDE.md 長さに強く依存**する点が判明
- ユーザーが新たに「開発スタイル（TDD）」「コード設計（関心の分離、コントラクト層、静的検査）」を CLAUDE.md に加えたい
- 既存の memory `claude-md-consolidation-principle.md` が**トークン総量の話と adherence の話を混同**していて判断軸が古くなっていた
- 公式推奨: 「CLAUDE.md は 200行以下」「Bloated CLAUDE.md causes Claude to ignore instructions」「path-scoped rules で実効 token 削減 + adherence 向上」

**意図する結果**:

- CLAUDE.md を **~106行**（現状 158行）まで圧縮して adherence 向上とゆとり確保
- 新規必須ルール（TDD / コード設計 / subagent 活用）を **最核として** CLAUDE.md に配置
- その他のルールは **path-scoped で `.claude/rules/`** に外出し（該当作業時のみロード → 実効 token 削減）
- memory の判断軸を訂正（tokens vs adherence を区別）
- `session-log.md` テンプレの曖昧表現を修正

## Scope

### 変更対象ファイル

| ファイル | 操作 | 意図 |
|---------|-----|------|
| `CLAUDE.md` | **全面書き換え**（158 → 約106行） | 核ルールのみ残す |
| `.claude/rules/implementation-quality.md` | frontmatter 追加 + エラー型セクション追記 | paths 条件ロード化 |
| `.claude/rules/test-quality.md` | frontmatter 追加 + テストルール追記 | 同上 |
| `.claude/rules/review-workflow.md` | **paths frontmatter 追加** | 案B 採用: PR作業は実質コード触った後に発火するので `src-tauri/**`, `src/**`, `.github/**` で十分 |
| `.claude/rules/commands.md` | **新規作成** | cargo/npm/docker コマンドを path-scoped 化 |
| ~~`.claude/rules/memory-policy.md`~~ | **作らない（案A採用）** | プロジェクト固有部分のみ CLAUDE.md に凝縮維持。global `~/.claude/CLAUDE.md` と重複する詳細（原則・staleness・docs昇格・git管理）は global 側に委譲 |
| `/home/kosei/.claude/projects/-home-kosei-inventory-system/memory/claude-md-consolidation-principle.md` | 訂正 | tokens vs adherence を区別 |
| `/home/kosei/.claude/projects/-home-kosei-inventory-system/memory/claude-md-externalization-token-effect.md` | 補強 | paths あり/なしの区別を追記 |
| `/home/kosei/.claude/projects/-home-kosei-inventory-system/memory/context-loading-budgets.md` | **新規作成**（reference 型） | 公式 docs からの容量・budget・発火条件の事実集約（次ラウンド `/go` 設計の材料） |
| `/home/kosei/.claude/projects/-home-kosei-inventory-system/memory/MEMORY.md` | 索引追記 | 新 reference ファイルへのリンク追加 |
| `.claude/memory/session-log.md` | テンプレ部分の書き換え | `（必要に応じて追記）` → `_(未記入)_` |

### 触らないもの

- `.claude/hooks/*` — 全 hook は現状維持（scaffolding 棚卸し結果: keep）
- `.claude/commands/*` — `/check` `/test` `/design-review` `/phase-complete` は既存のまま（次ステップの `/go` 相当実装時に拡張）
- `.claude/skills/inventory-code-review/SKILL.md` — 既存のまま
- `.claude/settings.json` — hook 登録は keep

---

## CLAUDE.md 新構成（目標 ~106行、200行推奨の約半分）

### 残すセクション（ほぼ原文）

1. **冒頭タイトル + プロジェクト説明** (3行)
2. **言語ルール** (6行)
3. **設計ドキュメント** (11行)
4. **レイヤー原則** (3行)
5. **Git** (5行)
6. **やってはいけないこと** (7行)

計: 35行

### 新規追加セクション（3つ）

7. **開発スタイル** (~10行)
   ```markdown
   ## 開発スタイル

   TDD で開発する（探索 → Red → Green → Refactoring）:
   - 探索: 既存コード・設計書を読み、再利用可能な関数・パターンを特定する
   - Red: 失敗するテストを先に書く（REQ番号をテスト名に含める）
   - Green: テストを通す最小限の実装
   - Refactoring: 可読性・重複除去（テストが緑のまま）

   KPI やカバレッジ目標が与えられたら達成するまで試行する。
   不明瞭な指示は質問して明確にする（憶測で進めない）。
   ```

8. **コード設計** (~10行)
   ```markdown
   ## コード設計

   - 関心の分離を保つ（UI/CMD/BIZ/IO/MNT のレイヤー原則に従う）
   - 状態とロジックを分離する
   - 可読性と保守性を重視する
   - コントラクト層（API/型）を厳密に定義し、実装層は再生成可能に保つ
   - 静的検査可能なルールはプロンプトではなく linter か ast-grep で記述する（例: `scripts/doc-consistency-check.sh`、`architecture_test`）
   ```

9. **Subagent 活用方針**（既存「ExitPlanMode hook の挙動」を統合更新、~18行）
   ```markdown
   ## Subagent 活用方針

   Opus 4.7 は subagent を控えめに生成する。明示指示がない場合は主 Claude が処理する方向に倒れる。

   **主 Claude で処理する場面**:
   - 1〜3ファイルの編集 / 設計書の1〜2箇所追記
   - 対話判断が必要な作業
   - 短時間（〜10分）で完結する作業

   **subagent (general-purpose, run_in_background: true) を使う場面**:
   - 4ファイル以上の広域探索
   - 長時間実装（実装 + テスト + fmt/clippy/test 一連）
   - 独立 context が必要な検証（e.g. L1/L2 突合の単独実行）
   - 並列発火できる独立タスク

   **ExitPlanMode hook の挙動**:
   - `check-plan-on-exit.sh`: プラン整合チェック（エラー時ブロック）
   - `suggest-subagent-for-plan.sh`: subagent 推奨/不適合を additionalContext で注入
   - 「Subagent 推奨」→ Agent tool (general-purpose, bg) で起動
   - 「Subagent 不適合」→ 主 Claude で手動実行
   - 「Subagent 判定リマインダ」→ プラン本文を自分で参照して判断
   ```

計: 約38行（新規）

### 圧縮するセクション

10. **記憶システム運用** (73行 → 約18行) — 案A 採用
    - `.claude/rules/memory-policy.md` は作らず、CLAUDE.md に**プロジェクト固有の運用だけ凝縮**
    - 原則 / Staleness / docs昇格 / git管理 は global `~/.claude/CLAUDE.md` 「記憶システム優先順位」に委譲（重複排除）
    - 残すのは: 格納場所、明示トリガー、暗黙トリガー、hook 連携、セッション終了時自己監査
    ```markdown
    ## 記憶システム運用

    Claude Code 純正の auto-memory を主記憶とする。詳細方針は `~/.claude/CLAUDE.md` の「記憶システム優先順位」参照。

    格納場所: `/home/kosei/.claude/projects/-home-kosei-inventory-system/memory/`

    **明示保存トリガー**（例外なく memory/ に Write）:
    `覚えておいて` / `記憶して` / `残しておいて` / `feedback残す` / `save this` / `remember this`

    **暗黙保存トリガー**（Claude が自己判断で保存）:
    - ユーザーが俺の提案を**否定**した直後 → feedback型（Why: に否定理由）
    - ユーザーが**好み・判断軸**を述べた瞬間 → feedback型
    - ユーザーが俺の提案を**採用**した直後 → project型(採用理由込み）
    - ユーザーが**ドキュメントに書いてない情報**を提供した瞬間 → project型 or user型

    **hook 連携**: `.claude/hooks/memory-capture-feedback.sh` がトリガー語を検知して additionalContext 注入する。発火時は指示に従ってその turn 内で保存判断を実行する。

    **セッション終了時の自己監査**: turn を終える前に、その turn で出た feedback / 判断軸が memory/ に反映されているか確認する。未反映なら Write してから終える。
    ```

計: 約18行

### 削除するセクション（外出し）

- **コマンド** (17行) → `.claude/rules/commands.md` に paths 付きで移動
- **テストルール** (5行) → `.claude/rules/test-quality.md` にマージ
- **エラー型** (6行) → `.claude/rules/implementation-quality.md` にマージ
- **ExitPlanMode hook の挙動** (12行) → Subagent 活用方針セクションに統合（上記 #9）

削除合計: 40行（移動先で吸収）

### 合計行数試算

| 区分 | 行数 |
|------|-----|
| 残すセクション（原文） | 35 |
| 新規3セクション（TDD / コード設計 / Subagent 活用方針） | 38 |
| 凝縮記憶システム運用（案A） | 18 |
| 空行・見出し装飾 | ~15 |
| **CLAUDE.md 合計** | **~106行** |

### Session start ロード総量（案A+B 採用後）

| ファイル | 行数 | session start |
|---------|-----|------------|
| CLAUDE.md（新） | ~106 | ✅ |
| `review-workflow.md`（paths 追加） | 92 | ❌（src-tauri/src 触った時のみ） |
| `implementation-quality.md`（paths 追加） | ~72 | ❌（Rust ファイル触った時のみ） |
| `test-quality.md`（paths 追加） | ~33 | ❌（Rust ファイル触った時のみ） |
| `commands.md`（新、paths） | ~20 | ❌（src-tauri/src/package.json 等触った時のみ） |
| **session start 合計** | **~106行** | **CLAUDE.md 1本のみ** |

200行推奨の約半分、ゆとり94行確保。adherence 最高、path-scoped 全ロード時でも total 323行で 200行/file の推奨は維持される。

---

## `.claude/rules/` 再編

### 既存ファイル変更

**`.claude/rules/implementation-quality.md`** (現状 65行):
- ファイル先頭に frontmatter 追加:
  ```yaml
  ---
  paths:
    - "src-tauri/**/*.rs"
  ---
  ```
- 末尾に CLAUDE.md から移動する「エラー型」セクション追記（6行）
- 結果: 約72行、Rust コード触った時のみロード → 常時 token 消費削減

**`.claude/rules/test-quality.md`** (現状 26行):
- frontmatter 追加:
  ```yaml
  ---
  paths:
    - "src-tauri/**/*.rs"
  ---
  ```
- 末尾に CLAUDE.md から移動する「テストルール」セクション追記（5行）
- 結果: 約33行、Rust コード触った時のみロード

**`.claude/rules/review-workflow.md`** (現状 92行):
- frontmatter 追加（案B 採用）:
  ```yaml
  ---
  paths:
    - "src-tauri/**/*.rs"
    - "src/**/*.{ts,tsx,js,jsx}"
    - ".github/workflows/**"
  ---
  ```
- 理由: PR/レビュー作業は実質コード触った後に発火する。`src-tauri/**` または `src/**` のいずれかを触った時点でロードされれば十分。`.github/workflows/**` は CI 設定触る時用
- 効果: session start ロード対象から除外（92行ぶんの常時 token 消費削減）

### 新規作成

**`.claude/rules/commands.md`** (新規、約20行):
```markdown
---
paths:
  - "src-tauri/**/*.rs"
  - "src/**/*.{ts,tsx,js,jsx}"
  - "package.json"
  - "Cargo.toml"
  - "docker-compose.yml"
---

# プロジェクトコマンド

## ビルド・チェック（Rust）
[cargo check / test / clippy / fmt]

## フロントエンド
[npm install / build / dev]

## Docker（第1〜第2段階、以降はWSL2直接）
[docker compose run --rm dev bash]
```

~~**`.claude/rules/memory-policy.md`**~~ → **案A 採用で作らない**
- 当初プラン: CLAUDE.md 現行「記憶システム運用」73行を外出し
- 変更理由: global `~/.claude/CLAUDE.md` 「記憶システム優先順位」と重複する内容（原則 / Staleness / docs昇格 / git管理）を削除し、プロジェクト固有部分（格納場所 / トリガー / hook連携 / 自己監査）だけ CLAUDE.md に凝縮した方が **session start ロード総量が最小**
- 65行ぶんの新規ファイル作成を回避 + CLAUDE.md も短く保てる（双方の adherence 向上）

---

## memory/ 訂正

### `claude-md-consolidation-principle.md` 訂正

旧判断の本文を保持しつつ、**「訂正」セクションを追記**して判断を更新:

```markdown
## 訂正（2026-04-18）

旧判断「CLAUDE.md に集約して最上級ルール扱い」は **トークン総量の話** としては正しかったが、
**adherence（指示遵守率）の話を見落としていた**。

公式 https://code.claude.com/docs/en/memory 曰く:
> target under 200 lines per CLAUDE.md file. Longer files consume more context **and reduce adherence**.

公式 https://code.claude.com/docs/en/best-practices 曰く:
> Bloated CLAUDE.md files cause Claude to ignore your actual instructions!

### 訂正後の判断軸

| 分割方式 | token削減 | adherence |
|---------|---------|-----------|
| CLAUDE.md 直書き（〜200行） | × | ◎（短さ維持時） |
| `.claude/rules/*.md` paths なし | × | ◯（ファイル分割） |
| `.claude/rules/*.md` paths あり | ◎ | ◎ |
| skills | ◎◎ | 最高効率 |

**新ルール**: CLAUDE.md は ~100行目標（200行ハード上限に対してゆとり重視）。paths で絞れるルールは `.claude/rules/*.md` に paths frontmatter 付きで外出し。常時必要だが長いルールも `.claude/rules/` に paths なしで分割（adherence 維持のため）。
```

### `claude-md-externalization-token-effect.md` 補強

「paths あり/なし」の区別を追記。既存の「paths なしは token 削減しない」は正しい。追加で「paths ありなら条件ロードで実効削減」を記載。

### `context-loading-budgets.md` 新規作成（reference 型）

Anthropic 公式 docs (https://code.claude.com/docs/en/memory, /skills, /context-window) から抽出した **CLAUDE.md / rules / skill の容量推奨と context 消費の事実**を1箇所に集約。

**新規 memory ファイル**: `/home/kosei/.claude/projects/-home-kosei-inventory-system/memory/context-loading-budgets.md`

**frontmatter**:
```yaml
---
name: Context loading budgets
description: CLAUDE.md / rules / skill の容量推奨・context消費・発火条件の事実（公式docs出典）
type: reference
---
```

**本文の骨子**:

| レイヤー | session start ロード | 個別容量推奨 | 全体制限 | 発火条件 |
|---------|-----------------|---------|-------|---------|
| **CLAUDE.md** | 全文 | 200行 | per file | 自動 |
| **rules (paths なし)** | 全文 | 明示なし（200推奨） | per file | 自動 |
| **rules (paths あり)** | なし | 明示なし（200推奨） | per file | マッチファイル Read 時 |
| **skill description** | ロード | 1,536 chars/skill | 8K chars or context の1% | - |
| **skill full (通常時)** | なし | 500行 | 明示なし（context 総量が物理限界） | Claude自主 or `/name` |
| **skill full (/compact 後)** | 呼ばれた skill のみ | 5K tokens/skill | 25K tokens 合計 | - |
| **skill (`disable-model-invocation: true`)** | 完全ステルス | 500行 | 同上 | `/name` のみ |
| **skill (`context: fork`)** | なし | 500行 | subagent 側の context へ | 呼ばれた時 |

**判断ルール（How to apply）**:
- **常時必要**（全作業に効く判断基準） → CLAUDE.md 直書き
- **特定ファイル種別で必要** → `.claude/rules/*.md` + paths frontmatter
- **明示呼び出し or Claude の関連判定で発動** → skill（default）
- **誤爆防止したい side-effect 系** → skill + `disable-model-invocation: true`
- **独立 context で実行したい検証** → skill + `context: fork`
- **長い reference 資料** → skill + supporting files（reference.md 等、on-demand）

**次ラウンド（`/go` 相当の検証 skill 設計時）に効く材料**:
- `!cargo test` / `!cargo clippy` の **dynamic context injection** で実行結果を埋め込める
- `allowed-tools` で事前承認 → パーミッション地獄回避
- `disable-model-invocation: true` + `/go` 明示呼び出しで誤爆防止
- `context: fork` で検証だけ subagent に閉じ込めれば main context 汚染ゼロ

**公式出典**:
- 200行推奨: https://code.claude.com/docs/en/memory "target under 200 lines per CLAUDE.md file"
- 500行推奨: https://code.claude.com/docs/en/skills "Keep SKILL.md under 500 lines"
- description 1,536 chars 上限: https://code.claude.com/docs/en/skills "each entry's combined text is capped at 1,536 characters"
- 25K/5K post-compact budget: https://code.claude.com/docs/en/skills "keeping the first 5,000 tokens of each. Re-attached skills share a combined budget of 25,000 tokens"
- 1%/8K description budget: https://code.claude.com/docs/en/skills "scales dynamically at 1% of the context window, with a fallback of 8,000 characters"

**MEMORY.md 索引への追加**:
```markdown
## 参照情報 (reference)
- [context-loading-budgets.md](context-loading-budgets.md) — CLAUDE.md/rules/skill の容量推奨・context消費の事実（公式docs出典）
```

---

## session-log.md テンプレ修正

`.claude/memory/session-log.md` 3箇所の `（必要に応じて追記）` を `_(未記入)_` に置換。

**Why**: `必要に応じて` は DOC_STYLE_GUIDE.md §5 禁止リストにある曖昧表現。Opus 4.7 の literal 解釈で誤読するリスクあり（「何が必要で、何が応じるのか」が不明確）。テンプレ空枠表示なら `_(未記入)_` の方が意図明確。

影響範囲: 既存の session ログ 2件 + 以降のテンプレ挿入箇所。session-log 生成 hook があるなら確認必要（grep で探す）。

---

## Verification

実装後の検証手順:

1. **行数確認**:
   ```bash
   wc -l CLAUDE.md .claude/rules/*.md
   ```
   → CLAUDE.md が **110行以下**（目標106）、各 rules ファイルが 100行以下であること

2. **公式 200行ガイドライン準拠**: `wc -l CLAUDE.md` が 200 未満（目標はゆとり94行以上）

3. **記憶システム整合性**:
   - memory/MEMORY.md の索引リンクが全て有効（`claude-md-consolidation-principle.md` への参照が訂正後も生きていること）
   - `context-loading-budgets.md` が MEMORY.md の reference セクションから正しくリンクされていること
   - CLAUDE.md 記憶システム運用セクションが global `~/.claude/CLAUDE.md` 「記憶システム優先順位」を正しく参照していること

4. **ExitPlanMode hook 動作**:
   - 新 CLAUDE.md での ExitPlanMode 時に `check-plan-on-exit.sh` の doc-consistency-check が通ること
   - `suggest-subagent-for-plan.sh` が追加した subagent 活用方針の文言と整合すること

5. **既存テスト・品質チェック**（影響なし想定だが念のため）:
   ```bash
   ./scripts/doc-consistency-check.sh
   ```
   → 既存の19項目チェックが pass

6. **実運用チェック**（次セッション起動時）:
   - `/memory` コマンドで CLAUDE.md + rules 全ファイルが正しくロードされることを確認
   - Rust ファイル touch 時に paths-scoped rules がロードされることを確認（InstructionsLoaded hook があれば使う）

---

## 実装順序（fresh Claude が順次実行）

> **前提**: このプランは `/clear` 後の fresh Claude が読んで実装する。作業開始前に、このファイルを最初から最後まで通読してから着手すること。不明瞭な箇所があれば実装前にユーザーに確認を取る（憶測で進めない）。

1. **事前確認**:
   - `wc -l /home/kosei/inventory-system/CLAUDE.md` で現状 158行を確認（想定と一致するか）
   - `fd . /home/kosei/inventory-system/.claude/rules --type f` で既存 rules 3 本確認

2. **新規ファイル作成** (並列可能):
   - `.claude/rules/commands.md`（paths 付き、cargo/npm/docker コマンド）

3. **既存 rules 更新**（並列可能）:
   - `.claude/rules/implementation-quality.md` (frontmatter 追加 + エラー型セクション追記)
   - `.claude/rules/test-quality.md` (frontmatter 追加 + テストルール追記)
   - `.claude/rules/review-workflow.md` (frontmatter 追加、案B)

4. **CLAUDE.md 全面書き換え** (案A で memory 運用凝縮、~106行目標)

5. **memory/ 訂正 + 新規**（repo 外、git commit 対象外）:
   - `/home/kosei/.claude/projects/-home-kosei-inventory-system/memory/claude-md-consolidation-principle.md` に訂正セクション追記
   - `/home/kosei/.claude/projects/-home-kosei-inventory-system/memory/claude-md-externalization-token-effect.md` に paths 区別追記
   - `/home/kosei/.claude/projects/-home-kosei-inventory-system/memory/context-loading-budgets.md` 新規作成（reference 型）
   - `/home/kosei/.claude/projects/-home-kosei-inventory-system/memory/MEMORY.md` の reference セクションに新規ファイルリンク追加

6. **session-log.md テンプレ修正**:
   - `.claude/memory/session-log.md` の `（必要に応じて追記）` 3箇所 → `_(未記入)_`

7. **検証**:
   - `wc -l /home/kosei/inventory-system/CLAUDE.md /home/kosei/inventory-system/.claude/rules/*.md`
   - CLAUDE.md ≤ 110 行 / 各 rules ≤ 100 行を確認
   - `bash /home/kosei/inventory-system/scripts/doc-consistency-check.sh` が pass すること
   - ただし `doc-consistency-check.sh` は docs/ 配下向け → CLAUDE.md 改変で ERROR 出ないか確認、誤検知なら理由メモ

8. **sentinel 更新**: `touch /home/kosei/.claude/projects/-home-kosei-inventory-system/memory/.last_audit`（監査トリガー hook のリセット。プラン完了時の必須手順）

9. **Git commit**（repo 内ファイルのみ）:
   - 対象: `CLAUDE.md`, `.claude/rules/*.md`, `.claude/memory/session-log.md`, `docs/plans/claude-md-consolidation-plan.md`（本プラン自身）
   - 対象外: `memory/` 配下（repo 外）
   - コミットメッセージは下記参照

10. **完了報告**: 行数 before/after、検証結果、commit hash をユーザーに報告。Plans.md の該当タスクは今回のスコープ外なので触らない。

コミットは全て完了した時点で 1本にまとめる（memory/ 訂正・新規は repo 外なので含まない）:
```
refactor: CLAUDE.md を 106行目標に圧縮し .claude/rules/ を paths-scoped 化

- 開発スタイル（TDD）とコード設計を新規追加
- Subagent 活用方針を明文化（Opus 4.7 対応、既存 ExitPlanMode hook 挙動を統合）
- 記憶システム運用をプロジェクト固有部分だけ凝縮（global ~/.claude/CLAUDE.md に委譲）
- コマンド/テスト/エラー型/レビューフローを .claude/rules/ に paths 付きで移動
- commands.md を新規追加（cargo/npm/docker）
- session-log.md テンプレの曖昧表現を修正
- 本プランを docs/plans/claude-md-consolidation-plan.md に記録
```

**注**: memory/ ディレクトリは `~/.claude/projects/` 配下で repo 外（machine-local）→ git add 対象外。memory/ の訂正は git commit には含まれない。

---

## 影響を受けない前提事項

- 既存の `docs/` 配下は一切触らない（ただし本プラン自身を `docs/plans/claude-md-consolidation-plan.md` として配置する step は例外）
- 既存 hook 全て keep（scaffolding 棚卸し結果: 削除対象なし）
- settings.json の hook 登録 keep
- 既存コード（src-tauri, src）は一切触らない
- 既存テスト全て keep
- `.claude/commands/*` は既存のまま（次ラウンド `/go` 相当 skill 化時に再検討）
- `.claude/skills/inventory-code-review/SKILL.md` は既存のまま
