## 16. BIZ-04: PLU書出しロジック

> **2026-07-02 field gate note**: CV17 1.1.1 / SR-S4000 の実機確認により、現行 UI-08 出力は外部手動 gate 未通過。BIZ-04 は IO-04 の CV17 1.1.1 adapter profile（11列 `.txt`、13桁JAN必須）を前提に、件数上限を prepare 時点で拒否し、PLUファイル生成だけでは `plu_dirty` を更新しない。PLU総枠5000は通常PLUとスキャニングPLUで共有される（SR-S4000 取扱説明書で確認済みの工場出荷時配分: 総枠 5,000 = 通常PLU 216 + スキャニングPLU 4,784。スキャニングPLU開始 217 は出荷時固定の境界）。
> **2026-07-03 D-028 note**: JANなし商品のPLU対象扱い設計（decision-log D-028）により、prepare は三分バケット（PLU対象 / 対象外 / 要修正）で動作する。対象外（`plu_target=0`）は抽出せず、要修正（`plu_target=1` かつ JAN 不備）は生成をブロックせず理由付きリストで返す。同一JAN（グループコード）は prepare 内で dedup する。

### 16.1 モジュール構成

```
src-tauri/src/
  biz/
    mod.rs                 -- pub mod plu_export_service を追加
    product_service.rs     -- 既存（BIZ-01）
    inventory_service/     -- 既存（BIZ-02、ディレクトリモジュール）
    plu_export_service.rs  -- PLU書出しの業務ロジック（本セクション）
```

### 16.2 型定義

**ExportMode列挙型**:
```
enum ExportMode {
    Full,  // plu_target=1 かつ is_discontinued=0 の商品
    Diff,  // plu_target=1 かつ plu_dirty=1 の商品のみ
}
```

**PluExportPrepareRequest構造体**:
- mode: ExportMode

**PluExportRow構造体**（IO-04に渡す行データ）:
- product_code: String
- jan_code: Option<String>
- name: String
- selling_price: i64
- tax_rate: String（"10" / "8" / "0"）
- department_name: String

**PluCsvOutput構造体**（IO-04の戻り値。E-4オンライン調査で確定、2026-04-08）:
- bytes: Vec<u8>
- suggested_filename: String
- content_type: &'static str（確定: "text/tab-separated-values"）
- encoding: &'static str（確定: "CP932"）

**PluExcludedProduct構造体**（D-028 要修正バケット。生成から除外した商品と理由）:
- product_code: String
- jan_code: Option\<String\>（商品マスタ上のJAN。未登録の場合はNULL）
- name: String
- reason: PluExcludedReason

**PluExcludedReason列挙型**:
```
enum PluExcludedReason {
    MissingJan,          // jan_code が NULL（plu_target=1 なのに JAN 未登録）
    InvalidJanFormat,    // 13桁数字でない
    InvalidCheckDigit,   // JAN/EAN-13 チェックディジット不正
    GroupPriceMismatch,  // 同一JAN内で selling_price / tax_rate が不一致
}
```

**PluExportPreparedResult構造体**:
- csv_output: PluCsvOutput
- count: usize（書出し行数。dedup 後の生成行数）
- target_product_codes: Vec\<String\>（confirm対象の商品コード。dedup 群は代表行だけでなく**全メンバー**を含むため、count と len は一致しないことがある。excluded の商品は含まない。confirm時にこのexact setを送る）
- excluded: Vec\<PluExcludedProduct\>（要修正バケット。UI-08 が理由付き一覧で表示し、商品マスタ修正へ誘導する）
- over_limit_warning: bool（互換維持フィールド。工場出荷時配分の4,784件超過をエラーにするため通常false）

---

**PluExportConfirmRequest構造体**:
- product_codes: Vec\<String\>（prepare結果のtarget_product_codes）

**PluExportConfirmResult構造体**:
- updated_count: usize
- confirmed_at: String（YYYY-MM-DDTHH:MM:SS）

---

### 16.3 prepare_plu_export

**関数要求**: 指定モードで商品を抽出し、PLUファイルを生成する。`plu_dirty` / `plu_exported_at` は更新しない

**シグネチャ**:
```
fn prepare_plu_export(conn: &DbConnection, req: PluExportPrepareRequest) -> Result<PluExportPreparedResult, BizError>
```

