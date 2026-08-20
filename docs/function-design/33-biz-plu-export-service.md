## 16. BIZ-04: PLU書出しロジック

> **D-072 / REQ-907**: app 管理 slot は app、既存登録はレジを authority とする。Z004 全スロットダンプで占有を確認した後、JAN 単位の memory No. を永続予約し、Diff / Full とも CV17 へ投入できる（SPEC-PLS-D2〜D5）。

### 16.1 モジュール構成

```
src-tauri/src/
  biz/
    plu_export_service.rs
```

BIZ-04 は transaction と業務状態遷移を所有する。固定幅 Z004 の解釈は IO-02、slot CRUD は `db::plu_slot_repo`、CV17 向け 11 field 生成は IO-04 に委譲する。

**関数要求**: レジ占有 snapshot の照合、PLU slot の冪等予約・解放、Diff / Full 行準備、保存後 confirm を一貫した transaction 境界で提供する。

**シグネチャ**: 各公開関数の Rust 形状は §16.3〜§16.5 に定義する。

**処理ステップ**: snapshot → prepare → external save / register operation → confirm の順で処理し、詳細は §16.3〜§16.6 に定義する。

**エラーハンドリング**: validation / snapshot conflict / no-free-slot / IO・DB failure を区別し、transaction failure は部分状態を残さず rollback する。回復契約は §16.8 を正本とする。

### 16.2 型定義

```rust
enum PluExportMode { Diff, Full }

enum PluSlotStatus { Free, External, Reserved, Active, ReleasePending }

enum PluExcludedReason {
    MissingJan,
    InvalidJanFormat,
    InvalidCheckDigit,
    GroupPriceMismatch,
    NoFreeSlot,
}

enum PluPreparedRowKind { Product, Clear }

struct PluPreparedRow {
    memory_no: i64,
    row_kind: PluPreparedRowKind,
    target_product_codes: Vec<String>,
}

struct PluExportPreparedResult {
    plu_output: PluFileOutput,
    count: usize,
    target_product_codes: Vec<String>,
    prepared_rows: Vec<PluPreparedRow>,
    excluded: Vec<PluExcludedProduct>,
}

struct PluRegisterSnapshotSummary {
    snapshot_at: Option<String>,
    free_count: usize,
    external_count: usize,
    app_managed_count: usize,
    conflict_count: usize,
    release_pending_count: usize,
}
```

`app_managed_count` は `reserved` / `active` / `release_pending` の総数、`release_pending_count` はそのうち次回 Diff / Full で clear 行を書き出す解除待ち件数を返す。後者は UI の Diff 可否判定に使うため、前者から推測しない。

`NoFreeSlot` の operator 文言は「レジの空きスロットがありません」とする。件数上限との比較ではなく、snapshot 後に `free` slot がないという実状態を表す。

### 16.3 import_plu_register_snapshot（BIZ-04-D3 / SPEC-PLS-D2）

```rust
fn import_plu_register_snapshot(
    conn: &mut DbConnection,
    raw_bytes: &[u8],
) -> Result<PluRegisterSnapshotSummary, BizError>
```

入力は共通 FilePicker（D-054）が返す `PickedFile.bytes` を CMD-08 経由で受け取った file bytes とする。BIZ-04 は path を扱わない（既存の CSV 取込み / 日報取込みと同型。設計 PR #84 の `path` 入力は D-054 の出力契約と接続できないため gated amendment で bytes へ改訂、2026-08-18）。

IO-02 の全スロット占有読取り mode が返す `(memory_no, raw_code)` を、**1 transaction** で `plu_slots` と照合する。途中失敗時は slot、app_settings、operation_logs をまとめて rollback する。

| レジ観測 | 現在 status | 結果 |
|---|---|---|
| 空 | free / external | free。scanning_code を NULL |
| 空 | reserved | reserved を維持 |
| 空 | active | active を維持し `missing_on_register`、対応商品を dirty |
| 空 | release_pending | free。解放確認済みとして released_at を更新 |
| 同一コード | reserved | active。activated_at を更新 |
| 同一コード | active / release_pending | 現 status を維持 |
| occupied | free | eligible な 13 桁 JAN と一致し、その JAN に `reserved` / `active` slot が無ければ active として採用（activated_at）。その JAN が `reserved` / `active` slot を既に持つなら重複 stale として `release_pending`（app 管理 slot の memory No. は維持、§16.6 (4)）。それ以外は external |
| 別コード | reserved | 観測値を external とし `reservation_dropped`。旧 JAN は後続 prepare で再予約 |
| 別コード | active | app の active を維持し conflict、対応商品を dirty |
| 別コード | release_pending | 観測値を external とする |
| 同一コード | external | external を維持 |
| 別コード | external | 観測値で external を更新 |

