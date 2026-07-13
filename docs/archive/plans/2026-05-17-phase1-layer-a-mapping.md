# Phase 1-B/1-C: Layer A 振り分け作業表

> **親 plan**: [2026-05-17-knowledge-transfer-to-gkmas-ocr.md](2026-05-17-knowledge-transfer-to-gkmas-ocr.md) §1 + §2
> **作成日**: 2026-05-17
> **ステータス**: Phase 1-B (再読 + 要約) と Phase 1-C (振り分け cut-line 確定) のマージ作業ファイル
> **Phase 1 完了時の扱い**: 親 plan §1〜§2 に「振り分け結果サマリ表」を追記したうえで本ファイルを `docs/archive/plans/` に移送

---

## 1. 振り分け先カテゴリ

`claude-md-layering-principle.md` の 3 択判定順を全 Layer A memory に適用する:

1. **機械強制可能** → `~/.claude/hooks/` global hook で deny block (汎用 hook 化)
2. **ドキュメント化済 / 詳細展開必要** → `~/.claude/skills/<name>/SKILL.md` 経由で trigger load (auto-load なし)
3. **プロンプト必須** → `~/.claude/CLAUDE.md` global に直書き (200 行制限あり、Critical のみ)

`claude-md-externalization-token-effect.md` 補足: 「`.claude/rules/` への外出しは auto-load 対象でトークン削減にならない」。skill の trigger description 経由 load が本筋。

統合 skill 候補 (親 plan §2.2 + 本作業で精査):

| ID | skill 名 | 主題 |
|----|---------|------|
| A | `claude-codex-review-loop` | Codex review 反復ループの作法 |
| B | `plan-mode-discipline` | Plan mode と Self-Review の規律 |
| C | `pr-workflow-hygiene` | PR / Plans.md / CI 運用の衛生 |
| D | `engineering-judgment-axioms` | 工学的判断軸 (bias / 検証 / OSS / 推奨) |
| E | `naming-and-design-axioms` | 命名・設計の判断軸 (CLAUDE.md 圧縮 / 移行ラッパー / 設計書分割) |

---

## 2. Critical (9 件) — CLAUDE.md global 必須

CLAUDE.md global に 1-2 行で骨格を残し、skill で詳細展開する。一部は hook で機械強制継続。

| # | memory | 要約 | CLAUDE.md | skill | hook |
|---|--------|------|-----------|-------|------|
| 1 | `plan-self-review-before-implementation` | 複数 step プランは ExitPlanMode 前に 7 観点 (prereq/scripts/docs/verify/post/constraints/commit) セルフレビュー | ○ | B | `check-plan-on-exit.sh` (Self-Review 検証) |
| 2 | `feedback-plan-rally-required-before-exit` | ExitPlanMode 前に Plan agent ラリーで plan 本体 critique、新規指摘 0 まで反復 | ○ | B | `check-plan-on-exit.sh` D-1 (subagent log 確認) |
| 3 | `feedback-plan-mode-recursive-refinement` | 多発失敗 / context 大 / hook 通過違和感の 3 トリガーで plan 再点検 | ○ | B | — |
| 4 | `feedback-self-review-mechanical-addition-anti-pattern` | Self-Review 形式的追加 (見出しのみ) は即 reject、各観点 100 字以上 + 行番号/memory 参照 | ○ | B | `check-plan-on-exit.sh` (内容検査) |
| 5 | `feedback-codex-p1-empirical-defense` | Codex P1 致命指摘は実証で裏取り、主張と修正方向の正誤を分けて判定 | ○ | A | — |
| 6 | `feedback-claude-self-bias-blind-spot` | 自己 bias 自覚、機械的強制 (hook deny / pre-condition gate) でしか質担保できない | ○ | D | — |
| 7 | `feedback-memory-rule-needs-hook-enforcement` | memory rule の限界、重要な実行手順は hook で deny block する設計に倒す | ○ | D | — |
| 8 | `feedback-subagent-retry-proposal-verification` | subagent の retry/再実行提案は鵜呑みにせず必要性を自分で検証 | ○ | D | — |
| 9 | `review-convergence-pattern` | 機械チェックで潰せる問題は PR レビュー前に潰す (fmt/clippy/test + L1/L2 + doc-consistency) | ○ | D | — |

**CLAUDE.md global への配置試案 (1 セクション = 1 トピック、計 9 段落):**

