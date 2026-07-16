# P6 dead code・残骸

## 確認範囲

- `src/components/ui` 全ファイルと production import graph、`package.json` の対応 dependency、TypeScript の unused 検査設定
- Rust module の `dead_code` / `unused_imports` 抑止と production reachability。通常の `cargo clippy --all-targets --all-features -- -D warnings` は pass し、追加の `cargo rustc --lib --all-features -- --force-warn dead_code --force-warn unused_imports` で抑止内も分類した
- `collapsible.tsx` は定義以外から参照されず、`docs/function-design/58-ui-stock-inquiry.md:124`、`:428`、`:543` に「現在未使用」「primitive 残置」と明記された状態どおりだった。意図と再利用候補が正本に残っているため finding にはしない
- force-warn が報告した serde / error payload field は、production で契約上消費されるもの、test が variant payload を検査するもの、下記の実消費されないものに分け、害の経路を成立させられない警告は除外した

### P6-1: 未参照の UI wrapper 群と React Hook Form dependency が初期 scaffold のまま残る
- 観点: dead code・残骸
- 証拠: `src/components/ui/dropdown-menu.tsx:7`、`src/components/ui/dropdown-menu.tsx:210`、`src/components/ui/form.tsx:17`、`src/components/ui/form.tsx:142`、`src/components/ui/radio-group.tsx:9`、`src/components/ui/radio-group.tsx:45`、`package.json:25`、`package.json:40`、`tsconfig.json:19`
- 害の経路: 変更コスト増 / 読み手の混乱 — production import graph に3ファイルの利用元がなく、`react-hook-form` は未参照の `form.tsx` だけ、`@hookform/resolvers` は repository 内に利用元がない。export された孤立 file は `noUnusedLocals` を通過するため、記憶のない書き手には利用可能な標準部品に見え、未検証 wrapper を採用するか、不要 dependency の更新・脆弱性対応を継続することになる。
- repo 規範との対照: `docs/function-design/69-ui-threshold-settings.md:102` は React Hook Form を「本 repo で不使用のため導入しない」と明記する一方、`docs/UI_TECH_STACK.md:277`〜`:300` と依存・wrapper は採用済みの形を残しており、現行方針の正本が分裂している。dropdown / radio wrapper の残置方針は規範未定義。
- 提案方向: 実利用のない wrapper と専用 dependency を削除するか、採用予定と owner を正本に明記する。
- 想定労力: S
- 確度: 確実

### P6-2: module-wide `allow(dead_code)` が旧棚卸し進捗 DTO と到達不能な BIZ 関数を隠す
- 観点: dead code・残骸
- 証拠: `src-tauri/src/lib.rs:1`、`src-tauri/src/lib.rs:2`、`src-tauri/src/biz/stocktake_service.rs:68`、`src-tauri/src/biz/stocktake_service.rs:95`、`src-tauri/src/biz/stocktake_service.rs:117`、`src-tauri/src/biz/stocktake_service.rs:145`、`src-tauri/src/cmd/stocktake_cmd.rs:20`
- 害の経路: 読み手の混乱 / 回帰リスク — production CMD は `get_stocktake_items` が返す DB版 `StocktakeProgress` を使用し、`StocktakeProgressBiz` と `get_stocktake_progress` には呼出元がないが、`biz` 全体への lint 抑止で通常の clippy は green になる。進捗取得の入口が2つあるように見えるため、変更時に到達不能な変換だけを更新したり、同種の dead code が増えても gate が検知しない。
- repo 規範との対照: `docs/function-design/42-cmd-sales-stocktake.md:165`〜`:182` は `get_stocktake_items` で一覧と進捗をまとめる現行経路を正とする一方、`docs/function-design/35-biz-stocktake-service.md:332`〜`:351` は未到達関数を現役 contract として残す。`src-tauri/src/lib.rs:1` の「UI層未実装」も現在の実態と一致しない。
- 提案方向: 現行 contract に一本化し、必要なシンボルだけに局所的な lint 抑止を限定する。
- 想定労力: S
- 確度: 確実

### P6-3: CSV import cache / BIZ request が commit で読まれない文字列と token を保持する
- 観点: dead code・残骸
- 証拠: `src-tauri/src/biz/csv_import_service/mod.rs:112`、`src-tauri/src/biz/csv_import_service/mod.rs:120`、`src-tauri/src/biz/csv_import_service/mod.rs:122`、`src-tauri/src/biz/csv_import_service/mod.rs:145`、`src-tauri/src/biz/csv_import_service/mod.rs:149`、`src-tauri/src/cmd/csv_import_cmd.rs:120`、`src-tauri/src/cmd/csv_import_cmd.rs:165`、`src-tauri/src/biz/csv_import_service/commit.rs:25`、`src-tauri/src/biz/csv_import_service/commit.rs:138`
- 害の経路: 変更コスト増 / 読み手の混乱 — `MatchedRow.jan_code` と `name` は全一致行ぶん30分キャッシュへ複製されるが commit は product_code / quantity / amount / line_no / pos_stock_sync だけを読む。`CommitRequest.preview_token` も CMD で検証・cache lookup 済みの値を複製するだけでBIZは参照せず、型を読んだ書き手に「BIZでも token と cached_data の対応を検証する」という誤った保証を与える。
- repo 規範との対照: `docs/function-design/32-biz-csv-import-service.md:77`〜`:101` は未使用 field も contract に含める一方、同文書 `:246` は token の復元・検査をCMD責務とするため、設計自体が残骸を固定している。
- 提案方向: cache と BIZ request を commit が実際に必要とする field 集合へ縮める。
- 想定労力: S
- 確度: 確実

### P6-4: 日報 parser の行 provenance と parse error 詳細が production 境界で全て捨てられる
- 観点: dead code・残骸
- 証拠: `src-tauri/src/io/daily_report_parser.rs:30`、`src-tauri/src/io/daily_report_parser.rs:32`、`src-tauri/src/io/daily_report_parser.rs:41`、`src-tauri/src/io/daily_report_parser.rs:43`、`src-tauri/src/io/daily_report_parser.rs:62`、`src-tauri/src/io/daily_report_parser.rs:64`、`src-tauri/src/biz/daily_report_import_service/parse.rs:39`、`src-tauri/src/biz/daily_report_import_service/parse.rs:40`、`src-tauri/src/biz/daily_report_import_service/parse.rs:146`、`src-tauri/src/biz/daily_report_import_service/parse.rs:158`
- 害の経路: 変更コスト増 / 読み手の混乱 — production BIZ は `parse_errors` の空否だけを見て5 fieldすべてを捨て、summary/payment の `source_file` も cache DTO への変換時に落とす。それでも parser の全生成経路は値を組み立て続けるため、書き手は利用されない provenance/error contract を保守し、field を変更しても実画面・操作ログに届かないことを型から判別できない。
- repo 規範との対照: `docs/function-design/29-io-daily-report-parser.md:70`〜`:107` は詳細付き parse result を定義するが、`docs/function-design/37-biz-daily-report-import-service.md:160`〜`:163` は error 詳細の転送・記録を定義せず一括 `BizError` 化する。境界をまたぐ詳細の要否は規範未定義。
- 提案方向: production で必要な metadata だけを parser contract に残すか、必要な詳細をBIZの診断経路へ接続する。
- 想定労力: S
- 確度: 確実
