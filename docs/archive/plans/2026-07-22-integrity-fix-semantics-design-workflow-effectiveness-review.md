# Workflow Effectiveness Review — 整合性補正の意味論正本確定（監査是正 順 3、PR #19）

## Workflow Used

R3 design-first（docs-only、11 doc）。owner 裁定（意味論 A）→ packet 起票（plan-first `1eedb41`）→ 起票直後の adjacent-contract sweep → Plan Gate rally 8 round（Claude 独立 subagent 4 + Codex 4、相互修正案方式。round 4 で新規指摘が尽きず owner 判断で vendor 切替）→ plan-approved → design 本文執筆 → L1 full → Draft PR #19 → Contract Audit Double Audit（1 pass = 独立 fresh context / 2 pass = Codex 独立 mutation testing）→ gated amendment `b180185` + closure 実 mutation 6/6 RED → Findings Freeze → Ready 承認（介入 1/2、dispatch・merge・closeout は Coordinator へ委任 = PR #18 precedent）→ explicit `workflow_dispatch` success → 三点一致 `676f368` → squash merge `384fcc8`。

## What Worked

- **adjacent-contract sweep（D-050 D11）の即日効果**: 起票直後の sweep が旧意味論の残存 3 系統（ui-task-specs / ARCHITECTURE / DB_DESIGN 復旧方針）を Plan Gate 前に検出。正本化した規律の 2 度目の即日 dogfood 実証。
- **vendor 切替の owner 判断**: Claude rally 4 round で同型指摘（grep 網から漏れる literal 旧意味論）が尽きなかった時点で Codex へ切替。round 5 で REQ-904 誤引用・365 日 retention と「唯一の監査痕跡」の横断矛盾・precedent 誤引用という、それまでの rally が構造的に見なかった種類の指摘が出た。
- **Double Audit 2 pass の系統的 mutation testing**: 1 pass（Ledger 突合 + 推論 + mutation 3 種）が P0 で通した後、2 pass が **survivor 5 件 + 事実誤記 2 件**（BIZ-02 の TX 内必須ログ欠落 = 実コード裏取り付き / review-checklist「全TX外方針」の実態乖離）を検出。waive しない規律の 4 度目の実証。
- **全数照合ゲート（round 4 P3 起源）**: anchor 積み上げの構造的弱点への対策として導入した「全ヒット 1:1 分類」が、以後の round の検証基盤になった。
- **closure 実 mutation**: 是正後に survivor 同型 mutation 6 種を再注入し新 anchor の red を全実測。回帰感度が推論でなく測定で確定した。

## What Did Not Work

- **anchor 積み上げ方式そのもの**: round 1〜4 の指摘が全て「個別 anchor の網から漏れる literal 残存」という同一 failure class。起票時点で全数照合 + exact-count 構造 anchor を既定にしていれば rally 2〜3 round は不要だった。
- **1 pass の検出力**: Ledger 突合と少数 mutation では「green のまま契約を除去できる」survivor を 1 件も見つけられなかった（5 件全てを 2 pass が検出）。doc-gate の Contract Audit 1 pass は survivor 探索を明示 charge にしない限り通過儀礼化する。
- **Coordinator の mutation 手順ミス**: 未 commit の是正がある working tree で closure mutation を実施し、`git checkout --` 復元が是正 3 ファイル分を巻き戻した（再適用で復旧、memory `feedback-mutation-test-on-clean-tree-only` に教訓化済み）。
- **L1 の単発フレーク**: final HEAD の full 1 回目で `local-ci-tests`（dirty mutation 検出の自己テスト）が失敗。単体・full 再実行とも再現せず。加えて再実行の 1 回目起動が docs gate 途中で無進捗のままプロセス消滅する事象も 1 回発生（2 回目で正常完走）。いずれも本 PR 非接触の gate 基盤側の観察として記録。
- **subagent の完了待ち規律**: L1 実行を委譲した subagent が背景起動だけで turn を終える挙動が複数回発生し、SendMessage での追い立てを要した。実行系の委譲 prompt には「foreground で完了まで待つ」を毎回明記する必要がある。

## Issues Caught Before Implementation

Plan Gate rally 8 round: P1×5 + P2×14 + P3×8（frontend 文言同期の追跡漏れ / TX 内ログ precedent 誤引用 / 35-biz 継承断言 / ui-task-specs step 7 literal / biz-task-specs ログ混在 / 36-biz 関数要求文 / DB_DESIGN 確認文言 / REQ-904 誤引用 / D-051 retention 未固定 ほか）。全件 accept・反映。

## Issues Caught by Tests

