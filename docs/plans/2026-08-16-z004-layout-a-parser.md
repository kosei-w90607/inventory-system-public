# Plan Packet — Z004 parser layout A 対応（D-070 runway ②）

## Workflow State

Use the field definitions, enums, transition evidence, packet-selection rule, and fail-closed behavior from `docs/DEV_WORKFLOW.md` `Workflow State`. Keep exactly one `- Key: value` line per field.

If a state-only commit materializes multiple phases, list the complete adjacent forward sequence and the pre-existing evidence for every intermediate transition in an append-only review/evidence record. Recording compression never permits a gate skip.

- Phase: plan-gate
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: pending
- Amendments: none
- Coordinator: Fable (main thread)
- Writer: Codex
- Plan Reviewer: Sonnet subagent（独立、Writer と別 context）
- Final Reviewer: Sonnet subagent（独立、Writer と別 context）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: L3 実ファイル取込み確認（CSV-09/CSV-10 相当）/ Ready 承認 / merge

Transition narrative（append-only）:

- 本 packet 作成 commit で kickoff → spec-check → design → plan-draft → plan-gate を materialize する。evidence: task scope と Risk は本 packet に記録（kickoff → spec-check）/ in-scope source docs は Design Sources に列挙し設計更新要と判定（spec-check → design）/ 設計判断は本 packet Spec Contract に確定済みで未解決の設計問題なし、source doc への反映は本 PR 内で Writer が実施（design → plan-draft、PR #77 先例の「updated in this PR」形）/ packet + Test Design Matrix を同一 commit で commit（plan-draft → plan-gate）。

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay 往復上限: 2
- Plan Review round 天井: 3（既定）

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

§5.5を使わないchangeは両方`none`のままにする。

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
POS CSV（Z004）の parser 契約変更。取込みパイプライン（BIZ-03 → sale_records / pos_stock_sync 在庫増減）の入口であり、誤 parse は在庫・売上データの誤登録に直結する。Risk Tiers の「POS CSV」に該当。

## Goal

Goal Invariant:

### 最小完了条件

- 店舗の標準手順（SD → CV17 取込み → PC 側 `EcrDatas`）で得られる実 Z004 ファイル（layout A: メタ行群 + ヘッダ 1 行 + 全スロットダンプ、精算日はメタ内日付行）を、既存の Z004 取込み画面からエラー停止なしで parse でき、既存 BIZ-03 パイプライン（sale_records 作成・pos_stock_sync 在庫増減・rollback）へ従来どおり流れること。

### 失敗定義

- 実 Z004（layout A）が引き続き「精算日を抽出できません」で停止する、または layout A 対応の副作用で従来 shape の parse 結果・既存 test が変化する。
- どちらの shape でもない不正ファイルが安全停止せずに誤 parse される（fail-closed の毀損）。

### 非目的

- BIZ-03 / UI-07 / bindings の契約変更。parser の出力契約（ParseResult）は不変のまま完結させる。
- layout B（連結型）対応、PLU slot 永続割当、bulk onboarding、受入台本第2版（いずれも D-070 runway の後続便）。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `src-tauri/src/io/z004_parser.rs`: 二形状対応（従来 shape + layout A）の layout 検出・精算日抽出の実装（Spec Contract SPEC-Z4A-D1〜D6）。
- `docs/function-design/23-io-z004-parser.md`: 契約 amendment — 二形状受理・layout A 構造・精算日抽出規則・E パディング語義の正本化（SPEC-Z4A-D1〜D6 の doc 側正本）、`total_data_lines` 定義の一般化、2026-08-01 evidence boundary 注記の実態同期。
- `docs/function-design/55-ui-csv-import.md`: 「店舗採取 layout A は IO-02 未対応」記述 2 箇所（冒頭 evidence sync 注記・取込み種別表）の実態同期。
- `docs/plu-export-and-real-csv-verification.md`: CSV-05 / CSV-09 / CSV-10 の状態行を「parser 改修後」から本 change 後の状態へ同期（CSV-09/10 の実走完了記録は L3 evidence 確定後）。
- 新規 synthetic layout A fixture（CP932 / CRLF / 全フィールドクォート / メタ 6 行・日付 5 行目 / ヘッダ 1 行 / 13桁JAN+E・8桁+EEEEEE・全ゼロ・返品マイナス・複数数量行を含む匿名化 shape）と新規 unit tests。
- 新規 test が REQ token を含む場合は `cargo run --bin generate_traceability` で `90-traceability.md` 再生成を同一 PR で実施。

