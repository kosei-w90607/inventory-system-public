# Test Design Matrix — 監査是正 順 4: mutation→consumer query 契約

Packet: [2026-07-22-mutation-consumer-query-contract.md](../2026-07-22-mutation-consumer-query-contract.md)

## Risk

Risk: R3

## Contracts Under Test

- SPEC-INV-CONTRACT-01: 全 production mutation の成功時 invalidation は `src/lib/invalidation-contract.ts` の SSOT 集合に一致する（導出原則 = 確定した table.column を読む query は invalidate、除外は E1〜E6）。**test oracle は契約表 D-052-Cn からの独立転記で、production SSOT を import しない**（Codex round 1 P1-1）
- 契約表の 16 mutation 行（packet Scope 参照。P5-1 / P5-2 / P5-3 / P5b-1 / P5b-2 / P5b-3 の欠落解消と、棚卸し開始・明細個数更新の SSOT 経由化 — rally round 2 C — を含む）
- `queryKeys.stockMovements` root/prefix helper の prefix 整合（product / list が root 配下）
- P8-2: 期待集合は D-052-Cn から test 側へ独立転記する。production の invalidation-contract.ts およびその契約集合を import・参照してはならない。実呼出し集合との順序非依存・重複検出付き完全一致を行う（Codex round 2 P1 で旧共有-SSOT 文言を全箇所置換）

## Failure Modes

- F1: mutation 成功後も consumer query が fresh cache のまま旧値を表示する（invalidate 欠落）
- F2: production contract から key を除去・追加・重複させてもテストが green のまま（契約感度なし。共有 SSOT を test が import すると mutant の両側が同時に縮む — Codex round 1 P1-1 の共有 tautology を含む）
- F3: stockMovements.root が既存 key shape の prefix にならず、prefix invalidate が product/list に届かない
- F4: 閾値部分成功分岐（succeededFields≥1 + failedField あり）だけ invalidation が発火しない（P5b-3 再発）
- F5: 返品 register_processed=true（レジ処理済み）で在庫系 invalidate が誤発火する（backend が在庫を書かない経路）
- F6: SSOT 定数と設計正本（UI_TECH_STACK §2.5 契約原則・除外表）が drift する
- F7: SSOT を経由しない invalidateQueries 直接呼び出しが新規に紛れ込む

## Test Matrix

- 既存テストの実在確認は plan-gate 前に `rg` で行う（DEV_WORKFLOW: Matrix 既存テスト実在確認）。
- Test Name は Writer 実装時に確定。ここでは検査対象 × 検査内容で指定する。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| 契約表 16 行（18 success handler、oracle は経路単位） | F1, F2 | unit（各 page test、invalidateSpy） | 各 mutation page test の契約遵守検査 — 期待 key 集合は**契約表 D-052-Cn から転記した独立 oracle**（invalidation-contract.ts を import しない）。実呼出し集合と順序非依存・重複検出付きで**完全一致比較**し、欠落・余分・重複いずれも red | production 実装の invalidate が oracle と 1 key でも異なる（不足・過剰・重複を含む） |
| P5-3（整合性補正） | F1 | unit 新設 | IntegrityCheckPage: fix 成功時の D-052-C12 独立 oracle 完全一致検査（全 6 key = productList.root / lowStock / stockInquiryRoot / stockMovements.root / productForm.root / stocktake.itemsRoot。latest-check literal は対象外） | fix 成功後に QueryClient へ触れない現行実装のまま、または C12 のいずれかの key 欠落 |
| P5-1（商品 form） | F1 | unit 新設 | ProductFormPage: create / update / **廃番化・復帰 toggle**（Codex round 1 P1-3 — 現行 test は toggleDiscontinue が mock 宣言のみ）成功時の独立 oracle 完全一致検査 + 失敗時不発火 | productList.root のみ invalidate の現行実装のまま、または toggle 経路の SSOT helper 呼出し削除 |
| P5b-3（閾値部分成功） | F4 | unit 新設 | ThresholdSettingsPage: succeededFields≥1 + failedField あり分岐で D-052-C13 独立 oracle 完全一致（全 3 key = thresholdSettings.settings / lowStock / stockInquiryRoot） | 部分成功分岐が refetch のみの現行実装のまま |
| P5b-1（棚卸し確定） | F1 | unit 既存拡張 | StocktakePage: 確定成功時の D-052-C11 独立 oracle 完全一致検査（stocktake 3 key + productList.root / lowStock / stockInquiryRoot / stockMovements.root / productForm.root の全量。latest-check は対象外） | stocktake domain 3 key のみの現行実装のまま |
| P5b-2（CSV commit/rollback） | F1 | unit **新設**（renderHook + QueryClient wiring — hook 実行 test は現状不在、page test は idle mock 全置換。useDailyReportImportFlow.test.tsx パターン。rally round 1 P1-2） | useCsvImportFlow: commit / rollback 成功時の D-052-C8/C9 独立 oracle 完全一致検査（productList.root / monthlySalesRoot / stockMovements.root / productForm.root / stocktake.itemsRoot の追加分を含む全量） | 現行 5 key のままの実装 |
| stockMovements.root | F3 | unit 新設 | query-keys: stockMovements.product(id) / list(...) が root() の prefix 配下にあることの構造検査 | root が別 prefix になり prefix invalidate が届かない |
| 返品分岐 | F5 | unit 既存拡張 | ReturnExchangePage: register_processed=true では在庫系 key が invalidate されない negative 検査 | 分岐を無視して無条件 invalidate に変えた実装 |
| SSOT shape | F2 の前提 | unit 新設 | invalidation-contract: 全 mutation エントリが非空集合であることの meta 検査 | 空集合エントリの混入 |
| SSOT 経由の強制 | F7 | regression（vitest 静的走査、fail-closed — Codex round 1 P2-2） | `invalidation-contract.static.test.ts`（仮名）: src/features + src/lib の全 invalidateQueries 呼び出しを走査し、SSOT helper 本体 / backupRestore 系 / stocktake error-path named helper 以外を 1 件でも検出したら fail | SSOT 非経由の直接呼び出し（success-path 直書きを含む）が production に新規追加される |
| doc 同期 | F6 | CLI | `bash scripts/doc-consistency-check.sh` pass + Ledger の doc 突合 | UI_TECH_STACK §2.5 の原則・除外表と SSOT の乖離 |

