# Phase 1-D: 統合 skill 5 つの draft

> **親 plan**: [2026-05-17-knowledge-transfer-to-gkmas-ocr.md](2026-05-17-knowledge-transfer-to-gkmas-ocr.md) §2.2
> **mapping file**: [2026-05-17-phase1-layer-a-mapping.md](2026-05-17-phase1-layer-a-mapping.md) §2-5
> **作成日**: 2026-05-17
> **ステータス**: Phase 1-D draft、Phase 2 で `~/.claude/skills/<name>/SKILL.md` に分割 cut+paste 予定
> **memory path 表記**: 本 draft では project-scoped 絶対パスで書く。Phase 2 で global 配置時に「slug + 検索手順」形式に書き換え (gkmas-ocr-pipeline でも同じ slug で memory を作る前提)

---

## A. claude-codex-review-loop

```markdown
---
name: claude-codex-review-loop
description: Codex review 反復スタイルで Claude が踏む地雷の回避作法集 (P1 empirical defense / drift fix grep / non-blocker incorporation / GitHub /contents/ API 罠 / self-trace 表記分離)。Codex から PR review コメントが来た、または PR open 直後で Codex review を待つ場面で発動。
---

# Claude × Codex Review Loop

## Purpose

Codex app が PR review の主軸 (`codex-review-workflow.md` 採用、codex-plugin-cc 不採用)。Codex 指摘への応答品質を上げる作法と、Codex 起因の罠 (API 仕様 / 表記ループ) を集約。

## When to Invoke

- Codex から PR review コメント (P1 / P2 / P3) が来た直後
- 自分が PR を open した直後、Codex review を待つ間に最終確認したいとき
- PR の status sync / drift 系修正を進めるとき
- GitHub API (`/contents/` 等) で encoding 判定する場面
- PR description / commit message に HEAD / chain 表記を入れる場面

## Rules

### 1. Codex P1 致命指摘は実証で裏取り

鵜呑みにしない。主張の正誤と修正方向の正誤を**別軸で判定**する。

- 実例: PR #57「主張誤り→防御採用」、PR #58 Round 3「主張正・修正方向誤り→実証で別正解選定」、両方とも 3 round 内 close
- 手順: (1) 主張のロジックを実コードで検証、(2) 提示された修正方向を実装してみて副作用を確認、(3) 両方の結論を PR comment に transparency 付きで記述

### 2. drift 系指摘は repo 全体 grep で全箇所一括修正

ピンポイント修正は次 round で同種残存検出されて 1 round 浪費 (PR #53 Round 1→2 で被弾)。

- 手順: 指摘の keyword を `rg` で repo 全体検索 → 該当箇所を全部一覧 → 1 commit で全箇所修正
- 関連: status sync PR は specifically future-tense / progress-tense keyword 群を open 前に一括 grep (skill C `pr-workflow-hygiene` 参照)

### 3. non-blocker / 任意改善指摘は同 PR 内で潰す条件

軽量 (~10 min) + PR スコープ内 + 3 round 以内、の 3 条件全て満たすなら同 PR で潰す。それ以外は別 PR に分割。

- 3 round 超過は scope 膨張 anti-pattern (skill C `pr-workflow-hygiene` の merge gate scope discipline 参照)

### 4. GitHub `/contents/` API は UTF-8 transcoding 罠

text file の bytes を UTF-8 transcoding して返す (GitHub Docs 未明示)。真の raw blob は `/git/blobs/{sha}` 経由。

- 実例: PR #62 R3-4 で実証、R5 で受容
- 手順: Codex 等 reviewer が `/contents/` で encoding 判定して指摘してきたら、`/git/blobs/{sha}` で再取得した bytes を提示して反証

### 5. PR HEAD / chain 表記は self-trace 分離

「最新機能修正 commit」と「docs sync (self-trace)」を分離して、docs 同期の永久ループを構造的に回避。

- 実例: PR #58 Round 2 P3 で確立、レビュアー推奨解 (B)
- 手順: PR description で "Latest feature commit: SHA1" と "Docs sync (self-trace): SHA2" を別行で明記

## Anti-patterns

- Codex P1 を主張内容だけで採用 / 拒否する (実証なし)
- drift 指摘をピンポイント修正 (同種残存検出で round 浪費)
- non-blocker を 3 round 超過まで引きずる (scope 膨張)
- `/contents/` API の Content-Encoding を信用する
- PR description で最新 commit と docs sync commit を同じ行に並べる (chain 表記が次 round で self-trace されて永久ループ)

## Related memory (Phase 2 で slug + 検索手順形式に書き換え)

- `feedback-codex-p1-empirical-defense.md`
- `codex-review-workflow.md`
- `codex-non-blocker-incorporation.md`
- `feedback-codex-drift-fix-grep-all-locations.md`
- `feedback-github-contents-api-utf8-transcoding.md`
- `feedback-self-trace-expression-breaks-sync-loop.md`
```