**処理ステップ**:
1. **対象商品の抽出**（TX外、読み取りのみ。D-028 三分バケットの「対象外」= plu_target=0 は抽出しない）
   a. Full → product_repo::find_active_products_for_plu(conn)（plu_target=1 AND is_discontinued=0）
   b. Diff → product_repo::find_plu_dirty_products_for_plu(conn)（plu_target=1 AND plu_dirty=1）
   - DbError → BizError::DatabaseError
2. 抽出結果が0件 → BizError::ValidationFailed("書出し対象の商品がありません")
3. **要修正バケット分離**（D-028。生成をブロックしない）
   - jan_code が NULL → PluExcludedReason::MissingJan
   - 13桁数字でない → PluExcludedReason::InvalidJanFormat
   - JAN/EAN-13チェックディジット不正 → PluExcludedReason::InvalidCheckDigit
   - 該当商品を excluded に積み、書出し候補から除外する。product_code を `ｽｷｬﾆﾝｸﾞｺｰﾄﾞ` にfallbackしない
4. **同一JAN dedup**（D-028。グループコード対応）
   - 残った候補を jan_code でグループ化し、同一JANに複数商品がある場合:
     - selling_price と tax_rate が全一致 → product_code 最小の行を代表として1行に dedup。名称も代表行の name（グループコード商品は色を区別しない既存方針と整合）
     - 不一致 → 群全体を excluded（PluExcludedReason::GroupPriceMismatch）に積み、生成から除外する
   - レジ側に同一スキャニングコードが複数スロット登録される状態を prepare 段階で排除する
5. **スキャニングPLU上限チェック**: dedup 後の生成行数 > constants::SCANNING_PLU_EXPORT_LIMIT（工場出荷時配分: PLU総枠5000 - 通常PLU216枠 = 4784件）→ BizError::ValidationFailed("スキャニングPLU書出し件数が上限の4784件を超えています")
6. 生成行が0件（全件が要修正）→ BizError::ValidationFailed。message に対象 product_code と理由を含め、利用者が商品マスタ側でJANを補正して再書出しできるようにする
7. **PluExportRowリスト構築**
   - 各代表 ProductForPlu → PluExportRow変換（product_code昇順、_for_plu関数が既にORDER BY product_code ASCで返す）
   - product_code, jan_code, name, selling_price, tax_rate はProductForPluからそのままコピー
   - department_name = ProductForPlu.department_name（INNER JOINで取得済み）
   - target_product_codes = 生成行の代表商品と dedup 群の非代表メンバーを合わせた product_code 一覧（excluded の商品は含まない）
8. **IO-04呼出し**: plu_formatter::generate_plu_tsv(&rows) → PluCsvOutput
   - IO-04仕様はCV17 1.1.1 adapter profile。25-io-plu-formatter.md 参照
   - 失敗（PluFormatError） → BizError::ImportError("PLUファイルの生成に失敗しました: {details}")
9. PluExportPreparedResult { csv_output, count, target_product_codes, excluded, over_limit_warning=false } を返す

**設計判断 — prepareではplu_dirtyを更新しない**:
- D-027により、PLUファイル生成はPCツール受理やレジ反映の証明ではない。生成または保存に成功しても、利用者が書出し済み確認を押すまで `plu_dirty` は残す
- 保存失敗・保存前のやり直しでは同じ差分を再生成できる。CV17 取込み失敗以降の回復は、保存済み Full ファイルの再投入または Full 再書出しで行う（CV17 へ投入してよいのは Full のみ = UI-08-D9。Diff 書出しは未反映確認用で投入しない）

**設計判断 — 冪等性**:
- prepareは状態変更ではないため冪等キーを適用しない。同じリクエストで2回生成しても業務上の問題はない
- confirmはexact product_code[]に対して `plu_dirty=0` を再適用するだけなので、同じpayloadの再送は結果として冪等である

**エラーハンドリング**:
- 対象0件（抽出0件、または全件が要修正で生成行0件）→ BizError::ValidationFailed
- dedup 後の生成行数が `SCANNING_PLU_EXPORT_LIMIT` を超える → BizError::ValidationFailed
- JANなし / 13桁数字以外 / チェックディジット不正 / 同一JAN内の価格・税率不一致 → エラーにせず excluded（要修正リスト）として結果に含めて返す（D-028）
- IO-04失敗 → BizError::ImportError（plu_dirtyは変更なし）