doc-consistency の M3 未確定マーカー WARN 1 件・PK3 観測 token WARN 2 件（いずれも即修正）。既存自動テストは docs-only のため非発火（751/668 全 green 維持）。

## Issues Caught by Review-only Sub-agent

Contract Audit 1 pass: P0（Ledger 10/10 PASS、mutation 3 種 red）。blocker 外観察 1 件（§21.4 3b の `conn` 表記 = 既存記法、実装 follow-up で自然解消）。

## Issues Caught by External Review

Codex round 5〜8（Plan Gate）+ 2 pass（Contract Audit）: P1×5 + P2×12 + P3×4。最重要 = 2 pass の survivor 5 件と BIZ-02 事実誤記（実コード `insert_operation_log(&tx,)?` 4 系の実証付き）、review-checklist「全TX外方針」の実態乖離（放置すると follow-up 実装をレビューが誤拒否）。

## Escaped / Late Findings

- BIZ-02 の TX 内必須ログは、D-051 起草時に Writer（Coordinator）が BIZ-01 だけを挙げて repo sweep をしなかったことによる遅発（2 pass で捕捉）。「現状整理」を書くときはその整理自体に sweep evidence を付けるべきだった。
- review-checklist の乖離は本 PR 以前からの既存 drift（2 pass が発見、本 PR scope へ追加して是正）。
- merge 後の escape は現時点で未検出。

## Test Adequacy

docs-only PR の「テスト」は doc-consistency + grep anchor + 独立レビュー。個別 anchor は brittle かつ選定漏れが構造的に起きる — exact-count 構造 anchor + 全数照合の 2 層が有効だった。実装 follow-up の完了条件として 36-biz §21.7 に 3 oracle（失敗注入 / detail_json 具体値 + movement 行数不変 / mismatches 非出現 + SQL 等式）を正本化済み。

## Signal / Noise

rally 全 8 round + Double Audit で false positive はほぼゼロ（全 findings accept、rebut 0）。round 1〜4 の同型反復は signal ではあるが方式起因の非効率（上記）。owner 介入は裁定 2 回（意味論 A / vendor 切替 + Codex relay）+ Ready 承認 1 回で、承認 budget 内（1/2 消化、dispatch 以降は委任）。

## Cost / Friction

Claude subagent 5 体（Plan Gate 4 + Contract Audit 1 pass + L1 実行系 3）+ Codex 5 セッション（owner relay）。owner relay の往復が Codex round ごとに必要な構造は、リミット到達による中断も含め wall-clock の主要因。closeout まで含め約 2 日（2026-07-21 裁定 → 07-22 merge）。

## Recommended Workflow Adjustment

1. **契約文書 PR の Matrix 既定**: 契約の削除・劣化を検出する exact-count 構造 anchor と全数照合（1:1 分類）を、rally での後追いではなく**起票時の Matrix 既定形**にする（template への追記候補）。
2. **「現状整理」記述の sweep evidence 義務**: 設計 doc / decision-log に「既存の例外は X だけ」型の整理を書くときは、根拠 sweep（rg command + 結果）を同時に記録する。
3. **doc-gate Contract Audit 1 pass の charge 明文化**: survivor 探索（green のまま契約除去可能か）を 1 pass の必須観点にする。
4. mutation testing の clean tree 前提は memory 化済み（`feedback-mutation-test-on-clean-tree-only`）。workflow docs への昇格は次期 workflow docs PR で判断。
5. L1 `local-ci-tests` のフレーク（dirty mutation 検出シナリオ）と docs gate 無進捗消滅の再発監視。再発時に gate 基盤の独立 issue として起票。

## Retired / Consolidated Rules

none — 理由: 本 PR は workflow 規律の新設・統合・退役を行っていない（適用済み規律 = D-050 の adjacent-contract sweep / 相互修正案方式 / anti-tautology 実 mutation はいずれも既存正本のまま。product 設計側の退役 = 「仮想棚卸し」概念は BIZ-07-D5 として 36-biz に記録済みで workflow 規律ではない）。

## Applied / Deferred Workflow Changes

- Applied（本 packet 内で完結）: 全数照合ゲート（2 command 分離形）/ exact-count 構造 anchor（Matrix #6/#7/#9/#12/#13/#14）/ closure 実 mutation の実測記録。
- Deferred（revisit 条件付き）: Codex round 5 提案の 3 件 — sweep manifest 機械化（次の同型監査/是正 PR 起票時）/ Scope 契約単位再編（次 design packet 起票時）/ REQ ID lint の PK check 化（次の workflow docs / checker PR）。上記 Recommended 1〜3 は次期 workflow docs PR の入力（D-050 方式の bundle 裁定へ）。
