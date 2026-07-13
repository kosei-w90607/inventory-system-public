# Workflow Effectiveness Review: UI-11c 操作ログ画面（PR #164）

## Workflow Used

- Project Profile: `../../project-profile.md`
- Plan Packet: [2026-07-11-ui11c-operation-logs.md](2026-07-11-ui11c-operation-logs.md)（R3、design → plan-draft → plan-gate → plan-approved → implementing → local-verified → independent-review → human-confirm → ready-hosted-final → merge → archive の隣接遷移を複数回 state-only commit で一括 materialize）
- Test Design Matrix: [test-matrices/2026-07-11-ui11c-operation-logs.md](test-matrices/2026-07-11-ui11c-operation-logs.md)
- review-only sub-agent: Plan Reviewer（fresh Claude Fable 5、Plan Gate 2 ラウンド）、Final Reviewer（fresh read-only Sol High、実装後 Contract Audit / re-audit / Finding Closure Verification 計 6 ラウンド）、fresh Sonnet UI review 1 ラウンド、Sol integration review 1 ラウンド（非公式・append-only）
- external review: GitHub PR #164 review コメント 3 件（state: COMMENTED、`gh pr view 164 --json reviews` で確認）
- human approval: Owner Decisions 6 項目確定（2026-07-11）、implementation 開始承認、Ready / merge 承認、Windows native L3 visual confirmation + L3-7/L3-8 waiver の residual-risk acceptance
- gates: `bash scripts/doc-consistency-check.sh`、targeted test、`bash scripts/local-ci.sh changed`、exact-HEAD `bash scripts/local-ci.sh full`、hosted final（run 29168080505 (private archive Actions evidence 29168080505)）、PR HEAD / PR 本文 local SHA / hosted `headSha` の三点一致、squash merge `94421a7`

## What Worked

- Plan Gate は 2 ラウンドで収束した（Round 1 P1=0/P2=2/P3=2 → Round 4 件修正 → Round 2 P1=0/P2=0）。実装コードは 1 行も書かれる前に producer 誤記述や `ui-task-specs.md` 未同期が捕まった。
- Sol integration review（append-only、非公式）は keyboard 二重 toggle 懸念を `userEvent` の native Enter/Space 経路で実証再現せず、production handler を変更しない判断を下した。仮説駆動でなく実証に基づく裁定だった。
- exact-HEAD 三点一致マージゲートは 20 コミット・7 回の実装後リメディエーションを経ても最後まで機能し、マージ直前の Finding Closure Verification（P1=0/P2=0）で驚きなく閉じた。
- Owner Decisions 6 項目（scope・日付範囲・operation_type・detail_json・URL state・REQ-902/905 裁定）を Plan Gate 前に確定したことで、実装後の手戻りは主に regression test 追加・doc 同期であり、スコープ自体の再交渉は発生しなかった。
- Owner の直接介入は 3 接点（Owner Decisions 確定 / 実装開始承認 / Ready・merge 承認）に限定され、この3点自体は健全に機能した。

## What Did Not Work

- 実装後レビューに収束条件（Findings Freeze 相当）がなかったため、修正のたびにフルスコープの Contract Audit が再実行され、Plan Gate 2 ラウンドに対し実装後だけで 7 ラウンド（Sol integration 非公式 1 + P1/P2/P3 classified 6）が発生した。
- D5（行展開は明示的な「詳細を表示／閉じる」native button、行全体 click は不使用）の契約と `docs/architecture/ui-task-specs.md` の記述との drift が、Final Contract Audit の 2 連続ラウンド（reviewed HEAD `36db4ac`, `c5ee02fc`）で P2 として再出現し、3 ラウンド目（readonly re-audit）でようやく PASS 確認された。drift 一括 grep の規律は Claude auto-memory 側には存在したが、実装 Writer（Codex/Sonnet）側には可視でなかった。
- Round 5 相当（Final Contract Audit remediation, reviewed HEAD `3a7ddea2`）の P2 群（strict 日付 validation の parse 前ガード欠落・片側期間指定時の URL state 正規化欠落・逆転 range 時の一覧保持欠落）は、chrono の parse 挙動や TanStack Query の queryKey/cache 挙動という外部前提を Design Phase で実検証していなかったことに起因する。Impact Review Lenses の「Fact check / design decision split」はあったが、外部ライブラリ挙動の事前実験までは要求していなかった。
- L3-7（synthetic WAL DB での exclusive lock 再現）と L3-8（DB row 投入・削除・設定復元を伴う empty-state 検証）は、SQLite CLI 導入・synthetic row 投入・DB lock/WAL 操作という手動故障注入級の手順に膨張し、最終的に `MANUAL PROCEDURE WAIVED` + owner residual-risk acceptance で着地した。
- 遷移バッチ圧縮規定（`DEV_WORKFLOW.md` の adjacent forward transitions／state-only transition commit 規定）と「owner を伝書鳩にしない」規定（`AGENT_OPERATING_MANUAL.md` §3.4）は既存規定として存在したが、本 PR では実効しなかった：20 コミット中 `docs(plans): ... へ遷移` 系だけで 5 件、design/trace/re-audit 同期系を含めると docs-only commit は 9 件に上り、Owner が waiver 文言化・PR 本文転記に手作業で関わる場面が残った。

