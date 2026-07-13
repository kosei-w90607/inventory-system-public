# inventory-system 知見の gkmas-ocr-pipeline への移植 方針整理

> **作成日**: 2026-05-17
> **ステータス**: Phase 0/1 完了 + Phase 2 draft 完成 + 部分配置 (skill 2/5)。Phase 2 残配置は user 手作業必須 (Claude Code auto-mode の Self-Modification HARD BLOCK 制約、memory `claude-code-self-modification-hard-block.md` 参照)。Phase 1 成果物: 新規 memory 2 本 (`feedback-spec-doc-split-judgment.md` + `claude-code-self-modification-hard-block.md`) + sub plan 3 本 (`2026-05-17-phase1-layer-a-mapping.md` / `2026-05-17-phase1-skill-drafts.md` / `2026-05-17-phase1-hooks-draft.md`)。Phase 2-B 部分配置済: `~/.claude/skills/pr-workflow-hygiene` / `naming-and-design-axioms` (Write tool 経由は実体ファイル、symlink ではない)
> **配置先指定の経緯**: Plan mode harness は `~/.claude/plans/skill-claudecode-virtual-reef.md` を指定したが、本プロジェクトの memory `feedback-active-plan-in-docs.md` (Critical) と CLAUDE.md「やってはいけないこと」(sandbox 外保存禁止) に従い `docs/plans/` 配下に変更

---

## Context

本プロジェクト inventory-system で 2026-03 以降に蓄積した知見（memory 80+ ファイル、scripts、hooks、docs 構造、skill）を、新プロジェクト **gkmas-ocr-pipeline** に移植したい。

新プロジェクトの判明事実:
- パス: `/home/kosei/Projects/gkmas-ocr-pipeline/`
- 言語: Python (`src/gkmas_ocr/`)
- ドメイン: ローカル OCR パイプライン (ffmpeg + manga-ocr + yt-dlp)、学園アイドルマスター二次創作 SS のためのセリフ収集
- 開発体制: **Claude Code 実装 → Codex レビュー** の反復（inventory-system と同じ）
- 設計書 SOT: `docs/ocr_pipeline_spec.md` (1280 行) + `docs/ocr_pipeline_review_checklist.md`、AGENTS.md L16 で「source-of-truth、不用意に書き換えるな」と明文化
- 個人用、Phase 0 進行中、Phase 3 で desktop packaging 想定

**意図する成果**: 新プロジェクトで Claude Code を起動した瞬間から、inventory-system で身につけた品質ゲート（Plan Self-Review / Codex P1 実証防御 / Plan rally / drift 一括 grep / 設計書整合チェック / PR スコープ規律）が同等に効く状態。

---

## 1. 資産分類

### Layer A: Codex × Claude Code 反復スタイルで効く汎用判断軸（持っていく、最重要）

新プロジェクトの「Claude Code 実装 → Codex レビュー」ループに**そのまま効く**。Critical 級から順:

| 種別 | memory ファイル | 効く理由 |
|------|----------------|---------|
| Critical | `plan-self-review-before-implementation.md` | 7 観点セルフレビュー、複数 step プランの手戻り抑制 |
| Critical | `feedback-plan-rally-required-before-exit.md` | Plan agent ラリーで plan 本体を再点検 |
| Critical | `feedback-plan-mode-recursive-refinement.md` | 多発失敗時の plan 再点検、新規指摘 0 まで反復 |
| Critical | `feedback-self-review-mechanical-addition-anti-pattern.md` | Self-Review 形式的追加の拒否、各観点 100 字以上 |
| Critical | `feedback-codex-p1-empirical-defense.md` | Codex P1 致命指摘の実証裏取り、主張と修正方向の正誤を分けて判定 |
| Critical | `feedback-claude-self-bias-blind-spot.md` | 自己 bias 自覚、機械的強制でしか質担保できない |
| Critical | `feedback-memory-rule-needs-hook-enforcement.md` | memory rule の限界、重要な手順は hook で deny block |
| Critical | `feedback-subagent-retry-proposal-verification.md` | subagent retry 提案は鵜呑みにせず必要性を自分で検証 |
| Critical | `review-convergence-pattern.md` | 機械チェックで潰せる問題は PR レビュー前に潰す |
| High | `codex-review-workflow.md` | Codex app 採用、codex-plugin-cc 不採用 |
| High | `codex-non-blocker-incorporation.md` | 任意改善指摘は軽量 + スコープ内 + 3 round 以内なら同 PR で潰す |
| High | `feedback-codex-drift-fix-grep-all-locations.md` | drift 系指摘は repo 全体 grep して全箇所一括修正 |
| High | `feedback-status-sync-pr-keyword-grep-comprehensive.md` | status sync PR は keyword 群を open 前に一括 grep |
| High | `feedback-pr-merge-gate-scope-discipline.md` | Round 2+ で merge gate スコープ膨張 anti-pattern |
| Mid | `feedback-handoff-prompt-on-session-reset.md` | 仕切り直し時に新セッション貼り付けプロンプト併記 |
| Mid | `feedback-recommend-with-explicit-basis.md` | 推奨・数字提案は bias 自覚 + 明示根拠 |
| Mid | `empirical-validation-for-prompts.md` | 重要指示文は白紙 subagent で評価 |
| Mid | `feedback-ci-polling-use-gh-watch.md` | bg CI 完了待ちは `gh pr checks <N> --watch` |
| Mid | `feedback-plans-sync-commit-milestone-only.md` | Plans 更新リアルタイム、commit は節目のみ |
| Mid | `feedback-naming-must-match-reality.md` | 表示名と実態の不一致を嫌う判断軸 |
| Mid | `feedback-self-trace-expression-breaks-sync-loop.md` | PR HEAD/chain 表記の self-trace で docs 同期ループ回避 |
| Mid | `feedback-sensitive-filter-narrow-not-broad.md` | sensitive path filter は複合語列挙、broad wildcard 回避 |
| Mid | `feedback-github-contents-api-utf8-transcoding.md` | GitHub `/contents/` API の UTF-8 transcoding 罠、`/git/blobs/{sha}` 経由が真の raw |
| Mid | `feedback-baseline-monotonic-ci-both-directions.md` | 漸減指標は両方向 fail 扱い |
| Mid | `feedback-migration-phase-wrapper-with-deadline.md` | 移行期ラッパーは期限付き両立、タグ gate 紐付け |
| Mid | `feedback-literal-union-as-retirement-list.md` | literal union を撤去リストとして自己終了設計 |
| Mid | `feedback-bash-wrap-exit-code-capture.md` | `bash; echo "---"; echo $?` の罠 |
| Mid | `oss-tool-anomaly-known-issue-search.md` | OSS tool 異常時は新規起票より既知 issue 検索先 |
| High | `claude-md-consolidation-principle.md` | CLAUDE.md は読み手 Claude 想定で直書き / 最上級ルール扱い |
| High | `claude-md-externalization-token-effect.md` | `.claude/rules/` 外出しは auto-load 対象でトークン削減にならない |
| High | `claude-md-layering-principle.md` | CLAUDE.md から削る移行先判断: 機械強制→Permissions / docs / CLAUDE.md 残しの 3 択 |
| High | `context-loading-budgets.md` | CLAUDE.md / rules / skill の容量推奨と context 消費 (公式 docs 出典) |
| Mid | `tech-selection-learning-investment.md` | 技術選定は spike + ADR 資産化 |
| Mid | `context-size-quality-threshold.md` | context 300k+ の変更は次セッション再レビュー |
| Mid | `feedback-active-plan-in-docs.md` | プランは `docs/plans/`、Plan mode 指定パスに流されない |
| Mid | `plan-archive-discipline.md` | 完了プランは `docs/archive/plans/` に即アーカイブ |
| Mid | `feedback-archive-relative-path-conversion.md` | archive 時は絶対パス→相対パス変換必須 |
| Mid | `plan-stage-quality-check.md` | プラン段階で設計書突合徹底 |
| Mid | `feedback-plan-mode-for-fix-proposals.md` | 疲弊セッション commit 再レビュー後の修正は Plan agent + 検証 |
| Mid | `feedback-commit-zero-plan-apply-immediately.md` | commit-0 plan の指示ファイル編集は同 session 内で実適用 |
| Mid | `feedback-diff-example-inline-code.md` | docs 内差分例示は inline code、markdown link 回避 |
| Mid | `feedback-plans-md-task-selection-with-user-context.md` | 「次着手」は機械採用せず実利用者業務頻度を別軸評価 |
| Mid | `feedback-plans-next-session-entry-temporary.md` | Next Session Entry は一時メモ、汎用判断軸のみ残す |
| Mid | `feedback-draft-first-then-verify-against-source.md` | 新テンプレ初適用は draft-first verify-after が実証的 |
| Mid | `feedback-non-it-user-feature-minimal-build.md` | hidden/advanced 機能は Verification + P1/P2=0 + CI green に固定 |

合計 **40 件前後** が Layer A。

### Layer B: 設計書 SOT + doc-consistency-check 方法論（持っていく + 派生版作成）

新プロジェクトの `ocr_pipeline_spec.md` 1280 行は **分割必至**（inventory-system の `FUNCTION_DESIGN.md` 索引 + サブ 20 ファイル分割と同じ問題）。流用候補:

- `docs/DOC_STYLE_GUIDE.md` の §0 (ドキュメント階層と命名規約) + §1 (参照規約 R0/R1/R3) + §5 (禁止事項) + §6 (自動チェック 19 項目)
- `scripts/doc-consistency-check.sh` の方法論（C1/C2/H1-H3/M1-M3/R0/R1/R3）
- 親文書索引 + サブ文書詳細の 2 層構造
- REQ ↔ FUNC ↔ Test のトレーサビリティ

**新規明文化が必要**: 「仕様書分割の判断軸」が memory にも DOC_STYLE_GUIDE にも保存されていない（後述 §3.1）。これを feedback memory 化してから移植する。

### Layer C: Claude Code 固有機構（持っていけないが、global 化で間接的に効かせる）

| 種別 | 対象 | 配置先 |
|------|------|--------|
| auto-memory 機構そのもの | `~/.claude/projects/<project>/memory/` | project-scoped、汎用化不可。**`~/.claude/CLAUDE.md` global** に重要ルールだけ昇格 |
| hooks | `.claude/hooks/check-plan-on-exit.sh` / `suggest-subagent-for-plan.sh` / `memory-capture-feedback.sh` | **`~/.claude/hooks/` に global 化**（プロジェクト跨ぎ発動） |
| skill | `.claude/skills/inventory-code-review/` | inventory 業務固有、移植不可。代替 skill 新規作成 |
| ScheduleWakeup / Plan mode / Skill tool | Claude Code 機構 | gkmas-ocr-pipeline でも Claude Code を使う限り自動的に利用可能 |

### Layer D: 技術スタック依存（捨て、または memory に塩漬け）

新プロジェクトでは無関係（Python + OCR ドメイン）:
- `feedback-vitest-react19-setup-pattern.md` / `feedback-radix-tooltip-aria-disabled.md` / `feedback-barrel-reexport-loophole.md` / `feedback-binding-vendor-in-vs-gitignore.md`
- `feedback-desktop-app-url-design.md` / `feedback-desktop-window-title-dynamic.md` / `desktop-app-ui-constraints.md` / `tauri2-linux-ime-limitation.md`
- `feedback-npm-install-blocked-mini-shai-hulud-2026-05.md`（時限的 npm 凍結、関係なし）
- `feedback-ime-composition-keydown-exclusion.md` / `feedback-radix-tooltip-aria-disabled.md`
- `feedback-z004-vs-plu-master-confusion.md` / `feedback-pos-vendor-independence.md` / `casio-sr-s4000-z-prefix-reference.md` / `barcode_scanner_ux.md`
- `frontend-function-design-granularity.md` / `ui-design-impl-bundled-pr.md`（UI 関数設計テンプレ、Python OCR には UI なし）
- `dev-environment-policy.md`（WSL2 直接、関係なし）
- `feedback-lsp-skills-policy-hook.md`（LSP hook、Python は別 LSP）

---

## 2. 配置先設計

### 2.1 `~/.claude/CLAUDE.md` (global instructions) への統合

**対象**: Layer A の最重要 (Critical 級 9 件) を **トリガー語 + 1 行要約** で記載。詳細は skill 経由で展開。

**注意**: CLAUDE.md global は 200 行制限あり (`context-loading-budgets.md` 参照)。既存内容（記憶システム優先順位、Agent Teams Lite Orchestrator など）と合わせて溢れないか要確認。**200 行超過時の振り分け順序**は `claude-md-layering-principle.md` に従い (1) 機械強制可能なルール → `~/.claude/settings.json` の Permissions / hooks に deny 化、(2) ドキュメント化済 → docs/ や skill 経由で reference、(3) プロンプト必須 → CLAUDE.md に残す、の判定順を適用。`claude-md-externalization-token-effect.md` も併せて適用 (`.claude/rules/` への外出しは auto-load 対象なのでトークン削減にならない、`~/.claude/skills/<name>/SKILL.md` の trigger description 経由 load が本筋)。

**配置例 (Critical 9 件)**:
```markdown
## Claude × Codex 反復スタイルの品質ゲート

### Plan 提出前のセルフレビュー
ExitPlanMode 前に 7 観点 (技術的前提 / スクリプト詳細 / ドキュメント修正 / 検証計画 / 後処理 / 実行制約 / コミット分割) で抜け漏れ潰し。各観点 100 字以上の本文 + 行番号 / memory 参照を必須。形式的見出しだけは即 reject。複数 step プラン全般に適用、1-3 ファイル 10 分以内の軽微タスクは除外。

### Plan rally
ExitPlanMode 前に Plan agent を独立 context で起動し plan 本体を critique、新規指摘 0 まで反復。多発失敗 / context 大 / hook 通過違和感の 3 トリガー。`/plan-rally` skill で標準フロー。

### Codex P1 致命指摘の扱い
鵜呑みにせず実証で裏取り。主張の正誤と修正方向の正誤を分けて判定。PR comment で transparency。

### subagent retry 提案の検証
subagent が retry / 再実行を提案しても必要性を自分で検証。完全 noise の可能性あり (PR #48 tracking retry の反省)。

### 機械チェック先行原則
fmt / clippy / test + 設計書整合 + L1/L2 で潰せる問題は PR レビュー前に全て潰す。
```

