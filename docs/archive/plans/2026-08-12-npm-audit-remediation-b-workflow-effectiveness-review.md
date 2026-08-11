# Workflow Effectiveness Review: npm 依存 audit 是正 change B（PR #71）

対象: PR #71（squash merge `c27ad0a`、2026-08-12）。起票契機は本 change 固有の新規事象 3 点 — Writer 停止条件の実運用初回（2 回発動・全 true positive）、evidence 表の手動転記系統誤り、共有 tree の実働中判明。D-062 (c) 編成そのものの評価は [formation WER（2026-08-04）](2026-08-04-d062c-formation-workflow-effectiveness-review.md) が正本であり、本 WER は編成評価を繰り返さない。

## Workflow Used

- Project Profile: [project-profile.md](../../project-profile.md)
- Plan Packet: [2026-08-12-npm-audit-remediation-b.md](2026-08-12-npm-audit-remediation-b.md)（gated Amendment ×2）
- Test Design Matrix: [同名 matrix](test-matrices/2026-08-12-npm-audit-remediation-b.md)
- review-only sub-agent: 独立 Sonnet Plan Reviewer（rally 3 round）+ 独立 Sonnet Final Reviewer（R3 Contract Audit + 是正 close 判定の継続 context 再検証）
- external review: なし（Codex は Writer 側）
- human approval: plan 承認 / Amendment 1 承認 / merge bundle 承認（Ready・merge + npm CLI 12 採否 + Amendment 2 追認）= 介入 3/3
- gates: doc-consistency `--target plan`（PK1〜PK6）、L1 full ×2（content HEAD / Ready 後最終 HEAD）、hosted final、三点一致 merge
- 本 change 固有の追加規律: 供給網検分（lockfile diff 全変更 package の publish 日実測 + 2026-08-04 Shai-Hulud 攻撃窓照合 + keyv 系更新禁止 + orphan 削除の根拠記載）、Writer 発注書への明示的停止条件（期待リスト外 diff / 未実測項目の不成立 / docs gate 吸収不能）

## What Worked

- **Writer 停止条件が 2 回とも true positive**。①esbuild 未達（真因 = tsx@4.21.0 の `~0.27.0` pin、packet が「未実測」と明示していた項目の不成立）②期待リスト外 diff（tsx@4.23.5 の依存廃止による orphan 削除 2 件）。いずれも Writer が独断続行せず停止 → Coordinator 実測 → gated Amendment で契約を更新してから再開、という設計どおりの分業が回った。「未実測項目は Contract Probe に明示し、不成立を停止条件にする」型は依存更新系 change の標準にできる
- **Final Review の再現実験主義**が手動転記の系統誤りを検出した。step 1 SHA の checkout 独立再実行（AC-1 再現）に加え、step 2 コマンドを単独実行して「packet 記載コマンドだけでは total 0 に到達しない」ことを実証し、未開示の `npm update js-yaml` の存在を逆算で特定した（P2-2）。lockfile 全 parse による検分表突合が before 列の約 7 割誤りを検出した（P2-1）
- **Plan Gate rally が構造欠陥を機械検査の手前で捕捉**。round 1 P1-2（2 PR 構成が 1 packet = 1 PR 前提の PK5 ancestry と衝突）は機械検査では検出できない設計問題で、単一 PR + 2 step 化の再設計に直結した。P1/P2 は 5 → 2 → 1 と単調収束し天井 3 round で終結、disposition 切替（D-065）も初適用どおり機能
- **供給網検分規律（publish 日 + 攻撃窓照合）**は Shai-Hulud（08-04、cooldown 通過済み侵害 version が registry に現存）に対する実効防御として機能した。全 45 エントリを攻撃窓前 publish で揃え、修正目標 version の事前実測（Contract Probe）が Writer の解決結果と一致した
- 機械検査（PK4 13 field / PK3 観測 token / PK6 数値実測 evidence）が rally 各 round の整形不備を即時検出し、reviewer の注意を実質問題に集中させた

## What Did Not Work

- **発注書の「public-writer clone を必ず使用」が守られず、共有 tree が実働中に判明した**（起動 directory 罠の 3 回目、memory `project-codex-launch-directory-pitfall` 既知）。テキスト指示では防げないことが再々実証された。今回は serial 引き継ぎで実害ゼロ、Amendment 2 の ownership 宣言 + staged 検分で継続したが、検出が「lockfile が Coordinator 側 tree で変化していた」という偶然の実測経由だった
- **evidence 表の手動転記**が defect 源になった。before 列（security 判定に直結しない列）に advisory affected range 下限の混入が集中し、Draft PR まで到達した（Final Review で捕捉）。「実測した値」と「文脈から補完した値」を Writer が区別しない現象の実例
- **relay 往復予算 2 が停止条件設計と構造的に不整合**。停止条件を N 個仕込めば最大 N 回の停止 → 再発注往復が正常系として発生する。今回 relay 3/2 の超過 1 は停止条件の正しい発動が原因であり、予算側の設計誤り

## Issues Caught Before Implementation