## Issues Caught Before Implementation

- Plan Gate Round 1（P2=2）: related-record link 契約で `record_id` producer 実態の誤記述（3 producer が既に書込み済みという事実が「producer は存在しない」と誤って弱く記述されていた）、`ui-task-specs.md` に新規 `list_log_operation_types` が未反映のまま Acceptance Criteria の無矛盾要求に抵触。
- Plan Gate Round 1（P3=2）: 同日指定 validation 文言の曖昧さ、Test Matrix の route/navigation 行が `navigation.ts` の `status: "pending"` 残存を検出できない手段（typecheck のみ）だった点。
- 4 件とも同一 Writer が docs のみの smallest safe fix で是正し、Round 2 で P1/P2=0 が確定した。実装コードは未着手の段階で捕まった。

## Issues Caught by Tests

- `bash scripts/local-ci.sh changed` / `full` は CLEAN/exact-HEAD 判定、fmt/clippy/typecheck/lint/build/docs、generated bindings diff、traceability ERROR/WARN 0 を機械的に保証し続けた。
- TDD RED→GREEN（backend desired API・date validation・distinct 欠落・frontend page module 欠落・navigation pending・canonical registry 逆順 fixture 等）が、client-side date filter への縮退や row/count predicate の破損を退けた。
- テストが捕まえなかったもの: D5 の native button 契約が `ui-task-specs.md` の旧記述と矛盾している状態そのもの（doc-consistency-check はリンク/必須節の存在は見るが、記述内容の意味的一致までは見ない）。この種の drift は Contract Audit（人手 + 直接照合）でのみ捕まった。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| related-record link producer 実態誤記述（Plan Gate R1 P2-1） | accepted | `record_id` 既存 producer 3 箇所を正しく記述、`record_type` 追加を follow-up として明示 |
| `ui-task-specs.md` の新規 CMD 未反映（Plan Gate R1 P2-2） | accepted | source doc 同期 |
| detail_json null 時の negative assertion欠落 / operation type Badge の可視 text 専用test欠落（post-impl UI review P2） | accepted | regression test 追加、production handler は無傷 |
| 日付 strict validation 欠落・片側期間 URL state 正規化欠落・逆転 range 一覧保持欠落・filter 別 case RTL 欠落（Final Contract Audit R1, P2=4） | accepted | 全件 same-PR で smallest fix、mutation で RED 確認後 GREEN |
| D5 native button 契約 drift（`36db4ac` 再監査 P2-1、`c5ee02fc` follow-up P2-1） | accepted | 2 ラウンド連続で再出現、3 ラウンド目で PASS 確認 |
| L3-8 cleanup assertion の順序不備（readonly final re-audit P2） | accepted | 二重 `try/finally` 化し、cleanup 失敗時も設定復元を必ず試行 |
| keyboard 二重 toggle 懸念 / canonical operation_type 順（Sol integration review、非公式・P 未分類） | accepted | 前者は実証再現せず regression test のみ追加、後者は `OPERATION_TYPE_ORDER` で最小修正 |

## Issues Caught by External Review