free slot 上で同一 eligible JAN が複数観測された場合は最小 memory No. だけを active として採用し、残りを `release_pending` にする（`scanning_code` は保持する。`plu_slots` の partial UNIQUE は `release_pending` を対象外とするため、`active` + `release_pending` の同一コード共存を保存できる。`release_pending` を持つ JAN の再対象化・重複行の扱いは §16.4 step 4）。照合後、`app_settings` の key `plu_register_snapshot_at` と `plu_register_snapshot_summary` を更新し、summary と conflict を operation_logs に記録する。実コード・名称・単価は summary / log に含めない。

初回 snapshot 未読込みの `prepare_plu_export` は `BizError::ValidationFailed`（reason=`register_snapshot_required`、文言「レジ設定の読込みが必要です」）で拒否する。二回目以降の読込みは任意だが、レジ側で手動登録した後は再読込みを推奨する。

```rust
pub fn get_plu_slot_summary(conn: &DbConnection) -> Result<PluRegisterSnapshotSummary, BizError>
```

### 16.4 prepare_plu_export（BIZ-04-D4 / SPEC-PLS-D3、D5）

```rust
fn prepare_plu_export(
    conn: &mut DbConnection,
    req: PluExportPrepareRequest,
) -> Result<PluExportPreparedResult, BizError>
```

prepare は **1 transaction** で対象抽出、JAN bucket / dedup、slot 予約、IO-04 行生成まで行う。

1. snapshot gate を検査する。
2. `plu_target=1`、未廃番、13 桁数字かつ check digit 有効な JAN を対象にする。JAN 不備と同一 JAN の売価・税率不一致は理由付き `excluded` とし、既存 slot を変更せず出力もしない。
3. 同一 JAN 群は D-028 の代表行規則を維持し、`target_product_codes` へ群の全 member を持つ。
4. 既存 `reserved` / `active` slot は sticky allocation として再利用する。`release_pending` の JAN が再び対象になった場合、同一コードの `external` slot があれば step 5 の採用を優先し（`release_pending` 行は clear 対象として維持）、なければ activated_at があれば active、なければ reserved に戻す。同一 JAN の `release_pending` が複数行なら最小 memory No. の 1 行のみ復元し、残りは `release_pending` のまま clear 対象に残す。
5. `reserved` / `active` を持たない JAN は、同一コードの `external` slot があれば新規予約せずその slot を `active`（activated_at=now）として採用する（snapshot 後に対象化されたレジ既存登録を app 管理へ移行する。partial UNIQUE 上、同一コードの `external` と `reserved` は共存できない）。`external` も無ければ memory No. が最小の `free` slot を `reserved` にする。空きがなければ `NoFreeSlot` へ積み、他の JAN の生成を続ける。固定件数との比較で prepare 全体を拒否しない。
6. Diff は dirty な対象 product 行と全 `release_pending` clear 行、Full は app 管理の `reserved` / `active` product 行と全 `release_pending` clear 行を作る。`external` / `free` はどちらにも含めない。
7. 要修正判定中の JAN に既存 slot がある場合、その slot を維持し、Diff / Full とも出力しない。
8. IO-04 へ `memory_no` 付き行を渡す。成功時に予約を commit し、同じ snapshot と商品状態での再 prepare は同じ memory No. を返す。

生成が空でも、解放 clear 行が存在すれば成功とする。対象行も clear 行もない場合だけ validation error とする。prepare 成功は CV17 / レジ反映の証明ではなく、商品 `plu_dirty` と `plu_exported_at` は confirm まで変更しない。

### 16.5 confirm_plu_export_saved（BIZ-04-D5 / SPEC-PLS-D4、D5）

```rust
fn confirm_plu_export_saved(
    conn: &mut DbConnection,
    req: PluExportConfirmRequest,
) -> Result<PluExportConfirmResult, BizError>
```

