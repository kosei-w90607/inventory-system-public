# Workflow Effectiveness Review — workflow docs WER consolidation

- 対象: roadmap 1-1 workflow docs PR（R3 workflow gate change、docs-only）
- PR: #18（squash merge `bbb61f6`、2026-07-21）
- 証跡: [Packet](2026-07-21-workflow-docs-wer-consolidation.md) / [Matrix](test-matrices/2026-07-21-workflow-docs-wer-consolidation.md) / D-050

## What worked

- **baseline-red anchor phrase 方式**: plan 段階で anchor 11 種の baseline 0 件を実証して exact command を固定した結果、Writer 実装は 1 round で assertion 全数反転。tautological 検証（rally / Plan Gate で計 3 回指摘された failure class）を構造的に排除できた。docs-only PR の「テスト」設計手法として再利用可能。
- **adjacent-contract sweep の即日 dogfood**: 本 PR が正本化した sweep を Double Audit 2 pass が本 packet 自身に適用し、Handoff 契約の Ledger 行欠落（P1）を検出 → gated amendment `1efe836`。規律の実効性が導入と同一 PR 内で実証された。
- **相互修正案方式**（これも本 PR で正本化）: 全 findings に修正案が添付され、Coordinator の実証裏取りで「提案側が優れる」ケース（M-HANDOFF の sed 終端）も往復なしで採否確定。空転 round ゼロ。
- **rally → Codex Plan Gate 移管**（owner 判断 2026-07-21）: Fable rally は実体指摘が round 4 で枯渇し、以降の bookkeeping 層指摘は Codex 側で消化。精査の一本化が round 浪費を抑えた。
- Owner Effort Budget 実績 2 / 予算 2（PR #7 precedent の見積りが再現）。

## What didn't

- Plans.md roadmap 1-1 の列挙が 4 項目消化済みのまま陳腐化していた（Phase 1 検証で検出）。closeout 時の列挙同期が 3 PR 分漏れ続けた構造問題で、本 PR の主要動機の一つ自体が同期漏れの産物。
- packet の自己適用漏れが 2 種（Handoff の Ledger 行 / 固定 count「9 本」表記）。いずれもレビュー網で検出されたが、起票時点の自己検査には存在しなかった。
- Coordinator 作業ミス 2 件: State Narrative の append 順逆挿入 ×2（即時自己修正）/ 直前 closeout での git mv + Edit の staging 漏れ（`RM` シグナル見逃し → main にリンク切れ commit `799beb3` → 是正 `3b179ff` + memory `feedback-git-rename-modified-staging-trap` 化）。
- Matrix assertion の品質収束に Plan Gate 4 round を要した（無終端 sed 範囲 / Markdown 表 escape による regex 破壊 / 分散 token の tautology）。「exact command は fenced block で書き、baseline と mutation の両側を実測する」を最初から適用していれば短縮できた。

## Adjustments（次への反映）

- packet 起票時の「自己適用検査」（本 packet の Ledger / Matrix / 記述が、本 PR が導入・変更する規律自身に適合するか）の checklist 化を検討 — 次の workflow docs 系 PR で判断。
- Coordinator clone の harness 生成物（`.claude/loop.md` 等）による `MERGE_EVIDENCE_VALID=false` は `.git/info/exclude` で恒久解決済み（repo 非改変・環境固有のため docs 化不要）。
- 規律自体の変更は不要 — 全欠陥は既存 gate（rally / Plan Gate / Double Audit / M-* assertion）の内側で検出された。改善は検出の前倒し（自己適用検査）のみ。

## Retired / Consolidated Rules

- roadmap 1-1 による WER Adjustment の「積み残しリスト管理」は本 PR で終了。以後の WER Adjustment は、発生の都度 DEV_WORKFLOW / template へ直接正本化するか、次期 workflow docs PR を新規起票する（積み残しの再蓄積をしない）。
- 不採用 defer 4 件の追跡先は D-050 に一本化: (i) 契約文言 registry（供給規約成立時 or drift 再発時）/ (ii) release-profile CI gate 化（2026-08-01 CI 再評価）/ (iii) 監査発注書の読取経路健全性チェック（roadmap 1-2 発注書作成時）/ (iv) STATECAP cap 枯渇フォールバック（workflow-state 再設計 PR）。