---

## B. plan-mode-discipline

```markdown
---
name: plan-mode-discipline
description: Plan mode と Self-Review の規律。ExitPlanMode 前の 7 観点セルフレビュー / Plan agent ラリー / プラン再帰精査 / plan archive 規律 / 疲弊セッション後の修正提案の扱い。Plan mode に入る前 / 出る前 / 完了 plan を archive するときに発動。
---

# Plan Mode Discipline

## Purpose

複数 step プラン段階で潰せる手戻りは plan 段階で潰す。Plan mode を「実装の前段階」ではなく「品質を確定させる工程」として運用する規律集。

## When to Invoke

- Plan mode に入った直後 (`ExitPlanMode` 前の点検)
- ExitPlanMode を呼ぶ直前 (Self-Review 7 観点 + Plan agent ラリー)
- 多発失敗 / context 大 / hook 通過違和感を感じたとき (再帰精査トリガー)
- 完了した plan を archive するとき
- 疲弊セッション commit の再レビュー後で修正提案を作るとき

## Rules

### 1. ExitPlanMode 前の Self-Review 7 観点

複数 step プランは ExitPlanMode 前に以下 7 観点で点検:

1. **技術的前提**: LSP/Skills Policy 要否 / rebase 要否 / commit prefix 選択根拠 / 前提条件
2. **スクリプト詳細**: `set -euo pipefail` / 絶対パス / 実行権限 / 既存スクリプト参照
3. **ドキュメント修正**: 編集対象 line の重複 / link 参照の影響範囲 / archive 影響
4. **検証計画**: 自動検証手段 / Self-Review 検証 / Plan rally / CI 予測 / pre-push hook
5. **後処理**: memory 監査 / sentinel 更新 / memo.md / plan archive
6. **実行制約**: Claude が勝手にやらないこと / 承認が必要な範囲 / scope 規律
7. **コミット分割**: commit 単位 / Plans.md 反映 / 依存

各観点は **100 字以上 + 行番号 / memory 参照必須**。形式的見出しのみ追加は即 reject (`feedback-self-review-mechanical-addition-anti-pattern.md`)。

1-3 ファイル 10 分以内の軽微タスクは適用除外可、ただし plan 本文に「Self-Review: 適用除外」マーカー必須。

### 2. Plan rally (ExitPlanMode 前の機械的強制)

ExitPlanMode 前に Plan agent を独立 context で起動して plan 本体を critique、新規指摘 0 まで反復。

- 機械強制: `check-plan-on-exit.sh` D-1 check で直近 30 分の subagent log 確認、ラリー実施履歴なしは deny block
- 標準フロー: `/plan-rally` skill 経由
- 本セッション実績 (memory `feedback-plan-mode-recursive-refinement.md`): 4 段ラリーで 35 件発見

### 3. プラン再帰精査の 3 トリガー

以下のどれかを感じたら Plan agent で plan 本体を再点検、新規指摘 0 まで反復:

- **多発失敗**: 同種の失敗が複数 round 繰り返している
- **context 大**: 当該 plan の処理範囲が 300k+ context を要求している
- **hook 通過違和感**: hook で fail せず通ったが「これで本当に通ってよいのか?」と感じる

### 4. plan 配置と archive 規律

- 作業中 plan: `docs/plans/`
- 完了 plan: `docs/archive/plans/` に**即**移動 (`plan-archive-discipline.md`)
- Plan mode harness が `~/.claude/plans/` を指定しても流されない (`feedback-active-plan-in-docs.md`)
- archive 時は **absolute path → relative path 変換必須** (doc-consistency R3 fail 再発防止、PR #49 で被弾、`feedback-archive-relative-path-conversion.md`)

### 5. 疲弊セッション commit の修正は Plan agent + 検証 + plan ファイル経由

疲弊セッション commit の再レビュー後の修正案は、いきなり実装に入らず Plan agent + 検証 + plan ファイルで練ってから実装 (`feedback-plan-mode-for-fix-proposals.md`)。

### 6. プラン段階で設計書突合徹底

実装前に設計書 (`docs/` 配下の Architecture / Function Design / DB Design 等) と plan の整合性を確認し、不整合を plan 段階で潰す (`plan-stage-quality-check.md`)。

### 7. commit-0 plan の指示は同 session 内で実適用

commit-0 plan (plan ファイルに「このファイルを編集」と書いた指示) は、その session 内で実適用する。defer すると drift して次 round で被弾 (PR #53 で被弾、`feedback-commit-zero-plan-apply-immediately.md`)。

### 8. plan 内 diff 例示は inline code、markdown link 回避

`docs/plans/` 内の差分例示は markdown link `[text](url)` でなく inline code `` `path` `` で書く。doc-consistency R3 fail 回避 (`feedback-diff-example-inline-code.md`)。

## Anti-patterns

- Self-Review 見出しだけ追加して内容空白 (即 reject 対象)
- Plan rally を skip して ExitPlanMode (hook で deny block 想定)
- 再帰精査トリガーを感じても進める (後で手戻り増加)
- 完了 plan を `docs/plans/` に置きっぱなし
- archive 時 absolute path のまま (R3 fail)
- 疲弊セッション後の修正をいきなり実装 (再失敗パターン)
- 設計書突合を実装後にやる (不整合の発見が遅れる)
- commit-0 plan を defer (drift する)
- plan 内に markdown link で diff 例示 (R3 fail)

## Related memory (Phase 2 で slug + 検索手順形式に書き換え)

- `plan-self-review-before-implementation.md`
- `feedback-plan-rally-required-before-exit.md`
- `feedback-plan-mode-recursive-refinement.md`
- `feedback-self-review-mechanical-addition-anti-pattern.md`
- `feedback-active-plan-in-docs.md`
- `plan-archive-discipline.md`
- `feedback-archive-relative-path-conversion.md`
- `plan-stage-quality-check.md`
- `feedback-plan-mode-for-fix-proposals.md`
- `feedback-commit-zero-plan-apply-immediately.md`
- `feedback-diff-example-inline-code.md`
```

