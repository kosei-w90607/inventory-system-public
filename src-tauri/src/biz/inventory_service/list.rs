//! 入庫・返品・廃棄の一覧取得（repo直呼び防止ラッパー）
//!
//! 44-cmd-inventory.md §23.10 に基づく実装。
//! BIZ層でper_page上限バリデーションを行い、IO層のリポジトリに委譲する。

use crate::biz::BizError;
use crate::db::disposal_repo::{
    self, DisposalRecordDetail, DisposalRecordSummary, InventoryRecordQuery, InventoryRecordSummary,
};
use crate::db::inventory_common::ListQuery;
use crate::db::inventory_repo::{self, MovementQuery, MovementRecord, MovementSourceLink};
use crate::db::manual_sale_repo::{self, ManualSaleRecordDetail};
use crate::db::receiving_repo::ReceivingRecordDetail;
use crate::db::receiving_repo::{self, ReceivingRecordWithSupplier};
use crate::db::return_repo::{self, ReturnRecordDetail, ReturnRecordSummary};
use crate::db::{DbConnection, DbError, PaginatedResult};

/// per_page の上限
const MAX_PER_PAGE: u32 = 100;

/// ページパラメータのバリデーション
fn validate_page_params(query: &ListQuery) -> Result<(), BizError> {
    if query.page < 1 || query.per_page < 1 || query.per_page > MAX_PER_PAGE {
        return Err(BizError::ValidationFailed(
            "ページパラメータが不正です".to_string(),
        ));
    }
    Ok(())
}

/// 入庫記録一覧を返す
///
/// 44-cmd-inventory.md §23.2
pub fn list_receivings(
    conn: &DbConnection,
    query: &ListQuery,
) -> Result<PaginatedResult<ReceivingRecordWithSupplier>, BizError> {
    validate_page_params(query)?;
    Ok(receiving_repo::list_receiving_records(conn, query)?)
}

/// 返品記録一覧を返す
///
/// 44-cmd-inventory.md §23.5
pub fn list_returns(
    conn: &DbConnection,
    query: &ListQuery,
) -> Result<PaginatedResult<ReturnRecordSummary>, BizError> {
    validate_page_params(query)?;
    Ok(return_repo::list_return_records(conn, query)?)
}

/// 廃棄記録一覧を返す
///
/// 44-cmd-inventory.md §23.7
pub fn list_disposals(
    conn: &DbConnection,
    query: &ListQuery,
) -> Result<PaginatedResult<DisposalRecordSummary>, BizError> {
    validate_page_params(query)?;
    Ok(disposal_repo::list_disposal_records(conn, query)?)
}

/// 入出庫履歴ハブ用に業務記録一覧を返す。
///
/// 65-inventory-record-traceability.md §65.4 / TRACE-D1
pub fn list_inventory_records(
    conn: &DbConnection,
    query: &InventoryRecordQuery,
) -> Result<PaginatedResult<InventoryRecordSummary>, BizError> {
    let page_query = ListQuery {
        page: query.page,
        per_page: query.per_page,
        date_from: None,
        date_to: None,
    };
    validate_page_params(&page_query)?;

    if !matches!(
        query.record_type.as_deref(),
        None | Some("all")
            | Some("receiving_record")
            | Some("return_record")
            | Some("manual_sale")
            | Some("disposal_record")
    ) {
        return Err(BizError::ValidationFailed(
            "未対応の記録種別です".to_string(),
        ));
    }
    if !matches!(query.status.as_deref(), None | Some("all") | Some("active")) {
        return Err(BizError::ValidationFailed("未対応の状態です".to_string()));
    }

    Ok(disposal_repo::list_inventory_records(conn, query)?)
}

