# Plan Packet — Z004 parser layout A 対応（D-070 runway ②）

## Workflow State

Use the field definitions, enums, transition evidence, packet-selection rule, and fail-closed behavior from `docs/DEV_WORKFLOW.md` `Workflow State`. Keep exactly one `- Key: value` line per field.

If a state-only commit materializes multiple phases, list the complete adjacent forward sequence and the pre-existing evidence for every intermediate transition in an append-only review/evidence record. Recording compression never permits a gate skip.

- Phase: implementing
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 8aa96a5
- Amendments: 8236176
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
- state-only 遷移 commit で plan-gate → plan-approved → implementing を materialize する（recording compression の正規例）。evidence: 独立 Plan Reviewer rally 3 round で P1/P2 = 0 収束（Review Response の round 1〜3 記録、最終 round 3 は対象 ce6869d）/ owner plan 承認 2026-08-17（介入 1 回目 / 予算 3 回）/ plan-first commit 8aa96a5 は全実装 commit に先行（PK5 ancestry）。

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
- `docs/plu-export-and-real-csv-verification.md`: CSV-05 / CSV-06 / CSV-07 / CSV-09 / CSV-10 の状態行を実態へ同期（CSV-06/07 は issue #76 実機バッチ evidence〈2026-08-15 PASS〉で即時同期可、CSV-09/10 のみ L3 evidence 確定後に完了記録。Plan Gate round 1 F2）。
- 新規 synthetic layout A fixture（CP932 / CRLF / 全フィールドクォート / メタ 6 行・日付 5 行目 / ヘッダ 1 行 / 13桁JAN+E・8桁+EEEEEE・全ゼロ・返品マイナス・複数数量行を含む匿名化 shape）と新規 unit tests。
- 新規 test が REQ token を含む場合は `cargo run --bin generate_traceability` で `90-traceability.md` 再生成を同一 PR で実施。

## Non-scope

- layout B（連結型）対応。Z004 の layout B 実サンプルは未採取であり、D-070 の runway ②は「layout A 対応」に scope を pin している。店舗標準手順は `EcrDatas`（layout A）に固定済み（2026-08-01 owner 判断、UI-07-D12）。layout B は現行どおり安全停止を維持し、CV17 明示書出し経路（復旧・調査用途）の実需と実サンプルが揃った時点で別 change として判断する。
- BIZ-03 / CMD-07 / UI-07 の契約・実装変更（ParseResult 出力契約不変のため不要）。同日冪等（D-071 / SPEC-SDI-D1〜D8）は merge 済みの前提基盤であり本 change で触らない。
- 8桁独自コード行の業務的取込み（商品マスタは JAN 前提。SPEC-Z4A-D5 で行単位エラーとしての可視性を維持するに留める）。
- PLU slot 永続割当 / bulk onboarding / 受入台本第2版（runway ③④⑤）。
- 既存の従来 shape unit tests の改変（凍結、SPEC-Z4A-D7）。

## Acceptance Criteria