---

## C. pr-workflow-hygiene

```markdown
---
name: pr-workflow-hygiene
description: PR / Plans.md / CI 運用の衛生規律 (merge gate scope / plans sync commit / CI polling / handoff prompt / status sync grep / plans task selection / next session temporary)。PR open 前後 / merge 直前 / Plans.md 編集 / CI 完了待ちの場面で発動。
---

# PR Workflow Hygiene

## Purpose

PR の取り扱いと Plans.md の運用、CI 待ち、セッション間 hand-off の規律集。Plan mode 単独ではなく「PR を回す全工程」での衛生規律をまとめる。

## When to Invoke

- PR を open する直前 / 直後
- PR merge gate を判定する場面 (round 2+ で scope 膨張の誘惑)
- Plans.md を編集する場面
- CI 完了を待つ場面
- セッション完了 / 仕切り直し / context reset 示唆を受けたとき
- status sync PR (進捗反映 PR) を open する直前

## Rules

### 1. PR merge gate scope discipline

Round 2+ clean PR で「品質改善 (TDD 基盤 / fixture 整備等) を merge gate に組み込む」誘惑は **scope 膨張 anti-pattern**。別 PR 分割 + transition design (fixture path 先払い等) で同等価値を確保する (`feedback-pr-merge-gate-scope-discipline.md`、PR #62 で実例)。

- 判定: 一石二鳥志向は user 判断軸で抑止する方向に倒す

### 2. Plans.md 更新はリアルタイム、commit は節目のみ

Plans.md (進行 task 一覧) は作業ごとに更新するが、commit するのは節目 (PR/round/フェーズ境界/タグ) のみ (`feedback-plans-sync-commit-milestone-only.md`)。

- 中間 commit は noise になる
- 節目 commit に Plans.md の差分をまとめて含める

### 3. status sync PR は keyword grep を open 前に一括実施

status sync PR は future-tense / progress-tense 系 keyword 群を PR open 前に**一括 grep して全置換** (`feedback-status-sync-pr-keyword-grep-comprehensive.md`、PR #55 で 4 round 浪費した反省)。

- 対象 keyword 群 (引用): 未来時制 / 進行時制を表す日本語の語彙、進行ステータス、Phase 着手宣言の定型句 (例として `T-O-D-O` / `未-着-手` 等を全角ハイフンで分解しているが実 grep 対象は普通の連続文字)
- `feedback-codex-drift-fix-grep-all-locations.md` の status sync PR 特化版

### 4. CI 完了待ちは `gh pr checks --watch`

bg CI 完了待ちは `gh pr checks <N> --watch` を使う (`feedback-ci-polling-use-gh-watch.md`)。

- 自前 polling は stall 事故あり
- `--watch` は CI 完了で自動 exit、`run_in_background` 併用で他作業可

### 5. 仕切り直し時は引継ぎ + 新セッション貼り付け用プロンプト併記

session 完了 / context reset 示唆 / 仕切り直しを受けたら、**引継ぎ状態整理 + コピペ可能な新セッション貼り付け用プロンプト**を必ず併記する (`feedback-handoff-prompt-on-session-reset.md`)。

- ユーザーが新セッション開始時に貼り付けるだけで作業継続できる形式
- 含めるべき内容: 完了 commit SHA / 次タスク / 制約 / 承認待ち項目

### 6. Plans.md「次着手」選定は機械採用せず別軸評価

Plans.md「次着手」候補を機械的に採用せず、実利用者業務頻度を別軸評価して両軸併記、user 判断を促す (`feedback-plans-md-task-selection-with-user-context.md`)。

### 7. Plans.md の Next Session Entry / Hand-off は一時メモ

Plans.md の Next Session Entry / Hand-off 系テキストは一時メモで、**作業完了後に明示削除**する。汎用判断軸のみ残す (`feedback-plans-next-session-entry-temporary.md`)。

### 8. archive 時の relative path 変換 (skill B と共通)

archive 時は absolute path → relative path 変換必須 (skill B `plan-mode-discipline` 参照、`feedback-archive-relative-path-conversion.md`)。PR と plan の archive で同じ規律を適用。

### 9. commit-0 plan の同 session 内実適用 (skill B と共通)

commit-0 plan で指示したファイル編集は同 session 内で実適用 (skill B `plan-mode-discipline` 参照、`feedback-commit-zero-plan-apply-immediately.md`)。PR スコープでも同じ。

## Anti-patterns

- Round 2+ で品質改善を merge gate に組み込む (scope 膨張)
- Plans.md 更新ごとに commit (中間 commit noise)
- status sync PR を keyword grep なしで open (round 浪費)
- 自前 sleep loop で CI polling (stall リスク)
- session 仕切り直しで引継ぎプロンプト未併記 (次セッションが context 復元に時間取られる)
- Plans.md 次着手を機械採用 (user 業務頻度を反映しない)
- Hand-off テキストを Plans.md に残しっぱなし (汎用ノイズになる)

## Related memory (Phase 2 で slug + 検索手順形式に書き換え)

- `feedback-pr-merge-gate-scope-discipline.md`
- `feedback-plans-sync-commit-milestone-only.md`
- `feedback-status-sync-pr-keyword-grep-comprehensive.md`
- `feedback-ci-polling-use-gh-watch.md`
- `feedback-handoff-prompt-on-session-reset.md`
- `feedback-plans-md-task-selection-with-user-context.md`
- `feedback-plans-next-session-entry-temporary.md`
- `feedback-archive-relative-path-conversion.md` (skill B 主軸、本 skill は副)
- `feedback-commit-zero-plan-apply-immediately.md` (skill B 主軸、本 skill は副)
- `feedback-codex-drift-fix-grep-all-locations.md` (skill A 主軸、本 skill は副)
```