## Non-scope

- layout B（連結型）対応。Z004 の layout B 実サンプルは未採取であり、D-070 の runway ②は「layout A 対応」に scope を pin している。店舗標準手順は `EcrDatas`（layout A）に固定済み（2026-08-01 owner 判断、UI-07-D12）。layout B は現行どおり安全停止を維持し、CV17 明示書出し経路（復旧・調査用途）の実需と実サンプルが揃った時点で別 change として判断する。
- BIZ-03 / CMD-07 / UI-07 の契約・実装変更（ParseResult 出力契約不変のため不要）。同日冪等（D-071 / SPEC-SDI-D1〜D8）は merge 済みの前提基盤であり本 change で触らない。
- 8桁独自コード行の業務的取込み（商品マスタは JAN 前提。SPEC-Z4A-D5 で行単位エラーとしての可視性を維持するに留める）。
- PLU slot 永続割当 / bulk onboarding / 受入台本第2版（runway ③④⑤）。
- 既存の従来 shape unit tests の改変（凍結、SPEC-Z4A-D7）。

## Acceptance Criteria

- AC1: synthetic layout A fixture の parse が成功し、settlement_date がメタ日付行から YYYY-MM-DD で得られる（新規 unit test、`cargo test -p` 対象 crate の該当 test green）。
- AC2: 従来 shape の既存 unit tests が全件無改変のまま green（`git diff` で既存 test 関数の変更ゼロ + L1 full CLEAN）。
- AC3: どちらの shape でもない入力（日付行なし・ヘッダ行なし・メタ走査上限超過）が致命的エラーで安全停止する（新規 negative tests `parse_z004_layout_a_no_date_fails` / `parse_z004_layout_a_no_header_fails` / `parse_z004_unrecognized_shape_fails` green）。
- AC4: `YYYY/M/D` 形式のメタ日付が `YYYY-MM-DD` へゼロ埋め正規化される（新規 unit test green）。
- AC5: 8桁+EEEEEE 行が invalid_jan の行単位エラーとして報告され、他行の parse は継続する（新規 unit test `parse_z004_layout_a_8digit_code_invalid_jan` green）。
- AC6: 全ゼロコード行（13桁・14桁）が空スロット skip のまま（既存 test 凍結 + layout A fixture 内の該当行が parsed_rows / parse_errors のどちらにも入らないことを新規 test `parse_z004_layout_a_slot_dump_counts` で assert、green）。
- AC7: 23-io / 55-ui / plu-export doc の同期が完了し `bash scripts/doc-consistency-check.sh` CLEAN（evidence: L1 full log）。
- AC8: owner L3 — 実 Z004（店舗採取、local-only）をバックアップ済みテスト DB へ取り込み、取込み成功・在庫増減・日次売上反映・返品マイナスを確認（CSV-09/CSV-10 相当。evidence = PR body / PR comment）。

## Design Sources

- Requirements / spec: `docs/function-design/23-io-z004-parser.md`（IO-02 現行契約）/ REQ-401 系（Z004 取込み）
- Architecture: `docs/ARCHITECTURE.md`（IO 層 = 純関数・DB 非依存の境界、変更なし）
- Function / command / DTO: `docs/function-design/55-ui-csv-import.md`（UI-07 / CMD-07 の呼び出し文脈、契約変更なし）/ `docs/function-design/32-biz-csv-import-service.md`（BIZ-03、契約変更なし・SPEC-SDI-D1〜D8 前提基盤）
- DB: 変更なし（parser は DB 非依存）
- Screen / UI: 変更なし（UI-07 の operator 動線・文言は不変）
- Decision log / ADR: D-070（Z004 を v1.0 gate に含める・runway ②の scope 根拠）/ D-071（同日冪等、前提基盤）/ 2026-08-01 owner 判断（標準入力元 = `EcrDatas` 固定、UI-07-D12）
- 形状 evidence: `docs/plu-export-and-real-csv-verification.md`「2026-07-06 実機確認・実ファイル形状の確定事項」/ `docs/function-design/29-io-daily-report-parser.md` §29.4（layout A/B 知見の移植元）/ issue #76 実機バッチ（2026-08-15、Z-LAYOUT 差分なし・Z-CSV-06/07 PASS）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | `docs/function-design/23-io-z004-parser.md` | updated in this PR（SPEC-Z4A-D1〜D6 正本化） |
| Command / DTO / generated binding / wire shape | なし（ParseResult 不変、bindings 再生成不要） | existing sufficient |
| DB / transaction / audit / rollback / migration | なし（DB 非接触） | existing sufficient |
| Screen / UI / route state / Japanese wording | `docs/function-design/55-ui-csv-import.md`（注記同期のみ、契約不変） | updated in this PR |
| CSV / TSV / report / import / export format | `docs/plu-export-and-real-csv-verification.md`（検証状態同期） | updated in this PR |
| Durable decision / ADR | D-070 が scope 根拠として既存。新規 durable decision は SPEC-Z4A-D* として 23-io へ正本化（decision-log 新設は不要） | updated in this PR |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| REQ coverage 追加（新規 test が REQ token を含む場合） | `cargo run --bin generate_traceability` で `90-traceability.md` 再生成（PR #72 の教訓: targeted checks では未検出、L1 full / CI で顕在化） |