- AC1: synthetic layout A fixture の parse が成功し、settlement_date がメタ日付行から YYYY-MM-DD で得られる（新規 unit test、`cargo test -p` 対象 crate の該当 test green）。adversarial case（非日付メタ値に日付様文字列を混在させても layout A 検出・「日付」ラベル行優先が保たれる）は `parse_z004_layout_a_datelike_meta_first_line` green で拘束する。
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
| REQ-401（Z004 取込み） | 23-io §13.3 | SPEC-Z4A-D1 | 二形状受理 + fail-closed。従来 shape 判定は 1 行目日付 + 2 行目 5 フィールド検査の二重条件（日付様メタ値による誤ルーティングの構造排除。ラベル照合まで課す案は凍結 BIZ fixture の省略ラベルと衝突するため gated Amendment 1 で不採用）。従来 shape 廃止案は既存 fixture/test 凍結と後方互換を壊すため不採用 | `parse_z004` | T-A1 / T-A7 / T-N1〜N3 |
| REQ-401 | 23-io §13.3（新設節） | SPEC-Z4A-D2 | layout A 検出はヘッダ検査（5 フィールド + 位置アンカー付きラベル照合）方式。field 数のみの検出は移植元 `is_header_fields` より弱く不採用、位置非依存ラベル照合も round 2 N3 で位置アンカーへ強化。メタ固定 6 行依存は CV17 版差に脆いため不採用。ヘッダ未検出は `NoSettlementDate` variant + 原因別新文言（凍結 negative test は variant のみ assert で互換） | `parse_z004` layout 検出 | T-A1 / T-A5 / T-A7 / T-N2 |
| REQ-401 | 23-io §13.3（新設節） | SPEC-Z4A-D3 | 精算日は「日付」ラベル行優先 + 最初の日付パターン fallback。`YYYY/M/D` 受理 + ゼロ埋め正規化（29-io §29.4 と同基準）。メタ 5 行目固定参照は不採用（同上） | 日付抽出・正規化 | T-A2 / T-A3 / T-A7 / T-N1 |
| REQ-401 | 23-io §13.2 | SPEC-Z4A-D4 | ParseResult 出力契約不変。下流（BIZ-03 / SPEC-SDI 基盤）を無改変で成立させる | 型定義（変更なしの確認） | T-A1 + 既存 test 凍結 |
| REQ-401 | 23-io §13.5 | SPEC-Z4A-D5 | E = 14 桁固定幅パディングの語義正本化。8桁+EEEEEE は invalid_jan 行エラー維持（silent skip は売上行の不可視喪失のため不採用） | doc 語義修正（挙動不変） | T-A4 |
| REQ-401 | 23-io §13.6 | SPEC-Z4A-D6 | 全スロットダンプ（5,000 行規模）受理。既存上限 10,000 行 / 20MB（BIZ-03 検査）内で新規ガード不要 | 境界仕様（確認） | T-A6 |
| — | DEV_WORKFLOW（既存 test 凍結原則） | SPEC-Z4A-D7 | 従来 shape 既存 test は無改変凍結。layout A は新規 test のみで拘束 | test diff | AC2 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 可。形状事実は plu-export doc「2026-07-06 実機確認」、layout 知見は 29-io §29.4、scope 根拠は D-070 に既存。本 change で 23-io に契約として正本化する。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: SPEC-Z4A-D1〜D6 を 23-io へ正本化（本 PR 内）。
- Assumptions and constraints: 実ファイルは CP932 / CRLF / 全フィールドクォート / メタ行 2 列（ラベル + 値: 管理No./ファイル/帳票/番号/日付/時刻）・データ行とヘッダ行 5 フィールド（2026-07-06 解析 + 2026-08-15 Z-LAYOUT 差分なしで検証済み）。非日付メタ値が日付パターンを含まないことには**依存しない**設計とする（従来 shape 判定の 2 行目 5 フィールド検査の重畳 + 「日付」ラベル行優先で誤ルーティング・誤抽出を構造的に排除し、T-A7 で拘束。Plan Gate round 1 F3 / gated Amendment 1）。IO 層は純関数・DB 非依存を維持。
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
- Operator workflow / Japanese UI wording: 操作は不変。致命的エラー文言は原因別 2 文言へ改訂（SPEC-Z4A-D2/D3 に exact 文言を確定済み、23-io の文言表と同一 PR で同期。既存の「〜。ファイル形式を確認してください」規約を踏襲）。
- Error, empty, retry, and recovery behavior: 二形状いずれでもない入力は致命的エラー安全停止。行単位エラー・空スロット skip の既存意味論は不変。
- Testability and traceability IDs: SPEC-Z4A-D1〜D7 + REQ-401。REQ token を含む test 追加時は traceability 再生成。

## Contract Probe