### 2.2 `~/.claude/skills/<name>/SKILL.md` への skill 化

**対象**: Layer A の High / Mid 級 30+ 件を **役割別に統合 skill** 化。trigger description で発動制御し、必要時のみ load。

**統合候補 skill** (5 つ):
1. **`claude-codex-review-loop`** — Codex review workflow / drift fix grep / status sync grep / non-blocker incorporation / P1 empirical defense / GitHub `/contents/` API 罠
2. **`plan-mode-discipline`** — Self-Review / Plan rally / recursive refinement / plan archive / active plan in docs / Plan mode for fix proposals
3. **`pr-workflow-hygiene`** — PR merge gate scope / Status sync keyword grep / Plans sync commit milestone / CI polling gh watch / Self-trace expression / archive relative path
4. **`engineering-judgment-axioms`** — Recommend with explicit basis / Empirical validation / OSS anomaly known-issue / Tech selection learning / Context size quality / Subagent retry verification / Claude self-bias / Memory rule needs hook
5. **`naming-and-design-axioms`** — Naming must match reality / Migration phase wrapper / Literal union as retirement / Baseline monotonic both directions / Sensitive filter narrow / Non-IT user minimal build

各 skill は description に明確な trigger 語を書き、Skill tool 経由でのみ load。

### 2.3 `~/.claude/hooks/` への global hook 化

**対象**: Claude Code 機構として全プロジェクト共通発動。

- `.claude/hooks/check-plan-on-exit.sh` → `~/.claude/hooks/check-plan-on-exit.sh` (Self-Review 検証は汎用)
- `.claude/hooks/suggest-subagent-for-plan.sh` → `~/.claude/hooks/suggest-subagent-for-plan.sh`
- `.claude/hooks/memory-capture-feedback.sh` → `~/.claude/hooks/memory-capture-feedback.sh` (トリガー語は汎用)

**注意**: 各 hook は inventory-system 固有のパス参照や Plans.md 依存があるかもしれない。汎用化リファクタが必要 (実装セッションで)。

### 2.4 `gkmas-ocr-pipeline/CLAUDE.md` の新規作成

**対象**: 新プロジェクト project local。Claude Code 起動時に auto-load。

**骨格** (inventory-system の CLAUDE.md を Python + OCR 用に派生):
```markdown
# gkmas-ocr-pipeline (個人用 OCR パイプライン)

学園アイドルマスター二次創作 SS 用のセリフ収集ローカル OCR パイプライン。Python + ffmpeg + manga-ocr + yt-dlp。

## 言語ルール
日本語で応答。コメントも日本語 OK。識別子は英語。コミット本文は日本語 OK、prefix は英語。

## 設計ドキュメント
実装前に必ず該当ドキュメントを読むこと。
- @docs/ocr_pipeline_spec.md — 主要仕様 (1280 行、分割予定)
- @docs/ocr_pipeline_review_checklist.md — 異常系チェック
- @docs/plans/current-status.md — 現在の決定 / open question / 次の作業

## 開発スタイル
Phase 0 はスクリプトベース。実装 UI 非依存を維持。Claude Code 実装 → Codex レビューの反復。

## レビューループ品質ゲート
（~/.claude/CLAUDE.md の Critical 9 件と整合、project 固有の追加ルールがあれば記載）

## やってはいけないこと
- 設計書を読まずに実装を始める
- 既存テストを削除 / 無効化する
- data/ 配下の動画 / フレーム / OCR 出力 / キャッシュを commit する
- API key / cookies / token を repo に置く
```

### 2.5 `gkmas-ocr-pipeline/.codex/rules/` への Codex 側ルール

**対象**: Codex がレビューする時に発動するルール。AGENTS.md からの参照。

- Codex は Claude Code とは別 system なので、CLAUDE.md / `~/.claude/` 系を読まない。Codex 用に **同じ判断軸を Codex 文法で書き直す** 必要あり
- 既存 `.codex/rules/default.rules` の存在を確認、追記 or 新規 `.codex/rules/review.rules` 作成

### 2.6 `gkmas-ocr-pipeline/docs/style-guide.md` への DOC_STYLE_GUIDE 派生版

**対象**: Python project 用の文書スタイル。最小 5 項目から開始 (19 項目を一気に持ち込まない、`feedback-non-it-user-feature-minimal-build.md` の最小ビルド原則):
1. 参照規約 (markdown link 実在チェック、サブファイル直接参照)
2. 命名規約 (親索引 + サブ詳細の 2 層構造、`NN-{category}-{module}.md`)
3. 曖昧表現禁止 (適切に / TBD / 必要に応じて)
4. 未確定マーカー禁止 (TODO / FIXME / 未確定)
5. テンプレート (関数設計 / データスキーマ / 業務シナリオ)

