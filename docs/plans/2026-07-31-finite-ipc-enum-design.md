# Plan Packet: 有限 IPC 値の generated enum contract 化（監査是正 順14 design-first）

## Workflow State

- Phase: human-confirm
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: f328692716c5f1ffcc0cfdae8a4ba457e019e153
- Amendments: f4070ee（AMD1: daily report 系対象外追補 + N9 突合方法強化。Writer self-audit 起因、family 一覧・契約本体の変更なし）
- Coordinator: Claude (Fable 5, main session)
- Writer: Claude (Fable 5, main session)
- Plan Reviewer: independent Claude subagent (Sonnet 5)
- Final Reviewer: independent Claude subagent (Sonnet 5)
- Reviewed Content HEAD: d7e1088d3784238532f3fa917ed638c44ef35ede
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: pending items = hosted workflow_dispatch 指示（docs-only のため event filter 対象外）+ merge approval。L3 なし

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 15分
- relay 往復上限: 0

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

§5.5を使わないchangeは両方`none`のままにする。

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
docs-only だが、IPC wire contract の型強化方針（D-061）を全 family 横断で凍結する設計であり、誤った境界規則を正本化すると実装 PR 群が広範囲に誤る。40 §5.3 / 42 §22.5 が「順14」を自己指名しており、71 §71.7 は「順 8」の見直し契機行（kind 拡張時）が接続対象（round 1 P3-1 で精緻化。Scope 節参照）。restore 系 kind（data-safety 隣接）も対象に含む。design-first の先例（順1+2 / 順3 / 順12）と同じ tier。

## Goal

Goal Invariant: 有限集合の IPC 値が「Rust enum を SSOT とする generated literal union」で型検査される契約が正本化され、片側 variant 変更が typecheck で検出される状態への実装 PR 群が、新たな設計判断なしで着手できる。

### 最小完了条件

- D-061（共通 pattern・境界規則・family 一覧・不正値経路の精密化）が decision-log に確定し、値集合の正本 doc（40 §5.3 / 41 §17.4 / 42 §22.5 / 68 §68.7 / 71 §71.7 の見直し契機消化）が enum 契約前提へ改訂されている
- 既知 backlog D-10（`DailySaleItem.source` の literal union 化）の解消判断が本 design に吸収されている

### 失敗定義

- wire 表現（正常値の snake_case string）が変わる設計になっている
- restore 系 kind 3 値の値・分岐意味論（68 §68.7 / 71 §71.7）が変わる
- 順12 で確定した D-060 の層境界（validation 所有・CmdError 変換一元化）と矛盾する

### 非目的

- 新しい有限値の追加・改名（値集合は現状凍結のまま型だけ強化する）
- DB schema / CHECK 制約の変更
- URL search 系の有限集合（監査 P4-2 の scope）
- コードの先行変更

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `docs/decision-log.md` に D-061 追加（下記 Spec Contract の凍結内容）
- CmdError.kind 値集合の正本 4 箇所の改訂: `40-cmd-product.md` §5.3（`kind: String` → generated enum `CmdErrorKind` 前提へ。「順14 で扱う」自己指名の消化）、`41-cmd-pos.md` §17.4（POS 3 値の継承記述）、`68-ui-backup-restore.md` §68.7（restore 3 値は値・分岐不変で型強化される旨の注記）、`71-mnt-backup.md` §71.7（MNT-01-D4 の「見直し契機: 順 8…」該当行の消化注記 — **意味論変更なしの最小注記に限定**）
- `42-cmd-sales-stocktake.md` §22.5 CMD-09-CONV-D1 の改訂: `SalesMode` request 側 String 据え置き（H-1）の解消判断を確定し、`SalesReportType` A 案を全 family の標準形として昇格
- domain family の境界 doc 改訂: `44-cmd-inventory.md` §23.5-23.7（wire 型注記）+ 同 list_movements 節（movement_type / reference_type の enum 露出 — round 1 P1-1）、`31-biz-inventory-service.md` §12.4/§12.6（返品・廃棄・reason の enum 所有）、`33-biz-plu-export-service.md` §16.2 + `41-cmd-pos.md` §17.6（ExportMode 境界露出、`parse_export_mode` 廃止）、`32-biz-csv-import-service.md` §15（error_type 4 値 wire enum の合成新設と status — round 1 P1-2 機序訂正を反映）、`30-biz-product-service.md` の tax_rate / stock_unit validation 節（wire 経路は enum 置換・file 由来経路の guard として維持の二層化 — round 2 P1）
- frontend 手動 union の置換方針の正本化: `55-ui-csv-import.md` §55.5（`CMD_ERROR_KIND` wrapper を bindings 由来へ）、`62-ui-manual-sale.md` §62.4、`67-ui-plu-export.md` §67.8、`56-ui-daily-sales.md` §56.2 + `53-ui-home.md` D-10 行（**D-10 解消**）、`57-ui-monthly-sales.md`（SalesMode 手動 union 置換）、`51-ui-product-form.md`（tax_rate / stock_unit の frontend 値集合正本 §147-148 相当 — 手書き集合を generated union 由来へ置換する方針の注記。UI 入力バリデーション（select guard・日本語文言）は不変 — round 3 P1）
- `docs/DB_DESIGN.md` CHECK 制約方針への接続注記（DB CHECK は enum 化後も防御として維持、IPC enum との対応関係 1 行）
- `Plans.md` の active packet link 追加（PK4）と D-10 backlog 表記の更新
- 実装 PR 群への義務の凍結（SPEC-P41-D5）