- 実 Z004 layout A の形状（メタ行 2 列・日付 5 行目・ヘッダ/データ 5 フィールド・CP932・CRLF・全クォート・E パディング）: 2026-07-06 実機採取の匿名化解析（plu-export doc「2026-07-06 実機確認・実ファイル形状の確定事項」）+ 2026-08-15 店舗再採取の Z-LAYOUT 差分なし（issue #76 evidence） -> 検証済み。新規 probe 不要、最終確認は L3（AC8）。
- 現行 parser が layout A で安全停止する事実: `z004_parser.rs` の Step 6（1 行目日付抽出）実読 + plu-export doc の実サンプル再確認記録 -> 検証済み（`NoSettlementDate` 停止）。
- 未検証の外部前提: なし（新規 crate 依存なし、OS/hardware 依存なし）。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| SPEC-Z4A-D1 二形状受理（二重条件判定）+ fail-closed | `parse_z004` layout 検出分岐 | T-A1（layout A 成功）/ T-A7（日付様メタ値の誤ルーティング排除）/ T-N3（どちらでもない入力の安全停止）/ 既存従来 shape tests（凍結） | L3: 実ファイル取込み成功 |
| SPEC-Z4A-D2 ヘッダ検査（5 フィールド + 位置アンカー付きラベル照合）のメタ読み飛ばし・未検出 NoSettlementDate + 新文言 | layout A 走査 | T-A1 / T-A5（メタ行数変動耐性）/ T-A7（decoy 5 フィールド非ヘッダ行の排除）/ T-N2（ヘッダ不在、`NoSettlementDate` variant + 文言） | — |
| SPEC-Z4A-D3 「日付」ラベル行優先 + fallback 走査 + 正規化 | 日付抽出 | T-A2（YYYY-MM-DD）/ T-A3（YYYY/M/D ゼロ埋め）/ T-A7（ラベル優先）/ T-N1（日付なし） | — |
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

- layout 検出の fail-closed 性: 二重条件判定（1 行目日付 + 2 行目 5 フィールド検査）と layout A 走査が、不正ファイルを誤受理しないか（メタ走査上限・layout A ヘッダ検査の位置アンカー照合・「日付」ラベル行優先の堅牢性）。
- 致命的エラー文言の原因別分岐（ヘッダ未検出 / 精算日未検出）が契約どおり実装され、旧「1行目から」文言が残存しないか。
- 従来 shape の完全非退行: 既存 test 凍結の diff 検分と、検出分岐追加による従来経路の意味論変化がないこと。
- 日付正規化のゼロ埋め・境界（1 桁月日、不正日付文字列）。
- fixture の匿名化 shape 準拠（Data Safety）。
- 23-io amendment と実装の一致（Contract Audit で行単位再検証）。

## Spec Contract

Contract ID: SPEC-Z4A-D1〜D7