## 契約感度の実測（M 行）

Findings Freeze 前に Writer が clean tree 上で実施し、結果を packet / PR body に記録する（mutation test on clean tree only）。

| M | 実 mutation | 期待 |
|---|---|---|
| M1 | **production の** invalidation-contract.ts の入庫エントリから stockMovements.root を除去（test oracle は触らない — Codex round 1 P1-1） | 入庫 page test が独立 oracle との差分で red |
| M2 | **production の**整合性補正エントリから lowStock を除去（test oracle は触らない） | IntegrityCheckPage 新設 test が独立 oracle との差分で red |
| M3 | 閾値エントリの部分成功適用を全成功時のみに戻す（P5b-3 の現行バグ再注入） | ThresholdSettingsPage 部分成功 test が red |
| M4 | stockMovements.root の prefix を別値に変更 | prefix 構造検査が red |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| consumer query cache（在庫系 / 売上系 / 履歴系） | 画面 mount 時 fetch | mutation 中は現 cache 表示 | onSuccess で SSOT 集合 invalidate | SSOT 経由のみ | active query は即 refetch、inactive は次回 mount | mutation 後の画面遷移で旧値を表示しない（本 change の中核） | app 再起動で cache 消滅（変更なし） | mutation 失敗時は invalidate しない（現行維持） | TanStack 既定 retry（変更なし） | 各 page test + M1〜M4 |
| 閾値保存の部分成功 state | — | — | succeededFields 反映 + SSOT invalidate | 全成功と同一集合 | settings refetch（現行維持） | 在庫少画面へ遷移して新閾値判定 | — | failedField 表示（現行維持） | operator 再操作 | P5b-3 test |
| 棚卸し確定後の integrity latest-check 表示 | 前回チェック表示 | — | invalidate 不要（rally round 2 B: staleTime:0 のため次回 mount で必ず refetch、確定連動チェックの結果は integrity 画面遷移時に自然反映） | 対象外 | mount 時必ず refetch（staleTime:0） | 確定後に integrity 画面へ遷移すれば最新チェック日時が見える | — | チェック失敗でも確定は成立（現行契約維持） | — | 契約表行 13 の対象外注記 |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| query invalidation（onSuccess 集約） | `rg -n "invalidateQueries" src/features src/lib --glob '!*.test.*'` 全 69 呼び出し行 / 12 file（2026-07-22 実測） | 契約表 16 mutation | backupRestore 系 6 呼び出し（対象外 domain、契約表収載の例外）/ stocktake 画面内 error-path invalidate（named helper へ集約、成功時契約の対象外） | 静的 regression test（F7 行の `invalidation-contract.static.test.ts`） |
| prefix helper パターン（csvImportLists / stockInquiryRoot / monthlySalesRoot） | query-keys.ts 全 domain | stockMovements.root + productForm.root + dailySales root 新設（productForm は一括 import の bulk 上書きが要求 = rally round 1 P2-2、dailySales は literal 4 箇所 = csv-import 2 + daily-report-import 2 の factory 化 = round 2 A、箇所数は round 3 P2-C 実測） | 単一 key domain（thresholdSettings 等）は prefix 不要。operation-logs 系 literal は P5-4 保全で非接触 | prefix 構造検査 test（3 domain） |