- GitHub 上で可視化された review は 3 件（`gh pr view 164 --json reviews` で `COMMENTED` × 3）のみ。9 ラウンドの review/re-audit のうち残り 6 ラウンド（Plan Gate 2 + append-only remediation の大半）は Plan Packet 内の append-only 記録としてのみ残り、GitHub review オブジェクト化されなかった。
- GitHub 上の 3 件が具体的にどの append-only ラウンドに対応するかは、PR タイムライン側の記録が本 packet の append-only 記録と 1 対 1 対応しておらず、本一次証跡だけからは特定できなかった（下記「一次証跡で確認できなかった主張」参照）。

## Escaped / Late Findings

- D5 drift は Design Phase・Plan Gate の両方を通過し、実装後の Contract Audit で初めて検出された。さらに 1 回の同 PR 修正では収束せず、2 ラウンド連続で P2 として再出現した。Design Phase の Contract Coverage Ledger には D5 の行自体は存在したが、`ui-task-specs.md` 側の記述同期はチェック対象外だった。
- Round 5 相当の日付・range 系 P2 群は、chrono / TanStack Query という外部ライブラリの挙動を前提にした contract であり、Design Phase の Impact Review Lenses では「Fact check / design decision split」止まりで、外部前提の実験的検証までは要求していなかった。
- L3-7/L3-8 の手順肥大化は Design Phase の「Manual verification」欄で「owner visual confirmation and Windows native L3 required」としか書かれておらず、SQLite CLI 操作級の手順になり得るという線引きが事前になかった。結果は実装後、L3 チェックリスト作成の段階で判明した。

## Test Adequacy

Strong tests:
- row/count predicate equivalence を実 SQLite 接続で検証する Rust test（固定 mock ではなく date range 変更で `total_count` が実際に変わることを確認）。
- related-record link の「shows」「hides」（zero/negative/fractional/numeric string/unsafe integer/unknown/missing）を別ケースとして分離した RTL parameterized test。
- detail_json の known/unknown field ラベリングを区別可能な synthetic key で検証する test。

Weak or missing tests:
- D5 のような「実装は正しいが source doc 記述が古い」状態を検出する機械チェックはなく、Contract Audit の人手照合に依存し続けた。
- L3-7/L3-8 は最終的に自動テストへ完全代替できず、`MANUAL PROCEDURE WAIVED` として owner residual-risk acceptance に着地した。

Mutation-style observations:
- `page={normalized.page}` を壊す mutation で reversed-range 保持 RTL が RED になることを確認済み（`c5ee02fc` 系 remediation）。
- guard 削除・string coercion mutation で related-record link の「hides」ケースが RED になることを確認済み。
- end date parse bypass mutation で strict validation matrix 拡張後の test が RED になることを確認済み。

## Signal / Noise

- sub-agent findings total（P1/P2/P3 分類が明記された 8 ラウンド集計）: P2 = 15、P3 = 10（Plan Gate R1 P2=2/P3=2、Plan Gate R2 P2=0/P3=0、post-impl UI review P2=2/P3=3、Final Contract Audit R1 P2=4/P3=2、再監査 R2 P2=4/P3=1、re-audit follow-up P2=2/P3=1、readonly final re-audit P2=1/P3=1、Finding Closure Verification P2=0/P3=0）
- 上記に加え、Sol integration review（非公式・append-only）で P1/P2/P3 未分類のまま 2 件（keyboard 二重 toggle、canonical operation_type 順）が扱われ、いずれも実装済み内容の修正につながった。
- accepted: 全件（formal 25 件 + informal 2 件）。本 PR のレビュー往復で reject・deferred・question に分類された finding は一次証跡上確認できなかった。
- rejected: 0
- deferred: 0
- question: 0

## Cost / Friction