---

## D. engineering-judgment-axioms

```markdown
---
name: engineering-judgment-axioms
description: 工学的判断軸の集約 (self-bias / memory rule needs hook / subagent retry verification / review convergence / recommend with basis / empirical validation / OSS anomaly known-issue / tech selection learning / context size quality / bash exit code trap / draft-first verify-after)。判断に迷ったとき / 推奨を出すとき / OSS 異常に遭ったとき / 新手法を初適用するときに発動。
---

# Engineering Judgment Axioms

## Purpose

Claude が判断 / 推奨 / 検証 / 学習を行うときの基底判断軸。「自分の bias を自覚する」「機械強制でしか質担保できない」のようなメタな判断軸を集約。

## When to Invoke

- 何かを推奨する / 数字を提案するとき (bias 自覚)
- subagent からの retry / 再実行提案を受け取ったとき
- PR レビュー前の最終チェック (機械チェック先行)
- 重要指示文 (CLAUDE.md / skill description) を新規 / 大改訂したとき
- OSS tool で奇妙な挙動に当たったとき
- 技術選定をするとき
- context が 300k+ を超える本体変更を実施したとき
- bash で exit code を扱う場面
- 新テンプレ / 新方法論を初適用するとき

## Rules

### 1. 自己 bias と hook 強制

Claude は自己 bias に気付けない、機械的強制 (hook deny / pre-condition gate) でしか質担保できない設計原理 (`feedback-claude-self-bias-blind-spot.md`)。reminder では足りない。

- 重要な実行手順は hook で deny block する設計に倒す (`feedback-memory-rule-needs-hook-enforcement.md`)
- memory rule だけでは Claude が忘れる、実例: ExitPlanMode 前 Self-Review 検証 = `check-plan-on-exit.sh`

### 2. subagent retry / 再実行提案は鵜呑みにせず検証

subagent の retry / 再実行提案は必要性を自分で検証する (`feedback-subagent-retry-proposal-verification.md`)。

- 完全 noise の可能性あり (PR #48 tracking retry が完全 noise だった反省)
- 検証手順: subagent の提示する根拠を実コードで再現、再実行で結果が変わるか実測

### 3. 機械チェック先行原則

fmt / clippy / test + 設計書整合 + L1/L2 で潰せる問題は **PR レビュー前に全て潰す** (`review-convergence-pattern.md`)。

- reviewer (Codex / 人間) の集中力を本質的指摘に振り向ける
- 差分縮小で review round 数を減らす

### 4. 推奨・数字提案は bias 自覚 + 明示根拠

推奨 / 数字提案は bias 自覚 + 明示的根拠とセット (`feedback-recommend-with-explicit-basis.md`)。感覚値は正直に「感覚値」と認める。

- 「800 行が閾値」のような数字提案には根拠 (Read tool 制限 / 過去実例) を併記

### 5. 重要指示文は empirical-prompt-tuning で白紙 subagent 評価

CLAUDE.md / 中核 rules / 自作 skill description は empirical-prompt-tuning で白紙 subagent 評価してから本番投入 (`empirical-validation-for-prompts.md`)。

- 自己解釈バイアスを排除した評価が必要
- 「この skill はいつ発動すべきか」を白紙 subagent に答えさせて意図と一致するか確認

### 6. OSS tool 異常時は既知 issue 検索先

OSS tool で奇妙な挙動に当たったら、新規起票より先に `gh issue list --search` で既知 issue を 5 分で検索 (`oss-tool-anomaly-known-issue-search.md`)。

- 重複起票で reviewer の時間を奪わない
- 既知 issue があれば回避策が既に書かれていることが多い

### 7. 技術選定は spike / prototype + ADR 資産化

技術選定は spike / prototype で実装検証し ADR (Architecture Decision Record) として資産化する (`tech-selection-learning-investment.md`)。

- 検討だけで決めない、必ず触る
- ADR は後続セッションが判断を再現できる粒度で書く

### 8. context 300k+ の本体変更は次セッション再レビュー

context 300k+ で実施した本体変更は次セッションで入念な再レビュー推奨 (`context-size-quality-threshold.md`)。

- 大 context 下では LLM attention 劣化 / 判断雑になる
- 次セッションの fresh context で見直す

### 9. bash exit code 罠

`bash -c "command; echo '---'; echo $?"` は `$?` が**最後の echo の exit code** を拾う (`feedback-bash-wrap-exit-code-capture.md`)。

- 正解: `command; rc=$?; echo "---"; echo $rc`
- script 内で exit code を扱うときは必ず変数代入を挟む

### 10. 新テンプレ初適用は draft-first verify-after

新テンプレ / 新方法論の初適用は **原典再読より draft-first verify-after** が実証的になりうる (`feedback-draft-first-then-verify-against-source.md`)。

- 適用条件: 既存プラン / memory が原典の主要視点をカバー済 + リワークコスト小 + 後続適用まで時間余裕あり

## Anti-patterns

- 自己判断を「正しい」と思い込む (bias 自覚なし)
- subagent 提案を即実行 (検証なし)
- PR を機械チェック skip して open (reviewer 集中力を fmt/clippy 系に取られる)
- 推奨を根拠なしで出す (説得力低下)
- 重要指示文を empirical 評価なしで本番投入
- OSS 異常で即新規 issue 起票 (重複)
- 技術選定を spike なしで決定 (後で後悔)
- 300k+ context の判断を次セッションで再レビューしない
- `command; echo $?` で exit code を取る (echo の rc を拾う)
- 新テンプレを毎回原典完全準拠で書く (時間浪費)

## Related memory (Phase 2 で slug + 検索手順形式に書き換え)

- `feedback-claude-self-bias-blind-spot.md`
- `feedback-memory-rule-needs-hook-enforcement.md`
- `feedback-subagent-retry-proposal-verification.md`
- `review-convergence-pattern.md`
- `feedback-recommend-with-explicit-basis.md`
- `empirical-validation-for-prompts.md`
- `oss-tool-anomaly-known-issue-search.md`
- `tech-selection-learning-investment.md`
- `context-size-quality-threshold.md`
- `feedback-bash-wrap-exit-code-capture.md`
- `feedback-draft-first-then-verify-against-source.md`
```

