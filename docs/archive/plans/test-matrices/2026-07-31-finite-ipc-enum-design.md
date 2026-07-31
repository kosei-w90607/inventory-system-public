# Test Design Matrix: 有限 IPC 値の generated enum contract 化（監査是正 順14 design-first）

対象 packet: [2026-07-31-finite-ipc-enum-design.md](../2026-07-31-finite-ipc-enum-design.md)

docs-only PR のため、機械 token 検査 + 既存 gate 回帰 + 独立レビュー突合で構成する。oracle は本 Matrix に独立転記した literal を正とし、対象 doc から導出しない。消滅系（空集合）oracle は必ず対応する非空 oracle と対で運用する。負 glob は使わない（ripgrep 15.1.0 既知不具合）。全 baseline は 2026-07-31 の改訂前 repo で実測済み。

| ID | 検査対象（契約） | 手順 | 期待（oracle） | 種別 |
|---|---|---|---|---|
| N1 | D-061 が decision-log に存在（D-061 (a)-(e)） | `rg -c "^## D-061" docs/decision-log.md` | `1` | 機械 |
| N2 | 42 §22.5 の SalesMode 据え置き（H-1）解消（SPEC-P41-D2 (10)。消滅系 — N2b と対。baseline = 1） | `rg -c "SalesMode enum 化は別タイミング" docs/function-design/42-cmd-sales-stocktake.md` | `0`（count 出力なし = 0） | 機械 |
| N2b | 42 §22.5 に request 側 enum 直受けの新契約文（N2 の非空対。新設 literal、baseline 0 = 一意） | `rg -c "request 側も generated enum で直受けする" docs/function-design/42-cmd-sales-stocktake.md` | `1` | 機械 |
| N3 | 40 §5.3 の kind enum 契約化（SPEC-P41-D4。baseline 0） | `rg -c "CmdErrorKind" docs/function-design/40-cmd-product.md` | `1` 以上 | 機械 |
| N3b | 40 §5.3 の自己指名文言の消化（消滅系 — N3 と対。baseline = 1） | `rg -c "全kindのenum化は監査是正 順14で扱う" docs/function-design/40-cmd-product.md` | `0` | 機械 |
| N4 | 41 §17.6 の手動 parse 廃止方針（SPEC-P41-D3。新設 literal、baseline 0） | `rg -c "順14 実装 PR2 で廃止" docs/function-design/41-cmd-pos.md` | `1` | 機械 |
| N5 | D-061 の不正値経路精密化（SPEC-P41-D3。decision-log 内 baseline 0） | `rg -c "serde deserialize 拒否" docs/decision-log.md` | `1` 以上 | 機械 |
| N6 | DB_DESIGN の CHECK×enum 接続注記（SPEC-P41-D3。baseline 0） | `rg -c "generated enum" docs/DB_DESIGN.md` | `1` | 機械 |
| N7 | restore 系 kind の型強化注記（SPEC-P41-D4。68 baseline 0 / 71 baseline 0） | `rg -c "CmdErrorKind" docs/function-design/68-ui-backup-restore.md` / `rg -c "D-061" docs/function-design/71-mnt-backup.md` | 各 `1` 以上 | 機械 |
| N7b | 55 §55.5 の frontend 手動定数置換方針（SPEC-P41-D4。新設 literal、baseline 0。既存の frontend 型名 `CmdErrorKind`（55 に baseline 1 で既出）とは別 anchor を用いる） | `rg -c "bindings 由来の generated union へ置換" docs/function-design/55-ui-csv-import.md` | `1` | 機械 |
| N8 | D-10 の吸収（D-061 (e)。消滅系 — N8b と対。56 baseline = 2 / 53 row baseline = 1。53 §308 の無関係な「D-1〜D-10」は plan 内番号で本 anchor に非該当と確認済み） | `rg -c "Backlog D-10" docs/function-design/56-ui-daily-sales.md` / `rg -c "D-10、本 PR スコープ外" docs/function-design/53-ui-home.md` | 各 `0` | 機械 |
| N8b | 56 の順14 吸収注記（N8 の非空対。56 baseline 0） | `rg -c "順14" docs/function-design/56-ui-daily-sales.md` | `1` 以上 | 機械 |
| N9 | family 一覧の完全性（SPEC-P41-D2 の 14 family + 対象外系の理由 + (11)(12) の P4-2 界面除外 + (13)(14) の file 由来経路 guard 維持）を順14 事前 inventory 調査・round 1/2 追補と突合し、**全 schema file（schema_v1〜v4 + migration）と DB_DESIGN.md の CHECK 一覧の両方**で網羅を再確認（schema_v1 のみの列挙は daily report 系 CHECK を見落とす — Writer self-audit で実発生）。値集合（各 family の literal 列挙）が現行コード・DB CHECK と一致すること（round 1 で P1-2 の値誤指摘を一次資料裏取りで refute した経緯があるため、Reviewer は必ず schema_v1.rs の CHECK と生成箇所コードを自分で実読すること） | 独立レビュー（Plan Review / Final Review の必須観点） | 漏れ・値誤り 0 | レビュー |
| N11 | 44 の list_movements 節に movement_type / reference_type の enum 露出契約（SPEC-P41-D2 (11)(12)。新設 literal、baseline 0 実測済み） | `rg -c "generated enum" docs/function-design/44-cmd-inventory.md` | `1` 以上 | 機械 |
| N12 | 51 に tax_rate / stock_unit の手書き値集合置換方針（SPEC-P41-D2 (13)(14)、round 3 P1。baseline 0 実測済み） | `rg -c "D-061" docs/function-design/51-ui-product-form.md` | `1` 以上 | 機械 |
| N13 | 33 §16.2 / 67 §67.8 に ExportMode 境界露出の改訂（SPEC-P41-D2 (9)、round 4 P1。各 baseline 0 実測済み） | `rg -c "D-061" docs/function-design/33-biz-plu-export-service.md` / `rg -c "D-061" docs/function-design/67-ui-plu-export.md` | 各 `1` 以上 | 機械 |
| N14 | 62 §62.4 に reason の frontend union 置換方針（SPEC-P41-D2 (5)、round 4 P1。baseline 0 実測済み） | `rg -c "D-061" docs/function-design/62-ui-manual-sale.md` | `1` 以上 | 機械 |
| N15 | 57 に SalesMode frontend 手動 union 置換方針（SPEC-P41-D2 (10)、round 4 P1。baseline 0 実測済み） | `rg -c "D-061" docs/function-design/57-ui-monthly-sales.md` | `1` 以上 | 機械 |
| N16 | Plans.md の D-10 表記が D-061 (e) 吸収へ更新（round 4 P2。fixed-string 検索、baseline 0 実測済み） | `rg -cF "D-061 (e) に吸収" docs/Plans.md` | `1` | 機械 |
| N10 | 既存 gate 回帰 + docs-only 確認 + 隣接 sweep | `bash scripts/doc-consistency-check.sh --target plan` / `cargo test --test design_compliance_test` / `bash scripts/local-ci.sh full` / `git diff --stat main...HEAD` に `src-tauri/src/` `src/` が現れない / 71 の変更が見直し契機消化の最小注記に留まる（restore 意味論の本文無変更を diff 実読で確認） | gate 全 pass / docs-only 成立 / 71 最小注記のみ | 機械 + レビュー |

## mutation 感度の考え方（docs-only）

コード mutation は対象外。doc contract の mutation 相当は (i) 契約文 literal の欠落・改変 → N1〜N8b の anchor 完全一致 count で検出、(ii) scope 外への漏れ変更 → N10 の diff 検査（docs-only + 71 最小注記）で検出、(iii) 凍結契約と実装 PR の drift → SPEC-P41-D5 (vi) により実装 PR Plan Review で突合（義務の所在のみ記録）。

## 実行タイミング

- N1〜N8b, N11〜N16: implementing 完了時（Writer）と independent-review（Reviewer 再実行）の 2 回
- N9: Plan Review と Final Review
- N10: implementing 完了時 + human-confirm → ready-hosted-final 遷移直前の local full 再実行
