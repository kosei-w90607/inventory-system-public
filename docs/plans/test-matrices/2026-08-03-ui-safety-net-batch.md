# Test Design Matrix: UI 安全網 batch（Error Boundary + unsaved changes ガード）

## Risk

Risk: R3

## Contracts Under Test

- SPEC-UISN-1〜4（packet 参照）
- UI-EB-D1〜D3（UI_TECH_STACK §6.10）
- UI-USW-D1〜D4（UI_TECH_STACK §6.11）
- 55 §55.7 importing ガード不変 / 02 ⑥ 2 系統不変 / UI-ERR-D1 不変

## Failure Modes

- ガードが block しない（hook 未配線 / shouldBlockFn 恒偽 / isDirty 計算破壊）
- ガードが誤 block する（isDirty=false・保存成功後の遷移を阻害）
- 破棄確認の続行 / 中止が逆転する（proceed / reset 取り違え）
- beforeunload 連動が失われる
- render 例外が白画面のまま（defaultErrorComponent / root errorComponent 未配線）
- fallback で layout（sidebar）が失われ回復導線が乏しくなる
- 再試行 / ホームへ戻る導線が機能しない
- 既存 importing ガード・EmptyState/Alert 2 系統の回帰
- useBlocker 直書きの再導入（hook 経由の規範崩壊）

## Test Matrix

- 既存 test を regression として引用する前に rg で実在確認する（T15 は Writer が確認して test 名を確定させる）。
- oracle は独立転記とする: fallback 見出し・dialog 文言の期待値は production component から import せず literal 転記で assert する。anchor に使う文言は固定前に `rg -c` で repo 内一意性を確認する。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... |
|---|---|---|---|---|
| UI-USW-D1 | 誤 block | unit | T1 `useUnsavedChangesWarning.test.tsx` isDirty=false で遷移が block されない | shouldBlockFn が isDirty を無視して恒真 |
| UI-USW-D1/D2 | block しない | unit | T2 同 isDirty=true で block + 破棄確認 dialog 表示 | hook 未配線 / shouldBlockFn 恒偽（X1） |
| UI-USW-D2 | 続行/中止逆転 | unit | T3 「編集を続ける」で遷移中止・入力保持 | reset() 未呼出 / proceed と入替（X2） |
| UI-USW-D2 | 続行/中止逆転 | unit | T4 「破棄して移動」で遷移実行 | proceed() 未呼出（X2） |
| UI-USW-D1 | beforeunload 欠落 | unit | T5 enableBeforeUnload が isDirty に連動 | 恒偽化（X3） |
| UI-EB-D1/D2 | 白画面 / layout 消失 | integration | T6 `route-error-fallback.test.tsx` throw する子 route で sidebar 保持のまま日本語 fallback 表示 | defaultErrorComponent 未配線（X4）/ 見出し文言破壊（X8） |
| UI-EB-D1 | 白画面 | integration | T7 RootLayout throw で root errorComponent の全画面 fallback | root errorComponent 削除（X5） |
| UI-EB-D2 | 導線不能 | integration | T8 再試行で再 render、ホームへ戻る導線が `/` へ | 再試行 handler no-op（X6） |
| UI-USW-D3 | 未配線 | integration | T9〜T14 適用 6 画面（51/61/62/63/64/69）各 dirty→block + 保存成功後の非 block | 画面の isDirty 計算破壊（X7 代表）/ hook 未配線 |
| 55 §55.7 不変 | 回帰 | regression | T15 `useCsvImportFlow.test.tsx`「REQ-401: commit 中だけ useBlocker と beforeunload を有効化する」（実在・PASS を Writer と Final Review が独立確認、Final Review P3-2 で実名転記） | 既存 useBlocker 2 hook への干渉 |
| UI-USW-D3 | 再導入 | sweep | T16 `unsaved-changes-guard-sweep.test.ts` useBlocker 直接使用が 3 hook 限定 | 画面が useBlocker を直書き |
| UI-USW-D3 | 分類 drift | sweep | T17 同 sweep: 分類表適用 6 画面すべてに hook 配線が存在 + `src/features/**/*Page.tsx` 実在集合が test 内の分類（適用 manifest + 除外 list）と全数一致。**除外側も test 内で component 名を個別列挙し、「manifest にない page は自動除外」型の実装を禁止**（未列挙の新規 page は fail させる — round 2 residual risk 採用） | 適用画面の配線漏れ / 未分類の新規 page 追加 / 分類表と実装の乖離（round 1 P1-3 是正で全数性を機械検証化） |

Mutation 検証（実装後、clean tree で実注入・独立再実測。kill 主張は Coordinator が独立再現する）:

| Mutation | 注入 | Red になるべき test |
|---|---|---|
| X1 | hook の shouldBlockFn を恒 false 化 | T2、T9 系 |
| X2 | dialog の proceed / reset handler を入替 | T3 / T4 |
| X3 | enableBeforeUnload を恒 false 化 | T5 |
| X4 | defaultErrorComponent 配線を削除 | T6 |
| X5 | root errorComponent を削除 | T7 |
| X6 | 再試行 handler を no-op 化 | T8 |
| X7 | 代表画面（ProductFormPage）の isDirty を恒 false 化 | T9 |
| X8 | fallback 見出し文言を別文言へ破壊 | T6（anchor 一意性を rg -c で事前確認） |
| X9 | 適用 1 画面（ProductFormPage）から hook 配線を削除 | T17（sweep の配線検出力）+ T9 |

