//! 返品・交換記録（create_return）

use crate::biz::BizError;
use crate::db::inventory_repo::{MovementType, ReferenceType};
use crate::db::product_repo;
use crate::db::return_repo;
use crate::db::system_repo;
use crate::db::{DbConnection, DbError};

use std::collections::BTreeMap;

use super::common::{apply_stock_change, compute_fingerprint, IDEMPOTENCY_KEY_MAX_LEN};

/// 返品・交換記録リクエスト（31-biz-inventory-service.md §12.4）
#[derive(Debug, Clone, serde::Deserialize, specta::Type)]
pub struct ReturnCreateRequest {
    pub idempotency_key: String,
    pub return_type: String,
    pub return_date: String,
    pub register_processed: bool,
    pub receipt_image_path: Option<String>,
    pub note: Option<String>,
    pub items: Vec<ReturnItemInput>,
}

#[derive(Debug, Clone, serde::Deserialize, specta::Type)]
pub struct ReturnItemInput {
    pub product_code: String,
    pub direction: String,
    pub quantity: i64,
}

/// 返品・交換記録の結果
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct ReturnCreateResult {
    pub record_id: i64,
    pub created: bool,
    pub idempotent_replay: bool,
    pub stock_warnings: Vec<String>,
}

fn validate_return_request_shape(req: &ReturnCreateRequest) -> Result<(), BizError> {
    if req.items.is_empty() {
        return Err(BizError::ValidationFailed(
            "明細が1件以上必要です".to_string(),
        ));
    }
    if req.return_type != "return" && req.return_type != "exchange" {
        return Err(BizError::ValidationFailed(format!(
            "返品種別が不正です: {}",
            req.return_type
        )));
    }

    let mut has_in_item = false;
    let mut has_out_item = false;
    for (i, item) in req.items.iter().enumerate() {
        if item.direction != "in" && item.direction != "out" {
            return Err(BizError::ValidationFailed(format!(
                "明細{}: 方向は 'in' または 'out' のみ有効です",
                i + 1
            )));
        }
        if item.direction == "in" {
            has_in_item = true;
        }
        if item.direction == "out" {
            has_out_item = true;
        }
        if item.quantity <= 0 {
            return Err(BizError::ValidationFailed(format!(
                "明細{}: 数量は1以上必要です",
                i + 1
            )));
        }
    }
    if req.return_type == "return" && has_out_item {
        return Err(BizError::ValidationFailed(
            "返品では渡し明細を指定できません".to_string(),
        ));
    }
    if req.return_type == "exchange" && (!has_in_item || !has_out_item) {
        return Err(BizError::ValidationFailed(
            "交換では戻り明細と渡し明細がそれぞれ1件以上必要です".to_string(),
        ));
    }

    Ok(())
}