## Non-scope

- Rust / TypeScript コードの変更一切（実装 = Codex 発注、順12 実装と直列）
- `StocktakeProgressBiz.status`（frontend に文字列比較なし、二重管理不在のため対象外）
- `26-io-product-csv-importer.md` の別種 `error_type`（"field_count_mismatch" 系 — Z004 parser と値域が異なる別 contract と正本明記済み、対象外）
- 反復言及 doc（45 / 30 / 58 / 74 等の validation kind 単発言及）の書き換え — 値集合の正本ではないため実装 PR 追随に分類（Required Design Artifacts 参照）
- URL search 系（P4-2）・DB schema 変更・operation_type（DB 動的取得のオープン集合）

## Acceptance Criteria

- `rg -c "^## D-061" docs/decision-log.md` → `1`
- `rg -c "CmdErrorKind" docs/function-design/40-cmd-product.md` → `1` 以上（§5.3 の enum 契約化）
- `rg -c "全kindのenum化は監査是正 順14で扱う" docs/function-design/40-cmd-product.md` → `0`（自己指名の消化。改訂前 baseline = 1 を実測すること）
- `rg -c "literal union化は将来D-10" src/features/daily-sales/lib/compute-summary.ts` → 変更なし（コードは触らない。D-10 の解消判断は 56/53 の doc 側でのみ行い、code comment は実装 PR で追随）
- `rg -c "D-10" docs/function-design/56-ui-daily-sales.md` の該当節が「順14 実装 PR で解消」前提へ改訂されている（機械 anchor は Matrix で確定）
- `bash scripts/doc-consistency-check.sh --target plan` exit 0 / `cargo test --test design_compliance_test` pass / `bash scripts/local-ci.sh full` pass
- `git diff --stat main...HEAD` に src-tauri/src/ / src/ が現れない（docs-only）

## Design Sources

- Requirements / spec: `docs/research/audit-2026-07/report.md` 順14 / `findings/p4-type-contracts.md` P4-1
- Architecture: `docs/ARCHITECTURE.md`（D-060 改訂後の呼び出し原則、wire 型変換の CMD 境界拒否規定）
- Function / command / DTO: 40 §5.3 / 41 §17.4・§17.6 / 42 §22.5 / 44 §23 / 31 §12.4・§12.6 / 33 §16.2 / 32 §15 / 30（tax_rate / stock_unit validation — round 2 P1）/ 23（ParseErrorType）/ 34（SalesMode/SalesReportType 定義）/ 68 §68.7 / 71 §71.7 / 55 §55.5 / 56 §56.2 / 57 / 62 §62.4 / 67 §67.8 / 53（D-10 行）/ 51（frontend 値集合正本 — round 3 P1）
- DB: `docs/DB_DESIGN.md` CHECK 制約方針、`docs/db-design/transaction-tables.md` / `pos-tables.md`（値集合の理由所有元 — 値は不変のため参照のみ）
- Screen / UI: 上記 UI doc 群（文言・表示分岐は不変）
- Decision log / ADR: D-053（error_id 相関）、D-054（cross-language 定数 SSOT の先例）、D-060（順12）、D-061（本 PR で新設）
- 生成基盤: `src-tauri/src/lib.rs` export_specta_bindings / `docs/UI_TECH_STACK.md` §2.5（tauri-specta SSOT 方針 — 方針自体は不変）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 40 / 41 / 42 / 44 / 31 / 33 / 32 / 30 / 68 / 71 の対象 § | updated in this PR（値集合の正本と自己指名箇所） |
| Command / DTO / generated binding / wire shape | 同上 + 55 / 56 / 57 / 62 / 67 / 53 / 51 | updated in this PR（正常値 wire 表現は不変、型のみ強化） |
| 反復言及 doc（45 / 30 / 58 / 74 / 73 / 24 / 21 / architecture task-specs の kind 単発言及） | 実装 PR 追随 | intentionally deferred — 値集合を定義せず参照するのみの箇所。実装 PR の drift sweep（rg 全箇所）で一括追随（SPEC-P41-D5 (iv)） |
| DB / transaction / audit / rollback / migration | DB_DESIGN.md（接続注記のみ、schema 不変） | updated in this PR |
| CSV / TSV / report / import / export format | 変更なし（ファイル format 不変） | existing sufficient |
| Durable decision / ADR | decision-log D-061 | updated in this PR |
| Process（active packet link / D-10 backlog 表記） | Plans.md | updated in this PR（Matrix N16 で機械検証 — round 4 P2） |

