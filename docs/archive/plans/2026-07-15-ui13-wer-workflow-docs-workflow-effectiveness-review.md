# Workflow Effectiveness Review: UI-13 WER 正本化 workflow docs（Public PR #7）

## Workflow Used

- Plan Packet / Matrix: [packet](2026-07-15-ui13-wer-workflow-docs.md) / [matrix](test-matrices/2026-07-15-ui13-wer-workflow-docs.md)
- 体制: Fable が Coordinator 兼 Writer（docs 3 file の軽微修正例外）。自己承認回避のため plan rally / Double Audit は全て独立 Sonnet context
- review: plan rally 4 round、Double Audit（同一フル Contract Audit ×2、レンズ分割なし）
- gates: L1 full ×2、doc-consistency、workflow-git（materialize 直後の局所実行を self-dogfood）、hosted workflow_dispatch final

## What Worked

- **plan rally が Coordinator 自身の Risk 誤判定（R2→R3）を round 1 で捕まえた**。workflow gate change の R3 明文規則と PR #2/#4 前例を reviewer が独立に裏取りした。Writer 兼任の Coordinator に対して独立 plan review が実効的に機能した直接証拠。
- round 2 の P1-b（Human Gate 失効条項の自己裁定）を owner 確認に戻した。自己承認回避の原則が review によって強制された。
- 正本化した materialize 局所検査を本 change 自身で self-dogfood し、全 materialize commit 直後の workflow-git PASS を確認。
- Double Audit は pass A = 0 findings / pass B = P3 ×1 で、冗長実施が単発監査より 1 件多く拾った（レンズ分割なし設計の意図どおり）。
- docs-only R3 の hosted final を workflow_dispatch 経路で取得し三点一致を成立させた（D-043 の explicit dispatch 規定の実測 2 例目）。

## What Did Not Work

- Coordinator の反映作業で 2 回の同期漏れ（round 2 反映時の Matrix 未同期 = round 3 P2、round 3 反映時の「8 項目」表記残存 = pass B P3）。多箇所に複製された数値・列挙は反映時に rg で全箇所同期すべき（drift-fix sweep の plan doc 内適用）。
- 初回 Risk 判定を「機械 gate に触れない」ことを根拠に R2 とした。「workflow gate = 人間手続き gate の正本を含む」という読みが抜けていた。

## Issues Caught Before Implementation

- Risk 昇格（round 1 P1）、Double Audit のレンズ分割誤設計（round 2 P1-a）、Human Gate 自己裁定（round 2 P1-b）、AC token 対応不備（round 2 P2 / round 3 P2）。

## Issues Caught by Review-only / Double Audit

| Finding | Classification | Result |
|---|---|---|
| packet 内「8 項目」表記が 9 token 化に未同期（pass B） | evidence quality | 処方どおり訂正（audited content 後の変更はこの 1 件のみ） |

## Escaped / Late Findings

- なし（merge 後 escape は現時点なし）。

## Test Adequacy

- token 検査 ①〜⑨ + 追加のみ diff 検査で docs 変更としては十分。機械強制（checker WARN / hook）は意図的 defer — 発動実績を見て判断。

## Signal / Noise

- rally 4 round は全 round で新規 finding があり冗長でなかった。P1 3 件が全て「Coordinator の自己判断の誤り」を突いており、独立 review の対象として正しい場所に効いた。

## Cost / Friction

- owner 実働: 介入 2 / 予算 2（事前指示 + 失効条項確認）。
- friction: Coordinator 反映時の同期漏れ 2 件による rally 1 round 追加。

## Retired / Consolidated Rules

- consolidate: 登録・生成義務 checklist は memory → template 正本へ昇格完了（memory は Claude 向け運用注記として存続）。probe 是正仮適用 / materialize 局所検査も DEV_WORKFLOW 正本化完了。UI-13 WER の Deferred 3 点はこれで全消化。
- retire: なし。

## Recommended Workflow Adjustment

Keep:

- Writer 兼任時の plan rally / Double Audit 全独立化。
- materialize 直後の workflow-git 局所実行（本 change で habit 化開始）。

Change:

- plan 反映作業では、変更した数値・列挙を rg で packet + Matrix 横断検索して全箇所同期する（本 change で 2 回漏れた）。運用注意で開始し、再発したら checker 化を検討。

Follow-up:

- checklist / materialize 検査の機械強制化は発動実績待ち（PR body Follow-up と同旨）。

## Applied / Deferred Workflow Changes

Applied:

- Registration / Generation Obligations 節（template）、probe 是正仮適用 + materialize 局所検査（DEV_WORKFLOW）— PR #7。

Deferred:

- 機械強制化（checker WARN / hook）。
