# Test Design Matrix: operation log 系 query key の共通 factory 収容（順17 / P5-4、wave 1 lane 1）

## Risk

Risk: R3（packet と同値）

## Contracts Under Test

- C1: key 実文字列不変（3 tuple: `["settings","logOperationTypes"]` / `["settings","logs",<search>]` / `["settings","integrity","latest-check"]`、search 引数の透過含む）
- C2: literal 再導入防止（許容 list = query-keys.ts + oracle test のみ）
- C3: page 配線（2 page が factory 経由、page 内 literal 0）
- C4: invalidation 意味論不変（当該 3 key は invalidation-contract の対象外のまま）
- C5: D-052-E1 期限付き例外コメント撤去と「直書き禁止」規範の無例外化
- C6: 設計 doc（74 / 必要なら 75）の factory 契約表記への同期

## Failure Modes

- F1: factory の segment typo・順序変更・引数欠落 → cache 分断・stale 表示
- F2: page 側 literal 残存・再導入 → 規範迂回の復活（P5-4 の再発）
- F3: latest-check の invalidate 化・contract への key 混入 → PR #21 裁定の逆転
- F4: doc が literal 記述のまま → 規範と設計 doc の矛盾残存（P5-4 指摘の片割れ）

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name / anchor | Would fail if... | Mutation |
|---|---|---|---|---|---|
| C1 | F1 | unit (vitest) | query-keys oracle test（期待 tuple を test 内に独立転記し `toEqual` 完全一致。3 tuple + search 引数透過 case + 空文字/undefined search case） | segment 改変・順序入替・引数透過の変質 | X1: factory の 1 segment 改変（例 `"logs"` → `"log"`）で red |
| C1 | F1 | unit (vitest) | 同 oracle test の引数透過 case | search が factory 内で正規化・欠落する | X1b: 引数 drop 注入で red |
| C2/C3 | F2 | static sweep (vitest) | literal 再導入 sweep test（`src/` 配下から当該 key literal を検索、許容 list は明示列挙のみ） | page へ literal 再導入・factory 迂回 | X2: page に literal 復元で red |
| C4 | F3 | regression (既存) + static sweep (vitest) | F3 の主防御は既存 `d052InvalidationOracle.integrityFix()` の厳密一致比較（`IntegrityCheckPage.test.tsx` :204、AC の既存 test green 維持で保持）。新設 sweep は literal 再導入の補完（contract は factory 呼出しのみで構成、literal 0 を 2026-07-28 実測 — round 1 P2-1） | latest-check の invalidate 化（factory 呼出し・literal のどちらの形でも） | X3: `invalidationContract.integrityFix()` へ新 factory の latest-check 呼出しを注入し既存 oracle test red / X3b: literal 追加で sweep red |
| C5 | — | anchor (rg) | M-A1: `rg -c 'D-052-E1' src/lib/query-keys.ts` = 0（実装後）/ M-A2: 「直書き禁止」規範文言 = 1 | 例外コメント残存 / 規範文言の巻き添え削除 | G1: 例外文復元で M-A1 red、G1b: 規範文言削除で M-A2 red |
| C6 | F4 | anchor (rg) | M-A3: 74 doc の factory 表記 anchor（実装時に定義文 literal へ特定化） | doc 未同期・literal 記述残存 | X4: doc 側 factory 表記の削除で red |
| C1〜C3 隣接 | — | regression (既存) | `OperationLogsPage.test.tsx` / `IntegrityCheckPage.test.tsx` green 維持 | 配線変更が描画・取得動作を壊す | 既存 suite が red |

anchor 規律: M-A 系は固定前に `rg -c` で一意性を確認し、汎用語を避けて定義文 literal へ特定化する。combined rg は使わず file 別に判定する。

## State Lifecycle Matrix

| State / subject | Initial | Success | Invalidate | Failure | Evidence |
|---|---|---|---|---|---|
| operation logs query | literal 時代と同一 tuple で fetch | 同一挙動（staleTime 等 option 不変） | 対象外のまま（C4） | — | oracle + 既存 RTL |
| integrity latest-check query | 同上 | 同上 | 対象外のまま（PR #21 裁定維持、C4） | — | oracle + sweep |

挙動変化を作らない収容のため、lifecycle の検証は「不変」の機械固定（oracle / sweep）に集約する。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| 共通 factory 慣用（18 domain、parameterized 含む） | query-keys.ts 全域（2026-07-28 実読） | operation log domain の追加 | 他 domain の再編なし（非目的） | oracle + sweep |
| literal 直書き | 横断 rg で 2 file 3 key のみと実測（2026-07-28） | 全 3 key を収容 | なし（残存 0 が AC） | sweep |
| 設計 doc の key 記述 | 74 :60/:286、75 :46 | factory 表記へ同期 | 75 は literal 前提の場合のみ（invalidate 除外意味論は不変） | M-A3（+ 必要なら M-A4） |

## Negative Paths

- search 引数が空文字 / undefined のとき、literal 時代と同一の tuple を返す（oracle test の case に含める）
- sweep の許容 list に glob 過剰除外がないこと（許容は明示 file 列挙のみ。fail-open 防止）