上記以外（Tauri command / doc 新設 / route / 画面）は該当なし。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-401（Z004 取込み） | 23-io §13.3 | SPEC-Z4A-D1 | 二形状受理 + fail-closed。従来 shape 廃止案は既存 fixture/test 凍結と後方互換を壊すため不採用 | `parse_z004` | T-A1 / T-N1〜N3 |
| REQ-401 | 23-io §13.3（新設節） | SPEC-Z4A-D2 | layout A 検出はヘッダ行（最初の 5 フィールド行）検出方式。メタ固定 6 行依存は CV17 版差に脆いため不採用 | `parse_z004` layout 検出 | T-A1 / T-A5 / T-N2 |
| REQ-401 | 23-io §13.3（新設節） | SPEC-Z4A-D3 | 精算日はメタ行群走査の最初の日付パターン。`YYYY/M/D` 受理 + ゼロ埋め正規化（29-io §29.4 と同基準）。メタ 5 行目固定参照は不採用（同上） | 日付抽出・正規化 | T-A2 / T-A3 / T-N1 |
| REQ-401 | 23-io §13.2 | SPEC-Z4A-D4 | ParseResult 出力契約不変。下流（BIZ-03 / SPEC-SDI 基盤）を無改変で成立させる | 型定義（変更なしの確認） | T-A1 + 既存 test 凍結 |
| REQ-401 | 23-io §13.5 | SPEC-Z4A-D5 | E = 14 桁固定幅パディングの語義正本化。8桁+EEEEEE は invalid_jan 行エラー維持（silent skip は売上行の不可視喪失のため不採用） | doc 語義修正（挙動不変） | T-A4 |
| REQ-401 | 23-io §13.6 | SPEC-Z4A-D6 | 全スロットダンプ（5,000 行規模）受理。既存上限 10,000 行 / 20MB（BIZ-03 検査）内で新規ガード不要 | 境界仕様（確認） | T-A6 |
| — | DEV_WORKFLOW（既存 test 凍結原則） | SPEC-Z4A-D7 | 従来 shape 既存 test は無改変凍結。layout A は新規 test のみで拘束 | test diff | AC2 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 可。形状事実は plu-export doc「2026-07-06 実機確認」、layout 知見は 29-io §29.4、scope 根拠は D-070 に既存。本 change で 23-io に契約として正本化する。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: SPEC-Z4A-D1〜D6 を 23-io へ正本化（本 PR 内）。
- Assumptions and constraints: 実ファイルは CP932 / CRLF / 全フィールドクォート / メタ行 2 列・データ行とヘッダ行 5 フィールド（2026-07-06 解析 + 2026-08-15 Z-LAYOUT 差分なしで検証済み）。IO 層は純関数・DB 非依存を維持。
- Deferred design gaps, risk, and follow-up target: layout B（連結型）は実サンプル未採取のため安全停止のまま defer（Non-scope 参照）。`EcrDatas` の保持期間・命名等の運用設計は runway 外の既存 backlog（日報取込み運用設計）。
- Test Design Matrix can cite design decision IDs or source doc sections: 可（SPEC-Z4A-D1〜D7）。
- Absolute guarantee / escape hatch self-check completed, with every exception checked and compatibility stated: 完了。例外 = 二形状のどちらでもない入力は全て致命的エラー安全停止（escape hatch なし）。従来 shape の互換は既存 test 凍結で機械保証。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | layout A/B は CASIO adapter facts。core 契約への昇格は 23-io の SPEC-Z4A-D* として実施（29-io の先例と同型） | 23-io amendment |
| Fact check / design decision split | 形状事実（メタ 2 列・日付 5 行目・E パディング）は 2026-07-06 解析 + 2026-08-15 Z-LAYOUT で検証済み。設計判断（検出方式・走査上限・エラー可視性）は本 packet で確定 | Contract Probe 節 |
| Lifecycle / retry | 取込み lifecycle（preview / commit / rollback / 同日冪等）は BIZ-03 既存契約のまま不変。parser は純関数で retry 概念なし | Matrix State Lifecycle 節 |
| Operator workflow | operator の操作は不変（UI-07 の同一画面・同一手順）。変わるのは「実ファイルでエラー停止しなくなる」結果のみ | AC8（L3） |
| Replacement path | 従来 shape を置換せず並存（後方互換）。既存 fixture・取込み済みデータへの影響なし | SPEC-Z4A-D1 |
| Data safety / evidence | 実 CSV・実店舗値は repo に入れない。fixture は匿名化 synthetic のみ | Data Safety 節 |
| Reporting / accounting semantics | Z004 は商品別 track。Z001/Z002/Z005 公式日次との加算禁止は既存契約のまま（本 change 非接触） | — |
| Manual verification | L3 = 実ファイル取込み + 在庫・日次売上・返品確認（CSV-09/10 の消化） | AC8 |
| 環境・再現性 | 新設の環境依存なし（純 Rust、既存 crate のみ。新規依存追加なし） | — |

