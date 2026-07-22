# Test Design Matrix — 順 3 実装 follow-up: 整合性補正 D-051 意味論のコード追随

対応 Plan Packet: [../2026-07-22-integrity-fix-semantics-impl.md](../2026-07-22-integrity-fix-semantics-impl.md)

## Risk

R3（TX 境界変更 + operator 可視 UI 2 画面。migration / 破壊的 IO なし）

## Contracts Under Test

- BIZ-07-D3: `integrity_fix` 操作ログは同一 TX 内必須、失敗時は補正ごと rollback（36-biz §21.4 ステップ 4）
- BIZ-07-D2: 補正は `inventory_movements` に行を追加しない（D-051 rejected ①②）
- BIZ-07-D4: 補正成功直後の再チェックで補正対象が mismatches に非出現（36-biz §21.6）
- BIZ-07-D1: movements = 原本 / stock_quantity = 派生 cache（SQL 等式で直接検査）
- INV-3: 負の movements_sum でも負在庫へ補正（既存 regression test 維持必須）
- INV-4: 合計は `WHERE is_voided = 0`、movement 0 件は `COALESCE(SUM, 0)` = 0 補正
- INV-8: products 物理 DELETE 禁止・既存 movement 行の非破壊
- §21.4 skipped 契約: 不存在商品 / difference 0 → skipped_count++
- UI-13-D9: 確定 flow の**全可視・accessible copy** の契約一致（75-ui、§75.6 語彙含む）
- UI-11c-D14: adjustments の operator-readable 一覧 + 技術情報（JSON） raw 保持（74-ui）
- UI-11c-D6 / §74.8: 既知 key 要約・parse / 文字数上限 / text-only の共通防御を specialized 一覧が迂回しない（74-ui）
- REQ-904 CMD validation: 空 codes → `CmdError { kind: "validation" }`（実コマンド呼び出しで検証）

## Failure Modes

- FM1: ログ INSERT が commit 後に実行され、失敗しても補正が確定する（現行バグ = 是正対象）
- FM2: ログ失敗時に一部商品の補正だけ確定する（部分 commit）
- FM3: 補正で movement 行（quantity=0 marker 含む）が挿入され、再チェックが収束しない
- FM4: detail_json の adjustments フィールド欠落・値誤り（監査痕跡の毀損）
- FM5: UI-13 確定 flow に「棚卸し」語彙・旧文言が残存（operator の概念汚染）
- FM6: UI-11c の分岐追加が他 operation type の表示を壊す
- FM7: adjustments 欠落 / 空 / 型不一致 / hostile 値 / 非 safe-integer の古いログで UI-11c がクラッシュまたは誤値描画
- FM8: oracle テストが実装ロジックの複製（tautology）で mutation 感度なし
- FM9: specialized 一覧が §74.8 共通防御を早期 return で迂回し、巨大 payload で無制限 DOM を生成

## Test Matrix