---

## E. naming-and-design-axioms

```markdown
---
name: naming-and-design-axioms
description: 命名・設計の判断軸 (naming must match reality / migration phase wrapper / literal union retirement / baseline monotonic both directions / sensitive filter narrow / non-IT user minimal build / claude-md consolidation/externalization/layering / context-loading-budgets / spec-doc-split-judgment)。CLAUDE.md / skill / docs / 設計書の構造判断 / 命名判断 / 移行ラッパー設計 / フィルタ設計の場面で発動。
---

# Naming and Design Axioms

## Purpose

命名と設計の判断軸を集約。CLAUDE.md / skill / docs / 設計書の構造判断、命名と実態の一致、移行期ラッパーの設計、フィルタの厳格度のような「設計上の判断」を必要とする場面で参照する。

## When to Invoke

- CLAUDE.md / skill / docs の構造を編集するとき
- 識別子 / 表示名を決める / 変更するとき
- 移行期ラッパー (typedInvoke / FallbackCommand 等) を設計するとき
- 撤去予定リストを literal union で表現するとき
- baseline 指標の CI を設計するとき
- sensitive path filter を書くとき
- 非 IT 利用者向け hidden/advanced 機能の完了基準を決めるとき
- 設計書 / 仕様書が肥大化したとき (800 行超 / 2 階層必要 / merge conflict 多発)

## Rules

### 1. 命名と実態の一致を強く優先

表示名 / 識別子と実態の不一致を強く嫌う (`feedback-naming-must-match-reality.md`)。

- 移行コスト見合わないケースは軽量な「表示名 override」を最優先提案
- 自動命名デフォルト (フレームワークの命名規約) には**抗う方向に倒す**
- 例: Tauri command 名と業務概念名がズレるなら command 名を業務概念に寄せる

### 2. 移行期ラッパーは期限付き両立

移行期ラッパーは純度優先ではなく期限付き両立が実務最適、撤去期限はタグ gate に紐付け (`feedback-migration-phase-wrapper-with-deadline.md`)。

- 例: typedInvoke 段階撤去は `v0.8.0-ui-daily` タグ gate で完了
- 撤去期限がない両立は「両立がデフォルト」化する anti-pattern

### 3. literal union を撤去リストとして自己終了設計

TypeScript literal union 自体を撤去リストとして運用する自己終了設計 (`feedback-literal-union-as-retirement-list.md`)。

- 例: `FallbackCommand` literal union が空 (`never`) になったら撤去完了 = literal が CI に効く撤去 marker
- 撤去 marker 専用フィールドを別に持つより literal union がそのまま機能する

### 4. baseline 指標は両方向 fail

漸減すべき指標の baseline CI は**増加だけでなく減少も fail 扱い** (`feedback-baseline-monotonic-ci-both-directions.md`)。

- 増加 fail: 漸減方針からの逸脱
- 減少 fail: baseline 更新漏れ (実は減ってるのに baseline 反映してない = 次回増加検知が機能しない)

### 5. sensitive filter は narrow 設計

sensitive path filter は `*token*` 等の broad wildcard でなく **credential 複合語列挙 + 単独語条件で絞る** (`feedback-sensitive-filter-narrow-not-broad.md`)。

- 例: `tokens.ts` / `tokenizer.json` 等の false positive 回避
- PR #59 P3-1 で確立、29 ケース実証

### 6. 非 IT 利用者向け hidden/advanced 機能は最小ビルド

非 IT 利用者向け hidden/advanced 機能は完了基準を **Verification + Codex P1/P2=0 + CI green** に固定、作り込み最小 (`feedback-non-it-user-feature-minimal-build.md`)。

- 過剰機能追加は anti-pattern
- 8-6 plan 承認後の user 指摘起源

### 7. CLAUDE.md は読み手 Claude 想定で直書き / 最上級ルール扱い

CLAUDE.md は読み手 Claude 想定で直書き / 最上級ルール扱い (`claude-md-consolidation-principle.md`)。

- 可読性は読み手が Claude なので不要 (人間向け改行 / 装飾は最小)
- 「散在させるな」の意味であって「何でも書け」ではない

### 8. CLAUDE.md 外出しは auto-load 対象でトークン削減にならない

CLAUDE.md から `.claude/rules/` への外出しは auto-load 対象なのでトークン削減にならない (`claude-md-externalization-token-effect.md`)。

- 削減したいなら `~/.claude/skills/<name>/SKILL.md` の trigger description 経由 load が本筋
- auto-load 対象を増やすと毎セッション context 圧迫

### 9. CLAUDE.md 圧縮時の 3 択判定順

CLAUDE.md から削るときの移行先判断: (1) 機械強制可能→Permissions / hooks、(2) ドキュメント化済→docs、(3) プロンプト必須→CLAUDE.md (`claude-md-layering-principle.md`)。

- 上から順に判定、(3) まで残ったものだけ CLAUDE.md に書く

### 10. context loading 容量推奨 (公式 docs 出典)

CLAUDE.md / rules / skill の容量推奨と context 消費 (`context-loading-budgets.md`)。

- 公式 docs 出典の事実値、感覚値ではない
- 設計時に必ず参照

### 11. 設計書 / 仕様書分割の判断軸

肥大化した設計書 / 仕様書は親索引 (200-500 行) + サブ詳細 (各 200-800 行) の 2 層構造に分割 (`feedback-spec-doc-split-judgment.md`)。

- 分割タイミング: 800 行超 / 2 階層必要 / merge conflict 2 回以上 / 「該当箇所を見つけにくい」レビュー指摘 / Read 2000 行制限超
- 分割境界: 論理境界優先 / 依存単方向 / 親索引責務 / サブ責務 / 命名規約 `NN-{category}-{module}.md`
- 機械検証: 参照整合 / 旧形式参照 / CI 組込 (`doc-consistency-check.sh` 等)

## Anti-patterns

- 命名と実態のズレを許容 (将来コスト)
- 移行期ラッパーを期限なしで両立 (両立が permanent 化)
- 撤去リストを literal union ではなく別ファイルで管理 (CI に効かない)
- baseline 指標の減少を OK 判定 (baseline 更新漏れ検知不能)
- sensitive filter を broad wildcard (false positive 多発)
- 非 IT 利用者向け hidden 機能を過剰作り込み
- CLAUDE.md を人間可読性最優先で書く (Claude 向け密度低下)
- ルールを `.claude/rules/` に外出ししてトークン削減した気になる
- CLAUDE.md 圧縮時に判定順を skip して感覚で移行先を決める
- 設計書を 1500+ 行のまま放置 (Codex review 粒度低下)

## Related memory (Phase 2 で slug + 検索手順形式に書き換え)

- `feedback-naming-must-match-reality.md`
- `feedback-migration-phase-wrapper-with-deadline.md`
- `feedback-literal-union-as-retirement-list.md`
- `feedback-baseline-monotonic-ci-both-directions.md`
- `feedback-sensitive-filter-narrow-not-broad.md`
- `feedback-non-it-user-feature-minimal-build.md`
- `claude-md-consolidation-principle.md`
- `claude-md-externalization-token-effect.md`
- `claude-md-layering-principle.md`
- `context-loading-budgets.md`
- `feedback-spec-doc-split-judgment.md`
```