prepare が返した exact `memory_no` / product_code set を **1 transaction** で再検証する。重複、範囲外、存在しない slot、期待 status と不一致の payload は全体を拒否する。

- product 行: `reserved -> active`、`activated_at=now`。対象群を `plu_dirty=0`, `plu_exported_at=now` にする。
- clear 行: `release_pending -> free`、`scanning_code=NULL`, `released_at=now`。
- retry: 既に同じ結果へ遷移済みなら idempotent success とする。別 JAN / 別 status への変化は拒否する。
- operation_logs: mode、product / clear 件数、confirmed_at を記録し、実コードを記録しない。

初期定数は `PLU_CLEAR_ROW_ENABLED=true` とする。clear 行が CV17 / SR-S4000 で受理されないことが L3 で判明した場合は、この一箇所を `false` に切り替えて clear 行を出力せず、`release_pending -> free` を禁止する（fallback no-reuse、D-072 revisit）。

### 16.6 slot 解放 trigger（BIZ-04-D6 / SPEC-PLS-D4）

次の契機は BIZ-01 から共通の解放 service を呼ぶ。

1. `plu_target: 1 -> 0`
2. 廃番化（同時に `plu_target=0`）
3. `jan_code` の変更
4. snapshot で同一 JAN の重複占有を検出し、その JAN の `reserved` / `active` slot があればそれ以外を、なければ最小 memory No. 以外を stale と判定（stale 側は `scanning_code` を保持したまま `release_pending`）

同じ JAN を共有する `plu_target=1` / active 商品が残る場合は解放しない。未反映の `reserved` は直接 `free`、反映済みの `active` は `release_pending` とし、IO-04 の exact **11 field** clear 行を次回 Diff / Full に含める。廃番解除は `plu_target` を自動復帰させない。

```rust
pub fn release_plu_slot_for_jan(conn: &DbConnection, jan_code: &str) -> Result<(), BizError>
```

#### 16.6.1 list_plu_dirty

```rust
fn list_plu_dirty(conn: &DbConnection) -> Result<Vec<Product>, BizError>
```

`plu_target=1 AND plu_dirty=1` の商品を product_code 順で返す read-only query。UI-00 の `PluNotificationBar` と UI-08 の既存 preview 契約を維持し、slot 予約・snapshot・集計状態を変更しない。

### 16.7 IO / repository への依存

| 依存 | 用途 |
|---|---|
| `io::z004_parser::parse_plu_register_snapshot` | layout A 全スロット占有の読取り |
| `db::plu_slot_repo` | snapshot 照合、最小空き予約、sticky 取得、confirm / release 状態遷移 |
| `db::product_repo` | PLU target 抽出、同一 JAN 群、dirty 更新、slot JOIN |
| `io::plu_formatter::generate_plu_tsv` | memory No. 付き product / clear 行の 11 field 出力 |
| `db::operation_log_repo` | snapshot / prepare / confirm の要約記録 |

`db::plu_slot_repo` の module 実装と map 登録、上記関数の実装は後続実装 A の義務とする。

### 16.8 Error / Recovery

- 保存キャンセル・保存失敗: 同じ mode を再 prepare すると予約済み memory No. を再利用する。
- CV17 取込み失敗: 保存済みファイルを再投入するか、Diff / Full を再書出しする。両 mode とも memory No. が永続しているため投入可能。
- snapshot conflict: active slot を勝手に external / free へ変えず、商品を dirty にして operator へ示す。
- `NoFreeSlot`: 該当 JAN だけを excluded とし、既存 slot と他の生成行を保持する。
- clear rejection: `release_pending` を再利用しない fail-safe を維持し、D-072 を再検討する。

### 16.9 対応不変条件

- 同一 JAN は同一 memory No. を sticky に使い、prepare 順序や画面 filter で番号を変えない。
- app は Z004 snapshot なしに空き slot を仮定しない。
- `external` / `free` は出力しない。要修正中の既存 slot は維持して出力しない。
- Diff / Full とも CV17 投入可能。Full は app 管理 slot 全体、Diff は未反映対象 + 解放分。
- slot 状態は売上、在庫、会計集計へ影響させない（SPEC-PLS-D8）。
