# Workflow Effectiveness Review: UI-01a Design Readiness Trial

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet: `docs/archive/plans/2026-06-09-ui01a-design-readiness.md`
- Test Design Matrix: `docs/archive/plans/test-matrices/2026-06-09-ui01a-design-readiness.md`
- review-only sub-agent: 実施
- external review: なし
- human approval: PR #88 merge 承認あり
- gates:
  - `bash scripts/doc-consistency-check.sh`
  - `bash scripts/doc-consistency-check.sh --target plan`
  - pre-push hook
  - runtime/backend non-scope diff check

## What Worked

Which workflow step caught or prevented a real issue?

- Design Phase は、UI-01a の実装前に `UI-01a-D1`〜`UI-01a-D7` を `function-design/50-ui-product-list.md` へ昇格し、Plan Packet だけに設計意図が残る状態を避けた。
- review-only sub-agent が P2 として、部門フィルタ候補の取得元が未確定であることを検出した。これにより、UI 実装中に `search_products` の現在ページから不完全な候補を派生する drift を防いだ。
- review-only sub-agent が P3 として、URL `sort` / `dir` と generated `SortKey` / `SortOrder` の mapping 不足を検出した。実装前に wire mapping を source doc へ追記できた。
- docs checks が `per_page` 上限表現、未確定マーカー、英語 `should` の曖昧表現を検出し、PR 前に全通過まで修正できた。
- PR 作成後のユーザー feedback から、PR description / repository docs は原則日本語、technical identifier は標準英語表記のまま、という運用ルールを `DEV_WORKFLOW.md` へ同じ PR で追加できた。

## What Did Not Work

Which step was overhead, noisy, unclear, or too heavy?

- 初回の Design Readiness では「既存 `search_products` で十分」という判断が強すぎ、部門フィルタの option source を見落とした。
- Plan Packet の一部に `UI-01a-D1`〜`D6` の古い表記が残り、`D7` 追加後の trace 更新が一箇所不足した。post-merge sync で archive evidence を補正した。
- Design Readiness Trial は docs-only だったが、R3 Plan Packet / Test Matrix / review-only まで行ったため軽くはない。今回は workflow dogfood が目的だったので妥当だが、以後の小さな docs cleanup では同じ重さにしない。

## Issues Caught Before Implementation

- UI-01a 初期表示、URL state、pagination、廃番 mode、HID scanner、cm / m toggle defer を source docs に整理し、UI 実装前の設計空白を減らした。
- 部門フィルタ候補は `list_departments` BIZ/CMD で全件取得する設計にした。検索結果ページから候補を作る案は rejected として記録した。

## Issues Caught by Tests

- `doc-consistency-check.sh` が `per_page` 上限未定義 WARN を検出した。
- `doc-consistency-check.sh` が `未確定` marker を検出した。
- `doc-consistency-check.sh --target plan` が英語 `should` を曖昧語として検出した。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| 部門フィルタの取得元が未確定で、後続実装で backend/CMD scope が突然広がる可能性がある | accepted | `list_departments` BIZ/CMD 設計と `UI-01a-D7` を source docs に追加 |
| URL `sort` / `dir` と generated enum (`ProductCode`, `Asc` など) の mapping が source doc にない | accepted | `50-ui-product-list.md` に URL 値から `SortKey` / `SortOrder` への mapping を追加 |

## Issues Caught by External Review

- なし。

## Escaped / Late Findings

What reached a later stage and should have been caught earlier?

- 部門フィルタ option source は、Design Phase checklist の「operator workflow」または「command/data contract」確認時点で先に出せたはずだった。review-only で実装前に捕まったため escaped ではないが、Design checklist を補強する価値がある。
- PR body を英語で作成した。ユーザーが読みにくいという feedback を受け、同 PR で日本語へ更新し、workflow rule へ反映した。

## Test Adequacy

Strong tests:
- docs checks は、page size contract、stale marker、曖昧表現、Plan Packet substance を十分に検出した。
- runtime/backend non-scope diff check で、`src/` / `src-tauri/` 差分なしを確認した。

Weak or missing tests:
- docs-only PR のため UI behavior test はない。実装 PR では `list_departments` binding、DepartmentFilter 全件候補、URL state、pagination、sort enum mapping の frontend/Rust tests が必要。
- `list_departments` command design は document only。実装 PR で generated binding diff と command registration drift を検証する必要がある。

Mutation-style observations:
- `DepartmentFilter` が現在ページの `items` から候補を作る実装になった場合、今回の docs-only test では検出できない。実装 PR の UI test で「検索結果にない部門も候補に残る」ケースを入れる。
- `sort=product_code` が `SortKey.ProductCode` へ変換されない場合、実装 PR の payload mapping test で検出する。

## Signal / Noise

- sub-agent findings total: 2
- accepted: 2
- rejected: 0
- deferred: 0
- question: 0

## Cost / Friction

- useful cost: review-only sub-agent は P2/P3 とも実装前の修正につながった。Design Phase の効果確認として十分に有用。
- excessive friction: docs-only trial に R3 artifact 一式を使ったため、通常の小規模 docs cleanup には重い。
- confusing steps: PR description の英語化は repo owner の reviewability を下げた。workflow rule と PR body 更新で修正済み。

## Recommended Workflow Adjustment

Keep:
- R3 の Plan Packet / Test Matrix / review-only sub-agent default。
- Design Phase で durable design decisions を source docs に昇格する方針。
- `doc-consistency-check.sh` / `--target plan` の両方を docs/design PR で使う方針。

Change:
- Design Phase checklist に、filter / select control の option source を明示する項目を追加する。master data 由来か、現在結果由来か、paginated/filtered rows から候補を作って安全な理由を確認する。
- PR description / repository docs は原則日本語にする。technical identifier は標準英語表記のままにする。

Follow-up:
- UI-01a implementation PR では `list_departments` command / generated binding / DepartmentFilter / search pagination を同じ implementation scope に入れる。
- UI-01b route / form、cm / m toggle、dedicated scanner UX は別 Design Phase で扱う。

## Applied / Deferred Workflow Changes

Applied:
- `docs/DEV_WORKFLOW.md` Design checklist に filter / select option source の確認項目を追加。
- `docs/DEV_WORKFLOW.md` Commit / PR Messages に、PR description / repository docs は原則日本語、technical identifier は英語標準表記のまま、というルールを追加済み。

Deferred:
- `list_departments` の runtime 実装と generated binding 更新は UI-01a implementation PR へ deferred。
- UI behavior tests は implementation PR へ deferred。

Not applied:
- 機械 enforcement は追加しない。今回の evidence では checklist 補強で十分。
