# Plan Packet: Fable exit runway 起点

Risk: R1

> **Status**: 完了（2026-07-06 closeout で archive）。全 work package 消化済み: 起点 PR #134 → P1 PR #136 → P2 PR #137 → P3 PR #138。

Docs-only の runway 整理。実装コード、migration、テスト、lockfile、実データは変更しない。

## Goal

Fable 主導の次段階へ移る前に、現時点の完了状態と直近の docs-only work package を 1 本の起点 plan に固定する。Phase 4 第1スライス判断の前に、既知の docs drift と運用手順の穴を小さい PR に分割できる状態にする。

## 現在地サマリ

- GitHub `main` は PR #133 `c6b5f11` と closeout `ab1391a` まで取り込み済み。
- Phase 3 は完了済み。Phase 4 は未着手。
- 本 PR 着手前の active plan はゼロ。
- 本 PR は runway 起点の active plan を 1 本作成し、実装・設計本体には入らない。

## Scope

1. この active Plan Packet を新規作成する。
2. [../../../Plans.md](../../../Plans.md) を PR #133 後の現在地と Fable exit runway に同期する。
3. 後続 work package の完了条件と後続 PR 番号欄を用意する。

## Non-scope

- [../../function-design/42-cmd-sales-stocktake.md](../../function-design/42-cmd-sales-stocktake.md) や [../../function-design/10-common-rules.md](../../function-design/10-common-rules.md) の drift 修正本体。
- operating manual / review lenses の本文執筆。
- 実装コード、migration、テスト、lockfile、生成物の変更。
- Phase 4 の設計着手。
- 実データ、実 JAN、店舗固有情報の記載。

## Work Packages

| Package | 内容 | 完了条件 | 後続 PR 番号 |
|---|---|---|---|
| P1 docs drift 修正 | `42-cmd-sales-stocktake.md` の BIZ 経由記述反転を戻す。`search_products` の `per_page` は docs 上 200 クランプ契約とされているが、実装に上限クランプは存在しないため、表記と実装方針（クランプ / reject / 現状容認）を統一する。 | `42-cmd-sales-stocktake.md` と関連 source docs の記述が実装実態と一致し、幽霊定数 `PAGINATION_MAX_PER_PAGE` 参照が残っていない。`bash scripts/doc-consistency-check.sh` が green。 | #136 |
| migration v4 docs 追記 | [../../function-design/22-mnt-migration.md](../../function-design/22-mnt-migration.md) に daily report 用 migration v4 の事実を追記する。 | migration v4 のテーブル群、登録順、backfill なしの扱いが source docs から追える。docs check が green。 | #137 |
| agent operating manual 作成 | Fable / Codex / review-only の役割分担、handoff、PR evidence、branch 操作を repo-local manual として作る。 | operating manual の置き場所が決まり、起動手順・禁止事項・PR evidence の読み方が 1 つの文書で追える。docs check が green。 | #138 |
| review lenses 追加 | [../../quality/review-checklist.md](../../quality/review-checklist.md) に Fable exit 後も拾うべき review lenses を追加する。 | checklist に docs drift、source-of-truth、agent handoff、Phase 4 着手前確認の観点が入る。docs check が green。 | #138 |

## Acceptance Criteria

- `docs/plans/2026-07-05-fable-exit-runway.md` が active R1 plan として存在し、Risk 行と必須セクションを持つ。
- `Plans.md` の基準行が PR #133 `c6b5f11` 以降の `main` を示す。
- `Plans.md` の次の主作業候補が「Fable exit runway 3 PR → Phase 4 第1スライス判断」になっている。
- PLU 実機確認は `次の行動` と backlog の二重記載ではなく、backlog 側に統合されている。
- backlog に `search_products` pagination 統一検討と MSI 配布手順 docs 化が追加されている。
- `bash scripts/doc-consistency-check.sh` が green。

## Design Sources

- Workflow: [../../DEV_WORKFLOW.md](../../DEV_WORKFLOW.md)
- Doc style: [../../DOC_STYLE_GUIDE.md](../../DOC_STYLE_GUIDE.md)
- Live dashboard: [../../../Plans.md](../../../Plans.md)
- Stable memory: [../../project-memory.md](../../project-memory.md)

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Dashboard / plan evidence | `Plans.md`, this Plan Packet | updated in this PR |
| Function design docs drift | `42-cmd-sales-stocktake.md`, `10-common-rules.md`, `22-mnt-migration.md` | intentionally deferred to follow-up PRs |
| Agent operating manual | repo-local docs location to be selected in follow-up | intentionally deferred |
| Review checklist lenses | `quality/review-checklist.md` | intentionally deferred |

## Test Plan

- `bash scripts/doc-consistency-check.sh`
- Manual self-check: linked local files exist.
- Manual self-check: PR #128〜#133 are not converted back to unfinished work.

## Review Focus

- This PR stays docs-only and does not include implementation files.
- Follow-up work packages are scoped as later PRs, not implemented here.
- `Plans.md` reflects live state without duplicating PLU real-device confirmation across next action and backlog.

## Implementation Results

- 起点 PR #134（`7c2b00c`、2026-07-05）: active plan 作成 + `Plans.md` を PR #133 後の現在地に同期。
- P1 docs drift 修正 = PR #136（`4cb4512`、2026-07-06）: decision-log D-031 追加、`42-cmd-sales-stocktake.md` の BIZ 経由記述修正、幽霊定数 `PAGINATION_MAX_PER_PAGE` 参照除去、Fable レビュー P2 対応で `architecture/cmd-task-specs.md` の「IO-01経由」stale 表を全行修正（settings 系のみ許可済み例外として残存）。
- P2 migration v4 docs 追記 = PR #137（`e38346d`、2026-07-06）: `22-mnt-migration.md` §11 に日報取込み 4 テーブルの適用方式・登録順・backfill 不要・PRAGMA 扱いを記録。Fable 実装突合で完全一致、指摘ゼロ approve。
- P3 operating manual + review lenses = PR #138（`0bc07e2`、2026-07-06）: `docs/AGENT_OPERATING_MANUAL.md` 新設（入口一本化 / router 表 / 新規 3 prompt / Codex 非対称の注意）+ `quality/review-checklist.md` に設計判断レンズ 12 項目を追加。
- 派生成果: 店舗実機調査バッチ issue #135（PLU-19/20/22 再確認 + 実ファイル採取 + 運用ヒアリング）。pagination 実装統一と MSI 配布手順 docs 化は `Plans.md` backlog に登録済み。

## Review Response

Review-only skipped because: R1 docs-only runway plan and dashboard sync. Full docs check and manual link/scope checks are sufficient for this PR.