- SPEC-Z4A-D1（二形状受理・fail-closed）: `parse_z004` は (a) 従来 shape（1 行目に `YYYY-MM-DD` 日付パターン、2 行目ヘッダ、3 行目以降データ）と (b) layout A（メタ行群 + ヘッダ 1 行 + データ行群）の両方を受理する。判定は「改行正規化後、1 行目に日付パターンがあり**かつ** 2 行目が 5 フィールドに分割できる場合に従来 shape、それ以外は layout A 走査」。2 行目条件は **field 数のみ（ラベル照合なし）** とする — 凍結 BIZ test の従来 shape fixture には省略ラベルヘッダ（`"No.","コード","名","個","額"` = 第 5 フィールド「額」）が実在し、D2 のラベル照合を従来 shape 判定に課すと凍結 test `test_parse_and_validate_req401_invalid_settlement_date` が red になるため（gated Amendment 1、Writer fail-closed true positive）。二重条件により、日付様文字列を含むメタ値による従来 shape への誤ルーティング（誤 settlement_date + 行ずれの大量 parse_errors）は field 数条件で引き続き構造的に排除される（実 layout A のメタ行は 2 列。Plan Gate round 1 F3 の防御は保持）。layout A 走査側のヘッダ検査（SPEC-Z4A-D2 の位置アンカー照合）は不変。どちらの shape としても成立しない入力は致命的エラー（`Z004ParseError`）で安全停止し、部分 parse 結果を返さない。
- SPEC-Z4A-D2（layout A 構造検出・ヘッダ検査）: ヘッダ検査は「5 フィールドに分割でき、**第 2 フィールドに『コード』、第 5 フィールドに『金額』を含む**行」とする（29-io 移植元 `is_header_fields` と同型の field 数 + 位置アンカー付きラベル照合。従来 shape ヘッダ `No,コード,名称,個数,金額` も実ファイルヘッダ〈メモリNo./コード/名称/個数/金額〉も同一基準で pass する。メタ行は 2 列のため field 数でも排除され、位置アンカー照合は 5 フィールドの非ヘッダ行に対する防御の重畳。Plan Gate round 2 N3）。layout A 走査では先頭 20 行以内で最初にヘッダ検査を満たす行をヘッダとし、それより前の行群をメタとして扱う。20 行以内に未検出の場合は `NoSettlementDate` variant・文言「ヘッダ行を検出できません。ファイル形式を確認してください」で安全停止する（既存凍結 negative test `test_parse_z004_req401_no_settlement_date` は variant のみ assert〈message assert なしを rg で実測済み〉のため variant 互換で凍結維持。`NoDataLines` は既存どおり 2 行未満の pre-check 専用）。メタ行数の固定値（6 行）には依存しない（CV17 の版差・帳票差への堅牢性。事実としてのメタ 6 行は fixture に反映する）。データ行はヘッダ行の次行以降とし、行単位処理（空行 skip / 空スロット skip / 行単位エラー）は既存契約のまま適用する。
- SPEC-Z4A-D3（精算日抽出・正規化）: layout A では、メタ行群のうち第 1 フィールドに「日付」を含む行の値からの日付パターン抽出を優先し、該当行がない場合のみメタ行群を先頭から走査した最初の日付パターンへ fallback する（実ファイルのメタはラベル 2 列構成〈管理No./ファイル/帳票/番号/日付/時刻〉であり、ラベル優先は非日付メタ値の偶然一致に対する防御）。受理形式は `YYYY-MM-DD` と `YYYY/M/D`（月日 1〜2 桁）で、出力は常にゼロ埋め `YYYY-MM-DD` に正規化する（29-io §29.4 の日付受理と同基準）。メタ行群に日付が見つからない場合は `NoSettlementDate` variant・文言「精算日を抽出できません。ファイル形式を確認してください」で停止する。従来 shape の 1 行目抽出は現行契約のまま不変。**利用者向け文言の改訂（Plan Gate round 2 N1）**: 旧文言「1行目から精算日（YYYY-MM-DD）を抽出できません」は「1行目」という位置限定が二形状対応後は事実誤認となるため退役し、上記 2 文言（原因別: ヘッダ未検出 / 精算日未検出）へ置き換える。凍結 tests は variant のみ assert のため無改変で green（実測済み）。23-io の処理ステップ・エラーハンドリング表の文言も同一 PR で同期する。
- SPEC-Z4A-D4（出力契約不変）: `ParseResult` / `ParsedRow` / `ParseError` / `Z004ParseError` の型・意味論は変更しない。`line_no` は物理行番号（1 始まり）のまま。`total_data_lines` の定義は「3 行目以降」から「ヘッダ行より後の行のうちフィールド分割を試みた行」へ一般化する（従来 shape ではヘッダ = 2 行目のため実質同値）。BIZ-03 以降・bindings は無改変。
- SPEC-Z4A-D5（E パディング語義）: コード欄の `E` は 14 桁固定幅の右パディングであり識別子ではない（2026-07-06 確定事項）。23-io §13.5 の「レジ固有サフィックス」記述をパディング語義へ是正する。正規化の挙動は不変: 13 桁 JAN + `E` は 13 桁化、8 桁独自コード + `EEEEEE` は invalid_jan の行単位エラーとして可視のまま維持する（silent skip は売上行の不可視喪失となるため不採用。当該行は商品マスタ非対象で取込み不能が正であり、エラー可視性が operator への正直な報告である）。
- SPEC-Z4A-D6（全スロットダンプ受理）: layout A は売上有無を問わない全スロットダンプ（5,000 行規模）である。既存上限（10,000 行 / 20MB、BIZ-03 検査）の範囲内であり、parser 側に新規サイズガードは設けない。全ゼロコード行の空スロット skip は既存契約のまま。
- SPEC-Z4A-D7（既存 test 凍結）: 従来 shape の既存 unit tests は削除・改変・skip いずれも禁止。layout A の拘束は新規 test / fixture のみで行う。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-Z4A-D1 | layout 検出分岐（二重条件）の実装 | T-A1 / T-A7 / T-N3 + 既存凍結 tests | fail-closed 性 | L1 full + L3 |
| SPEC-Z4A-D2 | ヘッダ検査・メタ読み飛ばし | T-A1 / T-A5 / T-N2 | 検出条件の堅牢性・error variant 互換 | L1 full |
| SPEC-Z4A-D3 | 日付ラベル優先走査・正規化 | T-A2 / T-A3 / T-A7 / T-N1 | ゼロ埋め・境界 | L1 full |
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