### 2.7 `gkmas-ocr-pipeline/scripts/doc-consistency-check.sh`

**対象**: 上記 5 項目を機械検証する shell script。inventory-system 版を参考に最小実装。

### 2.8 `gkmas-ocr-pipeline/scripts/pre-push.sh`

**対象**: Python 版 pre-push hook (pytest / mypy / ruff / black --check + doc-consistency-check)。

---

## 3. 新規明文化が必要な項目

### 3.1 仕様書分割の判断軸 (feedback memory 化候補)

**現状**: inventory-system で `FUNCTION_DESIGN.md` 索引 + `function-design/20-io-product-repo.md` 等のサブ 20 ファイル分割を実施したが、**「いつ分割するか」「どこで分割境界を引くか」の判断軸は memory にも DOC_STYLE_GUIDE にも保存されていない**。DOC_STYLE_GUIDE §0 は構造（命名規約 + ファイル種別マッピング）のみ。

**新規 feedback memory 案**:

```markdown
---
name: 仕様書分割の判断軸
description: 単一 markdown が肥大化したら親索引 + サブ詳細の 2 層に分割する。分割タイミングと境界の引き方
type: feedback
---

肥大化した設計書 / 仕様書は親索引 (200-500 行) + サブ詳細 (各 200-800 行) に分割する。

**Why:**
- 単一 1000+ 行 markdown は Read tool の 2000 行制限に近づき context を圧迫
- LLM の長文 attention 劣化で詳細部分が見落とされる
- レビュー差分が大きすぎて Codex が落とす指摘が増える
- 並行編集時の merge conflict が増加
- inventory-system で `FUNCTION_DESIGN.md` 1500+ 行 → 索引 + サブ 20 ファイルに分割した時、Codex review pass 率が体感 2 倍に改善

**分割タイミング (どれか満たしたら検討):**
1. 単一ファイルが 800 行超
2. 目次 / 章番号が 2 階層以上必要
3. 同時編集で merge conflict が 2 回以上発生
4. レビュー指摘で「該当箇所を見つけにくい」が出る
5. Read tool 一発で読めない (2000 行制限超)

**分割境界の引き方:**
- **論理境界優先**: 章 / セクション単位、機能 / レイヤー単位、時系列 / フェーズ単位のいずれかで自然に切れる場所
- **依存単方向**: サブ A がサブ B を参照する場合、サブ B はサブ A を参照しない (循環禁止)
- **親索引の責務**: 概要 + 目次 + 全体方針 + サブへの参照のみ。詳細はサブに移譲
- **サブの責務**: 自己完結した詳細。冒頭に `> **親文書**: [path](../parent.md)` を必ず置く
- **命名規約**: `NN-{category}-{module}.md` (例: `20-io-product-repo.md`)、NN の先頭桁でレイヤー分類

**分割後の機械検証:**
- 参照整合 (markdown link 実在チェック、サブから親 / 親からサブの双方向参照)
- 旧形式参照の検出 (`{parent}.md セクション` 等)
- スクリプトで CI に組み込む (`doc-consistency-check.sh` の R0/R1/R3)

**How to apply:**
- ファイル新規作成時に 800 行超えそうと予測したら最初から 2 層構造で書く
- 既存ファイルが基準超えたら、まず親索引 (概要 + 目次) を抜き出し、残りをサブに移す
- 分割後は必ず markdown link + 旧形式参照を機械検証
- gkmas-ocr-pipeline 移植時に最初に明文化する候補
```

### 3.2 Claude Code 実装 → Codex レビューループの作法統合 skill

**現状**: 複数 memory に散在 (`codex-review-workflow.md` / `codex-non-blocker-incorporation.md` / `feedback-codex-p1-empirical-defense.md` / `feedback-codex-drift-fix-grep-all-locations.md` / `feedback-status-sync-pr-keyword-grep-comprehensive.md` / `feedback-self-trace-expression-breaks-sync-loop.md` / `feedback-github-contents-api-utf8-transcoding.md`)。

**新規 skill 案**: `claude-codex-review-loop` (上記 §2.2 の 1)。memory ファイルへの link を持ち、Codex review が始まる context で発動。

---

## 4. Migration Plan (Phase 分割)

実装は別セッション。各 Phase の所要時間 / commit 単位を見積もり:

### Phase 0: 方針整理 (今日、本 plan ファイル)
- 本 plan ファイルを `docs/plans/2026-05-17-knowledge-transfer-to-gkmas-ocr.md` に commit
- 完了基準: plan が docs/plans/ に存在 + memory `feedback-active-plan-in-docs.md` 遵守 + Self-Review 7 観点埋まり

