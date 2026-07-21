# Test Design Matrix — 整合性補正の不変条件の正本確定（監査是正 順 3、design phase）

## Risk

Risk: R3

## Contracts Under Test

- BIZ-07-D1: `inventory_movements` = 原本、`products.stock_quantity` = 派生 cache（D-051）
- BIZ-07-D2: 補正は direct update のみ、movement 行追加禁止
- BIZ-07-D3: 補正の操作ログは同一 TX 内・必須記録（D-6 の明示例外）
- BIZ-07-D4: 収束性不変条件（補正直後の再チェックで対象商品 difference = 0）
- BIZ-07-D5: 「仮想棚卸し」（reference_id=0）概念の退役
- 75-ui / 74-ui の operator 向け表現が実挙動と一致
- D-051 durable adjudication の固定 5 小見出しと内容存在（retention 365 日 / 却下案 3 / revisit 2 条件 / D-6 例外整理）
- 監査 P7-1 の害経路（証拠 8 箇所）の全塞ぎ

## Failure Modes

- §21.4 と §21.6 の内部矛盾が形を変えて残る（片方だけ改訂）
- movement 挿入を示唆する記述が biz-task-specs / 75-ui に残存し、実装者が再び逸脱コメントを書く
- D-6 例外の理由が書かれず、将来の実装者が best-effort へ「統一」して監査痕跡を失う
- 収束性が検証不能な散文で書かれ、実装 follow-up のテストが書けない
- 文言改訂が UI-13-D8 / Amendment 5 の operator 語彙を壊す

## Test Matrix

- Before citing an existing test as regression coverage, use `rg` or an equivalent repository search to verify that the cited test exists.
- 本 PR は docs-only のため、Test Type の中心は schema（doc check）/ regression（grep anchor）/ review（独立レビュー突合）。既存自動テストの引用はなし（D-050 D10 の実在確認は該当なし）。