## State Lifecycle Matrix

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| isDirty（適用画面） | false | 入力で true | 保存成功で false — `onSuccess` 内 navigate 前の baseline 同期 or `!isFormLocked`（UI-USW-D1 MUST、遷移非 block） | — | — | 再訪で false（初期値再計算） | app 再起動で消失（native close 非保証 = UI-USW-D4） | 保存失敗は true 維持（block 継続） | — | T1〜T4 / T9〜T14 |
| blocker resolver | idle | blocked（dialog 表示） | proceed で遷移 | reset で idle へ | — | — | — | — | — | T2〜T4 |
| ErrorFallback | 非表示 | — | throw で表示 | 再試行で reset・再 render | — | 別 route 遷移で解除 | — | 再 throw で再表示 | 再試行 | T6〜T8 |

workflow-state 変更なし（該当 4 行は not applicable — 本 change は packet / gate 契約を変更しない）。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| useBlocker（§55.7 importing ガード型） | `useCsvImportFlow.ts` / `useDailyReportImportFlow.ts`（既存全 2 site） | `useUnsavedChangesWarning.ts`（withResolver 型へ拡張） | 既存 2 site は改変しない（相互排他、UI-USW-D3） | T15 / T16 |
| isDirty 計算（69 の values/savedValues 比較） | `ThresholdSettingsPage.tsx`（既存唯一） | 適用 6 画面（packet 分類表） | 除外画面は分類軸 a〜e（packet 表） | T9〜T14 / T17 |
| AlertDialog 確認 dialog | 既存 8 site（業務操作確認） | 破棄確認 dialog 1 件新設 | 既存 site の文言・挙動は不変 | T2〜T4 |
| route 全画面 fallback（__root notFoundComponent 型） | `__root.tsx` 404（既存唯一） | root errorComponent + defaultErrorComponent | — | T6 / T7 |

## Negative Paths

- missing input: isDirty 未指定は型エラー（boolean 必須）
- invalid input: —（boolean のみ）
- duplicate/ambiguous input: 同一画面での hook 二重呼出しは設計禁止（sweep T16 の適用 site 一覧で検知）
- unknown reference: ホームへ戻る導線は `/`（既存 route、navigation.test 既存担保）
- dependency missing: npm 依存追加なし（lockfile diff ゼロ）
- permission/write failure: N/A（storage 書込みなし）
- dry-run side effect: N/A

## Boundary Checks

- threshold: N/A
- null/default: isDirty 初期 false（T1）
- empty/non-empty: 空 form = isDirty false、1 文字入力で true（T9 系の代表 case）
- min/max: N/A
- status/policy enum: blocker resolver status（blocked/idle）T2〜T4
- wire type / internal type / producer/consumer / round-trip / precision / cross-language: N/A（IPC・DTO 不変、bindings diff ゼロ）

## Compatibility Checks

- old schema/input: N/A（永続 schema 不変）
- new schema/input: N/A
- output order: N/A
- optional field behavior: N/A

## Data Safety Checks

- source-derived data: 実店舗データ不使用、synthetic 入力のみ
- generated outputs: bindings / routeTree / traceability の diff ゼロ確認（route 新設なし）
- secrets: N/A
- local-only files: `.local/ci-evidence/` 非 commit
- synthetic sample boundaries: crash fixture は test 内 throw component のみ、dev 専用 throw を tracked に残さない

## Main Wiring / Integration Checks

- helper connected to main path: T17（適用 6 画面の hook 配線 sweep）+ T6/T7（router 配線）
- output reaches manifest/report: N/A
- effective config reaches runtime: defaultErrorComponent が createRouter 引数に実在（T6 が実 router 経由で検証）
- CLI arg reaches implementation: N/A

## Mutation-style Adequacy Questions

- mock 値と設計期待の分離: fallback / dialog 文言 oracle は独立転記（production から import しない）— X8 が担保
- lifecycle 順序: 保存成功→dirty 解除→遷移の順序は T9 系の保存後非 block case が担保
- 分岐反転: X1（shouldBlockFn）/ X7（isDirty）
- guard 除去: X4 / X5（errorComponent 配線）
- 出力 field 省略: N/A（wire 不変）
- 状態 token round-trip: N/A
- workflow-state 系 4 問: not applicable（packet / gate 契約不変）

## Residual Test Gaps

- Tauri native window close での beforeunload 発火は自動 test 不能（UI-USW-D4 で非保証を明文化、L3 でも保証にしない）
- WebView2 実機での beforeunload 既定ダイアログ表示は L3 で観察のみ（判定基準にしない）
- render 例外の「全 throw 経路」網羅は不能 — 2 層配線の構造検証（T6/T7）+ sweep で代替