/// 返品・交換記録を登録する
///
/// register_processed=true → 在庫は動かさない（CSV取込みで自動反映）
/// register_processed=false → direction に基づき在庫変動
///
/// 31-biz-inventory-service.md §12.4
pub fn create_return(
    conn: &mut DbConnection,
    req: ReturnCreateRequest,
) -> Result<ReturnCreateResult, BizError> {
    let normalized_key = req.idempotency_key.trim().to_string();
    if normalized_key.is_empty() {
        return Err(BizError::ValidationFailed(
            "冪等性キーは必須です".to_string(),
        ));
    }
    if normalized_key.len() > IDEMPOTENCY_KEY_MAX_LEN {
        return Err(BizError::ValidationFailed(format!(
            "冪等性キーは{}文字以内です",
            IDEMPOTENCY_KEY_MAX_LEN
        )));
    }

    // DB参照不要なBIZ契約は replay より先に検証する。
    validate_return_request_shape(&req)?;

    // fingerprint（リクエストフィールドのみ使用、DB参照不要）
    let header = format!(
        "{}|{}|{}",
        req.return_type, req.return_date, req.register_processed
    );
    let item_lines: Vec<String> = req
        .items
        .iter()
        .map(|i| format!("{}|{}|{}", i.product_code, i.quantity, i.direction))
        .collect();
    let fingerprint = compute_fingerprint(&header, &item_lines);

    // 冪等性チェック（バリデーションより先に実行）
    if let Some((existing_id, existing_fp)) =
        return_repo::find_return_by_idempotency_key(conn, &normalized_key)?
    {
        if existing_fp == fingerprint {
            return Ok(ReturnCreateResult {
                record_id: existing_id,
                created: false,
                idempotent_replay: true,
                stock_warnings: vec![],
            });
        } else {
            return Err(BizError::IdempotencyConflict(
                "同じ冪等キーで異なる内容のリクエストです".to_string(),
            ));
        }
    }

    // バリデーション（DB参照あり）
    for item in req.items.iter() {
        if product_repo::find_by_product_code(conn, &item.product_code)?.is_none() {
            return Err(BizError::NotFound(format!(
                "商品が見つかりません: {}",
                item.product_code
            )));
        }
    }

    // TX
    let tx = conn
        .transaction()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    let record_id = match return_repo::insert_return_record(
        &tx,
        &crate::db::return_repo::NewReturnRecord {
            return_type: req.return_type.clone(),
            return_date: req.return_date.clone(),
            register_processed: req.register_processed,
            receipt_image_path: req.receipt_image_path.clone(),
            note: req.note.clone(),
            idempotency_key: normalized_key.clone(),
            request_fingerprint: fingerprint.clone(),
        },
    ) {
        Ok(id) => id,
        Err(DbError::DuplicateKey(_)) => {
            let (existing_id, existing_fp) =
                return_repo::find_return_by_idempotency_key(&tx, &normalized_key)?.ok_or_else(
                    || {
                        BizError::DatabaseError(DbError::QueryFailed(
                            "DuplicateKey後にレコードが見つかりません".to_string(),
                        ))
                    },
                )?;
            if existing_fp == fingerprint {
                return Ok(ReturnCreateResult {
                    record_id: existing_id,
                    created: false,
                    idempotent_replay: true,
                    stock_warnings: vec![],
                });
            } else {
                return Err(BizError::IdempotencyConflict(
                    "同じ冪等キーで異なる内容のリクエストです".to_string(),
                ));
            }
        }
        Err(e) => return Err(BizError::DatabaseError(e)),
    };

    let mut stock_warnings_map: BTreeMap<String, String> = BTreeMap::new();
    for item in &req.items {
        return_repo::insert_return_item(
            &tx,
            &crate::db::return_repo::NewReturnItem {
                return_record_id: record_id,
                product_code: item.product_code.clone(),
                direction: item.direction.clone(),
                quantity: item.quantity,
            },
        )?;

        // register_processed=true → 在庫は動かさない（CSV取込みで自動反映）
        if !req.register_processed {
            let qty = if item.direction == "in" {
                item.quantity
            } else {
                -item.quantity
            };
            let outcome = apply_stock_change(
                &tx,
                &item.product_code,
                qty,
                MovementType::Return,
                ReferenceType::ReturnRecord,
                record_id,
                None,
            )?;
            if outcome.negative_stock_warning {
                stock_warnings_map.insert(
                    item.product_code.clone(),
                    format!(
                        "{}: 在庫がマイナスになりました（{}）",
                        item.product_code, outcome.stock_after
                    ),
                );
            }
        }
    }

    // BTreeMap → Vec（product_code 昇順・重複排除済み）
    let stock_warnings: Vec<String> = stock_warnings_map.into_values().collect();

    let detail = serde_json::json!({
        "record_id": record_id,
        "item_count": req.items.len(),
        "return_type": req.return_type,
        "register_processed": req.register_processed,
        "idempotency_key": normalized_key,
    });
    system_repo::insert_operation_log(
        &tx,
        &crate::db::system_repo::NewOperationLog {
            operation_type: "return_create".to_string(),
            summary: format!("返品記録作成（{}明細）", req.items.len()),
            detail_json: Some(detail.to_string()),
        },
    )?;

    tx.commit()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    Ok(ReturnCreateResult {
        record_id,
        created: true,
        idempotent_replay: false,
        stock_warnings,
    })
}

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::*;
    use crate::db::product_repo;

    fn make_return_req(key: &str, items: Vec<ReturnItemInput>) -> ReturnCreateRequest {
        ReturnCreateRequest {
            idempotency_key: key.to_string(),
            return_type: "return".to_string(),
            return_date: "2026-04-07".to_string(),
            register_processed: false,
            receipt_image_path: None,
            note: None,
            items,
        }
    }

    fn return_item(code: &str, direction: &str, qty: i64) -> ReturnItemInput {
        ReturnItemInput {
            product_code: code.to_string(),
            direction: direction.to_string(),
            quantity: qty,
        }
    }

    #[test]
    fn test_create_return_req202_normal() {
        // REQ-202: 返品・交換記録 — 正常な返品記録作成（register_processed=false, direction=in → 在庫増加）
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "RTN-001", 10);

        let req = make_return_req("ret-key-1", vec![return_item("RTN-001", "in", 2)]);
        let result = create_return(&mut conn, req).unwrap();
        assert!(result.created);
        assert!(!result.idempotent_replay);

        let p = product_repo::find_by_product_code(&conn, "RTN-001")
            .unwrap()
            .unwrap();
        assert_eq!(p.product.stock_quantity, 12);
    }

    #[test]
    fn test_create_return_req202_register_processed_no_stock_change() {
        // REQ-202: 返品・交換記録 — register_processed=true → 在庫は動かさない
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "RTN-002", 10);

        let mut req = make_return_req("ret-key-2", vec![return_item("RTN-002", "in", 3)]);
        req.register_processed = true;
        let result = create_return(&mut conn, req).unwrap();
        assert!(result.created);

        // 在庫不変
        let p = product_repo::find_by_product_code(&conn, "RTN-002")
            .unwrap()
            .unwrap();
        assert_eq!(p.product.stock_quantity, 10);

        // inventory_movements にレコードなし
        let mv_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM inventory_movements WHERE product_code = 'RTN-002'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(mv_count, 0);
    }

    #[test]
    fn test_create_return_req202_direction_in_increases_stock() {
        // REQ-202: 返品・交換記録 — direction=in → 在庫増加
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "RTN-003", 5);

        let req = make_return_req("ret-key-3", vec![return_item("RTN-003", "in", 3)]);
        create_return(&mut conn, req).unwrap();

        let p = product_repo::find_by_product_code(&conn, "RTN-003")
            .unwrap()
            .unwrap();
        assert_eq!(p.product.stock_quantity, 8);
    }

    #[test]
    fn test_create_return_req202_direction_out_decreases_stock() {
        // REQ-202: 返品・交換記録 — exchange の direction=out → 在庫減少
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "RTN-004-IN", 10);
        create_test_product(&conn, "RTN-004", 10);

        let mut req = make_return_req(
            "ret-key-4",
            vec![
                return_item("RTN-004-IN", "in", 1),
                return_item("RTN-004", "out", 2),
            ],
        );
        req.return_type = "exchange".to_string();
        create_return(&mut conn, req).unwrap();

        let p = product_repo::find_by_product_code(&conn, "RTN-004")
            .unwrap()
            .unwrap();
        assert_eq!(p.product.stock_quantity, 8);
    }

    #[test]
    fn test_create_return_req202_idempotent_replay() {
        // REQ-202: 返品・交換記録 — 冪等性リプレイ（副作用ゼロ）
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "RTN-005", 10);

        let req = make_return_req("ret-key-5", vec![return_item("RTN-005", "in", 2)]);
        let r1 = create_return(&mut conn, req.clone()).unwrap();

        let log_count_before: i64 = conn
            .query_row("SELECT COUNT(*) FROM operation_logs", [], |r| r.get(0))
            .unwrap();

        let r2 = create_return(&mut conn, req).unwrap();
        assert!(!r2.created);
        assert!(r2.idempotent_replay);
        assert_eq!(r2.record_id, r1.record_id);

        // 在庫は1回目の +2 のみ
        let p = product_repo::find_by_product_code(&conn, "RTN-005")
            .unwrap()
            .unwrap();
        assert_eq!(p.product.stock_quantity, 12);

        let log_count_after: i64 = conn
            .query_row("SELECT COUNT(*) FROM operation_logs", [], |r| r.get(0))
            .unwrap();
        assert_eq!(log_count_before, log_count_after);
    }

    #[test]
    fn test_create_return_req202_idempotency_conflict() {
        // REQ-202: 返品・交換記録 — 同じキー+異なる内容 → IdempotencyConflict
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "RTN-006", 10);

        let req1 = make_return_req("ret-key-6", vec![return_item("RTN-006", "in", 2)]);
        create_return(&mut conn, req1).unwrap();

        let req2 = make_return_req("ret-key-6", vec![return_item("RTN-006", "in", 5)]);
        let result = create_return(&mut conn, req2);
        assert!(matches!(result, Err(BizError::IdempotencyConflict(_))));
    }

    #[test]
    fn test_create_return_req202_validation_empty_key() {
        // REQ-202: 返品・交換記録 — バリデーション: 空白のみの冪等性キー → エラー
        let (_dir, mut conn) = setup_test_db();
        let req = make_return_req("  ", vec![return_item("X", "in", 1)]);
        let result = create_return(&mut conn, req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    fn test_create_return_req202_validation_invalid_return_type() {
        // REQ-202: 返品・交換記録 — バリデーション: 不正な return_type → エラー
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "RTN-008", 10);

        let mut req = make_return_req("ret-key-8", vec![return_item("RTN-008", "in", 1)]);
        req.return_type = "invalid".to_string();
        let result = create_return(&mut conn, req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    fn test_create_return_req202_validation_invalid_direction() {
        // REQ-202: 返品・交換記録 — バリデーション: 不正な direction → エラー
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "RTN-009", 10);

        let req = make_return_req("ret-key-9", vec![return_item("RTN-009", "up", 1)]);
        let result = create_return(&mut conn, req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    fn test_create_return_req202_rejects_return_with_out_direction() {
        // REQ-202 / UI-03-D6: 返品は戻り(in)のみ。渡し(out)を含む返品はBIZで拒否する
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "RTN-012", 10);

        let req = make_return_req("ret-key-12", vec![return_item("RTN-012", "out", 1)]);
        let result = create_return(&mut conn, req);

        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    fn test_create_return_req202_rejects_exchange_missing_in_or_out() {
        // REQ-202 / UI-03-D7: 交換は戻り(in)と渡し(out)の両方が必要
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "RTN-013", 10);
        create_test_product(&conn, "RTN-014", 10);

        let mut only_in = make_return_req("ret-key-13", vec![return_item("RTN-013", "in", 1)]);
        only_in.return_type = "exchange".to_string();
        let mut only_out = make_return_req("ret-key-14", vec![return_item("RTN-014", "out", 1)]);
        only_out.return_type = "exchange".to_string();

        assert!(matches!(
            create_return(&mut conn, only_in),
            Err(BizError::ValidationFailed(_))
        ));
        assert!(matches!(
            create_return(&mut conn, only_out),
            Err(BizError::ValidationFailed(_))
        ));
    }

    #[test]
    fn test_create_return_req202_rejects_invalid_replay_before_idempotency_return() {
        // REQ-202 / UI-03-D6: 過去に存在し得る不正レコードも replay で許可しない
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "RTN-015", 10);

        let req = make_return_req("ret-key-15", vec![return_item("RTN-015", "out", 1)]);
        let header = format!(
            "{}|{}|{}",
            req.return_type, req.return_date, req.register_processed
        );
        let item_lines: Vec<String> = req
            .items
            .iter()
            .map(|i| format!("{}|{}|{}", i.product_code, i.quantity, i.direction))
            .collect();
        let fingerprint = compute_fingerprint(&header, &item_lines);
        let record_id = return_repo::insert_return_record(
            &conn,
            &crate::db::return_repo::NewReturnRecord {
                return_type: req.return_type.clone(),
                return_date: req.return_date.clone(),
                register_processed: req.register_processed,
                receipt_image_path: req.receipt_image_path.clone(),
                note: req.note.clone(),
                idempotency_key: req.idempotency_key.clone(),
                request_fingerprint: fingerprint,
            },
        )
        .unwrap();
        return_repo::insert_return_item(
            &conn,
            &crate::db::return_repo::NewReturnItem {
                return_record_id: record_id,
                product_code: "RTN-015".to_string(),
                direction: "out".to_string(),
                quantity: 1,
            },
        )
        .unwrap();

        let result = create_return(&mut conn, req);

        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    fn test_create_return_req202_exchange_type() {
        // REQ-202: 返品・交換記録 — return_type="exchange" も正常に動作すること
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "RTN-010A", 10);
        create_test_product(&conn, "RTN-010B", 10);

        let mut req = make_return_req(
            "ret-key-10",
            vec![
                return_item("RTN-010A", "in", 1),
                return_item("RTN-010B", "out", 1),
            ],
        );
        req.return_type = "exchange".to_string();
        let result = create_return(&mut conn, req).unwrap();
        assert!(result.created);

        let pa = product_repo::find_by_product_code(&conn, "RTN-010A")
            .unwrap()
            .unwrap();
        assert_eq!(pa.product.stock_quantity, 11);

        let pb = product_repo::find_by_product_code(&conn, "RTN-010B")
            .unwrap()
            .unwrap();
        assert_eq!(pb.product.stock_quantity, 9);
    }

    #[test]
    fn test_create_return_req202_validation_quantity_zero() {
        // REQ-202: 返品・交換記録 — バリデーション: 数量 <= 0 → エラー
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "RTN-011", 10);

        let req = make_return_req("ret-key-11", vec![return_item("RTN-011", "in", 0)]);
        let result = create_return(&mut conn, req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }
}