/// 入庫記録詳細を返す。
///
/// 65-inventory-record-traceability.md §65.5
pub fn get_receiving_record(
    conn: &DbConnection,
    record_id: i64,
) -> Result<ReceivingRecordDetail, BizError> {
    match receiving_repo::get_receiving_record_detail(conn, record_id) {
        Ok(mut detail) => {
            for movement in &mut detail.movements {
                movement.source =
                    resolve_movement_source(&movement.reference_type, &movement.reference_id);
            }
            Ok(detail)
        }
        Err(DbError::NotFound) => Err(BizError::NotFound(format!(
            "入庫記録が見つかりません: {}",
            record_id
        ))),
        Err(err) => Err(BizError::DatabaseError(err)),
    }
}

/// 返品・交換記録詳細を返す。
///
/// 65-inventory-record-traceability.md §65.5
pub fn get_return_record(
    conn: &DbConnection,
    record_id: i64,
) -> Result<ReturnRecordDetail, BizError> {
    match return_repo::get_return_record_detail(conn, record_id) {
        Ok(mut detail) => {
            for movement in &mut detail.movements {
                movement.source =
                    resolve_movement_source(&movement.reference_type, &movement.reference_id);
            }
            Ok(detail)
        }
        Err(DbError::NotFound) => Err(BizError::NotFound(format!(
            "返品・交換記録が見つかりません: {}",
            record_id
        ))),
        Err(err) => Err(BizError::DatabaseError(err)),
    }
}

/// 手動販売記録詳細を返す。
///
/// 65-inventory-record-traceability.md §65.5
pub fn get_manual_sale_record(
    conn: &DbConnection,
    record_id: i64,
) -> Result<ManualSaleRecordDetail, BizError> {
    match manual_sale_repo::get_manual_sale_record_detail(conn, record_id) {
        Ok(mut detail) => {
            for movement in &mut detail.movements {
                movement.source =
                    resolve_movement_source(&movement.reference_type, &movement.reference_id);
            }
            Ok(detail)
        }
        Err(DbError::NotFound) => Err(BizError::NotFound(format!(
            "手動販売記録が見つかりません: {}",
            record_id
        ))),
        Err(err) => Err(BizError::DatabaseError(err)),
    }
}

/// 廃棄・破損記録詳細を返す。
///
/// 65-inventory-record-traceability.md §65.5
pub fn get_disposal_record(
    conn: &DbConnection,
    record_id: i64,
) -> Result<DisposalRecordDetail, BizError> {
    match disposal_repo::get_disposal_record_detail(conn, record_id) {
        Ok(mut detail) => {
            for movement in &mut detail.movements {
                movement.source =
                    resolve_movement_source(&movement.reference_type, &movement.reference_id);
            }
            Ok(detail)
        }
        Err(DbError::NotFound) => Err(BizError::NotFound(format!(
            "廃棄・破損記録が見つかりません: {}",
            record_id
        ))),
        Err(err) => Err(BizError::DatabaseError(err)),
    }
}

/// movement_type の許容値
const VALID_MOVEMENT_TYPES: &[&str] = &[
    "sale_auto",
    "sale_manual",
    "receiving",
    "return",
    "disposal",
    "stocktake",
];

/// 在庫変動履歴を返す
///
/// 44-cmd-inventory.md §23.10
pub fn list_movements(
    conn: &DbConnection,
    query: &MovementQuery,
) -> Result<PaginatedResult<MovementRecord>, BizError> {
    if query.page < 1 || query.per_page < 1 || query.per_page > MAX_PER_PAGE {
        return Err(BizError::ValidationFailed(
            "ページパラメータが不正です".to_string(),
        ));
    }
    if let Some(ref mt) = query.movement_type {
        if !VALID_MOVEMENT_TYPES.contains(&mt.as_str()) {
            return Err(BizError::ValidationFailed(format!(
                "不正な変動種別です: {}",
                mt
            )));
        }
    }
    let mut result = inventory_repo::list_movements(conn, query)?;
    for item in &mut result.items {
        item.source = resolve_movement_source(&item.reference_type, &item.reference_id);
    }
    Ok(result)
}