```markdown
## Claude × Codex 反復スタイルの品質ゲート

### 1. Plan 提出前のセルフレビュー
複数 step プランは ExitPlanMode 前に 7 観点 (技術前提 / スクリプト詳細 / ドキュメント修正 / 検証計画 / 後処理 / 実行制約 / コミット分割) で点検。各観点 100 字以上 + 行番号/memory 参照必須。形式的見出しのみは即 reject (skill: plan-mode-discipline)。

### 2. Plan rally
ExitPlanMode 前に Plan agent を独立 context で起動し plan 本体を critique、新規指摘 0 まで反復。多発失敗 / context 大 / hook 通過違和感の 3 トリガー (skill: plan-mode-discipline)。

### 3. Plan 再帰精査
プラン段階で潰せる手戻りは plan 段階で潰す。Plan agent ラリーで実例 35 件発見の前例あり (skill: plan-mode-discipline)。

### 4. Codex P1 致命指摘の扱い
鵜呑みにせず実証で裏取り。主張の正誤と修正方向の正誤を分けて判定。PR comment で transparency (skill: claude-codex-review-loop)。

### 5. subagent retry 提案の検証
subagent が retry / 再実行を提案しても必要性を自分で検証。完全 noise の可能性あり (skill: engineering-judgment-axioms)。

### 6. 機械チェック先行原則
fmt / clippy / test + 設計書整合 + L1/L2 で潰せる問題は PR レビュー前に全て潰す。差分縮小と reviewer 集中力温存 (skill: engineering-judgment-axioms)。

### 7. 自己 bias と hook 強制
Claude は自己 bias に気付けない、機械的強制 (hook deny / pre-condition gate) でしか質担保できない設計原理。memory rule では reminder 不足 (skill: engineering-judgment-axioms)。
```

→ 推定 30 行強。既存 CLAUDE.md global の他セクション (記憶システム優先順位、Agent Teams Lite Orchestrator) と合わせて 200 行制限内に収まるか、Phase 2-A 着手時に実測。

---

## 3. High (9 件) — skill 配置

CLAUDE.md には書かない、各 skill で詳細展開。

| # | memory | 要約 | skill |
|---|--------|------|-------|
| 10 | `codex-review-workflow` | PR レビューは Codex app、codex-plugin-cc 不採用 | A |
| 11 | `codex-non-blocker-incorporation` | 非 blocker / 任意改善指摘は軽量 (~10 min) + PR スコープ内 + 3 round 以内なら同 PR で潰す | A |
| 12 | `feedback-codex-drift-fix-grep-all-locations` | drift 系指摘は対象 keyword を repo 全体 grep して全箇所一括修正、ピンポイント修正は次 round で同種残存 | A + C |
| 13 | `feedback-status-sync-pr-keyword-grep-comprehensive` | status sync PR は future-tense / progress-tense 系 keyword 群を open 前に一括 grep して全置換 | C |
| 14 | `feedback-pr-merge-gate-scope-discipline` | Round 2+ clean PR で merge gate スコープ膨張 anti-pattern、別 PR 分割 + transition design で同等価値 | C |
| 15 | `claude-md-consolidation-principle` | CLAUDE.md は読み手 Claude 想定で直書き / 最上級ルール扱い、可読性配慮不要 | E |
| 16 | `claude-md-externalization-token-effect` | `.claude/rules/` 外出しは auto-load 対象でトークン削減にならない、skill trigger load 経由が本筋 | E |
| 17 | `claude-md-layering-principle` | CLAUDE.md から削る移行先判断: 機械強制→Permissions/hooks / docs / CLAUDE.md 残し の 3 択判定順 | E |
| 18 | `context-loading-budgets` | CLAUDE.md / rules / skill の容量推奨と context 消費 (公式 docs 出典) | E |

---

## 4. Mid (27 件) — skill or docs 配置

