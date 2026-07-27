# Test Design Matrix: 動的 SQL placeholder の既存慣用統一（順22 / P7-2、wave 1 lane 2）

## Risk

Risk: R3（packet と同値）

## Contracts Under Test

- C1: 結果集合不変（`search_products` / `list_stocktake_items` の全 filter 組合せで、refactor 前後の返却行が同一）
- C2: `param_idx` 全廃（`src-tauri/src/db/` 配下 hit 0、dummy read 消滅、clippy -D warnings green）
- C3: 既存挙動の regression（既存 unit suite green 維持、test 改変なし）
- C4: param 非消費 filter（stocktake `counted_only`）の正常動作（filter 有無・他 filter との併用で正しい行が返る）

## Failure Modes

- F1: placeholder 番号と bind 値の対応ずれ → 誤った filter 結果（静かな誤動作）
- F2: placeholder 数と params 数の不一致 → 実行時 bind error
- F3: pagination（LIMIT / OFFSET）の placeholder が filter 数の変動に追随しない → ページずれ・bind error
- F4: 手動 counter の再導入 → P7-2 の再発（filter 変更時の手動対応証明が復活）

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name / anchor | Would fail if... | Mutation |
|---|---|---|---|---|---|
| C1 | F1/F2 | unit (Rust) | `search_products` filter 組合せ test（新規。単体 4 filter は既存を維持し、組合せ代表 = keyword×department / department×discontinued / keyword×discontinued / 全 filter 同時。oracle は seed データから独立転記した期待行） | 組合せ時に placeholder と bind が交差・欠落 | X1: placeholder 導出を `params.len() + 2` へずらし red |
| C1 | F1 | unit (Rust) | 同上の組合せ case | bind 値の push 順序と placeholder 対応の交差 | X2: 2 filter の params push 順序を入替え red |
| C1/C3 | F1/F2 | regression (既存) | 既存単体 filter test 群（keyword / product_code / department / discontinued true・false、sort、pagination、clamp、0 値エラー） | 単体 filter の挙動変化 | 既存 suite red |
| C4 | F1 | unit (Rust) | 既存 `test_list_stocktake_items_req205_dept_and_counted_combined` green 維持 + 必要なら counted×dept の反対値 case 追加 | 固定条件 filter が bind を要求・誤対応 | X3: counted_only 条件式に bind param 化を注入し red（params 不足で bind error） |
| C1/C3（stocktake） | F1/F2 | regression (既存) | 既存 basic / dept 単体 / counted 単体 test | stocktake 側の挙動変化 | 既存 suite red |
| C1 | F3 | unit (Rust) | pagination 併用 case（filter あり + page 指定で期待行を独立転記） | LIMIT/OFFSET の placeholder が filter 数に非追随 | X4: pagination placeholder の導出のみ旧 counter 形へ戻し red |
| C2 | F4 | anchor (rg) | M-A1: `rg -c 'param_idx' src-tauri/src/db/` = 0（実装後。file 別に product_repo / stocktake_repo 双方 0 を確認） | 手動 counter 再導入 | G1: `let _ = param_idx` を復元し M-A1 red |
| C2 | F4 | 機械 gate (L1) | `cargo clippy --all-targets --all-features -- -D warnings` green | dummy read なしでは unused warning が出る形の再導入 | G1 と同経路（clippy red） |

anchor 規律: M-A 系は固定前に `rg -c` で一意性・出現数を確認し、file 別に判定する（combined rg 不使用）。

mutation 規律: X 系は refactor 後 code への clean tree 注入 → red → 復元 → green（各回 clean 確認）。kill 主張は Final Review で Matrix どおりの実注入により独立再現する。

## State Lifecycle Matrix

| State / subject | Initial | Success | Failure | Evidence |
|---|---|---|---|---|
| search_products 呼び出し | filter 条件組立て | 期待行の返却（組合せ含む） | bind error なし（F2 の否定） | 組合せ test |
| list_stocktake_items 呼び出し | session 前提 + filter | 期待行の返却（counted 固定条件含む） | 同上 | 既存 + 組合せ test |

読み取り専用 query のため、lifecycle 検証は入出力固定（oracle）に集約する。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| `params.len() + 1` 慣用 | return / inventory / disposal / receiving の 4 repo（2026-07-28 rg 実測） | product / stocktake の 2 fn へ移植 | 慣用側 4 repo は変更なし（Non-scope） | M-A1 + 既存 suite |
| 手動 counter + dummy read | db/ 横断 rg で当該 2 fn のみと実測（2026-07-28） | 全廃 | なし（残存 0 が AC） | M-A1 |
| filter 組合せ test | stocktake に combined 1 case 実在、product に組合せなし（2026-07-28 実測） | product へ組合せ case 新設 | integration test dir への追加はしない（既存慣行 = inline test module） | 組合せ test |

## Negative Paths

- filter 全指定なし（WHERE 句なし相当）で全件系の既存挙動維持（既存 basic test）
- page / per_page の 0 値エラー・clamp の既存挙動維持（既存 test、改変禁止）
- 組合せで該当 0 行のケース（空集合が正しく返る、誤 bind で他行が混入しない）を組合せ test に含める