## Registration / Generation Obligations

該当なし（本 PR は新規 command / doc file / route を追加しない）。実装 PR には次を転記する（SPEC-P41-D5）: enum 追加時の `specta::Type` derive + `bindings.ts` 再生成 + 生成 diff が「型強化のみ（値・シグネチャ不変）」であることの review 確認。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| 監査 P4-1（型二重定義） | UI_TECH_STACK §2.5 / 42 §22.5 | D-061 (a) 共通 pattern | `#[derive(Serialize, Deserialize, specta::Type)]` + `#[serde(rename_all = "snake_case")]` を標準形とする。先例は方向別: request 直受けは `SalesReportType`（42 CMD-09-CONV-D1 A 案）、response 直出しは `SalesMode`（`MonthlySalesReport.mode`、Serialize + specta）。単一 enum での両方向本番実績は未存在のため、両方向は方向別実績の合成として実装 PR の round-trip test で担保する（round 1 P2-1 訂正）。PascalCase 先例（SortKey 等）への統一は wire 表現変更になるため棄却 | 全 family | Matrix N2 |
| 監査 P4-1（不正値経路） | ARCHITECTURE.md wire 型変換規定 / 41 §17.6 | D-061 (b) 不正値の精密化 | 「wire 不変」を「**正常値の wire 表現不変**」と精密化。request 側 enum 直受けにより不正文字列は serde deserialize 拒否（CMD 境界の wire 型変換失敗）へ統一され、旧 `parse_export_mode` 等の手動 parse + validation 文言は廃止。全 family の不正値は UI 固定操作（select / toggle / 定数）から到達不能で、利用者可視の変化なし。String 受け + 手動 parse 維持案は request 方向の型検査欠落（P4-1 の中核）を残すため棄却 | 41 §17.6 / 42 §22.5 | Matrix N4, N5 |
| 監査 P4-1（DB 交差） | DB_DESIGN CHECK 方針 / transaction-tables | D-061 (c) 境界規則 | enum 化は IPC wire + BIZ 内部まで。DB/repo 層は TEXT + CHECK のまま（防御維持、schema 不変）。DB 読み出し値の enum 変換失敗は明示 match で internal（CHECK により実質到達不能、catch-all 禁止）。repo まで enum 化する案は schema/migration へ波及し「値集合は現状凍結」の非目的に反するため棄却 | DB_DESIGN 注記 / 31 / 32 | Matrix N6 |
| P8b 系（kind 分岐） | 40 §5.3 / 68 §68.7 / 71 §71.7 | D-061 (d) CmdError.kind | `kind: CmdErrorKind`（12 値）へ。値・分岐・error_id 相関（D-053）・restore 3 値の意味論は不変。frontend の `CMD_ERROR_KIND` 手動定数（`export_error` 欠落の非対称あり）と手動 union 群は bindings 由来型へ置換 | 40 / 41 / 68 / 71 注記 / 55 | Matrix N3, N7 |
| D-10（既知 backlog） | 56 §56.2 / 53 Non-scope 行 | D-061 (e) D-10 吸収 | `DailySaleItem.source` の literal union 化を順14 実装 scope に吸収し D-10 を解消（family 一覧の 1 行として扱う）。独立 PR 維持案は同一 pattern の分割実装で drift 面を増やすため棄却 | 56 / 53 | Matrix N8 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history: 改訂後は D-061（共通 pattern + family 一覧 + 境界規則）+ 各正本 doc の改訂 § で完結
- Plan-only durable decisions promoted: D-061。family 別の実装詳細（derive 位置・変換 site）は各 doc の改訂 § が所有
- Assumptions and constraints: bindings 生成は `collect_commands!` 対象 command のシグネチャから型グラフを自動収集（lib.rs、順14 事前調査で実証済み）。先例は方向別 — request = `SalesReportType`（A 案）、response = `SalesMode`。単一 enum 両方向の実績は未存在（round 1 P2-1 訂正）
- Deferred design gaps: 反復言及 doc の追随は実装 PR の drift sweep へ（Required Design Artifacts）
- Test Design Matrix can cite design decision IDs: D-061 (a)-(e) / SPEC-P41-D1〜D5
- Absolute guarantee / escape hatch self-check: 絶対保証は新設しない。restore 系の条件付き保証は 71 §71.7 のまま不変

