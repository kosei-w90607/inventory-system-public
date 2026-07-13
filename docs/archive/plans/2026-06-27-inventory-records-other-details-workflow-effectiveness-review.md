# Workflow Effectiveness Review: 入庫 / 返品・交換 / 手動販売の業務記録詳細横展開

## Workflow Used

- Project Profile: `docs/project-profile.md`
- Plan Packet: `docs/archive/plans/2026-06-27-inventory-records-other-details.md`
- Test Design Matrix: `docs/archive/plans/test-matrices/2026-06-27-inventory-records-other-details.md`
- review-only sub-agent: Hegel timeout、Cicero P1/P2なし、Euclid final P1/P2なし
- external review: なし
- human approval: Windows native L3 owner confirmation 全項目 OK
- gates: GitHub CI 3 jobs、frontend gates、Rust gates、doc consistency、traceability、pre-push hook

## What Worked

- Design Phase で `65-inventory-record-traceability.md` に detail expansion slice を明記していたため、手動テスト項目は source doc / Plan Packet から導出できた。
- Windows native L3 が、親 route `<Outlet />` 不足、UI-02/UI-03 の `すべての履歴を見る` 未実装、routeTree 再生成漏れを実利用 flow で検出した。
- PR Draft checkpoint は有効だった。初回実装完了時点で PR を作り、native L3 と追加修正を同じPRで追跡できた。
- final full-diff review-only を merge 前に追加したことで、L3 修正後の route/search state と recent link 差分を再確認できた。

## What Did Not Work

- `UI-02 / UI-03 の recent list には「すべての履歴を見る」と detail 導線を置く` は source doc にあったが、初回実装の自動テストは detail 導線中心で、all-history 導線を落としていた。
- review-only sub-agent も all-history 導線の欠落を指摘できなかった。差分の挙動だけでなく、Plan Packet acceptance criteria との項目照合が弱かった。
- 手動手順には仕様由来の期待値を出せていたが、手順を出す前に「その期待値が自動テストで代表確認されているか」のセルフチェックが不足した。

## Issues Caught Before Implementation

- 取消 / 訂正、CSV/印刷、画像 asset 表示、種別別専用一覧は source docs と Plan Packet で非 scope に分離できた。
- UI-04 は現行作成画面に recent list を持たず、保存結果から detail 導線を置く、という当時の仕様は実装前に固定できた。

## Issues Caught by Tests

- Rust tests で4種横断 list、detail not_found、manual_sale ID と sale_records ID 混同、register_processed return の movement semantics を確認した。
- RTL tests で detail page 表示、returnTo、records list detail link、UI-04 保存結果 detail link を確認した。
- L3 feedback 後、UI-02/UI-03 recent list の `すべての履歴を見る` と `詳細を見る` href を RTL に追加した。

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| Hegel timed out | question | findings なし。Cicero で rerun |
| Cicero P1/P2なし | accepted | 初回実装レビューとして記録 |
| Euclid P1/P2なし | accepted | L3 修正後の final full-diff review として記録 |

## Issues Caught by External Review

- なし。

## Escaped / Late Findings

- UI-02/UI-03 recent list の `すべての履歴を見る` 未実装が Windows native L3 まで残った。
- 3種 detail route が親作成画面に吸われる `<Outlet />` 不足が Windows native L3 まで残った。
- 手動販売出庫に recent list が無い点は仕様どおりだったが、UX としては作業画面間の一貫性が弱いことを L3 後に再評価した。

## Test Adequacy

Strong tests:
- 4種横断 list の header-level row、sort、filter、validation。
- detail page の header / items / total / movements。
- movement source route と detail returnTo。

Weak or missing tests:
- 初回実装時点で UI-02/UI-03 `すべての履歴を見る` が未テストだった。
- 親 route が child route を render する integration test は L3 feedback 後に追加された。

Mutation-style observations:
- recent section の header action を削除しても初回 tests は落ちなかった。L3 後の追加 test で落ちるようになった。
- parent route が `<Outlet />` を持たない場合、route regression test で落ちるようになった。

## Signal / Noise

- sub-agent findings total: P1/P2 0
- accepted: 0
- rejected: 0
- deferred: 0
- question: Hegel timeout 1

## Cost / Friction

- useful cost: Draft PR checkpoint、Windows native L3、final full-diff review-only。
- excessive friction: Hegel timeout は成果なし。以後は timeout 後に狭い観点で rerun する判断を早める。
- confusing steps: 手動確認手順が仕様由来であることは正しかったが、どの画面のどの link を指すかの説明が不足し、movement 元記録 link の確認で質問が出た。

## Recommended Workflow Adjustment

Keep:
- R3 の Draft PR checkpoint。
- Windows native L3 を merge gate にする運用。
- L3 feedback 後の targeted regression test 追加。

Change:
- 手動確認手順を出す前に、各手順が source doc / Plan Packet / Test Matrix のどこから来たかを短く点検する。
- 手動確認手順に「画面名」「列名」「リンク文言」「戻り先の検索状態」を明示する。
- review-only prompt には Plan Packet acceptance criteria の項目照合を明示する。

Follow-up:
- 手動販売出庫にも recent list を追加するかを source docs で再設計し、別 PR として扱う。

## Applied / Deferred Workflow Changes

Applied:
- `docs/DEV_WORKFLOW.md` と `inventory-implementation` skill に Draft PR checkpoint を追加済み。
- UI-02/UI-03 recent list の all-history 導線は同 PR 内で仕様・テスト・実装を整合済み。

Deferred:
- review-only prompt template への acceptance criteria checklist 強制は、次の R3 PR で必要性を見て小さく更新する。

Not applied:
- 機械的な手動手順生成チェックは未導入。現時点では効果より摩擦が大きいため、次PRで人手の点検手順として dogfood する。
