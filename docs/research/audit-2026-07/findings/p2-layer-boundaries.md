# P2 層境界（backend + IPC）

## 確認範囲

- 全 `src-tauri/src/cmd/*.rs` の production import と command body
- `db/` / `io/` / `mnt/` から `biz` / `cmd` への上位参照
- frontend production source の `@tauri-apps/api/core` / raw `invoke` と generated `commands.*` 利用
- `cargo test --test design_compliance_test` は pass。ただし同 test は公開関数名と設計書の対応を検査し、import graph や command body の責務は検査しない
- IO/DB からの上位参照は検出なし。frontend IPC は generated `src/lib/bindings.ts` の `commands.*` + `unwrapResult` に統一され、raw invoke は検出なし

### P2-1: settings_cmd が DB/IO/MNT を直接束ねる実質的な service 層になっている
- 観点: 層境界
- 証拠: `src-tauri/src/cmd/settings_cmd.rs:6`、`src-tauri/src/cmd/settings_cmd.rs:51`、`src-tauri/src/cmd/settings_cmd.rs:66`、`src-tauri/src/cmd/settings_cmd.rs:103`、`src-tauri/src/cmd/settings_cmd.rs:232`、`src-tauri/src/cmd/settings_cmd.rs:302`
- 害の経路: 変更コスト増 / 回帰リスク — 設定 CRUD とログ検索は `system_repo` を直接呼び、日付 validation、backup directory 解決、DB connection の一時置換・復旧、base64 decode と filesystem error 分類まで CMD が所有する。新しい settings/backup/image 経路の書き手は「CMD を薄くする」規範と既存の巨大 command orchestrator のどちらを模倣すべきか判断できず、業務・復旧ルールがさらに IPC 層へ蓄積する。
- repo 規範との対照: `docs/ARCHITECTURE.md:37` は CMD を型変換・BIZ 呼出し・response 変換に限定し、validation/DB操作を禁止する。一方 `docs/function-design/43-cmd-settings-log.md:60` 以降は direct `system_repo`、CMD内 validation、restore orchestration、image decode を明示しており、実装は後者に一致するが正本同士が矛盾している。
- 提案方向: CMD-11 の例外を解消する service 境界を是正PRで設計する。
- 想定労力: L
- 確度: 確実

### P2-2: 同じ業務 validation が CMD と BIZ に二重配置されている
- 観点: 層境界
- 証拠: `src-tauri/src/cmd/stocktake_cmd.rs:153`、`src-tauri/src/biz/stocktake_service.rs:177`、`src-tauri/src/cmd/integrity_cmd.rs:35`、`src-tauri/src/biz/integrity_service.rs:133`、`src-tauri/src/cmd/product_cmd.rs:122`
- 害の経路: 一貫性破壊 / 回帰リスク — `actual_count < 0` と空の `product_codes` は CMD と BIZ の双方で判定され、stocktake は既に「カウント数」と「カウント値」で message が分岐している。validation 条件・field・文言を変更すると2層の同期が必要になり、CMD経由とBIZ直接テスト/再利用で異なる error contract を返し得る。商品CSVの空ファイル判定はCMDだけにあり、所有層もcommandごとに揺れている。
- repo 規範との対照: `docs/ARCHITECTURE.md:37` と `docs/function-design/42-cmd-sales-stocktake.md:23` は業務 validation をBIZ責務とするが、同じ `42-cmd-sales-stocktake.md:208` はCMDでの重複チェックを例外として認める。`docs/function-design/35-biz-stocktake-service.md:161` と `36-biz-integrity-check.md:127` もBIZ側 validationを要求しており、正本内で責務が二重化している。
- 提案方向: validation の単一所有層を正本で決め、CMDは変換だけに戻す。
- 想定労力: M
- 確度: 確実