## Design Readiness

- Existing design docs are sufficient because: 形状事実と layout 知見は既存 doc（plu-export / 29-io §29.4）に正本化済み。不足は IO-02 契約への適用のみで、それは本 PR の 23-io amendment（SPEC-Z4A-D1〜D6）で満たす。
- Source docs updated in this PR: 23-io / 55-ui（注記 2 箇所）/ plu-export（検証状態）。
- Design gaps intentionally deferred: layout B 対応（Non-scope 参照）。
- Durable decisions discovered in this plan and promoted to source docs: SPEC-Z4A-D1〜D6。

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): IO-02 単独の変更。層間契約（ParseResult）は不変。
- Backend function design: `parse_z004` の処理ステップ改訂を 23-io に正本化。
- Command / DTO / data contract: 不変（bindings 再生成不要）。
- Persistence / transaction / audit impact: なし（DB 非接触、BIZ-03 の operation_logs 分岐は既存契約のまま）。
- Operator workflow / Japanese UI wording: 不変。致命的エラー文言は既存の利用者向け日本語規約を維持（変更する場合は 23-io の文言表と同期）。
- Error, empty, retry, and recovery behavior: 二形状いずれでもない入力は致命的エラー安全停止。行単位エラー・空スロット skip の既存意味論は不変。
- Testability and traceability IDs: SPEC-Z4A-D1〜D7 + REQ-401。REQ token を含む test 追加時は traceability 再生成。

## Contract Probe

- 実 Z004 layout A の形状（メタ行 2 列・日付 5 行目・ヘッダ/データ 5 フィールド・CP932・CRLF・全クォート・E パディング）: 2026-07-06 実機採取の匿名化解析（plu-export doc「2026-07-06 実機確認・実ファイル形状の確定事項」）+ 2026-08-15 店舗再採取の Z-LAYOUT 差分なし（issue #76 evidence） -> 検証済み。新規 probe 不要、最終確認は L3（AC8）。
- 現行 parser が layout A で安全停止する事実: `z004_parser.rs` の Step 6（1 行目日付抽出）実読 + plu-export doc の実サンプル再確認記録 -> 検証済み（`NoSettlementDate` 停止）。
- 未検証の外部前提: なし（新規 crate 依存なし、OS/hardware 依存なし）。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| SPEC-Z4A-D1 二形状受理 + fail-closed | `parse_z004` layout 検出分岐 | T-A1（layout A 成功）/ T-N3（どちらでもない入力の安全停止）/ 既存従来 shape tests（凍結） | L3: 実ファイル取込み成功 |
| SPEC-Z4A-D2 ヘッダ検出方式のメタ読み飛ばし | layout A 走査 | T-A1 / T-A5（メタ行数変動耐性）/ T-N2（ヘッダ不在） | — |
| SPEC-Z4A-D3 メタ日付走査 + 正規化 | 日付抽出 | T-A2（YYYY-MM-DD）/ T-A3（YYYY/M/D ゼロ埋め）/ T-N1（日付なし） | — |
| SPEC-Z4A-D4 ParseResult 出力契約不変 | 型・下流無改変 | T-A1 の全 field assert + 既存 test 凍結（AC2） | — |
| SPEC-Z4A-D5 E パディング語義・8桁行の可視エラー維持 | `normalize_jan`（挙動不変）+ 23-io 語義修正 | T-A4（8桁+EEEEEE → invalid_jan、他行継続） | — |
| SPEC-Z4A-D6 全スロットダンプ受理・全ゼロ skip | 既存境界の確認 | T-A6（大型 fixture: 空スロット多数 + 実データ行混在の件数 assert） | — |
| SPEC-Z4A-D7 既存 test 凍結 | test diff | AC2（diff 検分 + L1 full） | — |
| 隣接契約: BIZ-03 上限 10,000 行 / 20MB（23-io §13.6、無変更） | 変更なし | 既存 BIZ-03 tests（非接触） | non-scope（明示除外: parser 側に上限検査を新設しない） |
| 隣接契約: INV-6 file_hash（生バイト SHA-256、無変更） | 変更なし | 既存 tests（凍結） | non-scope |
| 隣接契約: SPEC-SDI-D1〜D8 同日冪等（無変更の前提基盤） | 変更なし | 既存 tests（非接触） | non-scope（layout A 実ファイルの同日複数精算は L3 で観察のみ、契約変更なし） |