---

## Phase 1 完了基準の照合

| 完了基準 (親 plan §4) | 達成状況 |
|---------------------|---------|
| 5 skill の draft が SKILL.md 形式で存在 | ✅ 本ファイル §A-§E (Phase 2 で `~/.claude/skills/<name>/SKILL.md` に分割 cut+paste) |
| 各 skill が empirical-prompt-tuning で白紙 subagent 評価 pass | 🔜 Phase 1 commit 後 or Phase 2 で empirical 評価実施 (memory `empirical-validation-for-prompts.md` 適用) |
| 振り分け cut-line が文書化済 | ✅ [phase1-layer-a-mapping.md](2026-05-17-phase1-layer-a-mapping.md) §2-5 |

empirical 評価は別途実施するため、本 draft は「empirical 評価で指摘されたら本文修正」前提の中間アウトプット。

## Phase 2 着手前の作業項目

- ~~sandbox 設定~~: 本セッション内で実証検出 → 単純な sandbox allowWrite 追加では塞がらない、Claude Code auto-mode の Self-Modification 判定 HARD BLOCK (user 明示承認でも bypass 不可)。**回避策: user 手作業配置**
- ~~CLAUDE.md global 行数実測~~: 本セッション実測済、269 行 (推奨 200 超過状態既存)。Critical 9 件追記は §F (下記) で 10 行強に圧縮した試案を採用、合計 280 行弱で運用継続
- empirical-prompt-tuning skill で各 skill description を評価 (Phase 2 配置完了後、別セッション)
- memory path 表記を「slug + 検索手順」形式に書き換え → **§A〜§E すべて Phase 1-D draft 時点で書き換え済** (Related Memory section は「各 project の memory dir で slug を検索」形式に統一)