| # | memory | 要約 | skill |
|---|--------|------|-------|
| 19 | `feedback-handoff-prompt-on-session-reset` | 仕切り直し / context リセット示唆時は引継ぎ状態整理 + 新セッション貼り付け用プロンプト併記 | C |
| 20 | `feedback-recommend-with-explicit-basis` | 推奨・数字提案は bias 自覚 + 明示根拠とセット、感覚値は正直に認める | D |
| 21 | `empirical-validation-for-prompts` | 重要指示文は empirical-prompt-tuning で白紙 subagent 評価してから本番投入 | D |
| 22 | `feedback-ci-polling-use-gh-watch` | bg CI 完了待ちは `gh pr checks <N> --watch`、自前 polling は stall 事故あり | C |
| 23 | `feedback-plans-sync-commit-milestone-only` | Plans.md 更新リアルタイム、commit は節目のみ (PR/round/フェーズ境界/タグ) | C |
| 24 | `feedback-naming-must-match-reality` | 表示名/識別子と実態の不一致を強く嫌う、移行コスト見合わないケースは「表示名 override」を最優先提案 | E |
| 25 | `feedback-self-trace-expression-breaks-sync-loop` | PR の HEAD/chain 表記を「最新機能修正 commit」と「docs sync (self-trace)」で分離 | A |
| 26 | `feedback-sensitive-filter-narrow-not-broad` | sensitive path filter は credential 複合語列挙 + 単独語条件で絞る (broad wildcard 回避) | E |
| 27 | `feedback-github-contents-api-utf8-transcoding` | GitHub `/contents/` API は UTF-8 transcoding して返す、真の raw blob は `/git/blobs/{sha}` 経由 | A |
| 28 | `feedback-baseline-monotonic-ci-both-directions` | 漸減すべき指標の baseline CI は増加だけでなく減少も fail 扱い | E |
| 29 | `feedback-migration-phase-wrapper-with-deadline` | 移行期ラッパーは純度優先ではなく期限付き両立、撤去期限はタグ gate に紐付け | E |
| 30 | `feedback-literal-union-as-retirement-list` | TypeScript literal union 自体を撤去リストとして運用する自己終了設計 | E |
| 31 | `feedback-bash-wrap-exit-code-capture` | `bash; echo "---"; echo $?` の罠 ($? が最後の echo の exit code を拾う) | D |
| 32 | `oss-tool-anomaly-known-issue-search` | OSS tool 異常時は新規起票より先に `gh issue list --search` で既知 issue を 5 分で検索 | D |
| 33 | `tech-selection-learning-investment` | 技術選定は spike / prototype で実装検証し ADR 資産化 | D |
| 34 | `context-size-quality-threshold` | context 300k+ で実施した本体変更は次セッション再レビュー推奨 | D |
| 35 | `feedback-active-plan-in-docs` | プランは `docs/plans/`、完了時は `docs/archive/plans/`、Plan mode 指定パスに流されない | B |
| 36 | `plan-archive-discipline` | 完了プランは `docs/archive/plans/` に即アーカイブ | B |
| 37 | `feedback-archive-relative-path-conversion` | archive 時は絶対パス→相対パス変換必須 (doc-consistency R3 fail 再発防止) | B + C |
| 38 | `plan-stage-quality-check` | プラン段階で設計書突合徹底、実装前に不整合を潰す | B |
| 39 | `feedback-plan-mode-for-fix-proposals` | 疲弊セッション commit の再レビュー後の修正は Plan agent + 検証 + plan ファイルで練ってから実装 | B |
| 40 | `feedback-commit-zero-plan-apply-immediately` | commit-0 plan で指示したファイル編集は同 session 内で実適用 (defer すると drift) | B + C |
| 41 | `feedback-diff-example-inline-code` | docs/plans/ 内の差分例示は inline code、markdown link 回避 (doc-consistency R3 fail 防止) | B |
| 42 | `feedback-plans-md-task-selection-with-user-context` | Plans.md「次着手」を機械採用せず実利用者業務頻度を別軸評価、両軸併記で user 判断を促す | C |
| 43 | `feedback-plans-next-session-entry-temporary` | Plans.md の Next Session Entry / Hand-off 系テキストは一時メモで作業完了後に明示削除 | C |
| 44 | `feedback-draft-first-then-verify-against-source` | 新テンプレ初適用は draft-first verify-after が実証的になりうる判断軸 | D |
| 45 | `feedback-non-it-user-feature-minimal-build` | 非 IT 利用者向け hidden/advanced 機能は Verification + P1/P2=0 + CI green に固定、作り込み最小 | E |

**新規 (Phase 1-A で追加):**

| # | memory | 要約 | skill |
|---|--------|------|-------|
| 46 | `feedback-spec-doc-split-judgment` | 肥大化設計書/仕様書を親索引 + サブ詳細の 2 層に分割する判断軸 (タイミング 5 条件 + 境界 5 観点 + 機械検証 3 項目) | E |

---

## 5. skill 別件数集計

