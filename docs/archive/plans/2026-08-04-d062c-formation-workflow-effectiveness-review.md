# Workflow Effectiveness Review: D-062 (c) 編成（Fable Coordinator / Codex Writer / Sonnet Plan+Final Reviewer）

対象: 編成 dogfood 3 実測点 — PR #58（CSV取込み詳細 route、squash merge `9665a5c`、2026-08-03）/ PR #60（UI 安全網 batch、squash merge `40d8575`、2026-08-04）/ PR #61（UI consistency batch、squash merge `a203b2f`、2026-08-04）。change 単位の WER ではなく、編成（役割分担 + review 経路）の効果を 3 点比較で評価する。比較参照として鏡像編成（Fable Coordinator / Sonnet Writer / Codex Plan+Final Reviewer）の batch A（PR #57）/ batch B（PR #59）の rally 実績を用いる。起票の直接契機は owner 観察 2 件（rally round の多さ / reviewer findings の修正案欠落）で、両観察の裏取り結果を本文へ含める。

## Workflow Used

- 編成: Fable Coordinator（起草・裁定・state 管理）/ Codex Writer（実装、fail-closed 権限付き）/ Sonnet 5 Plan+Final Reviewer（別 vendor 独立レビュー、D-062 (c) 適合）
- gates: Plan Gate rally（P1/P2=0 まで）、gated Amendment + 正規 backtrack、mutation の Writer 自己実測 + Coordinator 独立再実測（記録非参照導出・隔離 worktree）、Final Review、owner L3、exact-HEAD local / hosted 三点一致
- packets: [PR #58](2026-08-03-csv-import-record-detail.md) / [PR #60](2026-08-03-ui-safety-net-batch.md) / [PR #61](2026-08-04-ui-consistency-batch.md)（Matrix は同名の test-matrices 配下）

## What Worked

- gated Amendment は 3 change すべてで Writer fail-closed の true positive（route 非 nesting 前提誤り / 分類表 64「画像選択」事実誤り / 90-traceability 再生成義務の Scope 漏れ）。計画の事実誤りを実装時実査で捕捉する層として、編成の中核価値が 3/3 で再現した。
- mutation 二重実測は 3 点とも survivor 0 で完走した。PR #61 では Writer 自己実測の初回に M-A7 survivor が出て fixture 補強で red 化しており、自己実測層が独立再実測より先に穴を塞いだ実例を得た。
- owner 介入は 3 点とも 3/3 で予算内。Plan Gate の P1+P2 は 3 点とも単調収束した。
- 実装前検出が機能した（PR #58 round 1 の P1 = private module 経由 unreachable の compile blocker、ほか各 change の Issues 節参照）。

## What Did Not Work

- Plan Review round 数が 2 → 3 → 5 と増加した。packet 記録上、原因はいずれも Coordinator（Fable）側の起草・是正品質 — PR #60 は DEV_WORKFLOW 要件の自己解釈緩和・分類表未列挙で design backtrack 2 回、PR #61 round 3/4 は是正の同 packet 内 sweep 漏れ同型 2 連発（packet-correction-full-sweep 教訓の再発）。
- 鏡像編成の batch A（4 round）/ batch B（5 round）も長 rally の原因は Coordinator 起因と packet に記録されており、round 増は reviewer vendor に依存しない構造要因（Coordinator 起草品質のばらつき）である。
- DEV_WORKFLOW Review Rules の「反復 plan / contract review では各 finding に具体的修正案を必須添付」（backup/migration design WER 起源）が rally 実践へ貫通していない。packet 記録では修正案付き finding と指摘のみ finding が両 vendor で混在する（例: batch B P1-1 は対処方針を Coordinator が起草 / PR #60 P2-1 も指摘のみ。逆に batch A では Codex が対抗機構案・検証コマンドを提案、PR #61 では Sonnet が案 a/b の選択形を提示）。owner は Codex rally の生文面で修正案欠落を観察したが、packet には Coordinator の paraphrase しか残らないため vendor 別の定量比較は記録上できない — これは記録側の限界でもある。
- Plan Review round 数の上限（rally 天井）は未正本化。Owner Effort Budget は介入 / relay / 時間のみで round 数の行を持たない。
- state 機構の逸脱が 2 件: PR #60 round 2 で round 1 是正が正規 `state-backtrack` commit なしに narrative のみで backtrack を主張（round 2 P3-1 で検出、正規化）。PR #61 で Writer 遷移 commit subject 非 canonical により STATECAP 不可視（Final Review P2-1、disposition = 履歴書き換えなし・以降 canonical）。いずれも Writer 発注書に canonical 形式が明記されていないことが共通要因。

## Issues Caught Before Implementation

- PR #58: private module 経由 unreachable の compile blocker（round 1 P1）。
- PR #60: DEV_WORKFLOW 要件の自己解釈緩和、26 page 分類表の未列挙、catch-all 理由不整合（round 1 P1×3、design backtrack で是正）。
- PR #61: IME 意味論の契約矛盾（P1-2、裁定 a = 契約側を SearchBar live 実態へ是正）ほか round 1 P1+P2=5。

## Issues Caught by Tests

- PR #58 gated Amendment 1 は Contract Probe T10 の runtime red が route 非 nesting 前提誤りを検出した（計画の誤りを test が先に否定した形）。
- mutation 二重実測は 3 点とも survivor 0。PR #61 M-A7 の初回 survivor は Writer 自己実測層で検出され、fixture 補強で red 化した。

## Issues Caught by Review-only Sub-agent

| change | Final Review 結果 |
|---|---|
| PR #58 | Ledger 22/22 適合、P1/P2=0、P3×1（JAN 列 pre-existing → backlog 起票） |
| PR #60 | P1/P2=0、state lifecycle 追加 audit pass |
| PR #61 | P2-1 = Writer 遷移 commit subject 非 canonical（STATECAP 不可視）を検出 |

## Issues Caught by External Review

- Sonnet Plan Review rally が 3 点とも実装前に P1 を段階検出し、Plan Gate 内で P1/P2=0 へ単調収束した。reviewer の過剰指摘で round が伸びた事例は packet 記録にない。

## Escaped / Late Findings

- merge 後の product / runtime escape は 3 点とも確認されていない。
- PR #58 の accordion trigger 発見性（P3）は Plan Gate / Final Review を通過し owner L3 で初検出、gated Amendment 2 で同 PR 是正。視認性の UX 判断は依然 owner L3 が最終防衛線である。
- PR #61 の STATECAP 非 canonical は Final Review まで潜伏した。

## Test Adequacy

Strong tests:

- mutation の Writer 自己実測 + Coordinator 独立再実測（記録非参照導出）の二重化。M-A7 の実例により、自己実測層は独立再実測の下位互換ではないことが示された。
- gated Amendment を裏付ける runtime probe（PR #58 T10）。

Weak or missing tests:

- rally の reviewer 原文が packet に残らず、reviewer 挙動（修正案添付率など）の事後検証ができない。paraphrase 記録の限界として認識する（新しい全文保存義務は導入しない — Not applied 参照）。

## Signal / Noise

- gated Amendment: 3/3 true positive、false 停止 0。
- Plan Review findings は大半が accepted（選択形裁定を含む）。round 増は reviewer noise ではなく Coordinator 起草の穴への再指摘が主因。
- Final Review: P1/P2 有意 finding は PR #61 P2-1 の 1 件で、state 可視性という workflow 上の実害に対応する真陽性。

## Cost / Friction

- review rounds: Plan 2 / 3 / 5 + Final 各 1〜2。round 増分は全て Coordinator 起草起因。
- relay: PR #60 で fail-closed 停止による再 relay（2/4）。PR #58 / #61 は 2/2。
- state friction: STATECAP 2/3（PR #60）、非 canonical subject（PR #61）。
- owner 介入: 3 点とも 3/3 で予算内。

## Recommended Workflow Adjustment

Keep:

- D-062 (c) 編成そのもの。3 実測点で gated Amendment true positive 3/3・mutation survivor 0・介入予算内が再現し、編成として成立。継続採用を推奨する。
- mutation の Writer 自己実測 + Coordinator 独立再実測の二重化。

Change:

1. **Reviewer 発注書への fix-proposal 義務の明文転記**: `docs/templates/subagent-review-packet.md` の Findings 欄へ「各 finding に具体的修正案必須（DEV_WORKFLOW Review Rules 準拠）」を追記し、Coordinator は修正案なしの finding を受理せず差し戻す。規則自体は既存であり、これは新設ではなく enforcement の是正。
2. **rally round 天井の正本化**: vendor 非依存で Plan Review 3 round を目安の天井とし、到達時は Coordinator が残 findings の disposition 裁定（同型指摘の一括是正 / backlog 化 / owner escalation）へ切替える。Owner Effort Budget へ round 行を追加。順14 follow-up (b) の「rally 天井」部分の判断材料は本 WER に集約する（cross-vendor 方式そのものの評価は PR #56 系の実測記録が正）。
3. **Coordinator 是正の同 packet 内 full sweep の手順化**: packet 是正 commit 前に旧前提を rg で全節 sweep する手順を Plan Packet の是正手順として明記する。round 増の根本は Coordinator 起草品質であり、天井（2）は排出弁、本項が根本対策。
4. **Writer 発注書への STATECAP canonical subject 追記**: PR #61 P2-1 disposition（「今後の発注時に反映」）の実行。PR #60 の narrative backtrack 逸脱も同じ追記で予防する。

Follow-up:

- Change 1・3・4 は次の発注（describeError 化 単独 R3）の発注書へ即適用する（template / DEV_WORKFLOW の正本化前でも発注書直書きで有効）。
- 正本化（DEV_WORKFLOW / template 改訂）は軽量 workflow docs PR（R3 workflow gate change、PR #53 同型）として別途起票し、Change 2 の採否はそこで owner が裁定する。

## Retired / Consolidated Rules

- 「rally round 過多は reviewer vendor の特性」という仮説を退役する。長 rally 5 件（D-062 (c) 3 点 + 鏡像 2 点）すべてが Coordinator 起因で、vendor 非依存の天井 + Coordinator 起草品質対策へ統合。
- 「修正案添付義務の新設」を退役する。義務は DEV_WORKFLOW Review Rules に既存で、発注書 template への転記と差し戻し運用（enforcement）へ統合。

## Applied / Deferred Workflow Changes

Applied:

- 本 WER の起票により、PR #58 / #60 / #61 closeout に分散していた「WER 起票判断」を消化した。

Deferred:

- Change 1〜4 の正本化（DEV_WORKFLOW / template 改訂）は workflow docs PR へ。発注書レベルの先行適用の初回 dogfood = describeError 化 単独 R3。

Not applied:

- reviewer rally 原文の全文保存などの新しい記録義務。paraphrase 限界は認識するが、記録コスト増に見合う便益が未実証。