## Impact Review Lenses

not applicable — 監査起源の docs-only 設計 PR。data-safety 隣接（restore kind の型強化）は「値・分岐意味論不変」を Review Focus と Matrix N3 で担保する。

## Design Readiness

- Existing design docs are sufficient because: 生成基盤（UI_TECH_STACK §2.5）と先例（42 A 案）は現状で十分。改訂対象は値集合の正本と自己指名箇所のみ
- Source docs updated in this PR: Scope 節の列挙どおり
- Design gaps intentionally deferred: 反復言及 doc / code comment の追随（実装 PR）
- Durable decisions discovered and promoted: D-061 (a)-(e)

Minimum design checks for business-app work:

- Layer ownership: D-060 の層境界に従う（validation 所有は BIZ、CMD は wire 型変換 — enum deserialize は CMD 境界の型変換そのもの）
- Backend function design: 各 family の enum 定義位置は既存 Rust enum の存在箇所（BIZ/IO）を優先し、新規は wire 境界の所有 doc に従う
- Command / DTO / data contract: 正常値 wire 表現不変、型のみ強化。bindings 再生成 diff は literal union 化のみ
- Persistence / transaction / audit impact: なし（DB TEXT + CHECK 不変）
- Operator workflow / Japanese UI wording: 不変（不正値経路は利用者到達不能）
- Error, empty, retry, and recovery behavior: kind の値・分岐不変。restore 3 値の表示契約（68 §68.7）不変
- Testability and traceability IDs: 実装 PR で family ごとの round-trip test + 既存 test の型追随（SPEC-P41-D5）

## Contract Probe

- 生成基盤の型収集方式: `src-tauri/src/lib.rs` の `export_specta_bindings()` が `collect_commands!` からの型グラフ自動収集であることを事前調査で実証済み（enum を command シグネチャに載せれば bindings に literal union が出る）
- 方向別 enum の本番先例: request 直受け = `SalesReportType`（`cmd/sales_cmd.rs:88` の引数直 deserialize、42 §22.5 A 案）、response 直出し = `SalesMode`（`MonthlySalesReport.mode`、Serialize + specta）をそれぞれ実読確認済み。`SalesReportType` は response struct に不在で、単一 enum の両方向実績は未存在（round 1 P2-1 で訂正。両方向の担保は実装 PR の family 別 round-trip test へ）
- 不正値時の serde 拒否挙動（invalid string → invoke error の具体 shape）: **実装 PR1 の Contract Probe へ委譲**（是正仮適用の end-to-end 実測が必要。docs-only の本 PR では実測不能のため、D-061 (b) は「UI 到達不能経路」であることを根拠に凍結し、実測で shape を確認してから frontend の error 表示 fallback（describe-error 既定文言）への合流を実装 PR で確定する）

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| D-061 (a) 共通 pattern（derive + snake_case、SalesReportType 標準形） | decision-log / 42 §22.5 | Matrix N2（token） | 実装は follow-up PR |
| D-061 (b) 不正値経路の精密化（正常値 wire 不変 + serde 拒否統一 + 手動 parse 廃止） | decision-log / 41 §17.6 / 42 §22.5 | Matrix N4, N5（token） | 実装 PR1 probe で shape 実測 |
| D-061 (c) 境界規則（IPC+BIZ まで、DB TEXT+CHECK 維持、変換失敗は明示 internal） | decision-log / DB_DESIGN 注記 / 30 / 31 / 32 | Matrix N6（token） | 実装は follow-up PR |
| D-061 (d) CmdErrorKind 12 値（値・分岐・error_id・restore 意味論不変、frontend 手動定数置換） | 40 §5.3 / 41 §17.4 / 68 §68.7 / 71 §71.7 注記 / 55 §55.5 | Matrix N3, N7（token） | 実装は follow-up PR |
| D-061 (e) D-10 吸収（source の union 化を family へ） | 56 §56.2 / 53 D-10 行 / Plans.md D-10 表記（round 4 P2） | Matrix N8, N16（token） | 実装は follow-up PR |
| D-061 (a)/(b) 派生: ExportMode 境界露出の doc 改訂（33 §16.2 / 67 §67.8。round 4 P1） | 33 / 67 | Matrix N13（token） | 実装は follow-up PR |
| D-061 (a) 派生: manual sale reason の frontend union 置換方針（62 §62.4。round 4 P1） | 62 | Matrix N14（token） | 実装は follow-up PR |
| D-061 (a) 派生: SalesMode frontend 手動 union 置換方針（57。round 4 P1） | 57 | Matrix N15（token） | 実装は follow-up PR |
| family 一覧の完全性（CmdErrorKind / return_type / direction / disposal_type / reason / source / CsvImportResult.status / ErrorRow.error_type / ExportMode / SalesMode / movement_type / reference_type / tax_rate / stock_unit の 14 family、対象外 = StocktakeProgressBiz.status・26-io error_type・operation_type とその理由 + (11)(12) の P4-2 界面除外 + (13)(14) の file 由来経路 guard 維持） | 本 packet + D-061 | Matrix N9（レビュー: inventory 調査との突合）+ N11（token） | — |
| 順12 実装との直列制約（settings_cmd error 生成箇所 / bindings.ts 干渉）と実装分割（PR1 = CmdErrorKind 横断、PR2 = domain family 群。順序の既定 = 順12 実装 → 順14 PR1 → PR2、owner 裁定で変更可） | 本 packet SPEC-P41-D5 | 実装 PR Plan Gate で突合 | — |
| 隣接 contract sweep: 各改訂 § の同居契約（40 §5.3 の error_id 契約 / 68 §68.7 の表示文言 / 42 §22.5 の集計意味論 / 55 §55.5 の wrapper 実装例 / 71 §71.7 の D1/D4/D5）は値・意味論不変で型注記のみ追加。除外契約なし | — | 独立レビューで再確認 | — |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-31-finite-ipc-enum-design.md](test-matrices/2026-07-31-finite-ipc-enum-design.md)

