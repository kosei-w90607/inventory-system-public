# 監査 manifest（work packages + 進捗 log）

> 固定仕様は [00-order.md](00-order.md)。**session 開始時は必ず 00-order.md → 本ファイルの順で読み、未消化 package を上から 1 つ取る。**

## Work packages（実施順）

- [x] **P0 構造マップ**: frontend（`src/features` / `src/components` / `src/routes` / `src/lib` / `src/config`）と backend（`src-tauri/src` の cmd / biz / io / mnt）のモジュール目録、層間依存の概観、共有部品の目録（どの画面が何を再利用し、何を独自実装しているか）。findings ではなく台帳（`findings/p0-structure-map.md`）を作る — 以降の package が参照する土台
- [x] **P1 部品重複・再利用逸失（frontend）**: 複数画面で類似実装が独立に存在する箇所（既知: SortableHeader、plain file input。他にないか）。design-system component catalog との突合
- [x] **P2 層境界（backend + IPC）**: 機械検査（design compliance test）が捕捉しない違反 — CMD 層のビジネスロジック混入、BIZ 迂回、IO 層からの上位参照、frontend からの command 呼び出し経路の一貫性（bindings.ts 経由の統一性）
- [x] **P3 error handling 一貫性**: 層別エラー型規約（DbError/BizError/CmdError）の遵守、握りつぶし・catch-all の残存、frontend 側のエラー表示パターン（toast / インライン / ダイアログ）の画面間一貫性
- [x] **P4 型・contract 重複**: TS 手書き型 vs `bindings.ts` 生成型の二重定義、zod schema と型の重複、Rust DTO との不整合リスク、literal union の散在
- [x] **P5 状態管理・データ取得パターン**: TanStack Query の使い方（key 設計 / staleTime / invalidation）の画面間ばらつき、hooks の粒度と再利用、URL search state の扱いの一貫性
- [x] **P6 dead code・残骸**: 未使用 export / 未使用部品（既知: `collapsible.tsx` は 58 §表で「現在未使用」と記録済み — 記録どおりか確認）/ 到達不能コード / 使われていない型
- [x] **P7 可読性・慣用性・命名**: owner 品質観点。React 19 / TS strict / Rust の慣用からの逸脱、命名が実態と一致しているか、コメントの質（why を語るか、drift していないか）、「読み手の驚き」が大きい箇所
- [x] **P8 テスト品質**: tautological test（既知: `integrity_cmd.rs`。他にないか）、実配線を通らず手組み fixture だけで通るテスト、REQ トレース(テスト名)の一貫性、カバーの薄い契約
- [x] **P9 統合**: P1〜P8 の findings を dedupe → 影響 × 労力で優先度付け → `report.md`（監査レポート + 是正リスト）を作成。**新規調査はしない**、統合のみ

## 監査条件記録（2026-07-17 追記）

第 1 パスの thread 設定は途中で意図せず変更されていた（session log で確定、原因は composer 下 model/reasoning control の誤操作と推定。auto-fallback・config 変更の記録なし）:

- P0 / P1 / P2: `gpt-5.6-sol` / `xhigh`（P2 は切替 47 秒後 commit のためほぼ sol 実行）
- **P3〜P9: `gpt-5.6-luna` / `low`**（23:18〜00:15 JST の 57 分間）

Coordinator 裁定: 第 1 パス findings の精度は独立検証（上位 7/7 CONFIRMED、luna 窓の package 産を含む）で実証済みのため**破棄しない**。未知数なのは取りこぼし（recall）であり、下記「第 2 パス」で補完する。report の「確認できた健全な領域」の clean 宣言は第 2 パス完了まで暫定扱い。

## 第 2 パス work packages（recall sweep、sol / xhigh で実行）

各 package: 対応する第 1 パスの `findings/<pkg>.md` を先に読み、**既出 findings の再確認はせず、第 1 パスが見落としたものだけを狩る**。新規 findings は同ファイルに `### <PKG>b-<連番>` 形式で追記。新規ゼロなら「第 2 パス: 追加なし、確認範囲: …」を追記。00-order.md の全制約（証拠 + 害の経路、件数目標禁止、read-only）は同一に適用。

- [x] **P3b** error handling 一貫性（第 2 パス）
- [ ] **P4b** 型・contract 重複(第 2 パス)
- [ ] **P5b** 状態管理・データ取得(第 2 パス)
- [ ] **P6b** dead code・残骸(第 2 パス)
- [ ] **P7b** 可読性・慣用性・命名(第 2 パス。owner 品質観点の本丸、丁寧に)
- [ ] **P8b** テスト品質(第 2 パス)
- [ ] **P9b** 差分統合: 第 2 パスの新規 findings を report.md の是正リスト・健全領域・優先度へ反映（新規ゼロなら report に「第 2 パスで clean 宣言を確定」を追記）。adjudication.md は触らない（Coordinator の管轄）

## 進捗 log（package 完了ごとに 1 行追記）

- 2026-07-16 23:07 JST / P0 / findings 0（台帳）/ frontend・backend・共有部品・層間依存の構造マップを作成
- 2026-07-16 23:12 JST / P1 / findings 4 / component catalog と production source の再利用境界を突合
- 2026-07-16 23:17 JST / P2 / findings 2 / CMD body・Rust import graph・frontend IPC経路を監査、design compliance test pass
- 2026-07-16 23:22 JST / P3 / findings 4 / 層別エラー変換・Result握りつぶし・filesystem catch-all・frontend表示契約を監査
- 2026-07-16 23:27 JST / P4 / findings 3 / generated IPC型・URL Zod schema・form field集合の二重管理を監査、typecheck pass
- 2026-07-16 23:31 JST / P5 / findings 4 / query key・staleTime・mutation invalidation・URL/local stateを横断監査
- 2026-07-16 23:39 JST / P6 / findings 4 / frontend import graph・dependency・Rust lint抑止内のproduction reachabilityを監査、既知collapsible残置は設計どおりと確認
- 2026-07-16 23:43 JST / P7 / findings 5 / 設計内矛盾・Rust SQL構築・TS literal型・動的title・lifecycleコメントをowner品質観点で監査
- 2026-07-16 23:50 JST / P8 / findings 4 / CMD本番分岐・mutation invalidation・navigation利用側・FE traceability gateを監査、frontend/backend全testとtraceability check pass
- 2026-07-16 23:54 JST / P9 / 統合 / P1〜P8 findingsを原因・完了条件でdedupeし、影響×労力の実行順と依存関係をreport.mdに集約
- 2026-07-17 00:31 JST / P3b / findings 2 / WALを含む旧DB移行・backup restoreの失敗時継続をrecall sweep

## 越境メモ（package scope 外で気づいた事項、1 行ずつ）

- （なし）
