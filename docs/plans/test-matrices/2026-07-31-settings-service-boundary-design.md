# Test Design Matrix: CMD-11 settings service 境界の正本化（監査是正 順12 design-first）

対象 packet: [2026-07-31-settings-service-boundary-design.md](../2026-07-31-settings-service-boundary-design.md)

docs-only PR のため、機械 token 検査（M1〜M7, M10）+ 既存 gate 回帰（M8）+ 独立レビュー突合（M9, M11）で構成する。oracle は本 Matrix に独立転記した literal を正とし、対象 doc の記述から導出しない。空集合 oracle（M4）は非空 oracle（M5）と必ず対で実行する。

検証 grep の注意: linuxbrew ripgrep 15.1.0 の負 glob 不具合（memory `ripgrep-15-negative-glob-broken.md`）を踏まえ、負 glob は使わない。各 anchor literal は固定前に `rg -c` で重複出現がないことを確認済み（M2/M3/M7 は本 change で新設する文の literal のため、改訂前 repo では 0 hit = 一意性が構成的に保証される）。

| ID | 検査対象（契約） | 手順 | 期待（oracle） | 種別 |
|---|---|---|---|---|
| M1 | D-060 が decision-log に存在（D-060 (a)-(d)） | `rg -c "^## D-060" docs/decision-log.md` | `1` | 機械 |
| M2 | ARCHITECTURE.md に CMD→MNT 正規経路の限定文（SPEC-CMD11-D1 (ii)） | `rg -c "接続所有権の交換を要する保守 orchestration" docs/ARCHITECTURE.md` | `1` | 機械 |
| M3 | ARCHITECTURE.md に CMD→IO 直呼び禁止文（SPEC-CMD11-D1 (iii)） | `rg -c "CMD が IO 層を直接呼ぶことは禁止" docs/ARCHITECTURE.md` | `1` | 機械 |
| M4 | 43 §43.5 から CMD validation アルゴリズム所有記述が消滅（D-060 (c)。空集合 oracle — M5 と対。改訂前 baseline = 1 を実測済み） | `rg -c "まずASCII strict" docs/function-design/43-cmd-settings-log.md` | `0`（rg は match 0 件で exit 1 を返すため、count 出力なし = 0 と判定） | 機械 |
| M5 | 43 の設定・ログ 4 command が biz::system_service 経由で記述（SPEC-CMD11-D2） | `rg -c "biz::system_service" docs/function-design/43-cmd-settings-log.md` | `4` 以上 | 機械 |
| M6 | 43 の restore 節が 71 §71.7 を normative 参照（D-060 (d)） | `rg -c "正本は 71-mnt-backup.md §71.7" docs/function-design/43-cmd-settings-log.md` | `1` 以上 | 機械 |
| M7 | 31 に拡張子 validation の BIZ 所有文（SPEC-CMD11-D3） | `rg -c "領収書画像の拡張子 validation は BIZ 層" docs/function-design/31-biz-inventory-service.md` | `1` | 機械 |
| M8 | 既存 gate 回帰 | `bash scripts/doc-consistency-check.sh --target plan` / `cargo test --test design_compliance_test`（src-tauri）/ `bash scripts/local-ci.sh full` | すべて exit 0 / pass | 機械 |
| M9 | 71-mnt-backup.md 無変更（非目的の担保、D-060 (d)） | `git diff --stat main...HEAD -- docs/function-design/71-mnt-backup.md` | 出力なし（0 file changed） | 機械 |
| M10 | 31 / 43 に未実装関数の fn シグネチャコードブロックを追加していない（Contract Probe 前提の維持） | `git diff main...HEAD -- docs/function-design/31-biz-inventory-service.md docs/function-design/43-cmd-settings-log.md \| rg -c "^\+.*fn \w+\("` | count 出力なし = 0（追加行に `fn name(` パターンなし） | 機械 |
| M11 | 隣接 contract sweep（43 §43.1〜§43.12 全節 + ARCHITECTURE.md §2/§5-9 + cmd-task-specs.md CMD-11 節 + biz-task-specs.md、§43.2 の所有表現統一と §43.5 エラーハンドリング小節の「wire contract 存続 + 所有表現書き換え」を含む）に取りこぼしがない / 改訂後 doc の future-state 記述に実装 PR 追随注記がある / validation 移動が条件・文言・field 不変を明示 | 独立レビュー（Plan Review / Final Review の必須観点） | 指摘 P1/P2 = 0 | レビュー |
| M12 | 43 から CMD の IO 直呼び処理記述が消滅（D-060 (b)。空集合 oracle — M5 と対。改訂前 baseline = 4 を実測済み） | `rg -c "system_repo::" docs/function-design/43-cmd-settings-log.md` | `0`（count 出力なし = 0） | 機械 |
| M13 | ARCHITECTURE.md §2 task table の整合（SPEC-CMD11-D1 (iv): BIZ-09 行新設 + CMD-11 行更新。`BIZ-09` は改訂前 docs/ 全体で 0 hit を実測済み = 一意） | `rg -c "BIZ-09" docs/ARCHITECTURE.md` | `2` 以上（BIZ table 行 + CMD-11 行） | 機械 |
| M14 | ARCHITECTURE.md §5-9 mapping table の BIZ 層行更新（SPEC-CMD11-D1 (v)。Plan Review round 2 P2） | `rg -c "BIZ-01〜BIZ-09" docs/ARCHITECTURE.md` | `1` | 機械 |
| M15 | cmd-task-specs.md CMD-11 から「許可済み例外」記述が消滅（D-060 (b)。空集合 oracle — M15b と対。改訂前 baseline = 4 を実測済み。archive 配下の同 literal は scope 外） | `rg -c "許可済み例外" docs/architecture/cmd-task-specs.md` | `0`（count 出力なし = 0） | 機械 |
| M15b | cmd-task-specs.md CMD-11 が BIZ-09 経由で記述（M15 の非空対） | `rg -c "BIZ-09" docs/architecture/cmd-task-specs.md` | `1` 以上 | 機械 |
| M16 | biz-task-specs.md に BIZ-09 task 仕様節（SPEC-CMD11-D1 (v)） | `rg -c "^### BIZ-09" docs/architecture/biz-task-specs.md` | `1` | 機械 |

## mutation 感度の考え方（docs-only）

コード mutation は対象外。doc contract の「mutation」に相当するのは (i) 契約文 literal の欠落・改変 → M1〜M7 が anchor literal の完全一致 count で検出、(ii) scope 外 file への漏れ変更 → M9 が検出、(iii) 凍結契約と実装 PR の drift → SPEC-CMD11-D5 (v) により実装 PR の Plan Review で本 packet と突合（本 Matrix の scope 外、義務の所在のみ記録）。

## 実行タイミング

- M1〜M7, M9, M10, M12〜M16: implementing 完了時（Writer）と independent-review（Reviewer 再実行）の 2 回
- M8: implementing 完了時 + human-confirm → ready-hosted-final 遷移直前の local full 再実行（DEV_WORKFLOW の規定どおり）
- M11: Plan Review と Final Review