- targeted tests: Matrix N1〜N10（機械 token + gate 回帰）
- negative tests: 消滅系 oracle（自己指名文言・据え置き文言）は対応する非空 oracle と対で運用
- compatibility checks: docs-only 確認（src 無変更の diff 検査）
- data safety checks: docs-only。実 artifact なし
- main wiring/integration checks: doc-consistency-check / design_compliance_test / local-ci full

## Boundary / Wire Contract

本 PR は wire に触れない。実装 PR 群の wire 契約を凍結する:

- producer / consumer: 各 family の Rust enum（SSOT）→ generated `bindings.ts` literal union → frontend
- wire type: 現行 snake_case string と 1:1 完全一致（正常値の wire 表現不変が不変条件）
- internal type: Rust enum（既存 enum への derive 追加 or 新設）
- precision/range: 値集合は現状凍結（追加・改名なし）
- round-trip path: request = enum 直 deserialize / response = enum 直 serialize。DB 読み出し値の enum 変換は明示 match（失敗 = internal、CHECK により実質到達不能）
- invalid input: serde deserialize 拒否（CMD 境界の wire 型変換失敗）へ統一。UI 固定操作から到達不能。shape は実装 PR1 probe で実測
- compatibility: bindings 再生成 diff が「string → literal union の型強化のみ」であることを実装 PR の review 必須観点とする

## Review Focus

- D-061 (b) の「不正値経路の精密化」が wire 互換の原則を破っていないか（正常値不変 + 到達不能経路の統一、という論理の穴）
- restore 系 kind の型強化が 68 §68.7 / 71 §71.7 の意味論（値・分岐・表示文言・error_id）を一切変えないか
- family 一覧の漏れ（inventory 調査 + round 1/2 追補の 14 family + 対象外系の理由の妥当性、CHECK 制約付き有限集合の全数突合 — 全 schema file（v1〜v4 + migration）+ DB_DESIGN.md CHECK 一覧の両方で列挙する。schema_v1 のみでは daily report 系を見落とす）
- D-060（順12）との整合 — 特に CmdError 変換一元化（`From<BizError>`）と kind enum 化の接続、settings_cmd 干渉の直列制約
- 改訂 doc の future-state 注記漏れ（実装 PR 追随の明示）

## Spec Contract

Contract ID: SPEC-P41-D1〜D5