---

### 16.4 confirm_plu_export_saved

**関数要求**: UI-08でPLUファイル保存後、利用者が書出し済み確認した対象商品だけを `plu_dirty=0` / `plu_exported_at=now` に更新する

**シグネチャ**:
```
fn confirm_plu_export_saved(conn: &mut DbConnection, req: PluExportConfirmRequest) -> Result<PluExportConfirmResult, BizError>
```

**処理ステップ**:
1. product_codesが空 → BizError::ValidationFailed("書出し済みにする商品がありません")
2. 重複product_codeがあればBizError::ValidationFailed("同じ商品コードが複数含まれています")
   - 件数上限比較は行わない（D-028: target_product_codes は dedup 群の全メンバーを含むため、書出し行数上限 4,784 を正当に超え得る。異常 payload はこの重複拒否とトランザクション内の全件存在確認で防御する）
3. confirmed_at = 現在日時をJST `YYYY-MM-DDTHH:MM:SS` で作る
4. **トランザクション開始**
   a. 各product_codeについてproduct_repo::find_by_product_codeで存在確認する
   b. 存在しない商品が1件でもあればNotFoundで全体ROLLBACK。部分更新しない
   c. product_repo::update_product(&tx, product_code, &ProductUpdates { plu_dirty: Some(false), plu_exported_at: Some(Some(confirmed_at)), ..Default }) を実行する
   d. **COMMIT**
5. **TX外: 操作ログ記録**
   - operation_type: "plu_export"
   - summary: "PLU書出し済み確認を記録しました（{count}件）"
   - detail_json: `{"count":{count},"confirmed_at":"..."}`
   - ログ記録失敗は警告のみ
6. PluExportConfirmResult { updated_count, confirmed_at } を返す

**設計判断 — バッチUPDATEの方式**:
- 対象商品数は dedup 群の展開により書出し行数 4,784 を超え得るが、上界は products テーブルの総行数（数千件規模）に自然に縛られる。1件ずつ存在確認 + update_product を呼ぶ方式を採用する。SQLiteの単一接続＋1人運用デスクトップアプリでは十分高速で、動的IN句構築のバグを避けられる
- prepare後に商品が変更されても、confirmはprepare時のexact setだけを更新する。prepare後に新たにdirtyになった別商品は巻き込まない

**入力例**:
```
PluExportPrepareRequest { mode: ExportMode::Diff }
```

**出力例**:
```
PluExportPreparedResult {
    csv_output: PluCsvOutput {  // 注: 型名は互換維持でCsvのまま据え置き。実体はタブ区切りPLUファイル
        bytes: [0x83, 0x81, 0x83, ...],  // CP932エンコード済みPLUファイル
        suggested_filename: "PLU_20260408.txt",
        content_type: "text/tab-separated-values",
        encoding: "CP932",
    },
    count: 42,
    target_product_codes: ["4976383262108", "HZ-0099", ...],  // dedup 群の非代表メンバーも含む
    excluded: [PluExcludedProduct { product_code: "BT-0012", jan_code: None, name: "JANなし商品", reason: MissingJan }, ...],
    over_limit_warning: false,
}
```

---

### 16.5 list_plu_dirty

**関数要求**: plu_target=1 かつ plu_dirty=1 の商品一覧を返す（D-028: 「PLU対象のうちレジ未反映」の意味に限定）。UI-08 の差分対象プレビューと UI-00 の PLU未反映通知の共通ソース

**シグネチャ**:
```
fn list_plu_dirty(conn: &DbConnection) -> Result<Vec<Product>, BizError>
```

**処理ステップ**:
1. product_repo::find_plu_dirty_products(conn) を呼ぶ（plu_target=1 AND plu_dirty=1 条件は IO 側クエリが持つ）
   - DbError → BizError::DatabaseError に変換
2. 結果をそのまま返す（0件でもOk(空Vec)。エラーではない）

**設計判断**: BIZ層としてのロジックは不要だが、CMD層からIO層を直接呼ばないレイヤー原則を守るため、薄いラッパーとして配置する

---

### 16.6 IO-04 仕様（CV17 1.1.1 adapter profile）