| skill | 件数 | 主要 memory |
|-------|------|-------------|
| A. `claude-codex-review-loop` | 7 | codex-workflow / non-blocker / drift fix grep / status sync grep / P1 empirical defense / self-trace / github-contents |
| B. `plan-mode-discipline` | 11 | self-review / plan rally / recursive refinement / mechanical addition / active-plan-in-docs / plan-archive / archive-relative-path / plan-stage / plan-mode-for-fix / diff-inline / commit-zero |
| C. `pr-workflow-hygiene` | 9 | merge-gate-scope / plans-sync-commit / CI-polling / handoff-prompt / status-sync-grep (重) / plans-task-selection / next-session-temporary / commit-zero (重) / archive-relative-path (重) |
| D. `engineering-judgment-axioms` | 11 | self-bias / memory-rule-needs-hook / subagent-retry / review-convergence / recommend / empirical-validation / OSS-anomaly / tech-selection / context-size / bash-wrap / draft-first |
| E. `naming-and-design-axioms` | 11 | naming / migration-phase-wrapper / literal-union / baseline-monotonic / sensitive-filter / non-IT-minimal / claude-md-consolidation/externalization/layering / context-loading-budgets / spec-doc-split-judgment |

重複 (複数 skill に跨る) memory: drift-fix-grep / archive-relative-path / commit-zero / status-sync-grep。これらは主軸 skill に本文、副 skill には「関連参照」リンクで対応。

---

## 6. hooks 振り分け

| hook | 機械強制対象 | 配置先 |
|------|-------------|--------|
| `check-plan-on-exit.sh` | ExitPlanMode 前の Self-Review 7 観点存在 + 内容検査 + Plan agent ラリー実施履歴 (D-1) | `~/.claude/hooks/` global (汎用化リファクタ要、Phase 2-C) |
| `suggest-subagent-for-plan.sh` | additionalContext で subagent 推奨/不適合/リマインダ注入 | `~/.claude/hooks/` global (汎用化リファクタ要) |
| `memory-capture-feedback.sh` | トリガー語 (覚えておいて等) 検知 → additionalContext 注入 | `~/.claude/hooks/` global (トリガー語は汎用、注入先パスのみプロジェクト相対化必要) |

汎用化リファクタの主な変更点 (Phase 2-C で着手):
- inventory-system 固有のパス参照 (例: `.claude/state/`, `docs/plans/`) を環境変数 or git rev-parse 経由に置換
- Plans.md 依存があれば project local hook で wrap (`.claude/hooks/` プロジェクト個別配置で global を call) するパターンを採用

---

## 7. Phase 1-D 着手時の前提

本振り分け表を input として:
- skill A〜E の SKILL.md draft を `~/.claude/skills/<name>/SKILL.md` 形式で書く
- 各 skill の description は trigger 語を明確に書き、白紙 subagent 評価 (empirical-prompt-tuning) で「いつ発動すべきか」を答えさせて意図と一致するか確認 (親 plan §5)
- 重複 memory は主軸 skill に本文、副 skill に「関連参照: 主軸 skill 名 + 該当 memory 名」のリンクで対応

Phase 1 完了基準 (親 plan §4) の照合:
- ✅ 5 skill の draft が `~/.claude/skills/<name>/SKILL.md` に存在 — 1-D で達成予定
- ✅ 各 skill が empirical-prompt-tuning で白紙 subagent 評価 pass — 1-D の最後で実施
- ✅ 振り分け cut-line が文書化済 — **本ファイルで達成 (Phase 1-C 完了)**

---

## 8. 判断ログ

| 日付 | 判断 | 理由 |
|------|------|------|
| 2026-05-17 | Critical 9 件は全て CLAUDE.md + skill 両配置 | Critical 級は「忘れたら致命」なので auto-load 必須 (CLAUDE.md)、詳細は skill 経由 trigger load で重複を許容 |
| 2026-05-17 | claude-md 系 4 件 + spec-doc-split-judgment を skill E に統合 | 「メタな設計判断 (CLAUDE.md / docs の構造判断)」は 1 skill に集約した方が trigger が明確 (「CLAUDE.md 編集」「設計書分割」「docs 構造変更」のいずれかで発動) |
| 2026-05-17 | drift-fix-grep / archive-relative-path / commit-zero / status-sync-grep は複数 skill 跨り | 主題 (PR drift fix / archive 手順 / commit-0 plan / status sync PR) が複数 skill の対象に該当、主軸 skill に本文 + 副 skill に link 参照で対応 |
| 2026-05-17 | hook 3 本は Phase 2-C で汎用化リファクタ後 global 化 | inventory-system 固有のパス参照を git rev-parse / 環境変数経由に置換する必要あり、project local hook で wrap するパターン採用 |