### Phase 1: 分類リスト確定 + 新規 memory 化 (別セッション、推定 1-2 セッション)
- 1-A: `feedback-spec-doc-split-judgment.md` 新規作成 (§3.1 の draft 元に)
- 1-B: Layer A 全 40 件を再読、要約 1 行ずつ抽出
- 1-C: CLAUDE.md / skill / hooks 振り分け cut-line 確定 (`claude-md-layering-principle.md` の 3 択判定順を全 40 件に適用、どの memory が CLAUDE.md / どの skill / どの hook に行くか確定)
- 1-D: 統合 skill 5 つの description + 内容 draft (§2.2、1-C の振り分け結果を前提とする)
- 完了基準: 5 skill の draft が `~/.claude/skills/<name>/SKILL.md` に存在 + 各 skill が empirical-prompt-tuning で白紙 subagent 評価 pass + 振り分け cut-line が文書化済

### Phase 2: `~/.claude/` global 配置 (別セッション、推定 1 セッション)
- 2-A: `~/.claude/CLAUDE.md` に Critical 9 件統合 (§2.1)
- 2-B: `~/.claude/skills/` に 5 skill 配置 (§2.2)
- 2-C: `~/.claude/hooks/` に汎用化した 3 hook 配置 (§2.3)
- 完了基準: 別 project (例: inventory-system) で Claude Code 起動して各 skill / hook が発動することを確認

### Phase 3: gkmas-ocr-pipeline 側配置 (別セッション、推定 1-2 セッション)
- 3-A: `gkmas-ocr-pipeline/CLAUDE.md` 新規作成 (§2.4)
- 3-B: `gkmas-ocr-pipeline/.codex/rules/review.rules` 新規作成 (§2.5)
- 3-C: `gkmas-ocr-pipeline/docs/style-guide.md` 新規作成 (§2.6、最小 5 項目)
- 3-D: `gkmas-ocr-pipeline/scripts/doc-consistency-check.sh` 新規作成 (§2.7)
- 3-E: `gkmas-ocr-pipeline/scripts/pre-push.sh` 新規作成 (§2.8)
- 完了基準: gkmas-ocr-pipeline で Claude Code 起動 → 自動 load される + pre-push が想定通り fail / pass する

### Phase 4: empirical validation (別セッション、推定 0.5 セッション)
- 4-A: gkmas-ocr-pipeline で「軽微な spec 編集」を 1 タスク Claude Code にやらせ、Codex レビューループが回るか実証 (memory `empirical-validation-for-prompts.md` 適用)
- 4-B: ループで問題発見されたら Phase 1-3 に戻って修正
- 完了基準: 1 タスクが Plan → 実装 → Codex review → fix → merge まで通る

### Phase 5: 仕様書分割の実適用 (gkmas-ocr-pipeline 側、別セッション、推定 1-2 セッション)
> **依存関係**: `ocr_pipeline_spec.md` は 1280 行で §3.1 の閾値 1 (800 行) を**既に超過**しているため、Phase 3 (gkmas-ocr-pipeline 配置) と**並列実施可**。**Phase 3-D (`doc-consistency-check.sh` 配置) より前に Phase 5-A 分割を完了することを推奨**（順序逆転すると 1280 行 1 ファイルに対して機械検証を走らせることになり、分割境界の判断軸を実適用前に固定できないリスクあり）
- 5-A: `ocr_pipeline_spec.md` 1280 行を §3.1 の判断軸で分割 (`docs/spec/` 等のサブディレクトリ作成)
- 5-B: AGENTS.md の参照を更新
- 5-C: `doc-consistency-check.sh` で検証 (Phase 3-D 完了後)

---

## 5. Verification (実装後の検証手段)

実装は別セッションだが、各 Phase 完了時の検証手段を予め定義:

- **Phase 1 完了時**: 各 skill description を白紙 subagent (general-purpose) に渡し、「この skill はいつ発動すべきか」を答えさせて意図と一致するか確認 (empirical-prompt-tuning 適用)
- **Phase 2 完了時**: `claude --version` 起動 → 別 project (例: 適当な空 directory) で `/plan-rally` 等のコマンド入力 → skill が load されることを確認
- **Phase 3 完了時**: gkmas-ocr-pipeline で `claude` 起動 → CLAUDE.md が自動 load + `pre-push.sh` を空 commit で実行 → 期待通り pass / fail を確認
- **Phase 4 完了時**: 1 タスク完了 (PR merge まで) を実証 + 不足 / 過剰が見つかったら memory に記録
- **Phase 5 完了時**: `doc-consistency-check.sh` 全項目 pass + 旧形式参照 0 件 + サブファイル全部に親文書 link 存在

---

## Self-Review (7 観点)