---

## F. CLAUDE.md global 追記版 (Phase 2-A、圧縮 10 行強)

sub plan A §2 の試案 30 行を、skill 名明記で詳細移譲する圧縮形に再設計。現状 269 行 + 約 12 行 = 281 行で運用。

**追記場所**: `~/.claude/CLAUDE.md` 末尾 (既存「## Rules」「## Personality」等のセクション群の後)

```markdown
## Claude × Codex 反復スタイルの品質ゲート

複数 step プランは ExitPlanMode 前に Self-Review 7 観点 + Plan rally で点検 (skill: `plan-mode-discipline`)。多発失敗 / context 大 / hook 通過違和感の 3 トリガーで plan 再点検。

Codex P1 致命指摘は実証で裏取り、主張と修正方向の正誤を別軸判定 (skill: `claude-codex-review-loop`)。drift 系指摘は repo 全体 grep して全箇所一括修正。

subagent retry 提案は鵜呑みにせず必要性を検証。Claude は自己 bias に気付けない、機械強制 (hook deny) でしか質担保できない (skill: `engineering-judgment-axioms`)。

機械チェック (fmt / clippy / test / 設計書整合) で潰せる問題は PR レビュー前に全部潰す。
```

**カバー範囲** (Critical 9 件の縮退対応):

| Critical | 短文 (CLAUDE.md) | 詳細 (skill) |
|---------|----------------|------------|
| 1. Self-Review | §2 段落 1 (Self-Review 7 観点) | plan-mode-discipline §1 |
| 2. Plan rally | §2 段落 1 (Plan rally) | plan-mode-discipline §2 |
| 3. 再帰精査 | §2 段落 1 (3 トリガー) | plan-mode-discipline §3 |
| 4. mechanical addition | §2 段落 1 (Self-Review 7 観点に内包) | plan-mode-discipline §1 (各観点 100 字以上等) |
| 5. P1 empirical defense | §3 段落 1 | claude-codex-review-loop §1 |
| 6. 自己 bias | §4 段落 1 (Claude は自己 bias に気付けない) | engineering-judgment-axioms §1 |
| 7. memory rule needs hook | §4 段落 1 (機械強制でしか質担保できない) | engineering-judgment-axioms §1 |
| 8. subagent retry | §4 段落 1 (subagent retry 提案は検証) | engineering-judgment-axioms §2 |
| 9. review convergence | §5 段落 1 (機械チェック先行) | engineering-judgment-axioms §3 |

---

## G. symlink 構成 vs 実体配置 トレードオフ

skill / hook を `~/.claude/skills/` `~/.claude/hooks/` に配置する 2 方式の比較。本セッションで判明した制約 (auto-mode HARD BLOCK + 既存 symlink broken 多数) を踏まえた設計判断材料。

| 観点 | 実体配置 (Write 直接 / user 手作業 cp) | symlink 構成 (別 repo + `ln -s`) |
|------|-----------------------------------|--------------------------------|
| 初期コスト | 低 (Write 1 回 or cp 1 回) | 高 (別 repo 作成 + ln -s + dotfiles 管理) |
| アップデート同期 | 個別更新必要 (OS 環境数 × project 数) | 本元 1 回更新で全 OS 環境 / 全 project 反映 |
| version 管理 | なし (file system のみ) | git 経由 (履歴 / branch / diff / レビュー) |
| 配布性 | 低 (手作業 cp、新規環境セットアップで全 file 持ち込み) | 高 (dotfiles repo clone + symlink install script 一発) |
| 競合解決 | 単一実体なので競合なし | 複数 project が同じ本元を期待 = 整合性必要 |
| HARD BLOCK 回避 | 影響大 (新規 file 作成都度 HARD BLOCK 判定) | 影響小 (`ln -s` は Self-Modification 判定回避の可能性高、ただし要実証) |
| broken symlink リスク | なし | あり (本元削除すると全 symlink が broken、本セッション既存 3 件で実観測) |

### 本セッション実観測

```
~/.claude/skills/refactoring-ui -> ../../.agents/skills/refactoring-ui
~/.agents/skills/  →  "No such file or directory" (broken)
```

`refactoring-ui` / `frontend-design` / `find-skills` の 3 symlink は本元 `~/.agents/skills/` ディレクトリが消えているため broken 状態。skill 一覧には load 試行が表示されるが実際は読めない (要 user 確認)。

### 推奨判断

| skill / hook 数 | 推奨方式 | 理由 |
|---------------|--------|------|
| ≤5 (本 Phase 2 時点) | 実体配置 | 初期コスト最小、本元管理オーバーヘッド回避 |
| 6-15 (将来 gkmas-ocr-pipeline 追加後想定) | 実体配置 + dotfiles repo にコピー保管 | 同期は手作業だが、source of truth が dotfiles repo にあれば再現性確保 |
| >15 (汎用 skill 集として整備する場合) | symlink 構成への移行検討 | 同期コスト > 初期構築コスト の損益分岐点超え |

Phase 2 時点では **実体配置** で進行、source of truth は本リポジトリの `docs/plans/2026-05-17-phase1-skill-drafts.md` (§A〜§E) と `docs/plans/2026-05-17-phase1-hooks-draft.md` (§3〜§5) に保管。将来 dotfiles repo に移管する判断は別 plan。
