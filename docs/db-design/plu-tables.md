# テーブル定義（PLU スロット永続割当）

> **親文書**: [DB_DESIGN.md](../DB_DESIGN.md)
> **設計判断**: [decision-log.md D-072](../decision-log.md#d-072-plu-slot-永続割当と段階導入2026-08-18)

---

## 25. plu_slots

### 役割

SR-S4000 のスキャニング PLU 領域について、レジで観測した占有とアプリが管理する JAN 単位の予約をメモリ No. ごとに永続化する。アプリ管理スロットはアプリ、既存登録はレジを authority とし、空き判定には Z004 全スロットダンプの読込みを必須とする（**BIZ-04-D3 / SPEC-PLS-D1、D2**）。

### カラム定義

| カラム名 | 型 | 制約 | 説明 |
|---|---|---|---|
| memory_no | INTEGER | PRIMARY KEY, CHECK(217 <= memory_no AND memory_no <= 5000) | レジのスキャニング PLU メモリ No. |
| scanning_code | TEXT | NULLABLE | app 管理時は 13 桁 JAN、既存登録はレジで観測したコード、free は NULL |
| status | TEXT | NOT NULL, CHECK(status IN ('free','external','reserved','active','release_pending')) | スロット状態 |
| reserved_at | TEXT | NULLABLE | 予約日時 |
| activated_at | TEXT | NULLABLE | レジ反映確認日時 |
| released_at | TEXT | NULLABLE | 解放確認日時 |
| updated_at | TEXT | NOT NULL | 最終更新日時 |

`scanning_code` には `status IN ('external','reserved','active')` の行だけを対象とする partial UNIQUE index を置く。同じ JAN / 観測コードをこれら 3 status の複数スロットへ割り当てる状態は DB が拒否する。`release_pending` は clear 待ちの stale 保持であり index の対象外とする（同一コードの `release_pending` 複数行、および `active` / `reserved` / `external` との共存を許容する）。スナップショット照合の重複解消（最小番号だけ active、残り release_pending）と解放 trigger はこの例外で保存できる（gated amendment 2、2026-08-18。`status <> 'free'` では重複解消結果が保存不能だった）。

### migration v5

migration v5 は table と partial UNIQUE index を作り、memory No. 217〜5000 の **4,784 行**を `status='free'`, `scanning_code=NULL` で事前投入する。実装と migration map 登録は後続実装 A の義務であり、本 design-first PR は schema を変更しない（**MNT-03-D9 / SPEC-PLS-D1**）。

### products との結合

`plu_slots.scanning_code = products.jan_code` を JAN 単位の結合キーとする。product_code は slot identity に使わない。同一 JAN の商品群は 1 スロットを共有し、商品一覧・商品詳細は `reserved` / `active` / `release_pending` の該当 memory No. を読み取り専用値として返す。同一 JAN に複数行が該当する場合（重複解消後の `active` + `release_pending`、または `release_pending` 複数行）は `reserved` / `active` を優先し、`release_pending` のみなら最小 memory No. の 1 行を返す。

### 状態遷移

| 現在状態 | 契機 | 次状態 | 必須処理 |
|---|---|---|---|
| free | prepare | reserved | 最小空き番号、reserved_at |
| free | snapshot: レジ有・eligible JAN 一致（その JAN に reserved / active なし） | active | 採用、activated_at。同一 JAN 重複は最小番号だけ active、残り release_pending（scanning_code 保持） |
| free | snapshot: レジ有・reserved / active 保持 JAN と同一コード | release_pending | 重複 stale（33-biz §16.6 (4)）。app 管理 slot の memory No. は維持、observed 側に scanning_code 保持 |
| free | snapshot: レジ有・その他 | external | 観測コードを保持 |
| external | prepare: 同一コードの JAN が eligible かつ reserved / active なし | active | 採用、activated_at。新規 free 予約はしない（レジ既存登録の app 管理への移行） |
| free | snapshot: レジ空 | free | no-op |
| external | snapshot: レジ空 | free | scanning_code を NULL |
| external | snapshot: レジ有・同一コード | external | 維持 |
| external | snapshot: レジ有・別コード | external | 観測コードを更新 |
| reserved | confirm / snapshot: レジ有・同一コード | active | activated_at |
| reserved | snapshot: レジ空 | reserved | 未書込み予約を維持 |
| reserved | snapshot: レジ有・別コード | external | 予約破棄、reservation_dropped、旧 JAN は再予約対象 |
| reserved | 解放 trigger | free | released_at。レジ未書込みのため clear 不要 |
| reserved | 保存失敗・キャンセル後の再 prepare | reserved | 同じ番号を維持 |
| active | 解放 trigger（同一 JAN の対象 product なし） | release_pending | released_at、clear 待ち |
| active | snapshot: レジ空 | active | missing 報告、商品を dirty |
| active | snapshot: レジ有・同一コード | active | 維持 |
| active | snapshot: レジ有・別コード | active | conflict 報告、商品を dirty |
| release_pending | clear 行 confirm | free | scanning_code を NULL、再利用可 |
| release_pending | snapshot: レジ空 | free | 解放確認 |
| release_pending | snapshot: レジ有・同一コード | release_pending | clear 待ちを維持 |
| release_pending | snapshot: レジ有・別コード | external | 解放済み扱い、clear 不要 |
| release_pending | 元 JAN を再対象化 | active / reserved | activated_at の有無で復元、商品を dirty。同一 JAN の release_pending が複数行なら最小 memory No. の 1 行のみ復元し残りは維持。同一コードの external があれば external → active 採用を優先し本行は維持 |
| release_pending | fallback no-reuse | release_pending | clear 行を出さず固定 |

別コード衝突、同一 JAN 重複、要修正商品の扱いを含む照合表の正本は [33-biz-plu-export-service.md](../function-design/33-biz-plu-export-service.md) §16.3 とする（**BIZ-04-D3 / SPEC-PLS-D2〜D4**）。

### db::plu_slot_repo の責務

- memory No. 順の全 slot 読取り、JAN / status による検索
- 最小 `free` slot の予約、sticky allocation の再取得
- スナップショット照合、prepare、confirm、解放を呼出側の同一 transaction 内で行う CRUD
- `products.jan_code` との結合と、UI / CMD 向け `plu_memory_no` の取得
- status CHECK、範囲 CHECK、partial UNIQUE 違反を `DbError` に変換し、部分更新を残さない

module 実装、`db/mod.rs` の公開、design compliance map 登録は後続実装 A の義務とする。

## app_settings の PLU スナップショットキー

| key | value | 説明 |
|---|---|---|
| plu_register_snapshot_at | ISO 8601 timestamp | 最後に Z004 全スロット占有を読んだ日時 |
| plu_register_snapshot_summary | JSON | free / external / app-managed / conflict の件数要約。実コード・名称・単価は保存しない |

初回 snapshot 未読込みでは prepare を `register_snapshot_required` で拒否する。再読込みは任意だが、レジ側で手動登録を行った後は再読込みを推奨する（**BIZ-04-D3 / SPEC-PLS-D2**）。

## 集計境界

`plu_slots` と上記 app_settings は PLU 登録・解放の制御情報であり、売上、在庫、会計の集計には加算・減算・仕訳として参加しない。Z001 / Z002 / Z005 の公式日報集計と Z004 の商品別売上・在庫変動は従来どおり別 series で処理し、PLU slot 状態を集計根拠にしない（**BIZ-04-D7 / SPEC-PLS-D8、D-025**）。