- SPEC-P41-D1（共通 pattern）: 有限 IPC 値の SSOT は Rust enum とし、`#[derive(serde::Serialize, serde::Deserialize, specta::Type)]` + `#[serde(rename_all = "snake_case")]` で generated literal union に露出する。wire 文字列は現行値と 1:1 完全一致。標準形の先例は `SalesReportType`（42 §22.5 A 案）
- SPEC-P41-D2（family 一覧、値は現状凍結）: (1) `CmdErrorKind` 12 値（validation / duplicate / not_found / internal / import_error / export_error / idempotency_conflict / stocktake_in_progress / stocktake_not_in_progress / restore_failed_recovered / restore_failed_unrecoverable / restore_durability_unknown）、(2) 返品 `return_type`（return / exchange）、(3) 返品 `direction`（in / out）、(4) 廃棄 `disposal_type`（disposal / damage / other）、(5) 手動販売 `reason`（plu_unregistered / other）、(6) 日次売上 `source`（auto / manual、= D-10）、(7) `CsvImportResult.status`（completed / completed_partial / rolled_back）、(8) `ErrorRow.error_type`（unmatched_product / invalid_format / invalid_jan / invalid_number — **BIZ 層 String field の enum 化**。IO の `ParseErrorType` は 3 variant（InvalidFormat / InvalidJan / InvalidNumber）のみで `unmatched_product` は BIZ の突合段階で生成されるため、IO enum の直接露出では 4 値を覆えない。IO 3 variant + BIZ 1 値を合成した 4 値の wire enum を新設し、IO→wire 変換は明示 match とする — Plan Review round 1 P1-2 機序訂正）、(9) PLU `ExportMode`（full / diff — BIZ 既存 enum の露出、`parse_export_mode` 廃止）、(10) `SalesMode`（request 側 String 据え置き H-1 の解消）、(11) `movement_type`（sale_auto / sale_manual / receiving / return / disposal / stocktake — DB 層既存 enum `MovementType` の露出。request filter `MovementQuery.movement_type` と response `MovementRecord` の両方向。Plan Review round 1 P1-1）、(12) `reference_type`（csv_import / manual_sale / receiving_record / return_record / disposal_record / stocktake — DB 層既存 enum `ReferenceType` の露出、nullable のため wire は `Option`。同 P1-1）、(13) `tax_rate`（10 / 8 / 0 — request = ProductCreate/UpdateRequest、response = `Product` struct。frontend 手動 union `ProductTaxRate` の置換を含む。round 2 P1）、(14) `stock_unit`（pcs / cm — 同上。round 2 P1）。**(13)(14) の特記**: 商品 CSV 一括インポート（BIZ-01）は file 由来値が同じ BIZ validation を通る経路のため、`product_service.rs` の tax_rate / stock_unit validation（日本語文言）は **file 由来経路の guard として維持**し、wire 経路のみ enum 型が置換する（error row 契約は不変。他 family の「手動 parse 廃止」と扱いが異なる点を 30 の改訂で明記）。対象外 = `StocktakeProgressBiz.status`（frontend 二重管理なし）/ 26-io の別種 error_type（別 contract）/ `operation_type`（オープン集合）/ **daily report 系 3 点（amendment `AMD1` で追補）**: `DailyReportImportResult` 系の `status: String`（completed / rolled_back — frontend 比較なしで StocktakeProgressBiz.status と同類）・`duplicate_check.status` と `source_file`（`DailyReportDuplicateStatus` / `DailyReportSourceKind` として**既に generated enum 済み**、是正不要の先行事例）・`source_adapter`（POS Adapter Boundary の拡張点でオープン扱い）。なお (11)(12) の URL search 層の重複（`src/features/stock-movements/types.ts` の route/feature 型反復）は監査 P4-2 の scope であり本 change では扱わない
- SPEC-P41-D3（境界規則）: enum 化は IPC wire + BIZ 内部まで。DB/repo 層は TEXT + CHECK 不変。DB 読み出し値の enum 変換失敗は明示 match で internal（catch-all 禁止、`.claude/rules/implementation-quality.md` の既存規範に整合）。不正 wire 値は serde deserialize 拒否へ統一し、旧手動 parse の validation 文言は契約から除去（正常値の wire 表現・利用者可視挙動は不変）
- SPEC-P41-D4（kind 分岐の不変条件）: CmdErrorKind 化で値・分岐・error_id 相関（D-053 / CMD-ERR-D1/D2）・restore 3 値の表示契約（68 §68.7）は不変。frontend は `CMD_ERROR_KIND` 手動定数・手動 union（`export_error` 欠落の非対称を含む）を bindings 由来型へ置換し、文字列 literal の直書き比較を退役する
- SPEC-P41-D5（実装 PR 群の義務）: (i) 実装は 2 PR 分割 — PR1 = CmdErrorKind（横断・機械的）、PR2 = domain family 群（(2)〜(14)、round 2 P2 で range 更新）。順序の既定は 順12 実装 → 順14 PR1 → PR2（settings_cmd / bindings.ts 干渉の直列制約。owner 裁定で変更可）、(ii) 各 PR で bindings 再生成 diff が型強化のみであることを review 必須観点に、(iii) family ごとに wire round-trip test（正常全値 + 不正値拒否）を追加、(iv) 反復言及 doc / code comment（compute-summary.ts の D-10 comment 等）の drift sweep を rg で全箇所実施、(v) 不正値拒否の wire shape を PR1 の Contract Probe で実測し frontend fallback 表示との合流を確定（nullable request filter — family (11) `MovementQuery.movement_type` の `Option<Enum>` deserialize — も probe 対象に含める。round 2 P3）、(vi) 本 packet の凍結契約との突合を各実装 PR Plan Review の必須観点とする

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-P41-D1 | D-061 + 42 §22.5 改訂 | Matrix N2 | 先例 A 案との一致 | rg token |
| SPEC-P41-D2 | D-061 family 一覧 | Matrix N9 | inventory 突合・漏れ | 独立レビュー |
| SPEC-P41-D3 | D-061 + DB_DESIGN 注記 + 31/32 | Matrix N6 | DB 境界の穴 | rg token |
| SPEC-P41-D4 | 40/41/68/71/55 改訂 | Matrix N3, N7 | restore 意味論不変 | rg token + 独立レビュー |
| SPEC-P41-D5 | packet 凍結 | 実装 PR Plan Gate | 転記漏れ | 実装 PR packet |