### Plan Gate round 1（独立 Sonnet Plan Reviewer、対象 = plan-first commit 8aa96a5）

P1 = 0 / P2 = 3 / P3 = 1。全件 accept、同一 packet 内で是正（plan-gate に留まったままの in-place 修正、Coordinator が引用を実読裏取りのうえ裁定）。

- F1 (P2) accept: ヘッダ検出が field 数のみで移植元 `is_header_fields`（field 数 + ラベル内容照合）より弱い → SPEC-Z4A-D2 をラベル照合込みのヘッダ検査へ改訂。
- F2 (P2) accept: plu-export doc の CSV-06/07 が issue #76 evidence（2026-08-15 PASS）と drift したまま同期対象から漏れ → Scope を CSV-05/06/07/09/10 へ拡張。
- F3 (P2) accept（構造是正の強い形を採用）: 従来 shape 判定が「1 行目日付のみ」で日付様メタ値による誤ルーティングの新失敗モードを持つ → SPEC-Z4A-D1 を二重条件（1 行目日付 + 2 行目ヘッダ検査）へ、SPEC-Z4A-D3 を「日付」ラベル行優先へ改訂し、T-A7 で拘束。
- F4 (P3) accept: ヘッダ走査上限 20 の off-by-one が mutation 拘束されていない → Matrix の boundary case と mutation 設問を追加。
- Coordinator 自己検出 (P2 相当): 初稿 SPEC-Z4A-D2 の「ヘッダ未検出 → `NoDataLines` 系」は凍結 negative test `test_parse_z004_req401_no_settlement_date`（`NoSettlementDate` variant を assert）と衝突 → `NoSettlementDate` variant 互換へ是正。

### Plan Gate round 2（fresh 独立 Sonnet Plan Reviewer、対象 = 571dc4b）

P1 = 0 / P2 = 2 / P3 = 1。round 1 是正 5 件中 4 件適正・F4 不十分の判定。F3 は凍結 fixture 全数の机上トレースで健全確認。全新規 findings accept、in-place 是正。

