# Workflow Effectiveness Review: backup/migration failure contract 実装 PR2（PR #17）

対象: [archived Packet](2026-07-18-backup-migration-failure-contract-impl-pr2.md) / [Matrix](test-matrices/2026-07-18-backup-migration-failure-contract-impl-pr2.md) / PR #17（squash `601f160`、2026-07-21）

## What worked

- **Double Audit 2 pass が 3 PR 連続で実欠陥/oracle gap を検出**（PR #15、PR1/PR #16 に続き 3 例目）: 1 pass（Fable inline 契約突合）は P1/P2 = 0 だったが、2 pass（Codex 独立 fresh context、契約正本直読 + 実 mutation 再実行）が P1×1 + P2×2 を検出。P1 は §71.5 ファイル名検証欠落（`extract_date_from_backup` が separator/HHMMSS を未検証）で plan-first 時点から存在する既存欠陥、P2×2 は E3（COMMIT 失敗の併合メッセージに実 commit_error が含まれるかの検証欠落）と D5b（削除失敗時の warn + 継続の検証欠落）という survivor mutation 型の oracle gap。全件 Coordinator 実証裁定で accept、closure 再検証で mutation 3/3 red を実証。「2 pass を waive しない」規律の価値が 3 回連続で再実証された。
- **PR1 WER Adjustment 1（release-profile compile check gate）が本 PR で実運用に組み込まれ効果を確認**: Scope / Matrix G2 に `cargo check --release` green を明記した結果、release build 起因の state-backtrack は発生しなかった。STATECAP forward 上限 3 をちょうど使い切る形で `human-confirm -> ready-hosted-final` まで正規の state-only 遷移 commit で到達し、PR1 で必要になった narrative-only closeout 退避は不要だった。
- **Contract Probe が Plan Gate round 1 の P1 指摘を即日実証で解消**: 本番 WAL での COMMIT-時 BUSY 再現不成立を追加 probe（Probe A-2）で確定し、E3 を実 lock 依存の再現から決定論的 failpoint 注入設計へ是正。round 2/3 で同種の再発なし。
- **Owner Effort Budget の事前調整が的中**: PR1 の介入上限 4 → PR2 の 3（Windows native L3 を Impact Review Lenses の Eligibility 条件で非該当と判定し実機確認を除外）に対し、実消費も 3/3 に収まった。

## What didn't

- **Test Design Matrix D5 の起票時に実在しない既存テストを引用**: 「パターン不一致 skip」を既存テストとして記載したが実在せず、Plan Gate 3 round では検出されずに Double Audit 2 pass（Broad Audit 段階）まで持ち越された（Matrix D5 行の訂正注記、D5a/D5b として新設）。
- **§71.5 ファイル名検証欠落が Ledger 起票時に漏れ、複数のレビュー層を素通りした**: 当該欠陥は plan-first 時点から存在する既存欠陥で、PR2 の cleanup 変更が touch する契約でありながら当初 Contract Coverage Ledger に含まれていなかった。Plan Gate 3 round・Writer 自己レビュー 2 round（round 1 は 71 §71.5 を含めて走査したと記録）・R4 review-only sub-agent（live diff 基準）のいずれでも検出されず、契約正本を直読した Codex 独立 2 pass で初めて検出され、post-freeze の gated amendment（same-PR fix + Ledger 2 行追加）で処理した。

## Adjustments（次への反映）

1. Matrix 起票時に「既存テストで回帰担保」と記載する行は、該当テスト名を実在確認（`rg` 等）してから記載する運用を Plan Gate チェック項目に追加検討（D5 の誤記載が 2 pass まで持ち越された教訓）。
2. Ledger 起票段階で「Scope が touch する既存 contract で Ledger 未収録のものがないか」の adjacent-contract sweep を Plan Gate 手順に明文化検討（§71.5 は cleanup 経路が触れる隣接契約でありながら当初 Ledger 漏れだった。PR1 Plan Gate round 1 の no-clobber publish 網羅漏れ P1-3 と同型のパターンが 2 回目）。
3. 上記 2 点は post-freeze の gated amendment で処理でき、waive せず是正する規律自体は機能した — 規律の変更は不要。改善対象は「検出タイミングを Plan Gate 側へ前倒しできないか」の一点に限定する。

## Retired / Consolidated Rules

- PR1 WER Adjustment 1（release-profile check gate）: 本 PR で実運用に組み込まれ効果を確認。DEV_WORKFLOW / template への恒久昇格はまだされておらず、Plans.md 記載の workflow docs PR 待ち（継続 pending、変更なし）。
- PR1 WER Adjustment 2（STATECAP × backtrack 相互作用の明文化）: 本 PR では backtrack 自体が発生せず検証機会なし（該当なし/観測なし）。
- PR1 WER Adjustment 3（DEV_SETUP_CHECKLIST §L3 clone パス更新）/ Adjustment 4（blank window shell 抑止）: 本 PR は Windows native L3 非該当のため観測なし。
