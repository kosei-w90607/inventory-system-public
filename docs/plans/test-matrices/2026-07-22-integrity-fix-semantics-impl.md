# Test Design Matrix — 順 3 実装 follow-up: 整合性補正 D-051 意味論のコード追随

対応 Plan Packet: [../2026-07-22-integrity-fix-semantics-impl.md](../2026-07-22-integrity-fix-semantics-impl.md)

## Risk

R3（TX 境界変更 + operator 可視 UI 2 画面。migration / 破壊的 IO なし）

## Contracts Under Test

- BIZ-07-D3: `integrity_fix` 操作ログは同一 TX 内必須、失敗時は補正ごと rollback（36-biz §21.4 ステップ 4）
- BIZ-07-D2: 補正は `inventory_movements` に行を追加しない（D-051 rejected ①②）
- BIZ-07-D4: 補正成功直後の再チェックで補正対象が mismatches に非出現（36-biz §21.6）
- UI-13-D9: 確定 flow 3 文言の契約一致（75-ui）
- UI-11c-D14: adjustments の operator-readable 一覧 + 技術情報 raw JSON（74-ui）
- UI-11c-D6: 既知 key 要約表示の現行維持（74-ui）
- REQ-904 CMD validation: 空 codes → `CmdError { kind: "validation" }`（Scope 6、probe P2 成立条件付き）

## Failure Modes

- FM1: ログ INSERT が commit 後に実行され、失敗しても補正が確定する（現行バグ = 是正対象）
- FM2: ログ失敗時に一部商品の補正だけ確定する（部分 commit）
- FM3: 補正で movement 行（quantity=0 marker 含む）が挿入され、再チェックが収束しない
- FM4: detail_json の adjustments フィールド欠落・値誤り（監査痕跡の毀損）
- FM5: UI-13 確定 flow に「棚卸し」語彙・旧文言が残存（operator の概念汚染）
- FM6: UI-11c の分岐追加が他 operation type の表示を壊す
- FM7: adjustments 欠落 / 空 / 型不一致の古いログで UI-11c がクラッシュ
- FM8: oracle テストが実装ロジックの複製（tautology）で mutation 感度なし

## Test Matrix

| ID | 対象 | 契約 | 手順 / oracle | 種別 |
|---|---|---|---|---|
| T1 | `fix_integrity` 失敗系 | BIZ-07-D3 | テスト DB に `BEFORE INSERT ON operation_logs` の RAISE(ABORT) trigger を張り `fix_integrity` 実行 → `BizError::DatabaseError` / 全対象商品 stock_quantity 不変 / inventory_movements 行数増 0 を assert（FM1/FM2） | Rust 統合 |
| T2 | `fix_integrity` 成功系 | BIZ-07-D3 | 差異 2 商品以上で実行 → operation_logs 1 行、detail_json.adjustments[] の product_code / old_stock / new_stock / adjustment を**具体値**で assert（FM4） | Rust 統合 |
| T3 | `fix_integrity` 成功系 | BIZ-07-D2 | 補正前後で inventory_movements **総行数**と**対象商品ごとの行数**が不変を assert（FM3、quantity=0 marker mutant を red にする） | Rust 統合 |
| T4 | 収束系 | BIZ-07-D4 | 補正成功直後（介在 write なし）に `run_integrity_check` → mismatches に adjustments[].product_code 非出現 | Rust 統合 |
| T5 | 収束系補助 | BIZ-07-D4 | 同一 committed state で SQL 等式 `stock_quantity = SUM(quantity WHERE is_voided = 0)` を対象商品ごとに直接検査 | Rust 統合 |
| T6 | `integrity_cmd::fix_integrity` | REQ-904 | tauri::test mock State で**実コマンド関数**を空 codes で呼び `CmdError.kind == "validation"` を assert（probe P2 成立条件付き。現行のロジック複製 assert を置換） | Rust CMD |
| T7 | IntegrityCheckPage | UI-13-D9 | 確定ボタン label が「補正を確定」（旧「棚卸し補正として確定」の非存在も assert） | RTL |
| T8 | IntegrityCheckPage | UI-13-D9 | dialog title「在庫数を入出庫の合計に合わせて補正します」+ 説明文の契約文字列**完全一致** assert（FM5） | RTL |
| T9 | OperationLogsPage | UI-11c-D14 | `integrity_fix` ログ（adjustments 2 件）の詳細を開き「商品コード / 旧在庫 → 新在庫 / 差分」の一覧が具体値で表示される | RTL |
| T10 | OperationLogsPage | UI-11c-D14 | 同ログで折りたたみ「技術情報」内に raw JSON が保持されている | RTL |
| T11 | OperationLogsPage | UI-11c-D6 | 非 `integrity_fix` ログ（例: csv_import / manual_sale）の詳細表示が現行と不変（FM6） | RTL |
| T12 | OperationLogsPage | UI-11c-D14 | adjustments 欠落 / 空配列 / 非配列型の `integrity_fix` ログでもクラッシュせず既存の汎用表示へ degrade（FM7） | RTL |