/// movement の reference から元業務記録の表示情報を解決する。
///
/// 65-inventory-record-traceability.md TRACE-D2 / §65.3 / §65.8.2
pub(crate) fn resolve_movement_source(
    reference_type: &Option<String>,
    reference_id: &Option<i64>,
) -> Option<MovementSourceLink> {
    let reference_type = reference_type.as_deref()?;
    let reference_id = (*reference_id)?;
    let (label_prefix, route_prefix) = match reference_type {
        "receiving_record" => ("入庫記録", "/inventory/receiving/records"),
        "return_record" => ("返品・交換", "/inventory/return/records"),
        "manual_sale" => ("手動販売出庫", "/inventory/manual-sale/records"),
        "disposal_record" => ("廃棄・破損", "/inventory/disposal/records"),
        "csv_import" => ("CSV取込み", "/csv-import/records"),
        "stocktake" => ("棚卸し", "/stocktake/records"),
        _ => return None,
    };

    Some(MovementSourceLink {
        label: format!("{} #{}", label_prefix, reference_id),
        route: format!("{}/{}", route_prefix, reference_id),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn setup_db() -> DbConnection {
        let conn = db::init_database(":memory:").unwrap();
        db::migration::migrate(&conn).unwrap();
        conn
    }

    fn seed_product_with_stock(conn: &DbConnection, code: &str, stock: i64, unit: &str) {
        let product = crate::db::product_repo::NewProduct {
            product_code: code.to_string(),
            jan_code: None,
            name: format!("テスト商品_{}", code),
            department_id: 1,
            supplier_id: None,
            selling_price: 500,
            cost_price: 300,
            tax_rate: "10".to_string(),
            maker_code: None,
            stock_quantity: stock,
            stock_unit: unit.to_string(),
            is_discontinued: false,
            plu_dirty: true,
            plu_exported_at: None,
            plu_target: true,
            pos_stock_sync: true,
        };
        crate::db::product_repo::insert_product(conn, &product).unwrap();
    }

    #[test]
    fn test_list_receivings_req201_empty_table() {
        // REQ-201: 入庫記録 — 入庫記録一覧: 空テーブル → 0件
        let conn = setup_db();
        let query = ListQuery {
            page: 1,
            per_page: 10,
            date_from: None,
            date_to: None,
        };
        let result = list_receivings(&conn, &query).unwrap();
        assert_eq!(result.total_count, 0);
        assert!(result.items.is_empty());
        assert_eq!(result.page, 1);
        assert_eq!(result.per_page, 10);
    }

    #[test]
    fn test_list_returns_req202_empty_table() {
        // REQ-202: 返品・交換記録 — 返品記録一覧: 空テーブル → 0件
        let conn = setup_db();
        let query = ListQuery {
            page: 1,
            per_page: 10,
            date_from: None,
            date_to: None,
        };
        let result = list_returns(&conn, &query).unwrap();
        assert_eq!(result.total_count, 0);
        assert!(result.items.is_empty());
    }

    #[test]
    fn test_list_disposals_req204_empty_table() {
        // REQ-204: 廃棄・破損記録 — 廃棄記録一覧: 空テーブル → 0件
        let conn = setup_db();
        let query = ListQuery {
            page: 1,
            per_page: 10,
            date_from: None,
            date_to: None,
        };
        let result = list_disposals(&conn, &query).unwrap();
        assert_eq!(result.total_count, 0);
        assert!(result.items.is_empty());
    }

    #[test]
    fn test_list_receivings_req201_per_page_exceeds_max() {
        // REQ-201: 入庫記録 — 入庫記録一覧: per_page 上限超え → バリデーションエラー
        let conn = setup_db();
        let query = ListQuery {
            page: 1,
            per_page: 101,
            date_from: None,
            date_to: None,
        };
        let err = list_receivings(&conn, &query).unwrap_err();
        match err {
            BizError::ValidationFailed(msg) => {
                assert!(msg.contains("ページパラメータ"));
            }
            _ => panic!("expected ValidationFailed, got {:?}", err),
        }
    }

    #[test]
    fn test_list_returns_req202_page_zero() {
        // REQ-202: 返品・交換記録 — 返品記録一覧: page=0 → バリデーションエラー
        let conn = setup_db();
        let query = ListQuery {
            page: 0,
            per_page: 10,
            date_from: None,
            date_to: None,
        };
        let err = list_returns(&conn, &query).unwrap_err();
        match err {
            BizError::ValidationFailed(_) => {}
            _ => panic!("expected ValidationFailed, got {:?}", err),
        }
    }

    #[test]
    fn test_list_disposals_req204_per_page_zero() {
        // REQ-204: 廃棄・破損記録 — 廃棄記録一覧: per_page=0 → バリデーションエラー
        let conn = setup_db();
        let query = ListQuery {
            page: 1,
            per_page: 0,
            date_from: None,
            date_to: None,
        };
        let err = list_disposals(&conn, &query).unwrap_err();
        match err {
            BizError::ValidationFailed(_) => {}
            _ => panic!("expected ValidationFailed, got {:?}", err),
        }
    }

    #[test]
    fn test_list_movements_req303_invalid_movement_type() {
        // REQ-303: 在庫変動履歴 — 不正な movement_type → バリデーションエラー
        let conn = setup_db();
        let query = MovementQuery {
            product_code: "TEST-001".to_string(),
            date_from: None,
            date_to: None,
            movement_type: Some("invalid_type".to_string()),
            page: 1,
            per_page: 10,
        };
        let err = list_movements(&conn, &query).unwrap_err();
        match err {
            BizError::ValidationFailed(msg) => {
                assert!(msg.contains("不正な変動種別"));
            }
            _ => panic!("expected ValidationFailed, got {:?}", err),
        }
    }

    #[test]
    fn test_list_movements_req303_valid_movement_type() {
        // REQ-303: 在庫変動履歴 — 有効な movement_type → バリデーション通過（空結果OK）
        let conn = setup_db();
        let query = MovementQuery {
            product_code: "TEST-001".to_string(),
            date_from: None,
            date_to: None,
            movement_type: Some("receiving".to_string()),
            page: 1,
            per_page: 10,
        };
        // 有効な movement_type ならバリデーションを通過（空結果OK）
        let result = list_movements(&conn, &query).unwrap();
        assert_eq!(result.total_count, 0);
    }

    #[test]
    fn test_resolve_movement_source_req207_known_references() {
        // REQ-207 / TRACE-D2: movement reference から元業務記録 link を解決する
        let cases = [
            (
                "receiving_record",
                42,
                "入庫記録 #42",
                "/inventory/receiving/records/42",
            ),
            (
                "return_record",
                7,
                "返品・交換 #7",
                "/inventory/return/records/7",
            ),
            (
                "manual_sale",
                9,
                "手動販売出庫 #9",
                "/inventory/manual-sale/records/9",
            ),
            (
                "disposal_record",
                11,
                "廃棄・破損 #11",
                "/inventory/disposal/records/11",
            ),
            ("csv_import", 3, "CSV取込み #3", "/csv-import/records/3"),
            ("stocktake", 5, "棚卸し #5", "/stocktake/records/5"),
        ];

        for (reference_type, reference_id, expected_label, expected_route) in cases {
            let source =
                resolve_movement_source(&Some(reference_type.to_string()), &Some(reference_id))
                    .expect("known reference should resolve");
            assert_eq!(source.label, expected_label);
            assert_eq!(source.route, expected_route);
        }
    }

    #[test]
    fn test_resolve_movement_source_req303_null_reference() {
        // REQ-303: 初期在庫など NULL reference の movement は source なしで表示可能
        assert!(resolve_movement_source(&None, &Some(1)).is_none());
        assert!(resolve_movement_source(&Some("receiving_record".to_string()), &None).is_none());
    }

    #[test]
    fn test_resolve_movement_source_req303_unknown_reference() {
        // REQ-303: legacy/corrupt reference_type は movement 行を落とさず source なしにする
        let source = resolve_movement_source(&Some("legacy_reference".to_string()), &Some(99));
        assert!(source.is_none());
    }

    #[test]
    fn test_list_movements_req303_includes_source_link() {
        // REQ-303 / TRACE-D2: list_movements は既存 reference に加えて source link を返す
        let conn = setup_db();
        seed_product_with_stock(&conn, "MV-SRC", 10, "pcs");
        conn.execute(
            "INSERT INTO inventory_movements \
             (product_code, movement_type, quantity, stock_after, reference_type, reference_id, is_voided, created_at) \
             VALUES ('MV-SRC', 'receiving', 5, 15, 'receiving_record', 42, 0, '2026-03-15T10:00:00')",
            [],
        )
        .unwrap();

        let query = MovementQuery {
            product_code: "MV-SRC".to_string(),
            date_from: None,
            date_to: None,
            movement_type: None,
            page: 1,
            per_page: 50,
        };
        let result = list_movements(&conn, &query).unwrap();

        let source = result.items[0].source.as_ref().expect("source link");
        assert_eq!(source.label, "入庫記録 #42");
        assert_eq!(source.route, "/inventory/receiving/records/42");
    }

    #[test]
    fn test_list_movements_req303_null_reference_has_no_source() {
        // REQ-303: reference_type/reference_id が NULL の既存行も source=None で残す
        let conn = setup_db();
        seed_product_with_stock(&conn, "MV-NULL", 10, "pcs");
        conn.execute(
            "INSERT INTO inventory_movements \
             (product_code, movement_type, quantity, stock_after, is_voided, created_at) \
             VALUES ('MV-NULL', 'receiving', 5, 15, 0, '2026-03-15T10:00:00')",
            [],
        )
        .unwrap();

        let query = MovementQuery {
            product_code: "MV-NULL".to_string(),
            date_from: None,
            date_to: None,
            movement_type: None,
            page: 1,
            per_page: 50,
        };
        let result = list_movements(&conn, &query).unwrap();

        assert_eq!(result.total_count, 1);
        assert!(result.items[0].source.is_none());
    }

    #[test]
    fn test_list_inventory_records_req206_rejects_invalid_page_params() {
        // REQ-206 / TRACE-D1: 入出庫履歴ハブは per_page 上限100をBIZで検証する
        let conn = setup_db();
        let query = crate::db::disposal_repo::InventoryRecordQuery {
            record_type: Some("disposal_record".to_string()),
            date_from: None,
            date_to: None,
            record_id: None,
            product_keyword: None,
            department_id: None,
            status: None,
            page: 1,
            per_page: 101,
        };

        let err = list_inventory_records(&conn, &query).unwrap_err();

        assert!(matches!(err, BizError::ValidationFailed(_)));
    }

    #[test]
    fn test_list_inventory_records_req206_rejects_unknown_record_type() {
        // REQ-206: 未対応のrecord_typeはBIZ validationとして拒否する
        let conn = setup_db();
        let query = crate::db::disposal_repo::InventoryRecordQuery {
            record_type: Some("csv_import".to_string()),
            date_from: None,
            date_to: None,
            record_id: None,
            product_keyword: None,
            department_id: None,
            status: None,
            page: 1,
            per_page: 20,
        };

        let err = list_inventory_records(&conn, &query).unwrap_err();

        assert!(matches!(err, BizError::ValidationFailed(msg) if msg.contains("記録種別")));
    }

    #[test]
    fn test_get_disposal_record_req204_maps_missing_to_not_found() {
        // REQ-204 / REQ-206: 廃棄・破損詳細の未存在IDはBIZ NotFoundに変換する
        let conn = setup_db();

        let err = get_disposal_record(&conn, 404).unwrap_err();

        assert!(matches!(err, BizError::NotFound(msg) if msg.contains("廃棄・破損")));
    }
}