## Negative Paths

- missing input: N/A（mutation 入力検証は既存契約、変更なし）
- invalid input: 同上
- duplicate/ambiguous input: 同上
- unknown reference: SSOT に存在しない mutation 識別子の参照は TypeScript 型エラーで compile 時遮断
- dependency missing: N/A
- permission/write failure: mutation 失敗時に invalidate が発火しないこと（既存 test の onError 経路が担保、変更なし）
- dry-run side effect: N/A

## Boundary Checks

- threshold: N/A（閾値の値判定は backend 既存契約）
- null/default: 返品 register_processed 分岐の true/false 両側（F5）
- empty/non-empty: SSOT エントリ非空 meta 検査
- min/max: N/A
- status/policy enum: N/A
- wire type / internal type / producer/consumer / round-trip token / precision/range / cross-language parse: N/A（frontend 内部契約のみ、wire 変更なし）

## Compatibility Checks

- old schema/input: N/A（スキーマ変更なし）
- new schema/input: N/A
- output order: invalidate 順序は契約対象外（並列 Promise.all 可）を D-052 に明記
- optional field behavior: N/A

## Data Safety Checks

- source-derived data: 実店舗データ不使用（既存 synthetic fixture のみ）
- generated outputs: なし
- secrets: なし
- local-only files: なし
- synthetic sample boundaries: 既存 test fixture の範囲内

## Main Wiring / Integration Checks

- helper connected to main path: SSOT helper が実際に各 page の onSuccess から呼ばれる（契約遵守テストが spy で検証 — helper 単体 test だけでは wiring を保証しないため page test 経由を必須とする）
- output reaches manifest/report: N/A
- effective config reaches runtime: N/A
- CLI arg reaches implementation: N/A

## Mutation-style Adequacy Questions

- If a mock value is changed so it differs from the design-doc expected value, which assertion proves the implementation used the correct source and not the mock's accidental constant? → 契約遵守テストの期待は契約表 D-052-Cn から転記した独立 oracle（production SSOT 非 import）のため、production 側の変更は oracle との差分で必ず露出する（Codex round 1 P1-1 で共有 SSOT 方式を廃止）。oracle 自体の正しさは Ledger の backend 書込み根拠（file:line）で人間レビュー
- If invalidate/refetch changes the value before versus after the operation, which test proves the lifecycle order and preserved snapshot are correct? → invalidate は onSuccess 後のみ（State Lifecycle Matrix 1 行目）。mutation 失敗時に不発火の negative 検査
- If a key branch is inverted, which test fails? → F5（返品 register_processed 分岐の両側検査）
- If a guard is removed, which test fails? → M3（部分成功適用を全成功時のみへ戻す再注入で red）
- If an output field is omitted, which test fails? → M1/M2（SSOT からの key 除去で該当 page test red）
- その他の workflow-state / JSON range / browser round-trip 系質問: N/A（該当構造なし）

## Residual Test Gaps

- 「invalidate 後に画面が実際に新値を再描画する」E2E は本 change に含めない（vitest は invalidate 発火までを検査、refetch→再描画は TanStack Query の既検証挙動）。roadmap 1-4 受入テストの一気通貫台本が実機検証点
- SSOT と UI_TECH_STACK §2.5 除外表の突合は機械検査でなく Ledger + レビューで担保（除外表は自然文のため。機械化は過剰と判断、rally で妥当性を確認）
- 独立 test oracle（D-052-Cn 転記）と契約表の同期は手動 — oracle 転記 drift は Ledger 再検証（independent-review 時の row 突合）と M1/M2 実測で検出する。production SSOT と oracle の両方を同時に同方向へ誤る変更は人間レビューが最後の防衛線（Codex round 1 P1-1 の残余リスクとして明示）