| # | Contract | Failure Mode | Test Type | Test Name / Command | Would fail if... |
|---|---|---|---|---|---|
| 1 | packet / docs 整合 | checker 違反・リンク切れ | schema | `bash scripts/doc-consistency-check.sh --target plan` + full | ERROR > 0、または WARN が既存 1 件（75-ui paging 上限）から増加 |
| 2 | BIZ-07-D1 / D2（単一意味論） | §21.4 と §21.6 の矛盾残存 | review + mutation 感度 | 独立レビューによる §21.4 / §21.6 / biz-task-specs 突合。感度確認: §21.4 に旧 3e（`insert_movement` 行）を仮再注入した状態を red と判定できること | 改訂後も movement 挿入と direct update が別節で並存しても指摘されない |
| 3 | BIZ-07-D2 / D5 / operator 文書同期（旧記述の残存ゼロ） | 旧語彙・旧手順の残存 | regression (grep) | `rg "insert_movement" docs/function-design/36-biz-integrity-check.md` = 0 件 / `rg "棚卸し補正として" docs/function-design/75-ui-integrity-check.md docs/architecture/ui-task-specs.md docs/ARCHITECTURE.md docs/DB_DESIGN.md` = 0 件（DB_DESIGN は round 4 P2、command への反映は Codex round 5 P2-1）/ `rg "BIZ-06の確定処理と同じ方式" docs/architecture/biz-task-specs.md` = 0 件 / `rg "補正レコードを追加" docs/DB_DESIGN.md docs/function-design/36-biz-integrity-check.md` = 0 件 / `rg "補正行追加" docs/architecture/ui-task-specs.md` = 0 件（step 7、round 3 P1）/ `rg "stocktakeレコードを追加|補正有無" docs/architecture/biz-task-specs.md` = 0 件（ステップ 5/6、round 3 P1/P2）/ `rg "棚卸し補正と同じ方式" docs/function-design/36-biz-integrity-check.md` = 0 件（関数要求文、round 4 P1）/ `rg "仮想棚卸し" docs/function-design/36-biz-integrity-check.md` の残存が退役説明文脈のみ | 旧意味論の記述が 1 箇所でも実行仕様として残る |
| 4 | 非変更保証（D-6 一般原則 / run_integrity_check / UI-13 flow） | 例外化が一般原則へ波及 | review | 独立レビュー: §21.3・`integrity_check` ログ（best-effort のまま）・75-ui state machine / 選択 flow・74-ui の他 entry に変更がないことの diff 突合 | scope 外の契約が改訂 diff に混入している |
| 5 | BIZ-07-D1 / D4（収束性不変条件） | 検証不能な散文化 | regression (anchor) + review | §21.6 に原本/cache 行と「fix_integrity 成功直後の run_integrity_check は対象商品で difference = 0」相当の検証可能な文が存在（anchor grep は実文言確定後に PR body へ記録） | 不変条件行が欠落、または実装テストに翻訳できない表現 |
| 6 | BIZ-07-D3（同一 TX 必須ログ + D-6 例外） | 例外理由の欠落 / 継承断言の残存矛盾 | regression (anchor) + review | §21.4 ステップ 4（2 pass P2-1 で番号同期）が「TX内」「必須」「rollback」を含み、D-6 例外の理由（唯一の監査痕跡）が明記されている。構造 anchor: `rg -c "例外: BIZ-07 の fix_integrity" docs/function-design/35-biz-stocktake-service.md` = 1 / `rg -c "2ログ分離" docs/architecture/biz-task-specs.md` = 1 | best-effort のまま、例外理由なしの黙変更、35-biz 例外注記の削除、または biz-task-specs 2 ログ分離の差し戻し |
| 7 | P7-1 害経路の全塞ぎ + 65 追跡経路 | 証拠箇所の塞ぎ漏れ / 65 追跡行の削除 | review + regression (anchor) | P7-1 の証拠 8 箇所（integrity_service.rs 4 + 36-biz 4）それぞれ → 改訂後の塞ぐ節 or 実装 follow-up 項目への対応表を PR body に作成し、独立レビューが突合。構造 anchor: `rg -c "integrity_fix" docs/function-design/65-inventory-record-traceability.md` = 1（2 pass P2-3 survivor 是正） | 対応表に空欄がある、「実装 follow-up」への先送りが Plans.md に記録されていない、または 65 の補正追跡行が削除されても green |
| 8 | 75-ui 文言の operator 品質 | UI-13-D8 / Amendment 5 違反 | review | 新文言が「システム在庫」「入出庫の合計」「操作ログ」の既習語彙で構成され、色非依存・断定的過信文言なしを独立レビューが確認 | 「棚卸し」語彙の再導入、または movement 記録を示唆する文言 |
| 9 | 74-ui integrity_fix 詳細表示同期（UI-11c-D14） | 唯一の監査痕跡である旨の欠落 / operator-readable 表示の劣化 | regression (anchor) + review | 74-ui に integrity_fix の detail_json（old/new）が補正の唯一の監査痕跡である旨の追記が存在。構造 anchor: `rg -c "旧在庫 → 新在庫" docs/function-design/74-ui-operation-logs.md` = 1（D14 の operator-readable 表示形 — 2 pass P2-3 survivor 是正。raw JSON のみへの差し戻しで 0 になり red） | 追記漏れ、registry 表の既存 entry 破壊、または D14 の表示 decision を raw JSON のみへ劣化させても green |
| 10 | 実装現状との接続 | follow-up 作業の不明確化 | review | 実装 follow-up PR の作業列挙（ログ TX 内移動・必須化・逸脱コメント解消・**`IntegrityCheckPage.tsx` + `IntegrityCheckPage.test.tsx` の文言同期（round 1 P1）**・**`OperationLogsPage.tsx` + test の integrity_fix operator-readable 表示（Codex round 5 P2）**・テスト追随・`integrity_cmd.rs` tautological test の吸収検討）が packet Non-scope / Plans.md に存在 | 設計だけ確定し実装差分の追跡先がない（例: 75-ui 文言表だけ改訂され実 UI が乖離したまま追跡されない） |
| 11 | 旧語彙の全数照合（round 4 P3 — anchor 選定漏れの構造的対策、round 5 で多 pattern 化、round 6 P2 で 2 command 分離） | 個別 anchor の網から漏れる literal 残存 | regression (全数照合) + review | ①語彙系 `rg -n "棚卸し補正|補正レコード|補正行追加|stocktakeレコードを追加|補正有無" docs/ --glob '!docs/archive/**' --glob '!docs/research/**' --glob '!docs/plans/**'` + ②`rg -n "insert_movement"` を整合性補正文脈 5 ファイル（36-biz / 75-ui / biz-task-specs / ui-task-specs / DB_DESIGN）限定で実行し、全ヒット行を「Scope 改訂対象」or「正当文脈の明示除外」へ 1:1 分類した対応表を PR body に掲載、独立レビューが分類の正しさを突合（insert_movement を docs 全域にしない理由 = 20-io / 30-biz / 31-biz / 10-common 等の正当な repository API 記述の大量ヒット） | 分類不能な行（= Scope にも除外理由にもない旧語彙）が存在するのに green 扱いになる |
| 12 | BIZ-07-D2 / D3 / D4 の実装 follow-up テスト契約（round 5 P2 起源、2 pass P1-2 / P2-2 で oracle を是正） | ログ失敗時に補正だけ確定する / 監査痕跡の形骸化 / 成功時の marker 行混入 | 実装 follow-up の test contract（本 PR では設計固定のみ） | 失敗系: `integrity_fix` ログ INSERT を注入失敗させ（SQLite trigger 等）、`BizError::DatabaseError` 返却 + 全対象商品の stock_quantity 不変 + inventory_movements 行数増 0 を assert。成功系: detail_json.adjustments[] の product_code / old_stock / new_stock / adjustment を具体値検証 + **補正前後で inventory_movements の総行数・各対象商品行数が不変**（D-051 rejected ② marker 行の検出）。収束系: 補正成功直後（介在 write なし）に run_integrity_check を実行し adjustments[].product_code が result.mismatches に非出現 + SQL 等式の補助 oracle。構造 anchor: `rg -c "注入失敗" docs/function-design/36-biz-integrity-check.md` = 1 / `rg -c "行数が不変" docs/function-design/36-biz-integrity-check.md` = 1 / `rg -c "mismatches に存在しない" docs/function-design/36-biz-integrity-check.md` = 1 | 実装 PR がログ失敗系を tautological に検証、detail_json の中身を検証せず green、成功時に quantity=0 marker movement を追加しても green、または §21.7 の oracle 行を削除しても green |
| 13 | D-051 durable adjudication の内容存在（Codex round 7 P1、2 pass P1-1/P2-3 で anchor 化 + BIZ-02 是正） | 見出しだけ存在し内容が欠落・別見出しへ迷子 / 却下案の削除 | regression (anchor) + review | `docs/decision-log.md` D-051 が固定 5 小見出し（invariant / audit / retention / rejected / revisit）を持ち、**対応する小見出し内に**: retention = 365 日自動削除の事実 / rejected = 却下案 3 件（movement 挿入・marker 行・stock 原本化）/ revisit = 固定 2 条件 / audit = TX 境界現状整理（**TX 内必須群 = BIZ-01 商品更新系 + BIZ-02 業務記録 4 系**、integrity_fix は追加例外）が記載されていることを独立レビューが確認。構造 anchor: `rg -c "数学的に収束せず" docs/decision-log.md` = 1 / `rg -c "marker movement" docs/decision-log.md` = 2（rejected ② + revisit）/ `rg -c "既存原則の破壊" docs/decision-log.md` = 1 | 見出しが揃っていても内容が欠落・誤配置のまま green、または rejected の 1 案を削除しても green |
| 14 | review-checklist の操作ログ TX 境界記述（2 pass P1-1） | 旧「全TX外方針」断言の残存 / 例外列挙の欠落 | regression (anchor) + review | `rg -c "全TX外方針" docs/quality/review-checklist.md` = 0 / `rg -c "TX内必須" docs/quality/review-checklist.md` = 1（既定 best-effort + source-design 明記例外の構造が §3 に存在） | 旧断言が残り follow-up 実装（fix_integrity の TX 内ログ）がレビューで誤って拒否される |

