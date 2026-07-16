# P1 部品重複・再利用逸失（frontend）

## 確認範囲

- `src/components/{ui,patterns,layout,sales}` と `docs/design-system/02-component-catalog.md` の canonical 対応
- production source の重複 function 名、feature-local table/header、file input/dropzone、業務入力 helper、入出庫記録 detail shell
- 類似していても catalog が複数 canonical を意図している `SummaryCardsBar` と日付/月ナビ、domain contract が異なる各 table 本体は finding から除外した

### P1-1: 同一の SortableHeader が3テーブルに複製されている
- 観点: 部品重複・再利用逸失
- 証拠: `src/features/daily-sales/components/ProductTable.tsx:160`、`src/features/monthly-sales/components/DepartmentTable.tsx:103`、`src/features/monthly-sales/components/ProductRankingTable.tsx:118`
- 害の経路: 変更コスト増 / 一貫性破壊 — `aria-sort`、矢印表示、button class、alignment を同じ実装で3回持っているため、sorting header の a11y または表示規約を変えるたびに3箇所を同期する必要がある。現状は本文が同一なので、将来1箇所だけ修正されても型検査では検出できない。
- repo 規範との対照: `docs/design-system/02-component-catalog.md:120` は table を canonical pattern にする一方、sortable header の canonical は未定義。`Plans.md:24` と `Plans.md:103` には共通 component 化が既知 backlog として記録済み。
- 提案方向: generic な sortable table header の共通部品化候補。
- 想定労力: S
- 確度: 確実

### P1-2: file selection contract が複数の plain input/dropzone に分散している
- 観点: 部品重複・再利用逸失
- 証拠: `src/features/csv-import/components/FileDropzone.tsx:23`、`src/features/csv-import/components/FileDropzone.tsx:74`、`src/features/products/import/ProductImportDropzone.tsx:18`、`src/features/products/import/ProductImportDropzone.tsx:68`、`src/features/return-exchange/ReturnExchangePage.tsx:626`、`src/features/csv-import/components/PreviewStep.tsx:129`、`src/features/products/import/ProductImportPreview.tsx:211`
- 害の経路: 回帰リスク / 一貫性破壊 — drag/drop、同一ファイル再選択、disabled、accept、ファイルサイズ表示、accessible label を画面ごとに保守しており、既に2つの dropzone はほぼ同じ handler を別実装している。WebView2 の plain file input 白画面が日報取込みで実際に発生済みなので、残る画面を個別修正すると同じ platform failure と UX 差を画面単位で再発させる。
- repo 規範との対照: `docs/UI_TECH_STACK.md:528` は native dialog を原則とし、`docs/UI_TECH_STACK.md:535` は残る plain input を暫定例外かつ共通 FilePicker + plugin-dialog 移行対象とする。`Plans.md:107` に同じ follow-up が記録済み。
- 提案方向: FilePicker pattern と native dialog 移行を1つの横断変更として扱う。
- 想定労力: M
- 確度: 確実

### P1-3: 入出庫4詳細画面が同じ route shell と returnTo 正規化を個別所有している
- 観点: 部品重複・再利用逸失
- 証拠: `src/features/inventory-records/ReceivingRecordDetailPage.tsx:37`、`src/features/inventory-records/ReceivingRecordDetailPage.tsx:56`、`src/features/inventory-records/ReceivingRecordDetailPage.tsx:66`、`src/features/inventory-records/ReturnRecordDetailPage.tsx:60`、`src/features/inventory-records/ReturnRecordDetailPage.tsx:79`、`src/features/inventory-records/ReturnRecordDetailPage.tsx:89`、`src/features/inventory-records/ManualSaleRecordDetailPage.tsx:42`、`src/features/inventory-records/ManualSaleRecordDetailPage.tsx:64`、`src/features/inventory-records/ManualSaleRecordDetailPage.tsx:74`、`src/features/inventory-records/DisposalRecordDetailPage.tsx:43`、`src/features/inventory-records/DisposalRecordDetailPage.tsx:62`、`src/features/inventory-records/DisposalRecordDetailPage.tsx:72`
- 害の経路: 変更コスト増 / 回帰リスク — 4画面が同一の `returnTo` sanitizer、3段 skeleton、error Alert、戻る導線、query option をコピーしている。detail route 共通契約を変更すると4画面すべてに同じ修正が必要になり、1画面だけ古い recovery/navigation contract のまま残る可能性がある。
- repo 規範との対照: `docs/design-system/02-component-catalog.md:35` は4つの read-only 記録詳細を同じ PageHeader/戻る導線 variant として規定し、`MovementTable` も共有済みだが、detail shell と `returnTo` 正規化の canonical は規範未定義。
- 提案方向: record detail 共通 shell と returnTo helper の共通化候補。
- 想定労力: M
- 確度: 確実

### P1-4: 4つの業務入力 request builder が同一の基盤 helper を複製している
- 観点: 部品重複・再利用逸失
- 証拠: `src/features/receiving/lib/receiving-request.ts:10`、`src/features/receiving/lib/receiving-request.ts:17`、`src/features/receiving/lib/receiving-request.ts:24`、`src/features/manual-sale/lib/manual-sale-request.ts:10`、`src/features/manual-sale/lib/manual-sale-request.ts:17`、`src/features/manual-sale/lib/manual-sale-request.ts:24`、`src/features/disposal/lib/disposal-request.ts:12`、`src/features/disposal/lib/disposal-request.ts:19`、`src/features/disposal/lib/disposal-request.ts:26`、`src/features/return-exchange/lib/return-exchange-request.ts:18`、`src/features/return-exchange/lib/return-exchange-request.ts:25`、`src/features/return-exchange/lib/return-exchange-request.ts:32`
- 害の経路: 変更コスト増 / 一貫性破壊 — idempotency key fallback、local date の `YYYY-MM-DD` 化、整数 validation という domain 非依存の知識が4コピーある。random UUID fallback、時刻境界、safe integer の扱いを直す場合、4業務の一部だけが異なる入力/再送 contract になり得る。
- repo 規範との対照: `docs/design-system/02-component-catalog.md:190` 以降は業務フォームの構造を共通規範化しているが、request builder の基盤 helper は規範未定義。外部正典の「同じ知識は一箇所に」に照らした。
- 提案方向: domain 非依存の idempotency/date/integer helper の共通化候補。
- 想定労力: S
- 確度: 確実
