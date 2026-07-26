# Test Design Matrix — Opus 5 役割確定の正本化（D-056 候補）

## Risk

Risk: R3

## Contracts Under Test

- SPEC-WF-OPUS5-2026-07-27 D1〜D5（packet Contract Coverage Ledger 参照。採用規範文 = anchor phrase 契約、既存 gate / §3 既存 6 項 = 不変 guard 契約）

## Anchor Phrase Contract（plan-gate 時点で固定）

各採用規範文は下表の anchor phrase を字句どおり含む文で実装する。全 anchor は対象 file で baseline 0 hit を plan-gate 時点で実証する（実行記録は PR body、count は tracked doc に書かない）。anchor は対象 file 内で実装後も単一出現となる literal を選定済み（memory `matrix-anchor-uniqueness` の適用: 汎用語・cross-reference と衝突しない定義文 literal のみ）。実装で参照文を追加する場合は該当 anchor の一意性を再確認する。

| Decision ID | Anchor phrase（字句一致） | 対象 |
|---|---|---|
| D1 | `read-only の Reviewer / Explorer 発注書ロール専任` | `docs/AGENT_OPERATING_MANUAL.md` §3 第 7 項 |
| D1 | `design board 例外の対象外` | 同上 |
| D2 | `低制約発注書 profile` | `docs/AGENT_OPERATING_MANUAL.md` §5.4 見出し |
| D2 | `過程指示・検証手順の指定を書かない` | `docs/AGENT_OPERATING_MANUAL.md` §5.4 本文 |
| D3 | `Fable slot の恒久喪失` | `docs/decision-log.md` D-056（revisit 条件） |
| D4 | `通常レビューは既存分業を維持` | `docs/decision-log.md` D-056（投入基準。§3 第 7 項にも同旨文を置くが assertion は file 別） |

## Assertion Commands（literal、repo root で実行）

各行 1 コマンド。`期待: 0` = exit 0（hit あり / 差分なし）、`期待: 1` = exit 1（hit なし）。

```bash
# M-A1 期待: 0
rg -F 'read-only の Reviewer / Explorer 発注書ロール専任' docs/AGENT_OPERATING_MANUAL.md
# M-A2 期待: 0
rg -F 'design board 例外の対象外' docs/AGENT_OPERATING_MANUAL.md
# M-A3 期待: 0
rg -F '低制約発注書 profile' docs/AGENT_OPERATING_MANUAL.md
# M-A4 期待: 0
rg -F '過程指示・検証手順の指定を書かない' docs/AGENT_OPERATING_MANUAL.md
# M-A5 期待: 0
rg -F 'Fable slot の恒久喪失' docs/decision-log.md
# M-A6 期待: 0
rg -F '通常レビューは既存分業を維持' docs/decision-log.md
# M-D056 期待: 0（決定と適用指針の接続）
rg -F 'D-056' docs/decision-log.md docs/AGENT_OPERATING_MANUAL.md
```

## 不変 guard 契約（gate / 既存規範の非接触の機械証明）

```bash
# M-N1 期待: exit 0 かつ出力 UNCHANGED（DEV_WORKFLOW / ci.md / scripts 完全不変）
git diff --quiet origin/main -- docs/DEV_WORKFLOW.md docs/ci.md scripts/ && echo UNCHANGED
# M-N2 期待: 1（AGENT_OPERATING_MANUAL の削除行は §5 見出し 1 行のみ = それ以外の削除なし）
git diff origin/main -- docs/AGENT_OPERATING_MANUAL.md | rg '^-[^-]' | rg -v -F '追加 prompt 3 本'
# M-N3 期待: 0（§3 既存第 6 項の非改変 = 希少 slot の Writer 制約が残存）
rg -F '希少・高コストな model slot は通常実装の Writer に充てない' docs/AGENT_OPERATING_MANUAL.md
# M-N4 期待: 0（§3.1 design board 例外の原文残存 = §3.1 無改訂）
rg -F '例外（design board）' docs/AGENT_OPERATING_MANUAL.md
```

## Mutation 感度実測（実装後、commit 済み clean tree で実注入 → red 確認 → 復元 → green 再確認）

| Mutation ID | 注入内容 | 検出する assertion | 対応 Decision |
|---|---|---|---|
| X1 | §3 第 7 項の専任文（A1 含む文）を削除 | M-A1 が exit 1 に反転 | D1 |
| X2 | §3 第 7 項の design board 対象外文を削除 | M-A2 が exit 1 に反転 | D1 |
| X3 | §5.4 節（見出し含む）を削除 | M-A3 が exit 1 に反転 | D2 |
| X4 | §5.4 の過程指示禁止文を削除 | M-A4 が exit 1 に反転 | D2 |
| X5 | decision-log D-056 の revisit 条件文を削除 | M-A5 が exit 1 に反転 | D3 |
| X6 | decision-log D-056 の投入基準文を削除 | M-A6 が exit 1 に反転 | D4 |

記録先 = PR body（注入 → red → `git checkout -- <file>` 復元 → green、各回 clean tree 確認）。

## 既存 checker

```bash
# 期待: PASS
bash scripts/doc-consistency-check.sh
# 期待: PASS（active plan 存在時）
bash scripts/doc-consistency-check.sh --target plan
# 期待: PASS
bash scripts/check-workflow-git.sh
```
