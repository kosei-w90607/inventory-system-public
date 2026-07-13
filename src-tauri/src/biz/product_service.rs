//! 商品管理の業務ロジック（BIZ-01）
//!
//! 30-biz-product-service.md §4 に基づく実装。
//! IO層の関数を組み合わせ、トランザクション制御付きの業務ロジックを提供する。

use crate::db::product_repo::{self, NewPriceHistory, NewProduct, ProductUpdates};
use crate::db::system_repo::{self, NewOperationLog};
use crate::db::{inventory_repo, stocktake_repo, DbConnection, DbError, PaginatedResult};

use super::BizError;
use crate::db::inventory_repo::{MovementType, NewMovement};
use crate::db::product_repo::{ProductSearchQuery, ProductWithRelations};
use crate::db::stocktake_repo::NewStocktakeItem;

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/// 商品登録リクエスト（FUNC-4.2）
#[derive(Debug, serde::Deserialize, specta::Type)]
pub struct ProductCreateRequest {
    pub jan_code: Option<String>,
    pub name: String,
    pub department_id: i64,
    pub selling_price: i64,
    pub cost_price: i64,
    pub tax_rate: String,
    pub stock_unit: String,
    pub initial_stock: i64,
    pub maker_code: Option<String>,
    pub supplier_id: Option<i64>,
    pub pos_stock_sync: bool,
    pub plu_target: bool,
}

/// 商品登録結果（FUNC-4.2）
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct ProductCreateResult {
    pub product_code: String,
    pub warnings: Vec<String>,
}

/// 商品更新リクエスト（FUNC-4.4）
#[derive(Debug, Default, serde::Deserialize, specta::Type)]
pub struct ProductUpdateRequest {
    pub name: Option<String>,
    pub department_id: Option<i64>,
    #[serde(default, deserialize_with = "deserialize_nullable_update_field")]
    #[specta(type = Option<Option<i64>>)]
    pub supplier_id: Option<Option<i64>>,
    pub selling_price: Option<i64>,
    pub cost_price: Option<i64>,
    pub tax_rate: Option<String>,
    #[serde(default, deserialize_with = "deserialize_nullable_update_field")]
    #[specta(type = Option<Option<String>>)]
    pub maker_code: Option<Option<String>>,
    pub pos_stock_sync: Option<bool>,
    pub plu_target: Option<bool>,
}

/// 商品更新結果（FUNC-4.4）
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct ProductUpdateResult {
    pub warnings: Vec<String>,
}

fn deserialize_nullable_update_field<'de, D, T>(
    deserializer: D,
) -> Result<Option<Option<T>>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: serde::Deserialize<'de>,
{
    <Option<T> as serde::Deserialize>::deserialize(deserializer).map(Some)
}

// ---------------------------------------------------------------------------
// Failpoint（テスト専用）
// ---------------------------------------------------------------------------

#[cfg(test)]
pub(crate) mod failpoint {
    use std::sync::atomic::{AtomicBool, Ordering};

    pub static CREATE_PRODUCT_AFTER_INSERT: AtomicBool = AtomicBool::new(false);
    pub static CREATE_PRODUCT_AFTER_MOVEMENT: AtomicBool = AtomicBool::new(false);
    pub static UPDATE_PRODUCT_AFTER_PRICE_HISTORY: AtomicBool = AtomicBool::new(false);