## Data Safety

- 実 POS / 店舗 artifact、DB file、backup、log、receipt image、secret は commit しない（docs-only で該当物なし）
- local-only paths: なし
- synthetic-only paths: なし

## Implementation Results

（実装後に記入）

## Review Response

- Findings Freeze: frozen after Broad Audit; post-freeze exceptions: none.

### Plan Review round 1（independent Claude subagent, Sonnet 5, fresh context）

- P1-1（movement_type / reference_type の family 漏れ）: **accept**。`db/inventory_repo.rs` の `MovementType` / `ReferenceType`（各 6 値）と `schema_v1.rs:182,185` の CHECK を Writer が実読確認。family (11)(12) として追加、44 list_movements 節を Scope へ、Matrix N11 を追加。P4-2 界面（URL search 層の重複）は対象外と明記
- P1-2（ErrorRow.error_type の値が `n` である・IO enum 露出の機序誤り）: **値主張は refute / 機序副論点は accept**。Writer の一次資料裏取りで wire 値は `unmatched_product / invalid_format / invalid_jan / invalid_number` — `schema_v1.rs:153` CHECK・`parse.rs:104` の実生成・frontend `formatErrorRow.ts` switch の三点一致を実測し、`"n"` は repo 内に存在しない（reviewer 主張の根拠は再現不能）。一方「IO の `ParseErrorType` は 3 variant のみで `unmatched_product` は BIZ 生成」は事実（`z004_parser.rs:62-69` 実読）— 「IO 既存 enum の露出」という機序記述を「IO 3 variant + BIZ 1 値を合成した 4 値 wire enum の新設」へ訂正
- P2-1（`SalesReportType` 両方向実績の主張誤り）: **accept**。`SalesReportType` は request 引数のみ（response struct に不在を実読確認）。先例を方向別（request = SalesReportType / response = SalesMode）に訂正し、両方向担保は実装 PR の round-trip test へ
- P3-1（71 の自己指名表現）: **accept**。71 §71.7 の見直し契機行は「順 8」であり Risk 節を精緻化（Scope 節は当初から正確）

### Plan Review round 2（independent Claude subagent, Sonnet 5, fresh context）

- P1-2 反証の独立再検証: **Writer の refute を確認**（schema CHECK / parse.rs 生成 / formatErrorRow switch / repo 全体 `"n"` 0 hit をすべて Reviewer 自身の実測で一致）
- round 1 是正の波及: (11)(12) の値集合一致、方向別先例訂正の正確性、旧前提 0 hit を確認
- P1（`tax_rate` / `stock_unit` の family 漏れ — schema_v1.rs 全 CHECK 列挙で検出）: **accept**。family (13)(14) を追加。CSV 一括インポートの file 由来経路が同じ BIZ validation を通るため「wire 経路は enum 置換・file 経路の guard は維持」の二層化を特記（他 family の手動 parse 廃止と扱いが異なる）。frontend 手動 union `ProductTaxRate` も置換対象に追加
- P2（PR2 range が (2)〜(10) のまま）: **accept**。(2)〜(14) へ更新
- P3（nullable request filter の probe 明示）: **accept**。SPEC-P41-D5 (v) へ追記