> 本 plan が方針整理 (実装は別セッション) で確定するに足る品質か、`plan-self-review-before-implementation.md` の 7 観点で点検する。hook 正規表現 `^##[[:space:]]+(Self-Review|セルフレビュー)` にマッチする見出しで `## Self-Review` プレフィックスは厳守。

### 1. 技術的前提
- **LSP/Skills Policy 要否**: 本 plan は markdown 編集のみ、`feedback-lsp-skills-policy-hook.md` の適用外明記済み (memory L33)。skill 適用なし
- **rebase 要否**: 本 plan は新規ファイル 1 本作成、既存 docs/plans/ に conflict なし、rebase 不要
- **commit prefix 選択根拠**: `docs(plans): ...` または `chore(plans): ...`。新規 plan ファイル 1 本のみなので `docs(plans):` 採用 (既存 `2026-05-12-phase-2-ui-shortcuts.md` も `feat:` / `docs:` 系で運用)
- **前提条件**: 新プロジェクト `/home/kosei/Projects/gkmas-ocr-pipeline/` は sandbox read 可能 (denyOnly: [] のため)、ただし write は本プロジェクト外なので Phase 3 以降は別途 sandbox 設定変更が必要 (CLAUDE.md「やってはいけないこと」: プロジェクト外保存禁止と整合させるため、gkmas-ocr-pipeline 内での作業時はそちらを cwd にする)

### 2. スクリプト詳細
本 plan はスクリプト編集を含まないが、Phase 3-4/3-5 で新規作成する `doc-consistency-check.sh` / `pre-push.sh` の仕様 (本 plan §4 Phase 3-D/3-E 参照) は:
- `set -euo pipefail` 必須 (memory `feedback-bash-wrap-exit-code-capture.md` の罠回避 — `bash; echo "---"; echo $?` で `$?` が最後の echo の exit code を拾う罠、本セッションでも何度か被弾)
- パス指定は absolute path or `$(git rev-parse --show-toplevel)` 起点 (trailing slash 揺らぎ回避)
- 実行権限 mode 755 (`chmod +x`)
- 既存 `inventory-system/scripts/doc-consistency-check.sh` の構造を参考、ただし Python project 用に最小 5 項目から開始 (memory `feedback-non-it-user-feature-minimal-build.md` の最小ビルド原則 — hidden/advanced 機能は Verification + Codex P1/P2=0 + CI green に固定して作り込み最小化)