| ID | 対象 | 契約 | 手順 / oracle | 種別 |
|---|---|---|---|---|
| T1 | `fix_integrity` 失敗系 | BIZ-07-D3 | テスト DB に `BEFORE INSERT ON operation_logs` の RAISE(ABORT) trigger を張り `fix_integrity` 実行 → `BizError::DatabaseError` / 全対象商品 stock_quantity 不変 / inventory_movements 行数増 0 を assert（FM1/FM2） | Rust 統合 |
| T2 | `fix_integrity` 成功系 | BIZ-07-D3 / INV-4 / §21.4 skipped | 差異商品複数（adjustment 正負両方向、うち 1 商品は is_voided=1 movement 持ち = 合計から除外、1 商品は movement 0 件 = COALESCE 0 へ補正、1 商品は difference 0 = skipped）で実行 → operation_logs 1 行、detail_json.adjustments[] の product_code / old_stock / new_stock / adjustment を**具体値**で assert + `IntegrityFixResult.skipped_count` 検証（FM4） | Rust 統合 |
| T3 | `fix_integrity` 成功系 | BIZ-07-D2 / INV-8 | 補正前後で inventory_movements **総行数**・**対象商品ごとの行数**に加え、**既存 movement 行の主要値（id / quantity / is_voided）snapshot** と product 行の存続が不変を assert（FM3、quantity=0 marker mutant と既存行改変 mutant を red にする） | Rust 統合 |
| T4 | 収束系 | BIZ-07-D4 | 補正成功直後（介在 write なし）に `run_integrity_check` → mismatches に adjustments[].product_code 非出現 | Rust 統合 |
| T5 | 収束系補助 | BIZ-07-D4 / BIZ-07-D1 / INV-4 | 同一 committed state で SQL 等式 `stock_quantity = COALESCE(SUM(quantity), 0)`（`WHERE is_voided = 0`）を対象商品ごとに直接検査。movement 0 件商品でも成立を含める | Rust 統合 |
| T6 | `integrity_cmd::fix_integrity` | REQ-904 | `tauri::test::mock_builder().manage(...)` + `app.state::<AppState>()`（stocktake_cmd.rs precedent 踏襲）で**実コマンド関数**（同期）を空 codes で呼び `CmdError.kind == "validation"` を assert（現行のロジック複製 assert を置換） | Rust CMD |
| T7 | IntegrityCheckPage | UI-13-D9 | 確定ボタン label が「補正を確定」（旧「棚卸し補正として確定」の非存在も assert） | RTL |
| T8 | IntegrityCheckPage | UI-13-D9 | dialog 内に scope した**可視要素**（`toBeVisible()`）で AlertDialogTitle「在庫数を入出庫の合計に合わせて補正します」+ 可視 AlertTitle「補正すると元に戻せません」+ 可視 AlertDescription「選択した商品のシステム在庫を入出庫の合計に合わせて更新し、操作ログに記録します。」を assert（Title + Description の結合 = 契約説明文全文）。sr-only AlertDialogDescription は契約説明文**全文**との完全一致を別 assert（sr-only のみでの充足を不可にする。FM5） | RTL |
| T9 | OperationLogsPage | UI-11c-D14 | `integrity_fix` ログ（adjustments 2 件、正負両方向）の詳細を開き、**専用一覧 container 内に scope** して各行の商品コード / 旧在庫 → 新在庫 / 差分の**対応関係**を assert（screen-wide text assert 禁止 — 閉じた details 内 raw JSON による偶然 green を防ぐ）。あわせて①汎用 dt/dd 列挙に adjustments の raw 配列（`JSON.stringify` 行）が**重複表示されない**否定 assert、②hostile だが型正当な product_code（HTML 断片等）が一覧内に plain text として安全描画される assert を含む | RTL |
| T10 | OperationLogsPage | UI-11c-D14 | 同ログで折りたたみ「技術情報（JSON）」内に raw JSON が保持されている | RTL |
| T11 | OperationLogsPage | UI-11c-D6 | 非 `integrity_fix` ログ（例: csv_import / manual_sale）の詳細表示が現行と不変（FM6） | RTL |
| T12 | OperationLogsPage | UI-11c-D14 | **構造的欠陥**のみ degrade 対象: adjustments 欠落 / 空配列 / 非配列型 / 要素 field 欠落・null・型不一致 / valid・invalid 混在 / `Number.isSafeInteger` 不成立 — いずれもクラッシュせず specialized 一覧を生成せず既存の汎用表示へ degrade（FM7）。hostile だが**型正当**な文字列は degrade せず T9 ②で安全描画を検証（Boundary Contract と整合、rally round 2 指摘の反映） | RTL |
| T13 | OperationLogsPage | UI-11c-D6 / §74.8 | adjustments 21 件以上の fixture で specialized 一覧が**先頭 20 件のみ**描画され、「他 N 件は技術情報（JSON）で確認」の残数行が表示される（§74.8 の 20 key 方式踏襲、packet Scope 4 で確定した境界。無制限 DOM の禁止 = FM9） | RTL |

## State Lifecycle Matrix

| 状態 | 遷移 | 検証 |
|---|---|---|
| 差異あり → 補正成功 | stock = movements_sum、ログ 1 行 | T2 / T4 / T5 |
| 差異あり → ログ失敗 | 全量 rollback、stock 不変、ログ 0 行 | T1 |
| 補正成功 → 再チェック | mismatches 非出現 | T4 |
| 補正成功 → 操作ログ画面 | adjustments 一覧表示 | T9 / human visual confirmation（synthetic fixture） |