- rally round 1 P1-1: Plans.md 導線欠落（PK4 機械検出の再現込み）
- rally round 1 P1-2: 2 PR 構成と 1 packet = 1 PR 前提の衝突（PK5 ancestry 実害を設計段階で除去）
- rally round 2 P2-1: step 1 中間 evidence の SHA アンカー欠如（squash 後の検証不能性）
- rally round 3 P2-1: 撤退経路の「Amendment」語が D-039 gated amendment と新規作業を混同
- Coordinator 事前実測: 修正目標 version の publish 日 / cooldown 適合、GHSA 9 件の実読（malware 混入なし・全 devDep transitive）、keyv 系 lockfile pin の安全確認

## Issues Caught by Tests

- 該当なし（アプリ test への影響ゼロ。L1 full は両 HEAD で green、oracle は `npm audit --json` の total / 内訳照合が担った）

## Issues Caught by Review-only Sub-agent

| Finding | Classification | Result |
|---|---|---|
| Final P2-1: 検分表 before 列の系統転記誤り（約 7 割） | accepted | Coordinator が機械抽出で再生成、reviewer 独立パースと一致確認で closed |
| Final P2-2: `npm update js-yaml` の未開示（単独再現実験で実証） | accepted | PR body に実行コマンド全量 + 機序説明を追記、closed |
| Final P3-1: Plans.md entry の stale label | accepted | 即時是正、closed |

## Issues Caught by External Review

- 該当なし（external review なし。Writer = Codex の停止報告 2 件は review ではなく実装時の契約遵守として What Worked に記録）

## Escaped / Late Findings

- merge 後に escape した欠陥はなし。検分表 before 列誤りは Draft PR まで到達した late catch（Final Review で捕捉、merge 前に是正）
- Dependabot「8 件」と npm audit「7 件」の差分は change 中に気付き、closeout 後の実査で cargo 側 2 件（rand / glib、Tauri upstream-blocked）と確定 — scope 外として backlog 化で正

## Test Adequacy

- audit oracle を `--audit-level=high` exit code でなく `--json` の total + 内訳照合に固定した設計（matrix FM-4）は、js-yaml 4.3.0 止まり等の部分解消を検出できる感度を持ち、Final Review の再現実験でも有効に機能した
- 検分表の網羅性 oracle（diff 全 package × 検分表突合）は Final Reviewer の独立抽出で実際に執行された。ただし「before 列の正しさ」は oracle 未定義だった — 機械抽出生成の義務化（下記）で解消する
- `.npmrc` 不変・keyv 系不変の機械 gate は未整備のまま diff review 依存（packet Residual Test Gaps に記録済み）。今回は人的確認で足りたが、依存更新 change が今後も続くなら gate 化の費用対効果を再評価する

## Signal / Noise

- rally / Final Review の findings は P1 2 / P2 5+2 / P3 2 全件 accept で noise ほぼゼロ。誤指摘・幻覚引用は本 change では発生しなかった（reviewer への「機械検査主張は実行裏取り」指示が効いた可能性）
- 機械検査の PK6（数値主張の実測 evidence）が Review Response の round 記録に 1 回 WARN を出した。backtick 付き実測 token を書けば通る形式要求で、実害はないが記録文体を縛る軽微な摩擦

## Cost / Friction

- 介入 3/3（plan / Amendment 1 / merge bundle）、relay 3/2（超過 1 は停止条件起因・容認記録済み）、STATECAP forward 3/3 — いずれも上限ちょうどで、bundle 設計（npm 12 採否 + Amendment 2 追認を merge 承認へ同乗）が予算内完走の決め手だった
- Sonnet 系 WebSearch subagent が cyber safeguard で 1 回落ち、Coordinator inline へ切替（memory `feedback-security-review-subagent-routing-guardrail` の既知事象。防御目的の供給網調査でも発火し得る）

## Recommended Workflow Adjustment

1. **evidence 表の機械抽出生成を Writer 発注書の標準義務にする**: lockfile / version 遷移 / 件数の before-after 表は「`git show main:<file>` と HEAD の機械比較で生成し手動転記しない」を発注書 template に載せる。reviewer 側の独立パース突合とペアで二重検証になる（memory `feedback-evidence-tables-machine-extracted` 保存済み、正本化は deferred）
2. **Writer 発注書の必須先頭 step に「`pwd` + `git remote -v` の実行と報告」を置く**: 起動 directory の誤りをテキスト指示でなく初回報告で機械的に検出する（共有 tree 3 回目の対策。判明後の ownership 宣言 + staged 検分 + tree 復元操作の相互確認は Amendment 2 の型がそのまま再利用可能）
3. **relay 往復予算は「基本 2 + 発注書の停止条件数」で設計する**: 停止条件の正しい発動を予算超過として扱わない。packet template の Owner Effort Budget 節に注記する形が軽い
4. 依存更新系 change の標準型として「未実測項目を Contract Probe に列挙し、その不成立を Writer 停止条件へ写像する」を manual へ昇格する候補（今回 2/2 で機能）

## Retired / Consolidated Rules

- なし（本 change で新設した供給網検分規律は packet 局所。常設化するかは次の依存更新 change で再評価し、2 回機能したら CLAUDE.md「npm 供給網防御ルール」へ昇格を検討）

## Applied / Deferred Workflow Changes

- Applied: memory `feedback-evidence-tables-machine-extracted` 保存（2026-08-12）。cargo 側 2 advisory の評価と処置は D-067 として同日起票
- Deferred（WER deferred 規律に従い backlog 起票、次回 workflow docs change でまとめて正本化）: 上記 Recommended 1〜4 の template / manual への反映