### Plan Review round 3（independent Claude subagent, Sonnet 5, fresh context）

- round 2 是正の検証: family (13)(14) の値・露出箇所・二層化（wire 463-466 / file 692-699 の別 site 実在）・`ProductTaxRate` 実在をすべて Reviewer 実測で確認
- 全数突合: schema_v1.rs の CHECK 12 件全列挙で 11 件が family 対応・1 件（stocktake.status）が対象外明記と一致、frontend union sweep でも漏れなしを確認（14 family で網羅確定）
- P1（51-ui-product-form.md の Scope 欠落）: **accept**。値集合の frontend 正本（§147-148 相当の `"10"|"8"|"0"` / `"pcs"|"cm"` 手書き集合と select validation 文言）が実在することを Writer も実読確認（型名 `ProductTaxRate` 自体は 51 に不在で、正本は値集合と文言）。Scope / Design Sources / Required Design Artifacts / Matrix N12 へ水平展開。UI 入力バリデーションの意味論は不変と明記
- P2（30 の他節未展開）: **accept**。Design Sources / Required Design Artifacts / Ledger D-061 (c) へ展開。round 2 に続く sweep 不完全の再発のため、round 4 では「Scope 追加 doc の全節出現」を機械的に突合する観点を Reviewer へ明示依頼する

### Plan Review round 4（independent Claude subagent, Sonnet 5, fresh context）

- 全 doc×全節の機械突合を実施（依頼した欠陥 class 特化観点）。round 3 是正の反映と、Non-scope の「30」表記が別箇所（§381 の単発 kind 言及 = deferred / tax_rate 節 = in-scope）を指す整合であることを確認
- P1（33 / 62 / 67 / 57 が Ledger・Matrix に皆無）: **accept**。Ledger へ派生 3 行を追加し、Matrix N13（33+67）/ N14（62）/ N15（57）の presence anchor（`D-061`、各 baseline 0 実測済み）を新設
- P2（Plans.md の Scope 項目が未検証）: **accept**。Required Design Artifacts へ Process 行を追加し、Matrix N16（`rg -cF "D-061 (e) に吸収" docs/Plans.md`、fixed-string、baseline 0）を新設

### Writer self-audit（plan-approved 後、amendment AMD1）

- DB_DESIGN.md の CHECK 一覧改訂の執筆中に、round 3/5 の「全数突合」が schema_v1.rs のみを列挙し **schema_v2/v4 の daily report 系 CHECK（status / source_adapter / source_file）を見ていなかった**ことを検出。実査の結果**新 family は無し**: `DailyReportImportResult` 系 `status: String` は frontend 比較なし（StocktakeProgressBiz.status と同類）、`duplicate_check.status` / `source_file` は `DailyReportDuplicateStatus` / `DailyReportSourceKind` として既に generated enum 済み（本是正の先行事例）、`source_adapter` は POS Adapter Boundary の拡張点。対象外リストへ 3 点を追補し、N9 の突合方法を「全 schema file + DB_DESIGN CHECK 一覧」へ強化。Final Review で再検証すること

### Final Review（independent Claude subagent, Sonnet 5, fresh context, audited content = d7e1088）

- Matrix N1〜N16 を Reviewer が独立再実行し全 oracle 一致。N9 は全 schema file（v1: 12 CHECK + v4: 5 CHECK）+ DB_DESIGN 一覧の両方で 14 family + 対象外分類の網羅を独立再現
- P1（44 の enum 契約化注記が manual_sales.reason と廃棄の自由記述 reason を無限定にまとめ、実装 PR2 の誤読で自由記述 field の enum 化 = 機能退行を招き得る）: **accept**。分離明示 + 廃棄 reason の enum 化禁止を明記（commit d7e1088）。Reviewer が是正 diff・N11 継続・無矛盾を確認し **P1/P2 = 0 を認定**
- P2/P3 = 0

### Plan Review round 5（independent Claude subagent, Sonnet 5, fresh context）

- round 4 是正の検証: Ledger 派生行と N13〜N16 の対応・全 baseline 0・実行タイミング反映をすべて実測確認
- 全 doc×全節突合の再実行: 20 doc 中 19 が 3 系統に出現、欠落なし
- **新規 P1/P2 = 0。plan-approved 判定**
- P3-1（Plans.md が Design Sources に不在）: **Coordinator 裁定で解消扱い（doc 変更なし）**。Design Sources は設計判断の情報源のカテゴリであり、Plans.md は本 packet が書き込む process 追跡物で性質が異なる。検証は Required Design Artifacts の Process 行 + Ledger D-061 (e) 行 + Matrix N16（機械）が担保しており機能的欠落はない