## Adjacent Pattern Audit

- BIZ の TX 内 operation log 既存パターン: BIZ-01 商品更新系 3 箇所 + BIZ-02 業務記録 4 系（D-051 Audit 節の現状整理）。`fix_integrity` の実装はこれらの `&tx` 渡しパターンに揃える（独自方式を発明しない）。
- UI-11c 詳細表示の既存パターン: `Detail` component の dt/dd 列挙 + `KNOWN_KEYS` 要約。adjustments 分岐は同 component 内の拡張として実装し、別 component 乱立を避ける。
- 文言 assert の既存パターン: IntegrityCheckPage.test.tsx の既存 4 箇所（すべて旧ボタン名参照）の assert 形式を踏襲しつつ、T8 は可視要素 + dialog 内 scope を追加要求する。
- UI-11c specialized 一覧は §74.8 の共通防御（parse / 文字数上限 / text-only / 折りたたみ）を**通過した後**の拡張として実装する。早期 return による迂回は FM9 = レビュー blocker。
- 既存 `test_fix_integrity_req904_negative_movements_sum`（INV-3 の負在庫補正 regression）は**維持必須**。削除・skip・弱体化は不可。

## Negative Paths

- T1（ログ INSERT 失敗）/ T6（空 codes）/ T12（malformed detail_json）/ T13（巨大 payload）

## Boundary Checks

- adjustment が負値・正値の両方を T2 に含める（過剰在庫 / 不足在庫の両方向補正）
- 対象 1 商品のみ / 複数商品の両方（T2 は複数、T1 は複数で部分 commit を検出）
- movement 0 件商品の COALESCE 0 補正（T2/T5、INV-4）と負の movements_sum（既存 regression test 維持）
- i64 → JS number の safe-integer 境界: 表示側は `Number.isSafeInteger` 不成立で degrade（T12）
- specialized 一覧の件数境界: 20 件ちょうど（残数行なし）/ 21 件（先頭 20 + 残数行）の両側を T13 で検査

## Compatibility Checks

- 過去（TX 外時代）に書かれた `integrity_fix` ログも同 shape のため新表示で読める（T9 は DB 挿入 fixture で時代非依存に検証）
- 非 `integrity_fix` operation type の表示不変（T11）

## Data Safety Checks

- テストは in-memory / 一時 DB + synthetic 商品コードのみ。実店舗データ・実スクリーンショットの commit なし。

## Main Wiring / Integration Checks

- cmd 登録・bindings・route に変更なし → bindings / routes は差分ゼロ確認。90-traceability は REQ-904 のテスト件数変化で**必ず**生成差分が出るため、canonical generator（`cargo run --bin generate_traceability`）で再生成し REQ-904 行の差分のみ許容。

## Mutation-style Adequacy Questions

| Mutant | 期待 red |
|---|---|
| X1: ログ INSERT を commit 後（TX 外）へ戻す | T1 |
| X2: 補正時に quantity=0 の marker movement を挿入 | T3 |
| X3: ログ失敗時に rollback せず warn + commit 続行 | T1（stock 不変 assert） |
| X4: UI-13 文言を旧文言（棚卸し系）へ戻す | T7 / T8 |
| X5: UI-11c の専用一覧 container を削除（生 JSON のみへ退行） | T9（container scope assert が red になる — screen-wide text では検出不能） |

Writer 完了条件 = X1/X2/X4 の実 mutation red 実測。X3/X5 は independent-review（2 pass）で実測。

## Residual Test Gaps

- ログ INSERT 以外の TX 内失敗（stock UPDATE 自体の失敗）は rusqlite の標準エラー経路で、既存の TX rollback に委ねる（専用注入テストなし。理由: §21.7 の指定 oracle は ログ失敗系のみで、UPDATE 失敗は SQLite 層の一般保証）。
- 同時実行（single-instance ガード前提、PR #16 で導入済み）による補正競合はテスト対象外。
- Windows native L3 は実施しない（75-ui §75.12 の規定どおり、差異注入は fault injection 要のため自動テスト + synthetic fixture の human visual confirmation で代替）。