- N1 (P2) accept: `NoSettlementDate` の旧文言「1行目から…」が二形状対応後は事実誤認 → 原因別 2 文言（ヘッダ未検出 / 精算日未検出）を SPEC-Z4A-D2/D3 に exact 確定。凍結 tests は variant のみ assert を rg 実測で確認済み。
- N2 (P2) accept: ラベル照合の mutation 設問が既存 fixture では拘束されない（5 フィールド非ヘッダ行が fixture 群に不存在）→ T-A7 fixture に decoy（5 フィールド・ラベル位置不一致の非ヘッダ行）を追加し、照合除去で確実に red になる構成へ。
- N3 (P3) accept（強い形を採用）: 「is_header_fields と同型」の精度過大 → 位置アンカー付き照合（第 2 フィールド『コード』+ 第 5 フィールド『金額』）へ設計自体を強化し、記述と実体を一致させた。

### Plan Gate round 3（fresh 独立 Sonnet Plan Reviewer、対象 = ce6869d、収束確認）

P1 = 0 / P2 = 0 / P3 = 1（記録のみ）。round 2 是正 3 件（N1/N2/N3）は source 実測（凍結 test の assert 実読 / 両ヘッダのフィールド位置逐次照合 / 移植元 `is_header_fields` 実読）で全件適正判定。sweep 漏れなし。**Plan Gate 収束（round 3/3、これ以上の round 不要）**。

- P3-1（記録のみ、disposition = 発注書へ反映）: T-A7 が 3 つの mutation 標的（誤ルーティング排除 / 日付ラベル優先 / decoy ヘッダ誤認排除)を 1 test に束ねており fail 時の切り分けがやや弱い → Writer 発注書に「T-A7 内の assert に契約 ID コメントを付し、切り分け可能な assert 順で書く」を含める。新規 test 分割はコスト対効果で不採用。

### gated Amendment 1（2026-08-17、Writer fail-closed true positive）

Codex Writer が実装時に凍結 BIZ test `test_parse_and_validate_req401_invalid_settlement_date`（`src-tauri/src/biz/csv_import_service/tests/parse_tests.rs`）との衝突を検出し fail-closed 停止（発注どおりの正動作）。Coordinator が実読で再現確認 — 当該 fixture の 2 行目は `"No.","コード","名","個","額"` で、SPEC-Z4A-D2 の第 5 フィールド『金額』照合を通らず、初稿 D1 の「2 行目 = D2 ヘッダ検査」条件では従来 shape 判定に失敗して `NoSettlementDate` 停止 → BIZ の「不正な日付」検証に到達しない。

- 全数 sweep（Coordinator 実測）: `精算日` fixture の出現は 5 file。共有 builder `test_support.rs`（ヘッダ「スキャニングコード/金額」）と `csv_import_cmd.rs` fixture は位置アンカー照合を pass、衝突は当該 1 fixture のみ。BIZ の no-date negative fixture（`"no date here"...` 5 フィールド × 2 行）は layout A 走査 → ヘッダ未検出 → `NoSettlementDate` で従来どおり green（机上トレース）。
- 裁定: SPEC-Z4A-D1 の従来 shape 判定 2 行目条件を「D2 ヘッダ検査」→「5 フィールド検査のみ（ラベル照合なし）」へ変更。F3 の誤ルーティング防御は field 数条件で保持（実 layout A のメタ行は 2 列）。layout A 走査側の D2 位置アンカー照合・decoy mutation 拘束（round 2 N2）は不変。
- 棄却代替案: (a) 凍結 test の fixture 修正 = 既存 test 凍結原則に違反。(b) D2 ラベル照合の「額」への緩和 = layout A 側の検出強度を道連れに弱めるため不採用。
- 付記: BIZ-03 `parse.rs` は `Z004ParseError` を variant 単位で自前文言に写像するため、SPEC-Z4A-D2/D3 の原因別 2 文言は BIZ 経由の operator 表示には現れない（parser 層 Display / 診断用の正確性改善に留まる）。round 2 N1 の「operator に事実誤認メッセージが出る恐れ」は BIZ 経路では実害なしと実読確認。BIZ 文言の原因別化は BIZ-03 契約変更となるため Non-scope 維持。
