//! 廃棄・破損記録（create_disposal）

use crate::biz::BizError;
use crate::db::disposal_repo;
use crate::db::inventory_repo::{MovementType, ReferenceType};
use crate::db::product_repo;
use crate::db::system_repo;
use crate::db::{DbConnection, DbError};

use std::collections::BTreeMap;

use super::common::{apply_stock_change, compute_fingerprint, IDEMPOTENCY_KEY_MAX_LEN};

/// 廃棄・破損記録リクエスト（31-biz-inventory-service.md §12.6）
#[derive(Debug, Clone, serde::Deserialize, specta::Type)]
pub struct DisposalCreateRequest {
    pub idempotency_key: String,
    pub disposal_date: String,
    pub items: Vec<DisposalItemInput>,
}

#[derive(Debug, Clone, serde::Deserialize, specta::Type)]
pub struct DisposalItemInput {
    pub product_code: String,
    pub disposal_type: String,
    pub quantity: i64,
    pub cost_price: i64,
    pub reason: String,
}

/// 廃棄・破損記録の結果
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct DisposalCreateResult {
    pub record_id: i64,
    pub created: bool,
    pub idempotent_replay: bool,
    pub stock_warnings: Vec<String>,
}

/// 廃棄・破損記録を登録し、在庫を減少させる
///
/// 31-biz-inventory-service.md §12.6
pub fn create_disposal(
    conn: &mut DbConnection,
    req: DisposalCreateRequest,
) -> Result<DisposalCreateResult, BizError> {
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

    // 明細空チェック（fingerprint 計算より先に実行）
    if req.items.is_empty() {
        return Err(BizError::ValidationFailed(
            "明細が1件以上必要です".to_string(),
        ));
    }

    // fingerprint（リクエストフィールドのみ使用、DB参照不要）
    let item_lines: Vec<String> = req
        .items
        .iter()
        .map(|i| {
            format!(
                "{}|{}|{}|{}|{}",
                i.product_code, i.quantity, i.cost_price, i.disposal_type, i.reason
            )
        })
        .collect();
    let fingerprint = compute_fingerprint(&req.disposal_date, &item_lines);

    // 冪等性チェック（バリデーションより先に実行）
    if let Some((existing_id, existing_fp)) =
        disposal_repo::find_disposal_by_idempotency_key(conn, &normalized_key)?
    {
        if existing_fp == fingerprint {
            return Ok(DisposalCreateResult {
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
    for (i, item) in req.items.iter().enumerate() {
        if item.quantity <= 0 {
            return Err(BizError::ValidationFailed(format!(
                "明細{}: 数量は1以上必要です",
                i + 1
            )));
        }
        if item.cost_price < 0 {
            return Err(BizError::ValidationFailed(format!(
                "明細{}: 原価は0以上必要です",
                i + 1
            )));
        }
        if item.reason.trim().is_empty() {
            return Err(BizError::ValidationFailed(format!(
                "明細{}: 理由は必須です",
                i + 1
            )));
        }
        let valid_types = ["disposal", "damage", "other"];
        if !valid_types.contains(&item.disposal_type.as_str()) {
            return Err(BizError::ValidationFailed(format!(
                "明細{}: 廃棄種別が不正です: {}",
                i + 1,
                item.disposal_type
            )));
        }
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

    let record_id = match disposal_repo::insert_disposal_record(
        &tx,
        &crate::db::disposal_repo::NewDisposalRecord {
            disposal_date: req.disposal_date.clone(),
            idempotency_key: normalized_key.clone(),
            request_fingerprint: fingerprint.clone(),
        },
    ) {
        Ok(id) => id,
        Err(DbError::DuplicateKey(_)) => {
            let (existing_id, existing_fp) =
                disposal_repo::find_disposal_by_idempotency_key(&tx, &normalized_key)?.ok_or_else(
                    || {
                        BizError::DatabaseError(DbError::QueryFailed(
                            "DuplicateKey後にレコードが見つかりません".to_string(),
                        ))
                    },
                )?;
            if existing_fp == fingerprint {
                return Ok(DisposalCreateResult {
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
        disposal_repo::insert_disposal_item(
            &tx,
            &crate::db::disposal_repo::NewDisposalItem {
                disposal_record_id: record_id,
                product_code: item.product_code.clone(),
                disposal_type: item.disposal_type.clone(),
                quantity: item.quantity,
                cost_price: item.cost_price,
                reason: item.reason.clone(),
            },
        )?;

        let outcome = apply_stock_change(
            &tx,
            &item.product_code,
            -item.quantity,
            MovementType::Disposal,
            ReferenceType::DisposalRecord,
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

    // BTreeMap → Vec（product_code 昇順・重複排除済み）
    let stock_warnings: Vec<String> = stock_warnings_map.into_values().collect();

    let detail = serde_json::json!({
        "record_id": record_id,
        "item_count": req.items.len(),
        "warning_count": stock_warnings.len(),
        "idempotency_key": normalized_key,
    });
    system_repo::insert_operation_log(
        &tx,
        &crate::db::system_repo::NewOperationLog {
            operation_type: "disposal_create".to_string(),
            summary: format!("廃棄記録作成（{}明細）", req.items.len()),
            detail_json: Some(detail.to_string()),
        },
    )?;

    tx.commit()
        .map_err(|e| BizError::DatabaseError(DbError::from(e)))?;

    Ok(DisposalCreateResult {
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

    fn make_disposal_req(key: &str, items: Vec<DisposalItemInput>) -> DisposalCreateRequest {
        DisposalCreateRequest {
            idempotency_key: key.to_string(),
            disposal_date: "2026-04-07".to_string(),
            items,
        }
    }

    fn disposal_item(code: &str, qty: i64, cost: i64, reason: &str) -> DisposalItemInput {
        DisposalItemInput {
            product_code: code.to_string(),
            disposal_type: "disposal".to_string(),
            quantity: qty,
            cost_price: cost,
            reason: reason.to_string(),
        }
    }

    #[test]
    fn test_create_disposal_req204_normal() {
        // REQ-204: 廃棄・破損記録 — 正常な廃棄記録作成
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "DSP-001", 10);

        let req = make_disposal_req(
            "dsp-key-1",
            vec![disposal_item("DSP-001", 2, 300, "袋破れ")],
        );
        let result = create_disposal(&mut conn, req).unwrap();
        assert!(result.created);
        assert!(!result.idempotent_replay);

        // 在庫減少
        let p = product_repo::find_by_product_code(&conn, "DSP-001")
            .unwrap()
            .unwrap();
        assert_eq!(p.product.stock_quantity, 8);
    }

    #[test]
    fn test_create_disposal_req204_stock_decrease_confirmed() {
        // REQ-204: 廃棄・破損記録 — 在庫減少の詳細確認（movement レコード含む）
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "DSP-002", 15);

        let req = make_disposal_req(
            "dsp-key-2",
            vec![disposal_item("DSP-002", 5, 200, "色焼け")],
        );
        create_disposal(&mut conn, req).unwrap();

        let (qty, mt): (i64, String) = conn
            .query_row(
                "SELECT quantity, movement_type FROM inventory_movements WHERE product_code = 'DSP-002'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(qty, -5); // 在庫視点で負
        assert_eq!(mt, "disposal");
    }

    #[test]
    fn test_create_disposal_req204_idempotent_replay() {
        // REQ-204: 廃棄・破損記録 — 冪等性リプレイ（副作用ゼロ）
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "DSP-003", 10);

        let req = make_disposal_req("dsp-key-3", vec![disposal_item("DSP-003", 2, 300, "破損")]);
        let r1 = create_disposal(&mut conn, req.clone()).unwrap();

        let log_count_before: i64 = conn
            .query_row("SELECT COUNT(*) FROM operation_logs", [], |r| r.get(0))
            .unwrap();

        let r2 = create_disposal(&mut conn, req).unwrap();
        assert!(!r2.created);
        assert!(r2.idempotent_replay);
        assert_eq!(r2.record_id, r1.record_id);

        // 在庫は1回だけ減少
        let p = product_repo::find_by_product_code(&conn, "DSP-003")
            .unwrap()
            .unwrap();
        assert_eq!(p.product.stock_quantity, 8);

        let log_count_after: i64 = conn
            .query_row("SELECT COUNT(*) FROM operation_logs", [], |r| r.get(0))
            .unwrap();
        assert_eq!(log_count_before, log_count_after);
    }

    #[test]
    fn test_create_disposal_req204_idempotency_conflict() {
        // REQ-204: 廃棄・破損記録 — 同じキー+異なる内容 → IdempotencyConflict
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "DSP-004", 10);

        let req1 = make_disposal_req(
            "dsp-key-4",
            vec![disposal_item("DSP-004", 2, 300, "袋破れ")],
        );
        create_disposal(&mut conn, req1).unwrap();

        let req2 = make_disposal_req(
            "dsp-key-4",
            vec![disposal_item("DSP-004", 5, 300, "袋破れ")],
        );
        let result = create_disposal(&mut conn, req2);
        assert!(matches!(result, Err(BizError::IdempotencyConflict(_))));
    }

    #[test]
    fn test_create_disposal_req204_stock_warnings_dedup_by_product_code() {
        // REQ-204: 廃棄・破損記録 — P2-2回帰: 同一product_codeが複数明細で警告→1件に集約、後勝ち
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "WARN-DUP", 0);

        let req = make_disposal_req(
            "warn-dup-test",
            vec![
                disposal_item("WARN-DUP", 1, 100, "テスト1"),
                disposal_item("WARN-DUP", 2, 100, "テスト2"),
            ],
        );

        let result = create_disposal(&mut conn, req).unwrap();
        // 同一product_codeなので警告は1件に集約
        assert_eq!(result.stock_warnings.len(), 1);
        // 後勝ち: 2回目の変動後の stock_after が使われる (0 - 1 - 2 = -3)
        assert!(result.stock_warnings[0].contains("-3"));
    }

    #[test]
    fn test_create_disposal_req204_validation_empty_key() {
        // REQ-204: 廃棄・破損記録 — バリデーション: 空白のみの冪等性キー → エラー
        let (_dir, mut conn) = setup_test_db();
        let req = make_disposal_req("  ", vec![disposal_item("X", 1, 100, "理由")]);
        let result = create_disposal(&mut conn, req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    fn test_create_disposal_req204_validation_empty_reason() {
        // REQ-204: 廃棄・破損記録 — reason 空文字 → エラー
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "DSP-006", 10);

        let req = make_disposal_req("dsp-key-6", vec![disposal_item("DSP-006", 1, 100, "")]);
        let result = create_disposal(&mut conn, req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    fn test_create_disposal_req204_validation_invalid_type() {
        // REQ-204: 廃棄・破損記録 — 不正な disposal_type → エラー
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "DSP-007", 10);

        let mut item = disposal_item("DSP-007", 1, 100, "理由");
        item.disposal_type = "invalid".to_string();
        let req = make_disposal_req("dsp-key-7", vec![item]);
        let result = create_disposal(&mut conn, req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    fn test_create_disposal_req204_validation_quantity_zero() {
        // REQ-204: 廃棄・破損記録 — バリデーション: 数量 <= 0 → エラー
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "DSP-008", 10);

        let req = make_disposal_req("dsp-key-8", vec![disposal_item("DSP-008", 0, 100, "理由")]);
        let result = create_disposal(&mut conn, req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    fn test_create_disposal_req204_validation_negative_cost() {
        // REQ-204: 廃棄・破損記録 — バリデーション: 原価 < 0 → エラー
        let (_dir, mut conn) = setup_test_db();
        create_test_product(&conn, "DSP-009", 10);

        let req = make_disposal_req("dsp-key-9", vec![disposal_item("DSP-009", 1, -1, "理由")]);
        let result = create_disposal(&mut conn, req);
        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }
}