- review rounds 内訳: 9 ラウンド = Plan Gate 2（design 完了後の broad audit 相当）+ 実装後 7（Sol integration 非公式 1 + Sonnet UI review/Fable adjudication 1 + Sol High Final Contract Audit/re-audit 4 + Finding Closure Verification 1）。Plan Gate は broad audit 相当が 1 回（Round 1）+ closure 確認 1 回（Round 2）という構成だったのに対し、実装後は 7 ラウンドすべてが実質フルスコープの broad audit として繰り返され、closure 専用の軽量ラウンドは最後の Finding Closure Verification 1 回のみだった。
- コミット内訳: PR #164 は 20 コミット（`gh pr view 164 --json commits` で確認）。うち純粋な phase 遷移コミットが 5 件（plan-approved・implementing・human-confirm・ready-hosted-final の 4 件は `docs(plans): ... へ遷移` タイトル、実装checkpoint同期の 1 件は `docs(plans): UI-11c実装checkpointを同期` という実タイトルで phase 遷移を伴わない中間状態同期）、加えて `docs(design)` 1 件・`docs(trace)` 1 件・`docs(ui-11c)` 系 doc-only 同期 2 件を含めると docs-only commit は合計 9 件（全体の 45%）。実コード変更コミットは `feat`/`fix`/`test` 系の 11 件。
- GitHub review 不可視: 9 ラウンド中 GitHub review オブジェクトとして可視化されたのは 3 件のみ（`COMMENTED` × 3）。残り 6 ラウンドは Plan Packet の append-only 記録としてのみ存在し、PR タイムラインを見ただけでは全体像が追えない。
- Owner hands-on: Windows native L3-1〜8 の実機実行、visual confirmation の目視判定、L3-7/L3-8 waiver 根拠の文言化、PR 本文への L1 evidence 転記。証跡パッケージング自体を owner が担った場面が残り、これは Recommended Workflow Adjustment の Evidence Ownership / Owner Effort Budget が是正対象とする。
- 儀式税: exact-HEAD の SHA とテスト件数が Plan Packet 本文・PR 本文の双方に複数回転記され、そのたびに「新しい exact HEAD で `local-ci.sh full` を再実行してから PR 本文を同期する」連鎖が発生した（例: `438cd6d` 時点で Rust 669 / trace generator 14 / frontend 618 と記録されたが、その後 6 ラウンドの remediation で新たな content commit が積まれ、直近の exact-HEAD 時点の正確な件数は本一次証跡だけからは再現できなかった）。volatile evidence を tracked docs に転記する運用そのものが再実行コストを生んでいた。
- 比較: UI-11a（PR #？、レビュー 2 ラウンド、P2 は 0→1 の 1 件）、UI-11b（PR #144、Fable レビュー P1/P2=0 + 裁定 P2/P3 を同 PR で修正の 2 ラウンド相当）と比べ、UI-11c は差分規模（25 ファイル・+2896/-72）が数倍である一方、レビューラウンド数は 2 → 9 と 4.5 倍に増えており、規模比で見ても review round が不釣り合いに膨張した。

## Recommended Workflow Adjustment

Keep:
- Plan Gate 独立レビュー（Writer と別 context）と exact-HEAD 三点一致マージゲートは、20 コミット・7 remediation ラウンドを経ても最後まで機能した。継続する。
- Owner Decisions を Design Phase / Plan Gate 前に確定するパターンは、実装後のスコープ再交渉を防いだ。継続する。

Change（各々どの finding から導出したか）:
- **Findings Freeze**: 実装後 7 ラウンドすべてがフルスコープ再監査になった一因は収束条件の不在。初回 Broad Audit 完了後は finding set を凍結し、以降は closure 確認のみに限定する。
- **drift 一括 grep 正本化**: D5 drift が 2 ラウンド連続で再出現した一因は、drift 指摘受領時の一括 grep 修正規律が Claude auto-memory 側に閉じ、実装 Writer に可視でなかったこと。DEV_WORKFLOW.md 側の正本箇条書きに昇格する。
- **Contract Probe**: Round 5 相当の P2 群（chrono strict validation、TanStack Query queryKey 挙動）は外部ライブラリ前提を Design Phase で実験検証していなかったことに起因。R3/R4 で不確実な外部前提があれば Plan Gate 前に最小実験（Contract Probe）を要求する。
- **L3 Eligibility**: L3-7/L3-8 が SQLite CLI 導入・DB lock/WAL 操作という手動故障注入級の手順に膨張し waiver 着地した。Windows/Tauri ネイティブでしか観測できない項目のみを人間 L3 に残し、故障注入級の手順は自動テスト送りにする基準を設ける。
- **Owner Effort Budget**: Owner が Windows L3 実行・waiver 文言化・PR 本文転記に手作業で関わった。介入回数・実働時間・relay 往復に既定上限を設け、超過時は Coordinator が工程を簡略化する。
- **Evidence Ownership**: exact-HEAD SHA・テスト件数の複数転記が再実行連鎖を生んだ。volatile evidence（SHA・テスト件数）は tracked docs へ転記せず PR 本文/CI 出力のみを正本とする。
- **§3 モデル固定表撤廃**: レビューの実担当（Fable/Sol/Sonnet）は PR ごとに揺れており、固定役割表は属人化の源泉になっていた。独立性制約（Writer ≠ Plan Reviewer 等）のみを規範とし、実際の担当は各 PR の Workflow State role assignment に記録する model-neutral 表現へ置き換える。