## State Lifecycle Matrix

not applicable — docs-only design PR で runtime state / UI state / cache / route state に接触しない（実装 follow-up PR 側で fix_integrity の TX/rollback/retry を実テスト化する。その設計入力は 36-biz エラーハンドリング節と BIZ-07-D3/D4）。Workflow State **契約自体**は不変であり、本 packet の Phase 遷移（plan-draft → plan-gate 等）は通常運用上の管理遷移のため product State Lifecycle Matrix の対象外（Codex round 6 P3 で表現を実態へ同期）。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| 操作ログ記録の位置と強度（旧・第4段階先決事項D-6 best-effort） | 36-biz §21.3（integrity_check）/ §21.4（integrity_fix）/ BIZ-06 stocktake 系（TX 外 best-effort、`stocktake_service.rs` に明示コメント）/ 34-biz 日報系・CSV 取込み系（`daily_report_import_service/commit.rs` / `csv_import_service/commit.rs` = TX 外 best-effort）/ 71-mnt backup 系 / **BIZ-01 `product_service.rs`（`insert_operation_log(&tx, ...)?` 3 箇所 = TX 内必須）**/ **BIZ-02 `inventory_service/`（receiving / returns / manual_sale / disposal の 4 系 = TX 内・`?` 伝搬、31-biz 設計ステップ「7. ログ → 8. COMMIT」どおり — 2 pass P1-1 で列挙漏れを是正）**/ **`docs/quality/review-checklist.md` §3（旧「全TX外方針」断言 = 実態と乖離、2 pass P1-1 で是正対象化）** | integrity_fix のみ「同一 TX 必須」へ変更（TX 内 precedent は BIZ-01 + BIZ-02 群）+ 35-biz 例外注記 + review-checklist §3 の TX 境界記述是正 | 他の全箇所は現状維持 — BIZ-01/BIZ-02 の既存 TX 内必須は D-051 audit で現状整理として文書化のみ（挙動変更なし）、BIZ-03/04/05/06 と integrity_check の TX 外 best-effort・BIZ-06 自身の方針も不変 | Matrix #4（非変更確認）+ #6（例外理由明記 + 継承断言の注記）+ #14（review-checklist） |
| 「棚卸し補正」語彙 | 2026-07-21 起票後 sweep（`rg "棚卸し補正" docs/` archive/research 除外）+ round 4 全行読みで全数列挙: **36-biz §21.4 関数要求文（round 4 P1 — 当初 sweep が自ファイルを見ていなかった）**/ **biz-task-specs BIZ-07 ステップ 5/6（round 7 P2 で列挙漏れを是正）**/ 75-ui 文言表 / ui-task-specs UI-13 節（step 5/6/7 含む）/ ARCHITECTURE UI-13 行 / DB_DESIGN §整合性チェック復旧方針（確認文言引用含む）・pos_stock_sync=0 記述 / **DB_DESIGN §業務記録追跡方針（:81 付近、REQ-205/BIZ-06 の真正な棚卸し補正を一般列挙する行のため不変 — Codex round 5 P2-2 で列挙漏れを是正）**/ 35-biz（BIZ-06）/ tracking-system-tables movement_type 表 / 65-inventory-record-traceability 追跡対象列挙 / PROJECT_HANDOFF REQ-205 行。以後の網羅性は Matrix #11 の全数照合を最終ゲートとする | 36-biz / biz-task-specs / 75-ui / ui-task-specs / ARCHITECTURE / DB_DESIGN 復旧方針の 6 系統を改訂 | 35-biz・tracking-system-tables・65・PROJECT_HANDOFF・DB_DESIGN pos_stock_sync=0 記述は実棚卸し（BIZ-06、movement を作る正当な操作）文脈のため不変（pos_stock_sync=0 記述は design 中に文脈再確認 — packet Review Focus） | Matrix #3 / #8 |

## Negative Paths

- missing input: D-051 の rejected 内容が欠落・誤配置 → Matrix #13 review で red（round 8 P3 で参照先を是正）
- invalid input: 収束しない旧手順の部分残存 → Matrix #2 / #3
- duplicate/ambiguous input: 同一契約が §21.4 と §21.6 で異なる表現 → Matrix #2（単一意味論）
- unknown reference: 撤回した「先決事項 D-3」への dangling 参照 → doc-consistency + Matrix #3
- dependency missing: 実装 follow-up の追跡先欠落 → Matrix #10
- permission/write failure: 該当なし（docs-only）
- dry-run side effect: 該当なし（docs-only）

## Boundary Checks

- threshold: 該当なし（数値閾値の変更なし。既存 synthetic 例の数値は意味論説明のみ）
- null/default: movements 0 件商品（movements_sum = 0）の扱いは §21.3 既存契約のまま非変更 → Matrix #4
- empty/non-empty: 補正対象 0 件（ValidationFailed）の既存契約は非変更 → Matrix #4