## Test Plan

Test Design Matrix: [test-matrices/2026-08-16-z004-layout-a-parser.md](test-matrices/2026-08-16-z004-layout-a-parser.md)

- targeted tests: `z004_parser` unit tests（新規 T-A1〜T-A6 / T-N1〜T-N3、既存凍結）
- negative tests: 日付なし / ヘッダなし / メタ走査上限超過 / 二形状いずれでもない構造
- compatibility checks: 従来 shape fixture の parse 結果不変（既存 test 凍結）
- data safety checks: fixture が匿名化 synthetic であること（実 JAN・実店舗値・実商品名の不使用）
- main wiring/integration checks: BIZ-03 経由の既存 integration tests が無改変 green（parser 改修が主経路に届いていることは既存経路 test で担保）
- Human Gate L3 を含むため、Writer 完了条件に `cargo check --release` を含める（owner native build 前、CI gate ではない）

## Boundary / Wire Contract

- producer: CASIO CV17（SD 取込み後の `EcrDatas` 常在ファイル = layout A）/ 従来 shape（既存 fixture・過去採取分）
- consumer: `parse_z004` → BIZ-03（無改変）
- wire type: CP932 生バイト列（CSV、全フィールドクォート、CRLF/NEL 正規化は既存契約）
- internal type: `ParseResult`（不変）
- precision/range: quantity / amount = i32（不変）。日付は YYYY-MM-DD / YYYY/M/D 受理 → YYYY-MM-DD 正規化
- round-trip path: なし（読み取り専用の一方向 parse）
- invalid input: 二形状いずれでもない → 致命的エラー安全停止。行単位不正 → parse_errors 蓄積（不変）
- compatibility: 従来 shape の parse 結果・エラー文言は不変（既存 test 凍結が機械保証）

## Review Focus

- layout 検出の fail-closed 性: 「1 行目に日付なし → layout A 走査」の分岐が、不正ファイルを誤って layout A として受理しないか（メタ走査上限・ヘッダ検出条件の堅牢性）。
- 従来 shape の完全非退行: 既存 test 凍結の diff 検分と、検出分岐追加による従来経路の意味論変化がないこと。
- 日付正規化のゼロ埋め・境界（1 桁月日、不正日付文字列）。
- fixture の匿名化 shape 準拠（Data Safety）。
- 23-io amendment と実装の一致（Contract Audit で行単位再検証）。

## Spec Contract

Contract ID: SPEC-Z4A-D1〜D7