Follow-up:
- 上記 7 点（Findings Freeze / drift 一括 grep / Contract Probe / L3 Eligibility / Owner Effort Budget / Evidence Ownership / §3 モデル固定表撤廃）は D-038 として decision-log に記録し、UI-13 を dogfood target とする。
- D-034 slice 2（機械強制・hook 化）は本 PR の scope 外のまま据え置き、Findings Freeze 状態行・Owner Effort Budget 節・Contract Probe 節・state-only commit 数を将来の機械チェック対象語彙として D-038 に明記する。

## Applied / Deferred Workflow Changes

Applied（D-038 の8項目、本 WER が属する同一 PR `agent/pr164-wer-workflow-hardening` 内で適用。詳細は [decision-log.md D-038](../../decision-log.md)）:
- (1) `docs/AGENT_OPERATING_MANUAL.md` §3 のモデル固定役割表を撤廃し、独立性制約リスト（Writer ≠ Plan Reviewer 等）へ置き換え。
- (2) `docs/DEV_WORKFLOW.md` Review Rules に Findings Freeze を追加（初回 Broad Audit 完了後に finding set を凍結。2本の Contract Audit pass が実際に走る場合は常に — 必須の R4/workflow gate change の Double Audit でも、Contract Audit 節の推奨2本目を選択した R3 change でも — 両 pass 完了をもって初回 Broad Audit とする但し書き付き、Audit #2 で R3 側も対象化）。
- (3) `docs/DEV_WORKFLOW.md` Contract Audit に drift-fix sweep（drift 指摘受領時に `rg` で repo 全体を一括修正）を正本の箇条書きとして追加。
- (4) `docs/DEV_WORKFLOW.md` Plan Packet Rules + `docs/templates/plan-packet.md` に Contract Probe 節（R3/R4 の未検証外部前提向け最小実験）を追加。
- (5) `docs/DEV_WORKFLOW.md` Human Visual Confirmation に L3 Eligibility 基準を追加し、owner hands-on証跡集めの慣行を廃止（owner の役割を eye confirmation + PASS/FAIL 判定に限定）。
- (6) `docs/DEV_WORKFLOW.md` に Owner Effort Budget 節（介入回数・実働時間・relay往復の既定上限）を新設し、`docs/templates/plan-packet.md` に記入欄を追加。
- (7) `docs/DEV_WORKFLOW.md` Evidence Ownership（D-035）をテスト件数まで拡張し、volatile evidence として tracked docs への転記を禁止。
- (8) `docs/DEV_WORKFLOW.md` に state-only transition commit 数の上限（1 PR あたり3、うち post-implementation 2）を追加（Audit #2 P2 指摘により 2→3 へ改定）。
- `docs/decision-log.md` に上記8項目を D-038 として記録し、D-034 / D-035 に `Superseded in part by: D-038` を追記。
- 機械強制（PK4/PK5/hook）は D-034 slice 2 に deferred（本 PR の scope 外）。
- D-035 Revisit の問い「state-only transition scope は広すぎたか」への回答: scope 自体（Workflow State / `Plans.md` / append-only 記録に限定する境界）は正しく、実コード変更を混入させない防波堤として機能した。過剰だったのは scope ではなく運用側で、遷移のたびに個別コミットを切る運用が既存の隣接遷移バッチ圧縮規定（`DEV_WORKFLOW.md` adjacent forward transitions）を活かし切れていなかった点にある。是正は state-only transition commit 数の上限（1 PR あたり 3、うち post-implementation 2）と圧縮規定の実効化であり、scope 定義そのものの再設計ではない。

Deferred:
- PK4/PK5 相当の機械的整合性チェック（Workflow State enum / field 関係、drift grep のスクリプト化、L3 Eligibility の自動判定）は D-034 slice 2 のまま。

Not applied:
- D5 のような source doc drift をゼロにするための実装差分単位の自動 semantic diff は、対象範囲の定義が固まっていないため今回は導入しない。
