# Workflow Effectiveness Review: backup/migration failure contract 実装 PR1（PR #16）

対象: [archived Packet](2026-07-18-backup-migration-failure-contract-impl-pr1.md) / [Matrix](test-matrices/2026-07-18-backup-migration-failure-contract-impl-pr1.md) / PR #16（squash `8161a10`、2026-07-18）

## What worked

- **Double Audit が 2 連続で実バグ相当を検出**（PR #15 に続き 2 例目）: 1 pass（Fable inline 契約突合）は P1/P2 = 0 だったが、2 pass（Codex 独立 fresh context）が P2×4 を検出。うち 2 件は **survivor mutation**（テスト green のまま契約実装を丸ごと除去できる oracle 欠落）で、推論ベースの突合では原理的に見つからない種別。「2 pass を waive しない」規律の価値が再実証された。
- **Writer の oracle 変更に対する二重裁定**: Codex（Writer）が「既存 green テストの oracle が正本と逆」5 件を実装中に発見・修正した際、Coordinator が正本実文との突合（うち 1 件は「Writer 自身の書き戻しを根拠にした循環正当化でないか」の diff 確認）→ 2 pass の第三者再裁定、の 2 段で全件 accept を確定。Writer の善意の契約再解釈を裁定なしで通さないプロセスが機能した。
- **Contract Probe 4 件の事前確定**: pre-window dialog（MessageBoxW worker）/ CmdError kind wire / single-instance / no-clobber hard_link の 4 留保を本実装前に実証で潰し、本実装での手戻りゼロ。Probe #4（Rust std `rename` の置換挙動）は round 1 レビューの網羅漏れ指摘が拾ったもので、Plan Gate → Probe の連携も機能。
- **relay 予算の明示管理**: 2 pass round 2 を relay 追加でなく Coordinator inline 差分再確証（PR #15 と同型）に切り替え、調整理由を packet に記録して予算内で収束。

## What didn't

- **release build の盲点**: local-ci / cargo test / clippy / hosted CI がすべて debug profile のため、public snapshot `902647b` 由来の `generate_bindings` cfg 不整合（release で E0425）が owner の L3 準備まで潜伏。human-confirm 到達後に content fix が必要になり、state-backtrack + 再 walk のコストが発生した（memory `project-release-build-blind-spot` 反映済み）。
- **STATECAP forward 上限 3 と backtrack の相互作用**: backtrack 後の再 walk が 3 つ目の state-only 遷移 commit を消費し、`human-confirm -> ready-hosted-final` の遷移 commit を branch 上に作れなくなった。owner の early-Ready（遷移 commit 作成前の Ready 化）とも重なり、最終遷移は closeout narrative での実体化に退避（packet State Narrative に逸脱 2 点として明示記録）。
- **L3 手順 doc の public 化追随漏れ**: DEV_SETUP_CHECKLIST §L3 同期手順が旧 private clone パス（`C:\Users\Owner\projects\inventory-system`）のままで、owner が native clone の所在を見失った。
- **L3-1 の観測が事前説明と乖離**: 契約・Matrix oracle は充足したが、blank window shell がダイアログ背後に生成される実挙動は「window が開く前に表示」という Coordinator の事前説明より弱く、owner に判定の迷いを生じさせた。oracle の文言（Matrix）と operator への説明を一致させるべきだった。

## Adjustments（次への反映）

1. **release-profile compile check の gate 追加検討**（workflow docs PR / CI 再評価 2026-08-01 の判断材料）: 最低限、L3 を Human Gate に含む packet では owner 実機ビルド前に `cargo check --release` 相当を Writer の完了条件へ入れる。
2. **STATECAP と backtrack の設計見直し**（workflow docs PR）: backtrack 起因の再 walk は forward cap を消費しない、または cap 到達時の最終遷移は closeout 実体化を正規手順とする旨を DEV_WORKFLOW に明文化する（今回の narrative 退避を場当たりで終わらせない）。
3. **DEV_SETUP_CHECKLIST §L3 の clone パス更新**（workflow docs PR）: `C:\Users\Owner\projects\inventory-system-public` へ追随。
4. **blank window shell の抑止**（cosmetic backlog）: 起動失敗時の window 生成抑止 or 生成前 dialog 化。既存 backlog「起動時 setup 失敗の operator 可視化」と統合して扱う。

## Retired / Consolidated Rules

- blank window shell 抑止（Adjustment 4）を既存 backlog「起動時 setup 失敗の operator 可視化」へ統合し、新規 backlog 行を増やさない（Plans.md 側に統合先を記録済み）。
- 上記以外の退役・統合は none: Adjustment 1〜3 は規則の新設候補であり、次の workflow docs PR で DEV_WORKFLOW / DEV_SETUP_CHECKLIST への昇格を判断する（本 WER 時点では規則化しない）。