- SPEC-Z4A-D1（二形状受理・fail-closed）: `parse_z004` は (a) 従来 shape（1 行目に `YYYY-MM-DD` 日付パターン、2 行目ヘッダ、3 行目以降データ）と (b) layout A（メタ行群 + ヘッダ 1 行 + データ行群）の両方を受理する。判定は「改行正規化後の 1 行目に日付パターンがあれば従来 shape、なければ layout A 走査」。どちらの shape としても成立しない入力は致命的エラー（`Z004ParseError`）で安全停止し、部分 parse 結果を返さない。
- SPEC-Z4A-D2（layout A 構造検出）: layout A 走査では、先頭から最初の「5 フィールドに分割できる行」をヘッダ行として検出し、それより前の行群をメタとして扱う。ヘッダ検出は先頭 20 行以内に限定し、超過時は `NoDataLines` 系の致命的エラーで停止する。メタ行数の固定値（6 行）には依存しない（CV17 の版差・帳票差への堅牢性。事実としてのメタ 6 行は fixture に反映する）。データ行はヘッダ行の次行以降とし、行単位処理（空行 skip / 空スロット skip / 行単位エラー）は既存契約のまま適用する。
- SPEC-Z4A-D3（精算日抽出・正規化）: layout A では、メタ行群を先頭から走査し最初に見つかる日付パターンを settlement_date とする。受理形式は `YYYY-MM-DD` と `YYYY/M/D`（月日 1〜2 桁）で、出力は常にゼロ埋め `YYYY-MM-DD` に正規化する（29-io §29.4 の日付受理と同基準）。メタ行群に日付が見つからない場合は `NoSettlementDate` で停止する。従来 shape の 1 行目抽出は現行契約のまま不変。
- SPEC-Z4A-D4（出力契約不変）: `ParseResult` / `ParsedRow` / `ParseError` / `Z004ParseError` の型・意味論は変更しない。`line_no` は物理行番号（1 始まり）のまま。`total_data_lines` の定義は「3 行目以降」から「ヘッダ行より後の行のうちフィールド分割を試みた行」へ一般化する（従来 shape ではヘッダ = 2 行目のため実質同値）。BIZ-03 以降・bindings は無改変。
- SPEC-Z4A-D5（E パディング語義）: コード欄の `E` は 14 桁固定幅の右パディングであり識別子ではない（2026-07-06 確定事項）。23-io §13.5 の「レジ固有サフィックス」記述をパディング語義へ是正する。正規化の挙動は不変: 13 桁 JAN + `E` は 13 桁化、8 桁独自コード + `EEEEEE` は invalid_jan の行単位エラーとして可視のまま維持する（silent skip は売上行の不可視喪失となるため不採用。当該行は商品マスタ非対象で取込み不能が正であり、エラー可視性が operator への正直な報告である）。
- SPEC-Z4A-D6（全スロットダンプ受理）: layout A は売上有無を問わない全スロットダンプ（5,000 行規模）である。既存上限（10,000 行 / 20MB、BIZ-03 検査）の範囲内であり、parser 側に新規サイズガードは設けない。全ゼロコード行の空スロット skip は既存契約のまま。
- SPEC-Z4A-D7（既存 test 凍結）: 従来 shape の既存 unit tests は削除・改変・skip いずれも禁止。layout A の拘束は新規 test / fixture のみで行う。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-Z4A-D1 | layout 検出分岐の実装 | T-A1 / T-N3 + 既存凍結 tests | fail-closed 性 | L1 full + L3 |
| SPEC-Z4A-D2 | ヘッダ検出・メタ読み飛ばし | T-A1 / T-A5 / T-N2 | 検出条件の堅牢性 | L1 full |
| SPEC-Z4A-D3 | 日付走査・正規化 | T-A2 / T-A3 / T-N1 | ゼロ埋め・境界 | L1 full |
| SPEC-Z4A-D4 | 出力契約の非変更確認 | T-A1 全 field assert + AC2 | 型 diff ゼロ | L1 full |
| SPEC-Z4A-D5 | 23-io 語義修正（挙動不変） | T-A4 | doc と実装の一致 | Contract Audit |
| SPEC-Z4A-D6 | 境界確認 | T-A6 | 件数 assert | L1 full |
| SPEC-Z4A-D7 | test diff 凍結 | AC2 | diff 検分 | Final Review |

## Data Safety

- 実 Z004 CSV・実店舗値（実 JAN、実商品名、実売上数値、管理 No. 等のメタ実値）を commit しない。
- local-only paths: 店舗採取の実ファイル（owner PC の `EcrDatas` / ローカル解析 dir）。repo へは参照名のみ。
- synthetic-only paths: 新規 fixture は匿名化 shape（synthetic JAN 13 桁・架空名称・架空数値）のみ。29-io fixture と同基準。

## Implementation Results

Fill after implementation.

Do not transcribe exact-HEAD SHA or test counts here (D-035/D-038 Evidence Ownership). Record a qualitative summary and the PR link only.

## Review Response

Fill after review.
If R3 review-only sub-agent is skipped, record an explicit line beginning with `Review-only skipped because:` and the reason.
- Findings Freeze: not yet frozen; post-freeze exceptions: none.