    /// RAII ガード — Drop 時にフラグを自動リセット（並列テスト汚染防止）
    pub struct FailpointGuard(&'static AtomicBool);
    impl Drop for FailpointGuard {
        fn drop(&mut self) {
            self.0.store(false, Ordering::SeqCst);
        }
    }
    pub fn arm(flag: &'static AtomicBool) -> FailpointGuard {
        flag.store(true, Ordering::SeqCst);
        FailpointGuard(flag)
    }
}

// ---------------------------------------------------------------------------
// 関数
// ---------------------------------------------------------------------------

/// 独自コードを生成する（FUNC-4.3）
///
/// department の code_prefix + "-" + 4桁ゼロ埋め連番。
/// トランザクション内で呼ばれることを前提とする。
fn generate_custom_code(conn: &DbConnection, department_id: i64) -> Result<String, BizError> {
    let department = product_repo::find_department_by_id(conn, department_id)?
        .ok_or_else(|| BizError::ValidationFailed("部門が見つかりません".to_string()))?;

    let prefix = department.code_prefix.ok_or_else(|| {
        BizError::ValidationFailed("この部門は独自コード発番に対応していません".to_string())
    })?;

    let seq = product_repo::increment_next_seq(conn, department_id)?;
    let code = format!("{}-{:04}", prefix, seq);

    // 安全のため重複チェック（通常は起きない）
    if product_repo::find_by_product_code(conn, &code)?.is_some() {
        return Err(BizError::DuplicateProductCode(code));
    }

    Ok(code)
}

/// 商品を新規登録する（FUNC-4.2）
///
/// ## 設計ドキュメントとの差分
/// 30-biz-product-service.md ではステップ2（コード決定）の後にBEGINだが、
/// generate_custom_code 内の increment_next_seq が DB を更新するため
/// TX 開始をコード決定の前に移動。
pub fn create_product(
    conn: &mut DbConnection,
    req: ProductCreateRequest,
) -> Result<ProductCreateResult, BizError> {
    // 1. バリデーション（TX外、読み取りのみ）
    validate_create_request(&req, conn)?;

    // 2. BEGIN（コード決定を TX 内で行うため先に開始）
    let tx = conn
        .transaction()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    // 3. product_code の決定（TX内）
    let product_code = match &req.jan_code {
        Some(jan) => {
            let code = jan.clone();
            // 事前重複チェック
            if product_repo::find_by_product_code(&tx, &code)?.is_some() {
                return Err(BizError::DuplicateProductCode(code));
            }
            code
        }
        None => generate_custom_code(&tx, req.department_id)?,
    };

    // 4. products INSERT
    let new_product = NewProduct {
        product_code: product_code.clone(),
        jan_code: req.jan_code.clone(),
        name: req.name.clone(),
        department_id: req.department_id,
        supplier_id: req.supplier_id,
        selling_price: req.selling_price,
        cost_price: req.cost_price,
        tax_rate: req.tax_rate.clone(),
        maker_code: req.maker_code.clone(),
        stock_quantity: req.initial_stock,
        stock_unit: req.stock_unit.clone(),
        is_discontinued: false,
        plu_dirty: true,
        plu_exported_at: None,
        plu_target: req.plu_target,
        pos_stock_sync: req.pos_stock_sync,
    };

    match product_repo::insert_product(&tx, &new_product) {
        Ok(()) => {}
        Err(DbError::DuplicateKey(_)) => {
            return Err(BizError::DuplicateProductCode(product_code));
        }
        Err(e) => return Err(BizError::DatabaseError(e)),
    }

    #[cfg(test)]
    if failpoint::CREATE_PRODUCT_AFTER_INSERT.load(std::sync::atomic::Ordering::SeqCst) {
        return Err(BizError::DatabaseError(DbError::QueryFailed(
            "failpoint: create_product_after_insert".into(),
        )));
    }

    // 5. 初期在庫の記録
    if req.initial_stock > 0 {
        let movement = NewMovement {
            product_code: product_code.clone(),
            movement_type: MovementType::Receiving,
            quantity: req.initial_stock,
            stock_after: req.initial_stock,
            reference_type: None,
            reference_id: None,
            note: Some("初期在庫投入".to_string()),
        };
        inventory_repo::insert_movement(&tx, &movement)?;
    }

    #[cfg(test)]
    if failpoint::CREATE_PRODUCT_AFTER_MOVEMENT.load(std::sync::atomic::Ordering::SeqCst) {
        return Err(BizError::DatabaseError(DbError::QueryFailed(
            "failpoint: create_product_after_movement".into(),
        )));
    }

    // 6. 棚卸し中チェック＋自動追加
    if let Some(stocktake) = stocktake_repo::find_active_stocktake(&tx)? {
        let item = NewStocktakeItem {
            stocktake_id: stocktake.id,
            product_code: product_code.clone(),
            system_stock: req.initial_stock,
            actual_count: None,
        };
        stocktake_repo::insert_stocktake_item(&tx, &item)?;
    }

    // 7. 操作ログ
    let log = NewOperationLog {
        operation_type: "product_create".to_string(),
        summary: format!("商品を登録しました: {} ({})", req.name, product_code),
        detail_json: None,
    };
    system_repo::insert_operation_log(&tx, &log)?;

    // 8. COMMIT
    tx.commit()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    Ok(ProductCreateResult {
        product_code,
        warnings: vec![],
    })
}

/// 商品情報を更新する（FUNC-4.4）
///
/// 売価/原価が変わった場合は price_history に記録し、売価変更時は plu_dirty=true。
pub fn update_product(
    conn: &mut DbConnection,
    product_code: &str,
    req: &ProductUpdateRequest,
) -> Result<ProductUpdateResult, BizError> {
    // 1. 既存商品の取得
    let existing = product_repo::find_by_product_code(conn, product_code)?
        .ok_or_else(|| BizError::NotFound("商品が見つかりません".to_string()))?;

    // 2. バリデーション
    validate_update_request(req, conn)?;

    // 3. BEGIN
    let tx = conn
        .transaction()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    // 4. 価格変更チェック + price_history
    let new_selling = req.selling_price.unwrap_or(existing.product.selling_price);
    let new_cost = req.cost_price.unwrap_or(existing.product.cost_price);
    let selling_changed =
        req.selling_price.is_some() && req.selling_price != Some(existing.product.selling_price);
    let cost_changed =
        req.cost_price.is_some() && req.cost_price != Some(existing.product.cost_price);

    if selling_changed || cost_changed {
        let history = NewPriceHistory {
            product_code: product_code.to_string(),
            old_selling: existing.product.selling_price,
            new_selling,
            old_cost: existing.product.cost_price,
            new_cost,
        };
        product_repo::insert_price_history(&tx, &history)?;
    }

    #[cfg(test)]
    if failpoint::UPDATE_PRODUCT_AFTER_PRICE_HISTORY.load(std::sync::atomic::Ordering::SeqCst) {
        return Err(BizError::DatabaseError(DbError::QueryFailed(
            "failpoint: update_product_after_price_history".into(),
        )));
    }

    // 5. products UPDATE（plu_dirty は売価変更時、またはPLU対象化時のみ true）
    let plu_target_enabled = req.plu_target == Some(true) && !existing.product.plu_target;
    let mut updates = ProductUpdates {
        name: req.name.clone(),
        department_id: req.department_id,
        supplier_id: req.supplier_id,
        selling_price: req.selling_price,
        cost_price: req.cost_price,
        tax_rate: req.tax_rate.clone(),
        maker_code: req.maker_code.clone(),
        pos_stock_sync: req.pos_stock_sync,
        plu_target: req.plu_target,
        ..Default::default()
    };
    if selling_changed || plu_target_enabled {
        updates.plu_dirty = Some(true);
    }

    product_repo::update_product(&tx, product_code, &updates)?;

    // 6. 操作ログ
    // 変更前後をJSON記録（30-biz-product-service.md §4.4 ステップ6）
    let detail = if selling_changed || cost_changed {
        Some(format!(
            r#"{{"selling_price":{{"old":{},"new":{}}},"cost_price":{{"old":{},"new":{}}}}}"#,
            existing.product.selling_price, new_selling, existing.product.cost_price, new_cost
        ))
    } else {
        None
    };
    let log = NewOperationLog {
        operation_type: "product_update".to_string(),
        summary: format!("商品を更新しました: {}", product_code),
        detail_json: detail,
    };
    system_repo::insert_operation_log(&tx, &log)?;

    // 7. COMMIT
    tx.commit()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    Ok(ProductUpdateResult { warnings: vec![] })
}

/// 商品の廃番フラグを反転する（FUNC-4.5）
pub fn toggle_discontinue(conn: &mut DbConnection, product_code: &str) -> Result<bool, BizError> {
    let existing = product_repo::find_by_product_code(conn, product_code)?
        .ok_or_else(|| BizError::NotFound("商品が見つかりません".to_string()))?;

    let new_status = !existing.product.is_discontinued;

    let tx = conn
        .transaction()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    let updates = ProductUpdates {
        is_discontinued: Some(new_status),
        plu_dirty: Some(true),
        ..Default::default()
    };
    product_repo::update_product(&tx, product_code, &updates)?;

    let action = if new_status { "廃番" } else { "復帰" };
    let log = NewOperationLog {
        operation_type: "product_discontinue".to_string(),
        summary: format!("商品を{}しました: {}", action, product_code),
        detail_json: None,
    };
    system_repo::insert_operation_log(&tx, &log)?;

    tx.commit()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    Ok(new_status)
}

/// 商品コードで商品詳細を取得する
///
/// CMD-01 get_product 用。BIZ層ではロジックなし。IO層のラッパー。
pub fn get_product(
    conn: &DbConnection,
    product_code: &str,
) -> Result<ProductWithRelations, BizError> {
    product_repo::find_by_product_code(conn, product_code)?
        .ok_or_else(|| BizError::NotFound(format!("商品が見つかりません: {}", product_code)))
}

/// 検索条件に基づいて商品一覧を取得する（FUNC-4.6）
///
/// BIZ層では追加の業務ロジックなし。IO層のラッパー。
pub fn search_products(
    conn: &DbConnection,
    query: ProductSearchQuery,
) -> Result<PaginatedResult<ProductWithRelations>, BizError> {
    product_repo::search_products(conn, &query).map_err(BizError::from)
}

/// 部門選択候補を全件取得する（FUNC-4.7 / UI-01a-D7）
///
/// BIZ層では追加の業務ロジックなし。検索結果から候補を派生せず、IO層の部門 master data を返す。
pub fn list_departments(conn: &DbConnection) -> Result<Vec<product_repo::Department>, BizError> {
    product_repo::list_departments(conn).map_err(BizError::from)
}

/// 取引先選択候補を全件取得する（FUNC-4.7.1 / UI-01b-D7）
///
/// BIZ層では追加の業務ロジックなし。商品や検索結果から候補を派生せず、IO層の取引先 master data を返す。
pub fn list_suppliers(conn: &DbConnection) -> Result<Vec<product_repo::Supplier>, BizError> {
    product_repo::list_suppliers(conn).map_err(BizError::from)
}

/// 商品の在庫詳細を取得する（最終入庫日・最終販売日付き）
///
/// 44-cmd-inventory.md §23.8 get_stock_detail
pub fn get_stock_detail(
    conn: &DbConnection,
    product_code: &str,
) -> Result<product_repo::StockDetail, BizError> {
    product_repo::get_stock_detail(conn, product_code).map_err(|e| match e {
        DbError::NotFound => BizError::NotFound(format!("商品が見つかりません: {}", product_code)),
        other => BizError::from(other),
    })
}

/// 在庫が閾値以下の商品を一覧取得する
///
/// 44-cmd-inventory.md §23.8 list_low_stock
/// 閾値は app_settings から取得し、未設定時はデフォルト値を使用する
pub fn list_low_stock(
    conn: &DbConnection,
    include_discontinued: bool,
) -> Result<Vec<ProductWithRelations>, BizError> {
    let threshold_pcs = system_repo::get_setting(conn, "stock_low_threshold")?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(3);
    let threshold_cm = system_repo::get_setting(conn, "stock_low_threshold_fabric")?
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(500);
    Ok(product_repo::list_low_stock_products(
        conn,
        threshold_pcs,
        threshold_cm,
        include_discontinued,
    )?)
}

// ---------------------------------------------------------------------------
// バリデーション（内部関数）
// ---------------------------------------------------------------------------

fn should_default_plu_target(jan_code: Option<&str>) -> bool {
    jan_code.is_some_and(|jan| jan.len() == 13 && jan.chars().all(|ch| ch.is_ascii_digit()))
}

fn validate_create_request(
    req: &ProductCreateRequest,
    conn: &DbConnection,
) -> Result<(), BizError> {
    if req.name.trim().is_empty() {
        return Err(BizError::ValidationFailed("商品名は必須です".to_string()));
    }
    if req.selling_price < 0 {
        return Err(BizError::ValidationFailed(
            "売価は0以上で入力してください".to_string(),
        ));
    }
    if req.cost_price < 0 {
        return Err(BizError::ValidationFailed(
            "原価は0以上で入力してください".to_string(),
        ));
    }
    if !["10", "8", "0"].contains(&req.tax_rate.as_str()) {
        return Err(BizError::ValidationFailed("税率が不正です".to_string()));
    }
    if !["pcs", "cm"].contains(&req.stock_unit.as_str()) {
        return Err(BizError::ValidationFailed("数量単位が不正です".to_string()));
    }
    if req.initial_stock < 0 {
        return Err(BizError::ValidationFailed(
            "初期在庫は0以上で入力してください".to_string(),
        ));
    }
    // department 存在チェック
    if product_repo::find_department_by_id(conn, req.department_id)?.is_none() {
        return Err(BizError::ValidationFailed(
            "指定された部門が存在しません".to_string(),
        ));
    }
    // supplier 存在チェック（指定時のみ）
    if let Some(supplier_id) = req.supplier_id {
        let suppliers = product_repo::list_suppliers(conn)?;
        if !suppliers.iter().any(|s| s.id == supplier_id) {
            return Err(BizError::ValidationFailed(
                "指定された取引先が存在しません".to_string(),
            ));
        }
    }
    Ok(())
}

fn validate_update_request(
    req: &ProductUpdateRequest,
    conn: &DbConnection,
) -> Result<(), BizError> {
    if let Some(ref name) = req.name {
        if name.trim().is_empty() {
            return Err(BizError::ValidationFailed("商品名は必須です".to_string()));
        }
    }
    if let Some(price) = req.selling_price {
        if price < 0 {
            return Err(BizError::ValidationFailed(
                "売価は0以上で入力してください".to_string(),
            ));
        }
    }
    if let Some(cost) = req.cost_price {
        if cost < 0 {
            return Err(BizError::ValidationFailed(
                "原価は0以上で入力してください".to_string(),
            ));
        }
    }
    if let Some(ref rate) = req.tax_rate {
        if !["10", "8", "0"].contains(&rate.as_str()) {
            return Err(BizError::ValidationFailed("税率が不正です".to_string()));
        }
    }
    if let Some(dept_id) = req.department_id {
        if product_repo::find_department_by_id(conn, dept_id)?.is_none() {
            return Err(BizError::ValidationFailed(
                "指定された部門が存在しません".to_string(),
            ));
        }
    }
    if let Some(Some(supplier_id)) = req.supplier_id {
        let suppliers = product_repo::list_suppliers(conn)?;
        if !suppliers.iter().any(|s| s.id == supplier_id) {
            return Err(BizError::ValidationFailed(
                "指定された取引先が存在しません".to_string(),
            ));
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// 一括インポート（BIZ-01 §4.7-4.8）
// ---------------------------------------------------------------------------

/// 一括インポート用行データ
///
/// オプション項目は None = CSV に値なし。デフォルト化は commit_import の INSERT 時のみ。
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ImportRow {
    pub line_no: usize,
    pub product_code: String,
    pub name: String,
    pub department_id: i64,
    pub selling_price: i64,
    pub cost_price: i64,
    pub tax_rate: String,
    pub stock_unit: Option<String>,
    pub initial_stock: Option<i64>,
    pub jan_code: Option<String>,
    pub maker_code: Option<String>,
    pub supplier_id: Option<i64>,
    pub pos_stock_sync: Option<bool>,
}

/// バリデーションエラー行
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct ImportErrorRow {
    pub line_no: usize,
    pub raw_data: std::collections::HashMap<String, String>,
    pub errors: Vec<String>,
}

/// 重複行（product_code が既存）
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct ImportDuplicateRow {
    pub line_no: usize,
    pub import_row: ImportRow,
    pub existing_product_code: String,
}

/// インポートプレビュー結果
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct ImportPreview {
    pub valid_rows: Vec<ImportRow>,
    pub error_rows: Vec<ImportErrorRow>,
    pub duplicate_rows: Vec<ImportDuplicateRow>,
}

/// インポート結果
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct ProductImportResult {
    pub created_count: usize,
    pub updated_count: usize,
    pub skipped_count: usize,
}

/// 商品マスタCSVファイルをプレビューする（読み取り専用、DB書込みなし）
///
/// 30-biz-product-service.md §4.7
pub fn preview_import(conn: &DbConnection, file_bytes: &[u8]) -> Result<ImportPreview, BizError> {
    // 1. IO-03 呼出し
    let parse_result = crate::io::product_csv_importer::parse_product_csv(file_bytes)
        .map_err(BizError::ImportError)?;

    // 2. ヘッダ検証
    let required_headers = ["商品コード", "商品名", "部門ID", "売価", "原価", "税率"];
    let missing: Vec<&str> = required_headers
        .iter()
        .filter(|h| !parse_result.headers.contains(&h.to_string()))
        .copied()
        .collect();
    if !missing.is_empty() {
        return Err(BizError::ImportError(format!(
            "必須列が不足しています: {}",
            missing.join(", ")
        )));
    }

    // 部門リストをキャッシュ（N+1回避）
    let departments = product_repo::list_departments(conn)?;
    let dept_ids: std::collections::HashSet<i64> = departments.iter().map(|d| d.id).collect();

    // 取引先リストをキャッシュ
    let suppliers = product_repo::list_suppliers(conn)?;
    let supplier_ids: std::collections::HashSet<i64> = suppliers.iter().map(|s| s.id).collect();

    let mut valid_rows = Vec::new();
    let mut error_rows = Vec::new();
    let mut duplicate_rows = Vec::new();

    // #2 (P1): IO-03 の parse_errors を error_rows にマージ
    for parse_err in &parse_result.parse_errors {
        error_rows.push(ImportErrorRow {
            line_no: parse_err.line_no,
            raw_data: std::collections::HashMap::new(),
            errors: vec![parse_err.error_message.clone()],
        });
    }

    // #5 (P2): CSV内重複検出用
    let mut seen_codes: std::collections::HashSet<String> = std::collections::HashSet::new();

    for row in &parse_result.rows {
        let line_no = row.line_no; // IO-03 が保持する元CSVの行番号
        let mut errors = Vec::new();

        // 3. 各行バリデーション
        let product_code = row.fields.get("商品コード").cloned().unwrap_or_default();
        if product_code.is_empty() {
            errors.push("商品コードが空です".to_string());
        }

        // #5 (P2): CSV内重複チェック
        if !product_code.is_empty() && !seen_codes.insert(product_code.clone()) {
            errors.push("CSV内で商品コードが重複しています".to_string());
        }

        let name = row.fields.get("商品名").cloned().unwrap_or_default();
        if name.is_empty() {
            errors.push("商品名が空です".to_string());
        }

        let department_id = row.fields.get("部門ID").and_then(|v| v.parse::<i64>().ok());
        match department_id {
            None => errors.push("部門IDが不正です".to_string()),
            Some(id) if !dept_ids.contains(&id) => {
                errors.push(format!("部門ID {} が存在しません", id));
            }
            _ => {}
        }

        let selling_price = row.fields.get("売価").and_then(|v| v.parse::<i64>().ok());
        match selling_price {
            None => errors.push("売価が不正です".to_string()),
            Some(p) if p < 0 => errors.push("売価は0以上で入力してください".to_string()),
            _ => {}
        }

        let cost_price = row.fields.get("原価").and_then(|v| v.parse::<i64>().ok());
        match cost_price {
            None => errors.push("原価が不正です".to_string()),
            Some(p) if p < 0 => errors.push("原価は0以上で入力してください".to_string()),
            _ => {}
        }

        let tax_rate = row.fields.get("税率").cloned().unwrap_or_default();
        if !["10", "8", "0"].contains(&tax_rate.as_str()) {
            errors.push("税率は '10', '8', '0' のいずれかで入力してください".to_string());
        }

        // オプション項目（R2-5: None のまま保持、デフォルト化しない）
        // #3 (P2): 値あり+parse失敗をサイレント None にせずエラー化
        let stock_unit =
            row.fields
                .get("在庫単位")
                .and_then(|v| if v.is_empty() { None } else { Some(v.clone()) });

        let initial_stock = match row.fields.get("初期在庫") {
            Some(v) if !v.is_empty() => match v.parse::<i64>() {
                Ok(n) => Some(n),
                Err(_) => {
                    errors.push(format!("初期在庫の値が不正です: '{}'", v));
                    None
                }
            },
            _ => None,
        };

        let jan_code =
            row.fields
                .get("JANコード")
                .and_then(|v| if v.is_empty() { None } else { Some(v.clone()) });
        let maker_code = row.fields.get("メーカー品番").and_then(|v| {
            if v.is_empty() {
                None
            } else {
                Some(v.clone())
            }
        });

        let supplier_id = match row.fields.get("取引先ID") {
            Some(v) if !v.is_empty() => match v.parse::<i64>() {
                Ok(n) => Some(n),
                Err(_) => {
                    errors.push(format!("取引先IDの値が不正です: '{}'", v));
                    None
                }
            },
            _ => None,
        };

        let pos_stock_sync = match row.fields.get("POS在庫連動") {
            Some(v) if !v.is_empty() => match v.as_str() {
                "1" | "true" | "はい" => Some(true),
                "0" | "false" | "いいえ" => Some(false),
                _ => {
                    errors.push(format!(
                        "POS在庫連動の値が不正です: '{}' (1/0/true/false)",
                        v
                    ));
                    None
                }
            },
            _ => None,
        };

        // supplier_id 存在確認（R2-6対応）
        if let Some(sid) = supplier_id {
            if !supplier_ids.contains(&sid) {
                errors.push(format!("取引先ID {} が存在しません", sid));
            }
        }

        if !errors.is_empty() {
            error_rows.push(ImportErrorRow {
                line_no,
                raw_data: row.fields.clone(),
                errors,
            });
            continue;
        }

        let import_row = ImportRow {
            line_no,
            product_code: product_code.clone(),
            name,
            department_id: department_id.unwrap(),
            selling_price: selling_price.unwrap(),
            cost_price: cost_price.unwrap(),
            tax_rate,
            stock_unit,
            initial_stock,
            jan_code,
            maker_code,
            supplier_id,
            pos_stock_sync,
        };

        // 4. 重複チェック
        match product_repo::find_by_product_code(conn, &product_code)? {
            Some(_) => {
                duplicate_rows.push(ImportDuplicateRow {
                    line_no,
                    import_row,
                    existing_product_code: product_code,
                });
            }
            None => {
                valid_rows.push(import_row);
            }
        }
    }

    Ok(ImportPreview {
        valid_rows,
        error_rows,
        duplicate_rows,
    })
}

/// プレビュー済みの行をDBに一括登録する（TX）
///
/// 30-biz-product-service.md §4.8
/// create_product / update_product のBIZ関数はネストTXを発生させるため、
/// 直接 repo 関数を呼ぶ。price_history は記録しない。
pub fn commit_import(
    conn: &mut DbConnection,
    valid_rows: Vec<ImportRow>,
    overwrite_codes: Vec<String>,
) -> Result<ProductImportResult, BizError> {
    let overwrite_set: std::collections::HashSet<String> = overwrite_codes.into_iter().collect();

    // 1. TX開始
    let tx = conn
        .transaction()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    let mut created_count = 0usize;
    let mut updated_count = 0usize;
    let mut skipped_count = 0usize;

    // 進行中棚卸しのチェック（TX内で1回だけ）
    let active_stocktake = stocktake_repo::find_active_stocktake(&tx)?;

    for row in &valid_rows {
        if overwrite_set.contains(&row.product_code) {
            // UPDATE: ImportRow → ProductUpdates マッピング（R2-1 + R3-1修正）
            let updates = ProductUpdates {
                name: Some(row.name.clone()),
                department_id: Some(row.department_id),
                selling_price: Some(row.selling_price),
                cost_price: Some(row.cost_price),
                tax_rate: Some(row.tax_rate.clone()),
                stock_unit: row.stock_unit.clone(),
                supplier_id: row.supplier_id.map(Some),
                maker_code: row.maker_code.clone().map(Some),
                pos_stock_sync: row.pos_stock_sync,
                plu_dirty: Some(true),
                stock_quantity: None,
                is_discontinued: None,
                plu_exported_at: None,
                plu_target: None,
            };
            // #4 (P2): 戻り値チェック。対象が存在しない場合はスキップ
            let updated = product_repo::update_product(&tx, &row.product_code, &updates)?;
            if updated {
                updated_count += 1;
            } else {
                skipped_count += 1;
            }
        } else {
            // INSERT: デフォルト化は INSERT 時のみ（R2-5対応）
            let stock_unit = row.stock_unit.clone().unwrap_or_else(|| "pcs".to_string());
            let initial_stock = row.initial_stock.unwrap_or(0);
            let pos_stock_sync = row.pos_stock_sync.unwrap_or(true);

            let new_product = NewProduct {
                product_code: row.product_code.clone(),
                jan_code: row.jan_code.clone(),
                name: row.name.clone(),
                department_id: row.department_id,
                supplier_id: row.supplier_id,
                selling_price: row.selling_price,
                cost_price: row.cost_price,
                tax_rate: row.tax_rate.clone(),
                maker_code: row.maker_code.clone(),
                stock_quantity: initial_stock,
                stock_unit,
                is_discontinued: false,
                plu_dirty: true,
                plu_exported_at: None,
                plu_target: should_default_plu_target(row.jan_code.as_deref()),
                pos_stock_sync,
            };
            product_repo::insert_product(&tx, &new_product)?;

            // 初期在庫 > 0 → movement 記録
            if initial_stock > 0 {
                inventory_repo::insert_movement(
                    &tx,
                    &NewMovement {
                        product_code: row.product_code.clone(),
                        movement_type: MovementType::Receiving,
                        quantity: initial_stock,
                        stock_after: initial_stock,
                        reference_type: None,
                        reference_id: None,
                        note: Some("一括インポートによる初期在庫".to_string()),
                    },
                )?;
            }

            // 進行中棚卸し → stocktake_item 自動追加
            if let Some(ref st) = active_stocktake {
                stocktake_repo::insert_stocktake_item(
                    &tx,
                    &NewStocktakeItem {
                        stocktake_id: st.id,
                        product_code: row.product_code.clone(),
                        system_stock: initial_stock,
                        actual_count: None,
                    },
                )?;
            }

            created_count += 1;
        }
    }

    // 3. COMMIT
    tx.commit()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    // 4. TX外: 操作ログ記録
    let detail = serde_json::json!({
        "created_count": created_count,
        "updated_count": updated_count,
    })
    .to_string();
    let log = NewOperationLog {
        operation_type: "product_import".to_string(),
        summary: format!(
            "商品一括インポート: 新規{}件、更新{}件",
            created_count, updated_count
        ),
        detail_json: Some(detail),
    };
    if let Err(e) = system_repo::insert_operation_log(conn, &log) {
        tracing::warn!(error = %e, "操作ログ記録に失敗");
    }

    Ok(ProductImportResult {
        created_count,
        updated_count,
        skipped_count,
    })
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_database;
    use serial_test::serial;

    fn setup_test_db() -> (tempfile::TempDir, DbConnection) {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = init_database(db_path.to_str().unwrap()).unwrap();
        (dir, conn)
    }

    fn default_create_request() -> ProductCreateRequest {
        ProductCreateRequest {
            jan_code: None,
            name: "テスト商品".to_string(),
            department_id: 2, // ヘア雑貨（code_prefix=HZ）
            selling_price: 500,
            cost_price: 300,
            tax_rate: "10".to_string(),
            stock_unit: "pcs".to_string(),
            initial_stock: 0,
            maker_code: None,
            supplier_id: None,
            pos_stock_sync: true,
            plu_target: false,
        }
    }

    // ===== FUNC-4.3: generate_custom_code テスト =====

    #[test]
    #[serial]
    fn test_generate_custom_code_req101_normal() {
        // REQ-101: 独自コード発番 — 正常発番（HZ-0001 形式）
        // FUNC-4.3: 正常発番 — HZ-0001 形式
        let (_dir, mut conn) = setup_test_db();
        let tx = conn.transaction().unwrap();
        let code = generate_custom_code(&tx, 2).unwrap(); // ヘア雑貨
        assert_eq!(code, "HZ-0001");
        tx.commit().unwrap();
    }

    #[test]
    #[serial]
    fn test_generate_custom_code_req101_no_prefix() {
        // REQ-101: 独自コード発番 — code_prefix=NULLの部門はValidationFailed
        // FUNC-4.3: code_prefix=NULL の部門 → ValidationFailed
        let (_dir, mut conn) = setup_test_db();
        let tx = conn.transaction().unwrap();
        let result = generate_custom_code(&tx, 3); // 毛糸（code_prefix=NULL）
        assert!(
            matches!(result, Err(BizError::ValidationFailed(_))),
            "code_prefix=NULLで ValidationFailed: {:?}",
            result
        );
    }

    #[test]
    #[serial]
    fn test_generate_custom_code_req101_sequential() {
        // REQ-101: 独自コード発番 — 連番インクリメント（HZ-0001, HZ-0002）
        // FUNC-4.3: 連番 — 2回呼んで HZ-0001, HZ-0002
        let (_dir, mut conn) = setup_test_db();
        let tx = conn.transaction().unwrap();
        let code1 = generate_custom_code(&tx, 2).unwrap();
        // code1 の商品を INSERT して重複チェックを通す
        let p = NewProduct {
            product_code: code1.clone(),
            jan_code: None,
            name: "テスト1".to_string(),
            department_id: 2,
            supplier_id: None,
            selling_price: 100,
            cost_price: 50,
            tax_rate: "10".to_string(),
            maker_code: None,
            stock_quantity: 0,
            stock_unit: "pcs".to_string(),
            is_discontinued: false,
            plu_dirty: true,
            plu_exported_at: None,
            plu_target: true,
            pos_stock_sync: true,
        };
        product_repo::insert_product(&tx, &p).unwrap();
        let code2 = generate_custom_code(&tx, 2).unwrap();
        assert_eq!(code1, "HZ-0001");
        assert_eq!(code2, "HZ-0002");
        tx.commit().unwrap();
    }

    // ===== FUNC-4.2: create_product テスト =====

    #[test]
    #[serial]
    fn test_create_product_req101_jan() {
        // REQ-101: JAN有りで正常登録
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.jan_code = Some("4976383262108".to_string());
        req.name = "ハマナカ アミアミ極太".to_string();
        req.department_id = 3; // 毛糸

        let result = create_product(&mut conn, req).unwrap();
        assert_eq!(result.product_code, "4976383262108");
    }

    #[test]
    #[serial]
    fn test_create_product_req101_custom_code() {
        // REQ-101: JAN無しで独自コード発番
        let (_dir, mut conn) = setup_test_db();
        let req = default_create_request(); // jan_code=None, department=ヘア雑貨

        let result = create_product(&mut conn, req).unwrap();
        assert_eq!(result.product_code, "HZ-0001");
    }

    #[test]
    #[serial]
    fn test_create_product_req101_stores_plu_target_from_request() {
        // REQ-101 / REQ-402: 商品登録時のPLU対象フラグはrequest値を保存する。
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.jan_code = Some("CREATE-PLU-TARGET".to_string());
        req.department_id = 3;
        req.plu_target = true;

        let result = create_product(&mut conn, req).unwrap();

        let found = product_repo::find_by_product_code(&conn, &result.product_code)
            .unwrap()
            .unwrap();
        assert!(found.product.plu_target);
    }

    #[test]
    #[serial]
    fn test_create_product_req101_initial_stock() {
        // REQ-101: 初期在庫ありで inventory_movements が記録される
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.initial_stock = 10;

        let result = create_product(&mut conn, req).unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM inventory_movements WHERE product_code = ?1",
                rusqlite::params![result.product_code],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "初期在庫の inventory_movement が記録されるべき");
    }

    #[test]
    #[serial]
    fn test_create_product_req101_stocktake_auto_add() {
        // REQ-101: 棚卸し中に商品登録で stocktake_items 自動追加
        let (_dir, mut conn) = setup_test_db();

        // 棚卸し開始（直接SQL）
        conn.execute(
            "INSERT INTO stocktakes (started_at, status) VALUES ('2026-10-01T09:00:00', 'in_progress')",
            [],
        )
        .unwrap();

        let req = default_create_request();
        let result = create_product(&mut conn, req).unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM stocktake_items WHERE product_code = ?1",
                rusqlite::params![result.product_code],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "棚卸し中は stocktake_items に自動追加");
    }

    #[test]
    #[serial]
    fn test_create_product_req101_operation_log() {
        // REQ-101: operation_logs に product_create が記録される
        let (_dir, mut conn) = setup_test_db();
        let req = default_create_request();
        create_product(&mut conn, req).unwrap();

        let op_type: String = conn
            .query_row(
                "SELECT operation_type FROM operation_logs ORDER BY id DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(op_type, "product_create");
    }

    #[test]
    #[serial]
    fn test_create_product_req101_validation_name_empty() {
        // REQ-101: 商品登録 — 商品名空はValidationFailed
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.name = "".to_string();
        let result = create_product(&mut conn, req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    #[serial]
    fn test_create_product_req101_validation_selling_price_negative() {
        // REQ-101: 商品登録 — 売価マイナスはValidationFailed
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.selling_price = -1;
        let result = create_product(&mut conn, req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    #[serial]
    fn test_create_product_req101_validation_cost_price_negative() {
        // REQ-101: 商品登録 — 原価マイナスはValidationFailed
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.cost_price = -1;
        let result = create_product(&mut conn, req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    #[serial]
    fn test_create_product_req101_validation_tax_rate_invalid() {
        // REQ-101: 商品登録 — 不正税率はValidationFailed
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.tax_rate = "15".to_string();
        let result = create_product(&mut conn, req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    #[serial]
    fn test_create_product_req101_validation_stock_unit_invalid() {
        // REQ-101: 商品登録 — 不正数量単位はValidationFailed
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.stock_unit = "kg".to_string();
        let result = create_product(&mut conn, req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    #[serial]
    fn test_create_product_req101_validation_department_not_found() {
        // REQ-101: 商品登録 — 存在しない部門IDはValidationFailed
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.department_id = 9999;
        let result = create_product(&mut conn, req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    #[serial]
    fn test_create_product_req101_validation_supplier_not_found() {
        // REQ-101: 商品登録 — 存在しない取引先IDはValidationFailed
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.supplier_id = Some(9999);
        let result = create_product(&mut conn, req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    #[serial]
    fn test_create_product_req101_duplicate_jan() {
        // REQ-101: 商品登録 — JANコード重複はDuplicateProductCode
        // 事前チェックで重複検出
        let (_dir, mut conn) = setup_test_db();
        let mut req1 = default_create_request();
        req1.jan_code = Some("4976383262108".to_string());
        req1.department_id = 3;
        create_product(&mut conn, req1).unwrap();

        let mut req2 = default_create_request();
        req2.jan_code = Some("4976383262108".to_string());
        req2.department_id = 3;
        let result = create_product(&mut conn, req2);
        assert!(matches!(result, Err(BizError::DuplicateProductCode(_))));
    }

    #[test]
    #[serial]
    fn test_create_product_req101_duplicate_key_from_insert() {
        // REQ-101: 商品登録 — INSERT時DuplicateKeyはDuplicateProductCodeに正規化
        // INSERT 時の DuplicateKey → DuplicateProductCode に正規化
        let (_dir, mut conn) = setup_test_db();

        // 直接 IO 層で商品を挿入（BIZ 層の重複チェックをバイパス）
        let p = NewProduct {
            product_code: "HZ-0001".to_string(),
            jan_code: None,
            name: "先行登録".to_string(),
            department_id: 2,
            supplier_id: None,
            selling_price: 100,
            cost_price: 50,
            tax_rate: "10".to_string(),
            maker_code: None,
            stock_quantity: 0,
            stock_unit: "pcs".to_string(),
            is_discontinued: false,
            plu_dirty: true,
            plu_exported_at: None,
            plu_target: true,
            pos_stock_sync: true,
        };
        product_repo::insert_product(&conn, &p).unwrap();

        // BIZ 層で同じ product_code になるリクエスト（独自コード発番で HZ-0001）
        let req = default_create_request(); // department=2(HZ), next_seq=1 → HZ-0001
        let result = create_product(&mut conn, req);
        assert!(
            matches!(result, Err(BizError::DuplicateProductCode(_))),
            "INSERT時のDuplicateKeyがDuplicateProductCodeに正規化されるべき: {:?}",
            result
        );
    }

    #[test]
    #[serial]
    fn test_create_product_req101_rollback_after_insert() {
        // REQ-101: 商品登録 — INSERT後failpointでロールバック → productsに残らない
        // TX rollback: INSERT 後に failpoint で失敗 → products に残らない
        let (_dir, mut conn) = setup_test_db();
        let _guard = failpoint::arm(&failpoint::CREATE_PRODUCT_AFTER_INSERT);

        let req = default_create_request();
        let result = create_product(&mut conn, req);
        assert!(result.is_err());

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM products", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0, "rollback で products に商品が残っていないこと");

        // next_seq も巻き戻る（TX内で increment されたが rollback）
        let dept = product_repo::find_department_by_id(&conn, 2)
            .unwrap()
            .unwrap();
        assert_eq!(dept.next_seq, 1, "next_seq が巻き戻っているべき");
    }

    #[test]
    #[serial]
    fn test_create_product_req101_rollback_after_movement() {
        // REQ-101: 商品登録 — movement挿入後failpointでロールバック → 全行巻き戻る
        // TX深層rollback: movement 挿入後に failpoint → 全て巻き戻る
        let (_dir, mut conn) = setup_test_db();
        let _guard = failpoint::arm(&failpoint::CREATE_PRODUCT_AFTER_MOVEMENT);

        let mut req = default_create_request();
        req.initial_stock = 10; // movement を発生させる
        let result = create_product(&mut conn, req);
        assert!(result.is_err());

        let prod_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM products", [], |row| row.get(0))
            .unwrap();
        let mov_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM inventory_movements", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(prod_count, 0, "products が巻き戻っていること");
        assert_eq!(mov_count, 0, "inventory_movements が巻き戻っていること");
    }

    // ===== FUNC-4.4: update_product テスト =====

    #[test]
    #[serial]
    fn test_update_product_req102_price_change() {
        // REQ-102: 売価変更で price_history 記録 + plu_dirty=true
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.jan_code = Some("UP-PRICE".to_string());
        req.department_id = 3;
        create_product(&mut conn, req).unwrap();

        let update_req = ProductUpdateRequest {
            selling_price: Some(999),
            ..Default::default()
        };
        update_product(&mut conn, "UP-PRICE", &update_req).unwrap();

        // price_history が記録された
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM price_history WHERE product_code = 'UP-PRICE'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        // plu_dirty=true
        let found = product_repo::find_by_product_code(&conn, "UP-PRICE")
            .unwrap()
            .unwrap();
        assert!(found.product.plu_dirty);
    }

    #[test]
    #[serial]
    fn test_update_product_req102_cost_only_no_plu_dirty() {
        // REQ-102: 原価のみ変更で price_history あり、plu_dirty 変更なし
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.jan_code = Some("UP-COST".to_string());
        req.department_id = 3;
        create_product(&mut conn, req).unwrap();

        // plu_dirty を false にリセット
        product_repo::update_product(
            &conn,
            "UP-COST",
            &ProductUpdates {
                plu_dirty: Some(false),
                ..Default::default()
            },
        )
        .unwrap();

        let update_req = ProductUpdateRequest {
            cost_price: Some(999),
            ..Default::default()
        };
        update_product(&mut conn, "UP-COST", &update_req).unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM price_history WHERE product_code = 'UP-COST'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "price_history が記録されるべき");

        let found = product_repo::find_by_product_code(&conn, "UP-COST")
            .unwrap()
            .unwrap();
        assert!(
            !found.product.plu_dirty,
            "原価のみ変更では plu_dirty は変わらない"
        );
    }

    #[test]
    #[serial]
    fn test_update_product_req102_sets_plu_dirty_when_plu_target_turns_on() {
        // REQ-102 / REQ-402: PLU対象 0→1 は未反映化し、1→0 は未反映を増やさない。
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.jan_code = Some("UP-PLU-TARGET".to_string());
        req.department_id = 3;
        req.plu_target = false;
        create_product(&mut conn, req).unwrap();

        product_repo::update_product(
            &conn,
            "UP-PLU-TARGET",
            &ProductUpdates {
                plu_dirty: Some(false),
                ..Default::default()
            },
        )
        .unwrap();

        update_product(
            &mut conn,
            "UP-PLU-TARGET",
            &ProductUpdateRequest {
                plu_target: Some(true),
                ..Default::default()
            },
        )
        .unwrap();
        let enabled = product_repo::find_by_product_code(&conn, "UP-PLU-TARGET")
            .unwrap()
            .unwrap();
        assert!(enabled.product.plu_target);
        assert!(enabled.product.plu_dirty);

        product_repo::update_product(
            &conn,
            "UP-PLU-TARGET",
            &ProductUpdates {
                plu_dirty: Some(false),
                ..Default::default()
            },
        )
        .unwrap();

        update_product(
            &mut conn,
            "UP-PLU-TARGET",
            &ProductUpdateRequest {
                plu_target: Some(false),
                ..Default::default()
            },
        )
        .unwrap();
        let disabled = product_repo::find_by_product_code(&conn, "UP-PLU-TARGET")
            .unwrap()
            .unwrap();
        assert!(!disabled.product.plu_target);
        assert!(!disabled.product.plu_dirty);
    }

    #[test]
    #[serial]
    fn test_update_product_req102_not_found() {
        // REQ-102: 商品更新 — 存在しない商品コードはNotFound
        let (_dir, mut conn) = setup_test_db();
        let req = ProductUpdateRequest {
            name: Some("存在しない".to_string()),
            ..Default::default()
        };
        let result = update_product(&mut conn, "NONEXISTENT", &req);
        assert!(matches!(result, Err(BizError::NotFound(_))));
    }

    #[test]
    #[serial]
    fn test_update_product_req102_validation_department_not_found() {
        // REQ-102: 商品更新 — 不正department_idはValidationFailed
        // update_product: 不正 department_id → ValidationFailed（P1レビュー指摘対応）
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.jan_code = Some("UP-DEPT".to_string());
        req.department_id = 3;
        create_product(&mut conn, req).unwrap();

        let update_req = ProductUpdateRequest {
            department_id: Some(9999),
            ..Default::default()
        };
        let result = update_product(&mut conn, "UP-DEPT", &update_req);
        assert!(
            matches!(result, Err(BizError::ValidationFailed(_))),
            "不正department_idでValidationFailed: {:?}",
            result
        );
    }

    #[test]
    #[serial]
    fn test_update_product_req102_validation_supplier_not_found() {
        // REQ-102: 商品更新 — 不正supplier_idはValidationFailed
        // update_product: 不正 supplier_id → ValidationFailed（P1レビュー指摘対応）
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.jan_code = Some("UP-SUP".to_string());
        req.department_id = 3;
        create_product(&mut conn, req).unwrap();

        let update_req = ProductUpdateRequest {
            supplier_id: Some(Some(9999)),
            ..Default::default()
        };
        let result = update_product(&mut conn, "UP-SUP", &update_req);
        assert!(
            matches!(result, Err(BizError::ValidationFailed(_))),
            "不正supplier_idでValidationFailed: {:?}",
            result
        );
    }

    #[test]
    #[serial]
    fn test_create_product_req101_validation_initial_stock_negative() {
        // REQ-101: 商品登録 — 初期在庫マイナスはValidationFailed
        // create_product: initial_stock < 0 → ValidationFailed（P2レビュー指摘対応）
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.initial_stock = -1;
        let result = create_product(&mut conn, req);
        assert!(
            matches!(result, Err(BizError::ValidationFailed(_))),
            "負の初期在庫でValidationFailed: {:?}",
            result
        );
    }

    #[test]
    #[serial]
    fn test_update_product_req102_detail_json_recorded() {
        // REQ-102: 商品更新 — 売価変更でdetail_jsonに変更前後が記録される
        // update_product: 売価変更で detail_json に変更前後が記録される（P2レビュー指摘対応）
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.jan_code = Some("UP-JSON".to_string());
        req.department_id = 3;
        create_product(&mut conn, req).unwrap();

        let update_req = ProductUpdateRequest {
            selling_price: Some(999),
            ..Default::default()
        };
        update_product(&mut conn, "UP-JSON", &update_req).unwrap();

        let detail: Option<String> = conn
            .query_row(
                "SELECT detail_json FROM operation_logs WHERE operation_type = 'product_update' ORDER BY id DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(detail.is_some(), "detail_json が記録されるべき");
        let json = detail.unwrap();
        assert!(json.contains("\"old\":500"), "変更前の売価が含まれるべき");
        assert!(json.contains("\"new\":999"), "変更後の売価が含まれるべき");
    }

    #[test]
    fn test_update_product_req102_deserialize_nullable_clear_fields() {
        // UI-01b-D5: CMD JSON の null は Option<Option<T>> の Some(None) として clear 意図を保持する。
        let req: ProductUpdateRequest =
            serde_json::from_str(r#"{"supplier_id":null,"maker_code":null}"#).unwrap();
        assert_eq!(req.supplier_id, Some(None));
        assert_eq!(req.maker_code, Some(None));

        let req: ProductUpdateRequest =
            serde_json::from_str(r#"{"supplier_id":3,"maker_code":"A-1"}"#).unwrap();
        assert_eq!(req.supplier_id, Some(Some(3)));
        assert_eq!(req.maker_code, Some(Some("A-1".to_string())));

        let req: ProductUpdateRequest = serde_json::from_str("{}").unwrap();
        assert_eq!(req.supplier_id, None);
        assert_eq!(req.maker_code, None);
    }

    #[test]
    #[serial]
    fn test_update_product_req102_rollback_after_price_history() {
        // REQ-102: 商品更新 — price_history INSERT後failpointでロールバック → 全行巻き戻る
        // TX rollback: price_history INSERT 後に failpoint → 全て巻き戻る
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.jan_code = Some("UP-RB".to_string());
        req.department_id = 3;
        create_product(&mut conn, req).unwrap();

        let _guard = failpoint::arm(&failpoint::UPDATE_PRODUCT_AFTER_PRICE_HISTORY);

        let update_req = ProductUpdateRequest {
            selling_price: Some(999),
            ..Default::default()
        };
        let result = update_product(&mut conn, "UP-RB", &update_req);
        assert!(result.is_err());

        // price_history が巻き戻っている
        let ph_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM price_history WHERE product_code = 'UP-RB'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(ph_count, 0, "price_history が巻き戻っているべき");

        // products の selling_price が変わっていない
        let found = product_repo::find_by_product_code(&conn, "UP-RB")
            .unwrap()
            .unwrap();
        assert_eq!(found.product.selling_price, 500, "selling_price が元のまま");
    }

    // ===== FUNC-4.5: toggle_discontinue テスト =====

    #[test]
    #[serial]
    fn test_toggle_discontinue_req102_to_discontinued() {
        // REQ-102: false→true（廃番化）
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.jan_code = Some("DISC-01".to_string());
        req.department_id = 3;
        create_product(&mut conn, req).unwrap();

        let new_status = toggle_discontinue(&mut conn, "DISC-01").unwrap();
        assert!(new_status, "廃番になるべき");

        let found = product_repo::find_by_product_code(&conn, "DISC-01")
            .unwrap()
            .unwrap();
        assert!(found.product.is_discontinued);
        assert!(found.product.plu_dirty);
    }

    #[test]
    #[serial]
    fn test_toggle_discontinue_req102_to_active() {
        // REQ-102: true→false（復帰）
        let (_dir, mut conn) = setup_test_db();
        let mut req = default_create_request();
        req.jan_code = Some("DISC-02".to_string());
        req.department_id = 3;
        create_product(&mut conn, req).unwrap();

        toggle_discontinue(&mut conn, "DISC-02").unwrap(); // → true
        let new_status = toggle_discontinue(&mut conn, "DISC-02").unwrap(); // → false
        assert!(!new_status, "復帰するべき");
    }

    #[test]
    #[serial]
    fn test_toggle_discontinue_req102_not_found() {
        // REQ-102: 廃番切替 — 存在しない商品コードはNotFound
        let (_dir, mut conn) = setup_test_db();
        let result = toggle_discontinue(&mut conn, "NONEXISTENT");
        assert!(matches!(result, Err(BizError::NotFound(_))));
    }

    // ===== FUNC-4.6: search_products テスト =====

    #[test]
    #[serial]
    fn test_search_products_req103_biz_wrapper() {
        // REQ-103: 商品検索 — BIZ層ラッパー経由の正常検索（結合確認）
        // BIZ経由の正常検索（結合確認）
        let (_dir, mut conn) = setup_test_db();
        let req = default_create_request();
        create_product(&mut conn, req).unwrap();

        let query = ProductSearchQuery {
            keyword: None,
            department_id: None,
            is_discontinued: None,
            sort_key: product_repo::SortKey::ProductCode,
            sort_order: product_repo::SortOrder::Asc,
            page: 1,
            per_page: 50,
        };
        let result = search_products(&conn, query).unwrap();
        assert_eq!(result.total_count, 1);
    }

    #[test]
    #[serial]
    fn test_list_departments_req103_biz_wrapper_returns_all_departments() {
        // REQ-103 / UI-01a-D7: 部門候補は search_products の現在ページではなく、
        // BIZ -> IO の list_departments から master data 全件を取得する。
        let (_dir, conn) = setup_test_db();

        let result = list_departments(&conn).unwrap();

        assert_eq!(result.len(), 21, "初期部門 master data 全件を返すべき");
        assert_eq!(result[0].id, 1, "ORDER BY id ASC を維持するべき");
        assert!(
            result.iter().any(|department| department.id == 21),
            "現在ページの検索結果ではなく全件候補であるべき"
        );
    }

    #[test]
    #[serial]
    fn test_list_suppliers_req101_biz_wrapper_returns_all_suppliers() {
        // REQ-101 / UI-01b-D7: 取引先候補は current product / current page ではなく、
        // BIZ -> IO の list_suppliers から master data 全件を取得する。
        let (_dir, conn) = setup_test_db();
        product_repo::find_or_create_supplier(&conn, "テスト取引先A").unwrap();
        product_repo::find_or_create_supplier(&conn, "テスト取引先B").unwrap();

        let result = list_suppliers(&conn).unwrap();

        assert_eq!(result.len(), 2);
        assert_eq!(result[0].name, "テスト取引先A");
        assert_eq!(result[1].name, "テスト取引先B");
    }

    // ===== preview_import テスト =====

    fn make_csv(headers: &str, rows: &[&str]) -> Vec<u8> {
        let mut csv = format!("{}\n", headers);
        for row in rows {
            csv.push_str(&format!("{}\n", row));
        }
        // UTF-8 BOM付き
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice(csv.as_bytes());
        bytes
    }

    #[test]
    #[serial]
    fn test_preview_import_req104_normal() {
        // REQ-104: 一括インポート — 正常CSV → valid_rows
        // BIZ-01 §4.7: 正常CSV → valid_rows
        let (_dir, conn) = setup_test_db();
        let csv = make_csv(
            "商品コード,商品名,部門ID,売価,原価,税率",
            &["PI-001,テスト商品,1,500,300,10"],
        );
        let result = preview_import(&conn, &csv).unwrap();
        assert_eq!(result.valid_rows.len(), 1);
        assert_eq!(result.error_rows.len(), 0);
        assert_eq!(result.duplicate_rows.len(), 0);
        assert_eq!(result.valid_rows[0].product_code, "PI-001");
    }

    #[test]
    #[serial]
    fn test_preview_import_req104_parse_error() {
        // REQ-104: 一括インポート — デコード失敗はImportError
        // BIZ-01 §4.7: デコード失敗 → ImportError
        let result = preview_import(
            &setup_test_db().1,
            &[0xFF, 0xFE, 0x00], // 不正なバイト列
        );
        assert!(matches!(result, Err(BizError::ImportError(_))));
    }

    #[test]
    #[serial]
    fn test_preview_import_req104_missing_headers() {
        // REQ-104: 一括インポート — 必須列不足はImportError
        // BIZ-01 §4.7: 必須列不足 → ImportError
        let (_dir, conn) = setup_test_db();
        let csv = make_csv("商品コード,商品名", &["PI-002,テスト"]);
        let result = preview_import(&conn, &csv);
        assert!(matches!(result, Err(BizError::ImportError(ref msg)) if msg.contains("必須列")));
    }

    #[test]
    #[serial]
    fn test_preview_import_req104_validation_errors() {
        // REQ-104: 一括インポート — 売価マイナスはerror_rows
        // BIZ-01 §4.7: 売価マイナス → error_rows
        let (_dir, conn) = setup_test_db();
        let csv = make_csv(
            "商品コード,商品名,部門ID,売価,原価,税率",
            &["PI-003,テスト商品,1,-100,300,10"],
        );
        let result = preview_import(&conn, &csv).unwrap();
        assert_eq!(result.error_rows.len(), 1);
        assert!(result.error_rows[0]
            .errors
            .iter()
            .any(|e| e.contains("0以上")));
    }

    #[test]
    #[serial]
    fn test_preview_import_req104_duplicates() {
        // REQ-104: 一括インポート — 既存商品はduplicate_rows
        // BIZ-01 §4.7: 既存商品 → duplicate_rows
        let (_dir, mut conn) = setup_test_db();
        let req = default_create_request();
        create_product(&mut conn, req).unwrap(); // product_code は独自コード発番

        // 発番された商品コードを取得
        let existing: String = conn
            .query_row(
                "SELECT product_code FROM products ORDER BY product_code LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();

        let csv = make_csv(
            "商品コード,商品名,部門ID,売価,原価,税率",
            &[&format!("{},重複商品,1,500,300,10", existing)],
        );
        let result = preview_import(&conn, &csv).unwrap();
        assert_eq!(result.duplicate_rows.len(), 1);
        assert_eq!(result.duplicate_rows[0].existing_product_code, existing);
    }

    #[test]
    #[serial]
    fn test_preview_import_req104_mixed() {
        // REQ-104: 一括インポート — 正常+エラー+重複の混在
        // BIZ-01 §4.7: 正常+エラー+重複の混在
        let (_dir, mut conn) = setup_test_db();
        // 既存商品を作成
        let mut req = default_create_request();
        req.name = "既存商品".to_string();
        create_product(&mut conn, req).unwrap();
        let existing: String = conn
            .query_row(
                "SELECT product_code FROM products ORDER BY product_code LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();

        let csv = make_csv(
            "商品コード,商品名,部門ID,売価,原価,税率",
            &[
                "NEW-001,新規商品,1,500,300,10",                // 正常
                "ERR-001,,1,500,300,10",                        // エラー（名前空）
                &format!("{},重複商品,1,500,300,10", existing), // 重複
            ],
        );
        let result = preview_import(&conn, &csv).unwrap();
        assert_eq!(result.valid_rows.len(), 1);
        assert_eq!(result.error_rows.len(), 1);
        assert_eq!(result.duplicate_rows.len(), 1);
    }

    #[test]
    #[serial]
    fn test_preview_import_req104_optional_fields_none() {
        // REQ-104: 一括インポート — 必須列のみのCSV → オプション項目はNone（デフォルト化しない）
        // BIZ-01 §4.7 P3-3 + R2-5: 必須列のみのCSV → オプション項目は None
        let (_dir, conn) = setup_test_db();
        let csv = make_csv(
            "商品コード,商品名,部門ID,売価,原価,税率",
            &["OPT-001,テスト商品,1,500,300,10"],
        );
        let result = preview_import(&conn, &csv).unwrap();
        assert_eq!(result.valid_rows.len(), 1);
        let row = &result.valid_rows[0];
        assert!(
            row.stock_unit.is_none(),
            "stock_unit は None（デフォルト化しない）"
        );
        assert!(row.initial_stock.is_none(), "initial_stock は None");
        assert!(row.pos_stock_sync.is_none(), "pos_stock_sync は None");
        assert!(row.jan_code.is_none(), "jan_code は None");
        assert!(row.maker_code.is_none(), "maker_code は None");
        assert!(row.supplier_id.is_none(), "supplier_id は None");
    }

    // ===== commit_import テスト =====

    fn make_import_row(product_code: &str, name: &str) -> ImportRow {
        ImportRow {
            line_no: 1,
            product_code: product_code.to_string(),
            name: name.to_string(),
            department_id: 1,
            selling_price: 500,
            cost_price: 300,
            tax_rate: "10".to_string(),
            stock_unit: None,
            initial_stock: None,
            jan_code: None,
            maker_code: None,
            supplier_id: None,
            pos_stock_sync: None,
        }
    }

    #[test]
    #[serial]
    fn test_commit_import_req104_all_new() {
        // REQ-104: 一括インポート — 全行新規登録
        // BIZ-01 §4.8: 全行新規登録
        let (_dir, mut conn) = setup_test_db();
        let rows = vec![
            make_import_row("CI-001", "商品A"),
            make_import_row("CI-002", "商品B"),
        ];
        let result = commit_import(&mut conn, rows, vec![]).unwrap();
        assert_eq!(result.created_count, 2);
        assert_eq!(result.updated_count, 0);

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM products WHERE product_code LIKE 'CI-%'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    #[serial]
    fn test_commit_import_req104_overwrite() {
        // REQ-104: 一括インポート — 上書き対象の更新
        // BIZ-01 §4.8: 上書き対象の更新
        let (_dir, mut conn) = setup_test_db();
        // 既存商品を作成
        let existing = make_import_row("CO-001", "旧名前");
        commit_import(&mut conn, vec![existing], vec![]).unwrap();

        // 上書き
        let updated = ImportRow {
            name: "新名前".to_string(),
            selling_price: 999,
            ..make_import_row("CO-001", "新名前")
        };
        let result = commit_import(&mut conn, vec![updated], vec!["CO-001".to_string()]).unwrap();
        assert_eq!(result.updated_count, 1);
        assert_eq!(result.created_count, 0);

        let name: String = conn
            .query_row(
                "SELECT name FROM products WHERE product_code = 'CO-001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(name, "新名前");
    }

    #[test]
    #[serial]
    fn test_commit_import_req104_overwrite_preserves_optional_fields() {
        // REQ-104: 一括インポート — 上書き時に任意列未指定は既存値保持
        // BIZ-01 §4.8 R3-2: 上書き時に任意列未指定 → 既存値保持
        let (_dir, mut conn) = setup_test_db();
        // 既存商品を作成（stock_unit="cm", supplier_id=None）
        let mut existing = make_import_row("OP-001", "既存商品");
        existing.stock_unit = Some("cm".to_string());
        commit_import(&mut conn, vec![existing], vec![]).unwrap();

        // 上書き: stock_unit/pos_stock_sync は None（変更しない）
        let updated = make_import_row("OP-001", "更新商品"); // stock_unit = None
        commit_import(&mut conn, vec![updated], vec!["OP-001".to_string()]).unwrap();

        let stock_unit: String = conn
            .query_row(
                "SELECT stock_unit FROM products WHERE product_code = 'OP-001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            stock_unit, "cm",
            "stock_unit は既存値 'cm' が保持されるべき"
        );
    }

    #[test]
    #[serial]
    fn test_commit_import_req104_derives_plu_target_like_backfill_and_keeps_on_overwrite() {
        // REQ-104 / REQ-402: 新規は13桁数字JANだけPLU対象化し、上書きでは既存値を保持する。
        let (_dir, mut conn) = setup_test_db();
        let mut valid = make_import_row("IMP-VALID", "有効JAN");
        valid.jan_code = Some("4901234567894".to_string());
        let mut no_jan = make_import_row("IMP-NO-JAN", "JANなし");
        no_jan.jan_code = None;
        let mut short = make_import_row("IMP-SHORT", "12桁");
        short.jan_code = Some("123456789012".to_string());
        let mut alpha = make_import_row("IMP-ALPHA", "英字混在");
        alpha.jan_code = Some("49012345678A4".to_string());

        commit_import(&mut conn, vec![valid, no_jan, short, alpha], vec![]).unwrap();

        for (code, expected) in [
            ("IMP-VALID", true),
            ("IMP-NO-JAN", false),
            ("IMP-SHORT", false),
            ("IMP-ALPHA", false),
        ] {
            let product = product_repo::find_by_product_code(&conn, code)
                .unwrap()
                .unwrap();
            assert_eq!(product.product.plu_target, expected, "{code}");
        }

        let mut overwrite = make_import_row("IMP-VALID", "有効JAN更新");
        overwrite.jan_code = Some("123456789012".to_string());
        commit_import(&mut conn, vec![overwrite], vec!["IMP-VALID".to_string()]).unwrap();

        let overwritten = product_repo::find_by_product_code(&conn, "IMP-VALID")
            .unwrap()
            .unwrap();
        assert!(
            overwritten.product.plu_target,
            "overwrite keeps existing plu_target even when incoming JAN is not targetable"
        );
    }

    #[test]
    #[serial]
    fn test_commit_import_req104_initial_stock_movement() {
        // REQ-104: 一括インポート — initial_stock > 0 → movement記録
        // BIZ-01 §4.8: initial_stock > 0 → movement記録
        let (_dir, mut conn) = setup_test_db();
        let mut row = make_import_row("IM-001", "初期在庫あり");
        row.initial_stock = Some(10);
        commit_import(&mut conn, vec![row], vec![]).unwrap();

        let qty: i64 = conn
            .query_row(
                "SELECT quantity FROM inventory_movements WHERE product_code = 'IM-001' AND movement_type = 'receiving'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(qty, 10);
    }

    #[test]
    #[serial]
    fn test_commit_import_req104_active_stocktake() {
        // REQ-104: 一括インポート — 進行中棚卸し → stocktake_item自動追加
        // BIZ-01 §4.8: 進行中棚卸し → stocktake_item自動追加
        let (_dir, mut conn) = setup_test_db();
        // 棚卸しを直接作成
        conn.execute(
            "INSERT INTO stocktakes (started_at, status) VALUES ('2026-10-01T09:00:00', 'in_progress')",
            [],
        )
        .unwrap();

        let row = make_import_row("AS-001", "棚卸し中追加");
        commit_import(&mut conn, vec![row], vec![]).unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM stocktake_items WHERE product_code = 'AS-001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "stocktake_item が自動追加されるべき");
    }

    #[test]
    #[serial]
    fn test_commit_import_req104_no_stocktake() {
        // REQ-104: 一括インポート — 棚卸しなし → stocktake_item作成なし
        // BIZ-01 §4.8: 棚卸しなし → stocktake_item作成なし
        let (_dir, mut conn) = setup_test_db();
        let row = make_import_row("NS-001", "棚卸しなし");
        commit_import(&mut conn, vec![row], vec![]).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM stocktake_items", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    #[serial]
    fn test_commit_import_req104_operation_log() {
        // REQ-104: 一括インポート — 操作ログ記録
        // BIZ-01 §4.8: 操作ログ記録
        let (_dir, mut conn) = setup_test_db();
        let row = make_import_row("OL-001", "ログテスト");
        commit_import(&mut conn, vec![row], vec![]).unwrap();

        let op_type: String = conn
            .query_row(
                "SELECT operation_type FROM operation_logs WHERE operation_type = 'product_import' ORDER BY id DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(op_type, "product_import");
    }

    #[test]
    #[serial]
    fn test_commit_import_req104_empty_rows() {
        // REQ-104: 一括インポート — 空配列は created_count=0
        // BIZ-01 §4.8: 空配列
        let (_dir, mut conn) = setup_test_db();
        let result = commit_import(&mut conn, vec![], vec![]).unwrap();
        assert_eq!(result.created_count, 0);
        assert_eq!(result.updated_count, 0);
    }

    #[test]
    #[serial]
    fn test_commit_import_req104_rollback_on_failure() {
        // REQ-104: 一括インポート — FK違反で全行ロールバック
        // BIZ-01 §4.8 P3-5: FK違反で全行ロールバック
        let (_dir, mut conn) = setup_test_db();
        let good_row = make_import_row("RB-001", "正常商品");
        let mut bad_row = make_import_row("RB-002", "不正商品");
        bad_row.department_id = 9999; // 存在しない部門 → FK違反

        let result = commit_import(&mut conn, vec![good_row, bad_row], vec![]);
        assert!(result.is_err(), "FK違反でエラーを返すべき");

        // RB-001 もロールバックされている
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM products WHERE product_code = 'RB-001'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0, "TX全体がロールバックされるべき");
    }
}