### 3. ドキュメント修正
- **編集対象 line の重複/矛盾**: 本 plan は新規ファイル 1 本のみ。既存 inventory-system 内 docs との重複なし
- **link 参照の影響範囲**: 本 plan 内で参照する memory ファイル (44 件、§1 Layer A 表 + §3.1 + 各 Self-Review 観点) は全て inline code 形式で記載済 (memory `feedback-diff-example-inline-code.md` 遵守、markdown link 形式回避で doc-consistency R3 fail 防止 — PR #49 で被弾した経緯あり、memory `feedback-archive-relative-path-conversion.md` も同根の判断軸)
- **archive 影響**: 本 plan 完了後は `docs/archive/plans/2026-05-17-knowledge-transfer-to-gkmas-ocr.md` に移動 (memory `plan-archive-discipline.md` + memory `feedback-archive-relative-path-conversion.md` 遵守 — absolute path → relative path 変換必須)

### 4. 検証計画
- **本 plan 自体の検証**: doc-consistency-check.sh の `--target plan` で機械検証 (`./scripts/doc-consistency-check.sh --target plan docs/plans/2026-05-17-knowledge-transfer-to-gkmas-ocr.md`)
- **Self-Review 検証**: `check-plan-on-exit.sh` が ExitPlanMode 時に自動発動、本 §6 セクションを検知して deny block を回避
- **Plan rally**: 「方針整理のみ、実装は別セッション」かつ「複数 step プランではあるが各 step が別 plan に細分化される」ため、本 plan に対する Plan agent ラリーは不要と判断。**実装セッション側 (Phase 1 等) で Plan agent ラリーを必ず実施** (`feedback-plan-rally-required-before-exit.md` 遵守)。本 plan 内でこの判断を明示
- **CI 予測**: docs/plans/ 配下の新規ファイル commit のみ、CI への影響なし
- **pre-push hook**: `scripts/pre-push.sh` 発動 → ① cargo (該当変更なしで pass) + ② doc-consistency (新規 plan を `--target plan` で検証) + ③ typedInvoke (該当変更なしで pass) + ④ env safety (該当変更なしで pass)

### 5. 後処理
- **memory 監査の判断基準**: 本 plan は新規 memory 作成を伴わない (memory 化は §4 Phase 1-A で実施予定の `feedback-spec-doc-split-judgment.md` 1 件のみ)、本セッション完了時の memory 軽量監査不要 — post-tool hook reminder の対応は本 plan §6 (実行制約) のスコープ規律で「本 plan では実装しない」と明示
- **sentinel 更新**: `~/.claude/projects/-home-kosei-Projects-inventory-system/memory/.last_audit` の更新は別途タイミング (今は触らない)。本 plan 完了時に Phase 1-A 着手前のチェックポイントとして次セッションで touch 検討
- **memo.md / plan archive**: 本 plan は今日完了時点では active (§4 Phase 1-5 が未着手)、archive は Phase 5 全完了後。memory `plan-archive-discipline.md` の規約に従い `docs/archive/plans/` に移動 + memory `feedback-archive-relative-path-conversion.md` で相対パス変換必須

### 6. 実行制約
- **Claude が勝手にやらないこと**: マージ / force push / shared state 変更を本 plan の範囲では一切行わない
- **承認が必要 (Phase 2)**: `~/.claude/CLAUDE.md` / `~/.claude/skills/` / `~/.claude/hooks/` への書き込みは、現セッションの sandbox `write.allowOnly` リスト (`/dev/...` / `/tmp/claude` / `.` / `$TMPDIR` / `~/.cargo` / `~/.rustup` / `~/.npm` / `~/.cache` / `/tmp` / `~/.claude/projects/-home-kosei-Projects-inventory-system/memory` のみ) **に含まれない**ため、Phase 2 着手前に sandbox 設定変更 (例: `.claude/settings.local.json` で `~/.claude/skills` / `~/.claude/hooks` を allow に追加) のユーザー明示承認が必要。`~/.claude/settings.json` 自体は `denyWithinAllow` 配下なので Bash 経由編集禁止、Edit tool 経由のみ
- **承認が必要 (Phase 3)**: gkmas-ocr-pipeline (`/home/kosei/Projects/gkmas-ocr-pipeline/`) への書き込みは、別 project への書き込みなのでセッション開始時にユーザー明示承認 + cwd 切替必要 (CLAUDE.md「やってはいけないこと」: プロジェクト外保存禁止と整合させるため、gkmas-ocr-pipeline 内での作業時はそちらを cwd にする)
- **scope 規律**: 本 plan は「方針整理」スコープ厳守、§1 Layer A の memory 全 44 件 (本 plan で追加した 4 件含む) の skill 化や hook 汎用化は本 plan では実装しない (memory `feedback-pr-merge-gate-scope-discipline.md` 遵守 — Round 2+ clean PR で品質改善を merge gate に組み込む誘惑は scope 膨張 anti-pattern、別 PR/別 plan に分割)

### 7. コミット分割
- **本 plan ファイルの commit**: 単一 commit `docs(plans): 2026-05-17 知見移植 plan を docs/plans/ に追加` (memory `feedback-plans-sync-commit-milestone-only.md` の節目原則に従い、方針整理完了は節目に該当)
- **Plans.md 反映**: 本 plan は inventory-system の Backlog にあるべき (新プロジェクトへの知見移植) → `Plans.md` Backlog に 1 行追記する必要あり (`[Plans.md 反映]` hook 要求対応)。本 commit に同梱 or 直後の commit で対応。memory `feedback-plans-md-task-selection-with-user-context.md` の判断軸 (実利用者業務頻度別軸評価) からは、本 plan の Phase 1 着手優先度はユーザー判断待ち
- **依存**: なし、独立 commit (本 plan §4 Phase 0 完了に相当)

---

## 7. 未確定事項

- gkmas-ocr-pipeline 側で `CLAUDE.md` の代わりに既存 `AGENTS.md` を主軸にするか? AGENTS.md は Codex / Claude Code 両方が読む慣習なので、CLAUDE.md と AGENTS.md の二重管理を避けたいかもしれない (Phase 3-A 着手時に確認)
- `~/.claude/CLAUDE.md` 200 行制限を超える場合の優先順位 (Phase 2-A 着手時に実測)
- 既存 hook (`.claude/hooks/check-plan-on-exit.sh` 等) の汎用化リファクタコスト (Phase 2-C 着手時に diff 実測)
- Phase 4 empirical validation で「1 タスク」として何を選ぶか (Phase 4 着手時にユーザーと相談)

---

## 関連 memory / docs

- inventory-system 側:
  - `~/.claude/projects/-home-kosei-Projects-inventory-system/memory/MEMORY.md` (memory index)
  - `docs/DOC_STYLE_GUIDE.md` (文書スタイルガイド)
  - `scripts/doc-consistency-check.sh` (機械検証 19 項目)
  - `.claude/hooks/check-plan-on-exit.sh` (Plan mode 終了時検証)
- gkmas-ocr-pipeline 側:
  - `docs/ocr_pipeline_spec.md` (1280 行、分割対象)
  - `AGENTS.md` (Codex 用 agent guide)
  - `.codex/config.toml` / `.codex/rules/default.rules`