IO-04（PLUフォーマッター）はカシオレジスターツール（CV17）1.1.1 の `スキャニングPLU(商品)` import で受理された template shape に合わせる。CV17 import 成功だけでは SR-S4000 反映成功を意味しないため、SD-card / register reflection は manual gate で別途確認する。

**シグネチャ**:
```
fn generate_plu_tsv(rows: &[PluExportRow]) -> Result<PluCsvOutput, PluFormatError>
```

**入力**: &[PluExportRow]（product_code昇順）

**出力**: PluCsvOutput { bytes, suggested_filename, content_type, encoding }

**確定仕様（CV17 1.1.1 import profile）**:
- content_type: "text/tab-separated-values"
- encoding: "CP932"（Shift-JIS）
- suggested_filename: "PLU_{YYYYMMDD}.txt" 形式
- ファイル形式: タブ区切りテキスト。1行目ヘッダ、2行目以降データ
- ヘッダ: `メモリNo.`, `ｽｷｬﾆﾝｸﾞｺｰﾄﾞ`, `名称`, `単価`, `課税方式`, `単品売り`, `負単価`, `品番PLU`, `ゼロ単価`, `入力桁制限`, `部門リンク`
- メモリNo.: 通常PLU使用数 + 1 始まりの連番。PLU総枠上限は `5000`。工場出荷時配分（SR-S4000 取説確認済み: 通常PLU216）により `217` 始まり、最大件数は `4784`
- ｽｷｬﾆﾝｸﾞｺｰﾄﾞ: 13桁数字のJAN/EAN-13有効コード。product_code fallbackは禁止
- 商品名: CP932エンコードで半角16バイト/全角8文字以内に切り詰め。`_`はダブルサイズ制御文字のため使用不可
- 課税方式: tax_rate → テキスト変換（'10'→`税1(内税)`, '8'→`税2(内税)`, '0'→`非課税`）
- 部門リンク: department_name（部門名テキスト。数値IDではない）

**詳細設計**: `docs/function-design/25-io-plu-formatter.md` に関数設計作成済み。BIZ-04はJAN検証と件数上限をprepare時に扱い、IO-04は防御的に同じ形式を検証する。

---

### 16.7 product_repo への依存

BIZ-04が使用するIO関数（20-io-product-repo.md に定義済み）:

| 関数 | 用途 | 定義箇所 |
|------|------|---------|
| find_plu_dirty_products_for_plu(conn) | Diffモードの対象抽出（department_name付き） | 2.3 product_repo |
| find_active_products_for_plu(conn) | Fullモードの対象抽出（department_name付き） | 2.3 product_repo |
| find_by_product_code(conn, product_code) | confirm時の存在確認 | 2.3 product_repo |
| update_product(conn, product_code, updates) | confirm時のplu_dirty/plu_exported_at更新 | 2.3 product_repo |

**PLU専用クエリ関数（`_for_plu`）を追加**（20-io-product-repo.md に設計済み）。汎用関数のうち find_active_products（商品一覧用）は変更しない。find_plu_dirty_products は D-028 により `plu_target = 1` 条件を追加する（UI-00 通知と Diff プレビューの意味を「PLU対象のうち未反映」に限定するため。旧注記「既存の汎用関数は変更しない」は PR #12 時点の後方互換方針であり、D-028 で改訂した）。

---

### 16.8 非目的

以下はBIZ-04のスコープ外:
- **IO-04フォーマット実装**: E-4仕様確定済み（2026-04-08）。`25-io-plu-formatter.md` として別途関数設計を作成し実装する
- **PLUデータのレジ側への書き込み**: 運用手順書の範囲。PLUファイルを生成してフロントエンドに返すところまでがシステムの責務
- **plu_dirty以外のフィルタ条件追加**: 現時点ではFull/Diffの2モードのみ。部門別書出し等が必要になった場合は要求追加で対応
- **書出し履歴の管理**: operation_logsへの記録で十分。専用の書出し履歴テーブルは初回UI-08では作らない。保存済みPLUファイルを紛失した後の再書出しはFullモードで扱う

---

### 16.9 対応不変条件

- **INV-8: products物理DELETE禁止** — find_active_productsは `WHERE is_discontinued = 0` で取得。物理DELETEされた商品は存在しない前提
- **INV-1a: 入力値は常に正数** — BIZ-04は在庫変動を伴わないため直接該当しないが、PLU上限チェックの件数(count)は自然数
