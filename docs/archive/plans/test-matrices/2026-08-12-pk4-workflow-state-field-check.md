# Test Design Matrix: PK4 Workflow State 必須 field 検査

対象 packet: [2026-08-12-pk4-workflow-state-field-check.md](../2026-08-12-pk4-workflow-state-field-check.md)

## Test Cases

| ID | 対象 | 条件 | oracle（期待） |
|---|---|---|---|
| M-P1 | field 欠落 ERROR | R3 active packet で 13 field のうち 1 field を欠落させる（行欠落素通しだった 11 field は新設 loop の data-driven 全数、Phase / Execution Mode は既存 checker message の assert を新設 — 既存 case は enum 外のみで行欠落を assert していない） | 各 field 名を含む PK4 ERROR が出力され exit 非 0 |
| M-P2 | Hosted CI Requirement enum | 値を `maybe` 等 enum 外にする | enum 違反 ERROR |
| M-P3 | pending / none / 日本語先頭の正当値 | Plan Commit=`pending`（Phase=plan-gate）/ Reviewed Content HEAD=`pending` / Amendments=`none` / Human Gate=`none` / Plan Reviewer=`未定（plan-gate 時に選任）`（非 ASCII 先頭の実在型） | ERROR 0 |
| M-P4 | 任意追加 field 共存 | `- Draft Provenance: ...` 行を Workflow State に追加 | ERROR 0（未知行は禁止しない） |
| M-P5 | archive skip 維持 | archive path の packet を明示指定し field を欠落させる | 新設検査の ERROR なし（既存 skip 挙動） |
| M-P6 | R2 閾値維持 | R2 packet の field 欠落は ERROR、**R1 packet fixture（新設 — 既存 test file に R0/R1 fixture は 0 件、実測 `rg 'PKT_WS_RISK='` = R3×1 / R2×3）で新設 11 field のうち 1 field 以上を欠落させ ERROR 0 を assert** | R2 で ERROR / R1 で ERROR 0（level 閾値 skip） |
| M-P7 | 既存正例維持 | fixture default（13 field 完備）の既存正例 case | ERROR 0 のまま（既存 assert 無改変） |

## Mutation Sensitivity（X 系）

| ID | 一時注入 | RED oracle |
|---|---|---|
| X1 | 新設 field list から 1 field（例: Coordinator）を除外 | M-P1 の該当 field case が fail |
| X2 | Hosted CI Requirement enum 検査を恒真化 | M-P2 が fail |
| X3 | 新設検査を archive skip の外側へ移動（archive にも適用） | M-P5 が fail |
| X4 | R2 閾値（level 判定）を新設検査で無視 | M-P6 の R1 fixture case（field 欠落 + ERROR 0 期待）が fail |

注入は Writer 自己実測 + Coordinator 独立再実測（注入形独自設計・Writer 注入形非参照）。oracle は drift test の assert 文言（field 名 literal）に固定し、checker 実装の message 定数から導出しない（独立転記）。

## Negative Paths

- missing input: Workflow State 節自体の欠落は既存 case 2 が担保（無改変）。
- invalid input: enum 外値（M-P2）、field 行の値空文字（`- Coordinator:` のみ）は欠落と同扱いで ERROR（M-P1 の変形として 1 case 含める）。
- duplicate: 同一 field 行の重複は検査対象外（非目的、既存 parse の先勝ち挙動を変えない）。

## Boundary Checks

- threshold: level 2 が検査対象の下限（R2）、level 1 以下は非対象。
- null/default: `pending` / `none` は行存在ありの正当値。
- 値の形式: 新設 11 field は raw regex 判定（コロン後の非空白 1 文字以上）のため `extract_workflow_field` の ASCII 先頭 token 制約を受けない。日本語・自由文値（例: Coordinator の `Fable 5（main thread / owner relay）`、Plan Reviewer の `未定（…）` 型）が正当に通ることを M-P7 default 値と M-P3 の日本語先頭 case で担保。
- producer/consumer: checker（PK4）と drift test（M-P 系）は field list を独立に保持し、片方だけの変更を X1 が検出。

## Residual Test Gaps

- 実 packet 群（archive 全数）への一括再検査は行わない（非目的）。archive skip 機構が既存のまま働くことのみ M-P5 で担保。
- field 値の意味検証（role の実在 model 名等）は非目的であり test も置かない。