## State Lifecycle Matrix

| 状態 | 遷移 | 検証 |
|---|---|---|
| 差異あり → 補正成功 | stock = movements_sum、ログ 1 行 | T2 / T4 / T5 |
| 差異あり → ログ失敗 | 全量 rollback、stock 不変、ログ 0 行 | T1 |
| 補正成功 → 再チェック | mismatches 非出現 | T4 |
| 補正成功 → 操作ログ画面 | adjustments 一覧表示 | T9 / L3-2 |

## Adjacent Pattern Audit

- BIZ の TX 内 operation log 既存パターン: BIZ-01 商品更新系 3 箇所 + BIZ-02 業務記録 4 系（D-051 Audit 節の現状整理）。`fix_integrity` の実装はこれらの `&tx` 渡しパターンに揃える（独自方式を発明しない）。
- UI-11c 詳細表示の既存パターン: `Detail` component の dt/dd 列挙 + `KNOWN_KEYS` 要約。adjustments 分岐は同 component 内の拡張として実装し、別 component 乱立を避ける。
- 文言 assert の既存パターン: IntegrityCheckPage.test.tsx の既存 4 箇所の assert 形式を踏襲して置換する。

## Negative Paths

- T1（ログ INSERT 失敗）/ T6（空 codes）/ T12（malformed detail_json）

## Boundary Checks

- adjustment が負値・正値の両方を T2 に含める（過剰在庫 / 不足在庫の両方向補正）
- 対象 1 商品のみ / 複数商品の両方（T2 は複数、T1 は複数で部分 commit を検出）

## Compatibility Checks

- 過去（TX 外時代）に書かれた `integrity_fix` ログも同 shape のため新表示で読める（T9 は DB 挿入 fixture で時代非依存に検証）
- 非 `integrity_fix` operation type の表示不変（T11）

## Data Safety Checks

- テストは in-memory / 一時 DB + synthetic 商品コードのみ。実店舗データ・実スクリーンショットの commit なし。

## Main Wiring / Integration Checks

- cmd 登録・bindings・route に変更なし → L1 full の生成系検査（bindings / routes / traceability）で差分ゼロ確認。テスト追加による traceability 再生成のみ許容。

## Mutation-style Adequacy Questions

| Mutant | 期待 red |
|---|---|
| X1: ログ INSERT を commit 後（TX 外）へ戻す | T1 |
| X2: 補正時に quantity=0 の marker movement を挿入 | T3 |
| X3: ログ失敗時に rollback せず warn + commit 続行 | T1（stock 不変 assert） |
| X4: UI-13 文言を旧文言（棚卸し系）へ戻す | T7 / T8 |
| X5: UI-11c の adjustments 分岐を削除（生 JSON のみ） | T9 |

Writer 完了条件 = X1/X2/X4 の実 mutation red 実測。X3/X5 は independent-review（2 pass）で実測。

## Residual Test Gaps

- ログ INSERT 以外の TX 内失敗（stock UPDATE 自体の失敗）は rusqlite の標準エラー経路で、既存の TX rollback に委ねる（専用注入テストなし。理由: §21.7 の指定 oracle は ログ失敗系のみで、UPDATE 失敗は SQLite 層の一般保証）。
- 同時実行（single-instance ガード前提、PR #16 で導入済み）による補正競合はテスト対象外。
- probe P2 不成立時、T6 は backlog へ差し戻し（tautological test が残置される。既存 backlog 行が追跡先）。
