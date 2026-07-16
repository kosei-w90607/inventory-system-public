# P4 型・contract 重複

## 確認範囲

- `src/lib/bindings.ts` の generated command/DTO 型と、feature-local の interface / literal union / request builder
- 全 production route の Zod search schema と、page/feature が受ける search 型・正規化集合
- production Zod form schema と、同じ field set を表す手書き型・guard・保存順
- `npm run typecheck` は pass。以下は現状の値が一致しているため検出されず、将来の片側変更時に型検査が同期を保証しない contract risk

### P4-1: enum 相当の業務値が IPC では string に退化し、frontend が独立 union を持つ
- 観点: 型・contract 重複
- 証拠: `src-tauri/src/cmd/mod.rs:52`、`src-tauri/src/cmd/mod.rs:53`、`src/lib/invoke.ts:8`、`src-tauri/src/biz/inventory_service/returns.rs:18`、`src-tauri/src/biz/inventory_service/returns.rs:29`、`src/features/return-exchange/types.ts:3`、`src/features/return-exchange/types.ts:4`、`src-tauri/src/biz/inventory_service/disposal.rs:25`、`src-tauri/src/biz/inventory_service/disposal.rs:118`、`src/features/disposal/types.ts:3`、`src-tauri/src/cmd/plu_export_cmd.rs:73`、`src-tauri/src/cmd/plu_export_cmd.rs:92`、`src/features/plu-export/PluExportPage.tsx:18`
- 害の経路: 変更コスト増 / 回帰リスク — error kind、返品種別・方向、廃棄種別、PLU mode などは Rust 側の文字列比較と frontend literal union に二重定義されるが、generated binding は `string` なので片側への variant 追加・rename を型エラーにできない。記憶のない書き手が backend だけを更新すると、UI は新しい値を生成できないか既存 guard で拒否し、逆方向では runtime validation error になる。
- repo 規範との対照: `docs/UI_TECH_STACK.md:168`〜`:191` は Rust を SSOT とする tauri-specta 自動生成を、手動型の人為的乖離を避けるため採用している。実際 `src/lib/bindings.ts:1289` の `SalesMode` は generated literal union だが、上記 contract は `String` のため同じ保証を得ていない。
- 提案方向: 有限集合の IPC field を generated Rust enum に寄せる。
- 想定労力: L
- 確度: 確実

### P4-2: URL search の有限集合が route schema・feature 型・normalizer に反復される
- 観点: 型・contract 重複
- 証拠: `src/routes/products/index.tsx:12`、`src/routes/products/index.tsx:24`、`src/features/products/search.ts:7`、`src/features/products/search.ts:10`、`src/features/products/search.ts:46`、`src/features/products/search.ts:93`、`src/routes/stock/$code.movements.tsx:23`、`src/features/stock-movements/types.ts:6`、`src/routes/inventory/records.tsx:13`、`src/routes/inventory/records.tsx:30`、`src/features/inventory-records/types.ts:1`、`src/features/inventory-records/types.ts:20`
- 害の経路: 変更コスト増 / 一貫性破壊 — 商品一覧だけでも sort、dir、discontinued、perPage の集合が Zod、union、option const、normalizer に分散し、在庫変動 type と履歴 recordType/status も route と feature で重複する。新しい filter 値を page 側だけへ追加すると route の `.catch(undefined)` が URL 値を無言で落とし、schema 側だけへ追加すると normalizer が既定値へ戻すため、typecheck が通ったまま deep-link と画面状態が食い違う。
- repo 規範との対照: `docs/UI_TECH_STACK.md:300` は Zod schema と型を対応させ、schema 変更を型エラーで検知する方針を示す。日次/月次 route は `z.output<typeof searchSchema>` も定義しているが、page props は別 interface を import しており単一契約として使われていない。
- 提案方向: route schema と有限値 const から search 型・normalizer を導出する。
- 想定労力: M
- 確度: 確実

### P4-3: 閾値フォームの2 field が Zod schema と手書き key 集合に分裂している
- 観点: 型・contract 重複
- 証拠: `src/features/threshold-settings/lib/extract-thresholds.ts:11`、`src/features/threshold-settings/lib/extract-thresholds.ts:14`、`src/features/threshold-settings/lib/extract-thresholds.ts:19`、`src/features/threshold-settings/lib/extract-thresholds.ts:30`、`src/features/threshold-settings/lib/threshold-form-schema.ts:36`、`src/features/threshold-settings/lib/threshold-form-schema.ts:41`、`src/features/threshold-settings/lib/threshold-form-schema.ts:44`
- 害の経路: 変更コスト増 / 一貫性破壊 — 同じ field set が `ThresholdField`、保存順、setting key map、`ThresholdValues`、Zod object、issue path guard に表現される。3つ目の閾値を schema にだけ追加すると validation 対象にはなるが保存順・setting key mapへ到達せず、手書き union にだけ追加するとフォーム値に存在しない field を保存処理が要求し得る。
- repo 規範との対照: `docs/UI_TECH_STACK.md:300` は Zod schema と型の1:1対応・型エラー検知を要求する。`ThresholdFormValues` 自体は schema から推論しているが、保存側の `ThresholdField` / `ThresholdValues` は別定義である。
- 提案方向: Zod schema の key または単一 field descriptor から field 型・順序・map を導出する。
- 想定労力: S
- 確度: 確実
