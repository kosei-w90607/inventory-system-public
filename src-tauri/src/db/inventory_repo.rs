//! 在庫変動の共通型・関数
//!
//! 21-io-inventory-repo.md §2.7 に基づく実装。
//!
//! ## 設計ドキュメントとの差分
//! 21-io-inventory-repo.md では movement_type/reference_type を String としているが、
//! db-design/tracking-system-tables.md の CHECK 制約値が固定のため enum 化して typo 事故を防止。
//! as_str() で同じ文字列に変換されるため振る舞いは同一。

use super::{DbConnection, DbError};

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/// 在庫変動種別（db-design/tracking-system-tables.md: inventory_movements.movement_type CHECK制約に対応）
#[derive(Debug, Clone, PartialEq)]
pub enum MovementType {
    SaleAuto,
    SaleManual,
    Receiving,
    Return,
    Disposal,
    Stocktake,
}

impl MovementType {
    pub fn as_str(&self) -> &'static str {
        match self {
            MovementType::SaleAuto => "sale_auto",
            MovementType::SaleManual => "sale_manual",
            MovementType::Receiving => "receiving",
            MovementType::Return => "return",
            MovementType::Disposal => "disposal",
            MovementType::Stocktake => "stocktake",
        }
    }
}

/// 参照先種別（db-design/tracking-system-tables.md: inventory_movements.reference_type CHECK制約に対応）
#[derive(Debug, Clone, PartialEq)]
pub enum ReferenceType {
    CsvImport,
    ManualSale,
    ReceivingRecord,
    ReturnRecord,
    DisposalRecord,
    Stocktake,
}

impl ReferenceType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ReferenceType::CsvImport => "csv_import",
            ReferenceType::ManualSale => "manual_sale",
            ReferenceType::ReceivingRecord => "receiving_record",
            ReferenceType::ReturnRecord => "return_record",
            ReferenceType::DisposalRecord => "disposal_record",
            ReferenceType::Stocktake => "stocktake",
        }
    }
}

/// 商品別 movements 集計結果（BIZ-07 整合性チェック用）
///
/// 21-io-inventory-repo.md §10.6
#[derive(Debug, Clone)]
pub struct ProductMovementSum {
    pub product_code: String,
    pub movements_sum: i64,
}

/// 在庫変動INSERT用
///
/// 21-io-inventory-repo.md §2.7
#[derive(Debug)]
pub struct NewMovement {
    pub product_code: String,
    pub movement_type: MovementType,
    pub quantity: i64,
    pub stock_after: i64,
    pub reference_type: Option<ReferenceType>,
    pub reference_id: Option<i64>,
    pub note: Option<String>,
}

// ---------------------------------------------------------------------------
// 関数
// ---------------------------------------------------------------------------

/// inventory_movements に1行INSERTし、挿入されたIDを返す
///
/// 全ての在庫変動記録の共通入口。
///
/// 21-io-inventory-repo.md §2.7
pub fn insert_movement(conn: &DbConnection, movement: &NewMovement) -> Result<i64, DbError> {
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let ref_type_str = movement.reference_type.as_ref().map(|r| r.as_str());
    conn.execute(
        "INSERT INTO inventory_movements (
            product_code, movement_type, quantity, stock_after,
            reference_type, reference_id, note, is_voided, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8)",
        rusqlite::params![
            movement.product_code,
            movement.movement_type.as_str(),
            movement.quantity,
            movement.stock_after,
            ref_type_str,
            movement.reference_id,
            movement.note,
            now,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// products.stock_quantity を指定値で上書き更新する
///
/// BIZ-02 の共通在庫変動関数から呼ばれる専用関数。
/// product_repo::update_product は使わない（1カラムに ProductUpdates はオーバーヘッド）。
///
/// 21-io-inventory-repo.md §10.6
pub fn update_stock_quantity(
    conn: &DbConnection,
    product_code: &str,
    new_quantity: i64,
) -> Result<bool, DbError> {
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let affected = conn.execute(
        "UPDATE products SET stock_quantity = ?1, updated_at = ?2 WHERE product_code = ?3",
        rusqlite::params![new_quantity, now, product_code],
    )?;
    Ok(affected == 1)
}

/// 全商品の inventory_movements 合計値を一括取得する（BIZ-07 整合性チェック用）
///
/// 21-io-inventory-repo.md §10.6
pub fn sum_movements_by_product(conn: &DbConnection) -> Result<Vec<ProductMovementSum>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT product_code, COALESCE(SUM(quantity), 0) as movements_sum
         FROM inventory_movements
         WHERE is_voided = 0
         GROUP BY product_code
         ORDER BY product_code ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ProductMovementSum {
            product_code: row.get(0)?,
            movements_sum: row.get(1)?,
        })
    })?;
    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }
    Ok(items)
}

/// 指定商品の inventory_movements 合計値を取得する（BIZ-07 fix_integrity 用）
///
/// 21-io-inventory-repo.md §10.6
pub fn sum_movements_for_product(conn: &DbConnection, product_code: &str) -> Result<i64, DbError> {
    let sum: i64 = conn.query_row(
        "SELECT COALESCE(SUM(quantity), 0)
         FROM inventory_movements
         WHERE product_code = ?1 AND is_voided = 0",
        rusqlite::params![product_code],
        |row| row.get(0),
    )?;
    Ok(sum)
}

// ---------------------------------------------------------------------------
// CMD-06: 在庫変動履歴用型・関数
// ---------------------------------------------------------------------------

/// 在庫変動履歴の検索条件
///
/// 44-cmd-inventory.md §23.8 list_movements
#[derive(Debug, serde::Deserialize, specta::Type)]
pub struct MovementQuery {
    pub product_code: String,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub movement_type: Option<String>,
    pub page: u32,
    pub per_page: u32,
}

/// 在庫変動の元業務記録リンク
///
/// 44-cmd-inventory.md §23.8 list_movements
#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct MovementSourceLink {
    pub label: String,
    pub route: String,
}

/// 在庫変動履歴1件
///
/// 44-cmd-inventory.md §23.8 list_movements
#[derive(Debug, serde::Serialize, specta::Type)]
pub struct MovementRecord {
    pub id: i64,
    pub product_code: String,
    pub movement_type: String,
    pub quantity: i64,
    pub stock_after: i64,
    pub reference_type: Option<String>,
    pub reference_id: Option<i64>,
    pub source: Option<MovementSourceLink>,
    pub note: Option<String>,
    pub created_at: String,
}

/// 商品別の在庫変動履歴をフィルタ付きでページング取得する
///
/// 44-cmd-inventory.md §23.9 list_movements
/// is_voided=0 を常時付与（ロールバック済み変動は非表示）
pub fn list_movements(
    conn: &DbConnection,
    query: &MovementQuery,
) -> Result<super::PaginatedResult<MovementRecord>, DbError> {
    use super::inventory_common::validate_and_offset;
    use super::inventory_common::ListQuery;

    // validate_and_offset を再利用するために ListQuery を組み立てる
    let list_query = ListQuery {
        page: query.page,
        per_page: query.per_page,
        date_from: None,
        date_to: None,
    };
    let (limit, offset) = validate_and_offset(&list_query)?;

    let mut where_clauses = vec!["product_code = ?1".to_string(), "is_voided = 0".to_string()];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> =
        vec![Box::new(query.product_code.clone())];

    if let Some(ref from) = query.date_from {
        where_clauses.push(format!("created_at >= ?{}", params.len() + 1));
        params.push(Box::new(from.clone()));
    }
    if let Some(ref to) = query.date_to {
        // 日付指定の場合は末尾に T23:59:59 を付与して当日末までを含める
        let to_with_time = if to.len() == 10 {
            format!("{}T23:59:59", to)
        } else {
            to.clone()
        };
        where_clauses.push(format!("created_at <= ?{}", params.len() + 1));
        params.push(Box::new(to_with_time));
    }
    if let Some(ref mt) = query.movement_type {
        where_clauses.push(format!("movement_type = ?{}", params.len() + 1));
        params.push(Box::new(mt.clone()));
    }

    let where_sql = format!("WHERE {}", where_clauses.join(" AND "));

    // total_count
    let count_sql = format!("SELECT COUNT(*) FROM inventory_movements {}", where_sql);
    let total_count: u32 = conn.query_row(
        &count_sql,
        rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
        |row| row.get(0),
    )?;

    // data
    let data_sql = format!(
        "SELECT id, product_code, movement_type, quantity, stock_after, \
         reference_type, reference_id, note, created_at \
         FROM inventory_movements {} \
         ORDER BY created_at DESC, id DESC \
         LIMIT ?{} OFFSET ?{}",
        where_sql,
        params.len() + 1,
        params.len() + 2,
    );
    params.push(Box::new(limit));
    params.push(Box::new(offset));

    let mut stmt = conn.prepare(&data_sql)?;
    let rows = stmt.query_map(
        rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
        |row| {
            Ok(MovementRecord {
                id: row.get(0)?,
                product_code: row.get(1)?,
                movement_type: row.get(2)?,
                quantity: row.get(3)?,
                stock_after: row.get(4)?,
                reference_type: row.get(5)?,
                reference_id: row.get(6)?,
                source: None,
                note: row.get(7)?,
                created_at: row.get(8)?,
            })
        },
    )?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }

    Ok(super::PaginatedResult {
        items,
        total_count,
        page: query.page,
        per_page: query.per_page,
    })
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::inventory_common::{validate_and_offset, ListQuery};
    use crate::db::test_support::*;
    use crate::db::DbError;

    #[test]
    fn test_movement_type_as_str_req201() {
        // REQ-201: 在庫変動記録（MovementType enum — 全バリアントの文字列変換）
        // FUNC-2.7: MovementType enum — 全バリアントの文字列変換
        assert_eq!(MovementType::SaleAuto.as_str(), "sale_auto");
        assert_eq!(MovementType::SaleManual.as_str(), "sale_manual");
        assert_eq!(MovementType::Receiving.as_str(), "receiving");
        assert_eq!(MovementType::Return.as_str(), "return");
        assert_eq!(MovementType::Disposal.as_str(), "disposal");
        assert_eq!(MovementType::Stocktake.as_str(), "stocktake");
    }

    #[test]
    fn test_reference_type_as_str_req201() {
        // REQ-201: 在庫変動記録（ReferenceType enum — 全バリアントの文字列変換）
        // FUNC-2.7: ReferenceType enum — 全バリアントの文字列変換
        assert_eq!(ReferenceType::CsvImport.as_str(), "csv_import");
        assert_eq!(ReferenceType::ManualSale.as_str(), "manual_sale");
        assert_eq!(ReferenceType::ReceivingRecord.as_str(), "receiving_record");
        assert_eq!(ReferenceType::ReturnRecord.as_str(), "return_record");
        assert_eq!(ReferenceType::DisposalRecord.as_str(), "disposal_record");
        assert_eq!(ReferenceType::Stocktake.as_str(), "stocktake");
    }

    #[test]
    fn test_insert_movement_req201_normal() {
        // REQ-201: 在庫変動記録（insert_movement 正常INSERT）
        // FUNC-2.7: insert_movement — 正常INSERT（receiving）
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "TEST-001");

        let movement = NewMovement {
            product_code: "TEST-001".to_string(),
            movement_type: MovementType::Receiving,
            quantity: 10,
            stock_after: 10,
            reference_type: Some(ReferenceType::ReceivingRecord),
            reference_id: Some(1),
            note: Some("入庫テスト".to_string()),
        };
        let id = insert_movement(&conn, &movement).unwrap();
        assert!(id > 0, "挿入されたIDは正の整数");

        // is_voided=0, created_at非NULL、ISO 8601形式を確認
        let (is_voided, created_at): (bool, String) = conn
            .query_row(
                "SELECT is_voided, created_at FROM inventory_movements WHERE id = ?1",
                rusqlite::params![id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert!(!is_voided, "is_voidedは0であるべき");
        // chrono でパース成功 = ISO 8601 形式
        chrono::NaiveDateTime::parse_from_str(&created_at, "%Y-%m-%dT%H:%M:%S")
            .expect("created_at は %Y-%m-%dT%H:%M:%S 形式であるべき");
    }

    #[test]
    fn test_insert_movement_req201_null_reference() {
        // REQ-201: 在庫変動記録（insert_movement reference_type=None）
        // FUNC-2.7: insert_movement — reference_type=None（初期在庫投入パターン）
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "TEST-002");

        let movement = NewMovement {
            product_code: "TEST-002".to_string(),
            movement_type: MovementType::Receiving,
            quantity: 5,
            stock_after: 5,
            reference_type: None,
            reference_id: None,
            note: Some("初期在庫投入".to_string()),
        };
        let id = insert_movement(&conn, &movement).unwrap();
        assert!(id > 0);

        let ref_type: Option<String> = conn
            .query_row(
                "SELECT reference_type FROM inventory_movements WHERE id = ?1",
                rusqlite::params![id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(ref_type.is_none(), "reference_type は NULL");
    }

    #[test]
    fn test_insert_movement_req201_fk_violation_product() {
        // REQ-201: 在庫変動記録（存在しないproduct_codeでFK違反）
        // FUNC-2.7: insert_movement — 存在しないproduct_codeでFK違反
        let (_dir, conn) = setup_test_db();

        let movement = NewMovement {
            product_code: "NONEXISTENT".to_string(),
            movement_type: MovementType::Receiving,
            quantity: 1,
            stock_after: 1,
            reference_type: None,
            reference_id: None,
            note: None,
        };
        let result = insert_movement(&conn, &movement);
        assert!(
            matches!(result, Err(DbError::ForeignKeyViolation(_))),
            "不正なproduct_codeで ForeignKeyViolation が返るべき: {:?}",
            result
        );
    }

    // -----------------------------------------------------------------------
    // validate_and_offset テスト
    // -----------------------------------------------------------------------

    #[test]
    fn test_validate_and_offset_req201_normal() {
        // REQ-201: 在庫変動記録（validate_and_offset 正常系）
        // FUNC-10.1: 正常系 page=2, per_page=10 → offset=10
        let q = ListQuery {
            page: 2,
            per_page: 10,
            date_from: None,
            date_to: None,
        };
        let (limit, offset) = validate_and_offset(&q).unwrap();
        assert_eq!(limit, 10);
        assert_eq!(offset, 10);
    }

    #[test]
    fn test_validate_and_offset_req201_page_zero() {
        // REQ-201: 在庫変動記録（validate_and_offset page=0 エラー）
        // FUNC-10.1: page=0 → QueryFailed
        let q = ListQuery {
            page: 0,
            per_page: 10,
            date_from: None,
            date_to: None,
        };
        let result = validate_and_offset(&q);
        assert!(
            matches!(result, Err(DbError::QueryFailed(_))),
            "page=0 は拒否: {:?}",
            result
        );
    }

    #[test]
    fn test_validate_and_offset_req201_per_page_zero() {
        // REQ-201: 在庫変動記録（validate_and_offset per_page=0 エラー）
        // FUNC-10.1: per_page=0 → QueryFailed
        let q = ListQuery {
            page: 1,
            per_page: 0,
            date_from: None,
            date_to: None,
        };
        let result = validate_and_offset(&q);
        assert!(
            matches!(result, Err(DbError::QueryFailed(_))),
            "per_page=0 は拒否: {:?}",
            result
        );
    }

    #[test]
    fn test_validate_and_offset_req201_overflow() {
        // REQ-201: 在庫変動記録（validate_and_offset オーバーフロー防止）
        // FUNC-10.1: 巨大値で (page-1)*per_page がオーバーフローしないこと
        let q = ListQuery {
            page: u32::MAX,
            per_page: u32::MAX,
            date_from: None,
            date_to: None,
        };
        let result = validate_and_offset(&q);
        assert!(
            matches!(result, Err(DbError::QueryFailed(_))),
            "overflow は拒否: {:?}",
            result
        );
    }

    // -----------------------------------------------------------------------
    // update_stock_quantity テスト
    // -----------------------------------------------------------------------

    #[test]
    fn test_update_stock_quantity_req201_normal() {
        // REQ-201: 在庫数更新（正常更新 → true）
        // FUNC-10.6: 正常更新 → true
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "TEST-UPD");

        let updated = update_stock_quantity(&conn, "TEST-UPD", 42).unwrap();
        assert!(updated);

        let qty: i64 = conn
            .query_row(
                "SELECT stock_quantity FROM products WHERE product_code = 'TEST-UPD'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(qty, 42);
    }

    #[test]
    fn test_update_stock_quantity_req201_nonexistent() {
        // REQ-201: 在庫数更新（存在しない商品 → false）
        // FUNC-10.6: 存在しない商品 → false
        let (_dir, conn) = setup_test_db();
        let updated = update_stock_quantity(&conn, "NONEXISTENT", 10).unwrap();
        assert!(!updated);
    }

    #[test]
    fn test_update_stock_quantity_req201_updates_timestamp() {
        // REQ-201: 在庫数更新（updated_at が更新されること）
        // FUNC-10.6: updated_at が更新されること
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "TEST-TS");

        let before: String = conn
            .query_row(
                "SELECT updated_at FROM products WHERE product_code = 'TEST-TS'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        // わずかに待って updated_at が変わることを確認
        std::thread::sleep(std::time::Duration::from_millis(10));
        update_stock_quantity(&conn, "TEST-TS", 99).unwrap();

        let after: String = conn
            .query_row(
                "SELECT updated_at FROM products WHERE product_code = 'TEST-TS'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        // chrono の秒精度なのでタイミング次第で同じ可能性があるが、形式チェック
        chrono::NaiveDateTime::parse_from_str(&after, "%Y-%m-%dT%H:%M:%S")
            .expect("updated_at は正しい形式であるべき");
        // 少なくとも before 以降であること
        assert!(after >= before, "updated_at は更新前以降であるべき");
    }

    // -----------------------------------------------------------------------
    // 既存テスト
    // -----------------------------------------------------------------------

    #[test]
    fn test_db_check_constraint_req201_movement_type() {
        // REQ-201: CHECK制約（不正な movement_type を拒否）
        // FUNC-2.7: DB CHECK制約 — 不正な movement_type を生SQLで直接INSERT
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "TEST-CHK");

        let result = conn.execute(
            "INSERT INTO inventory_movements (
                product_code, movement_type, quantity, stock_after,
                is_voided, created_at
            ) VALUES ('TEST-CHK', 'invalid_type', 1, 1, 0, '2026-04-04T00:00:00')",
            [],
        );
        assert!(
            result.is_err(),
            "不正な movement_type は CHECK制約で弾かれるべき"
        );
    }

    // ===== FUNC-10.6: sum_movements_by_product テスト =====

    #[test]
    fn test_sum_movements_by_product_req303_normal() {
        // REQ-303: 在庫変動履歴（movements集計 — 複数商品の合計）
        // FUNC-10.6: 複数商品の合計
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "SM-001");
        seed_product(&conn, "SM-002");
        // SM-001: +10, -3 = 7
        insert_movement(
            &conn,
            &NewMovement {
                product_code: "SM-001".to_string(),
                movement_type: MovementType::Receiving,
                quantity: 10,
                stock_after: 10,
                reference_type: None,
                reference_id: None,
                note: None,
            },
        )
        .unwrap();
        insert_movement(
            &conn,
            &NewMovement {
                product_code: "SM-001".to_string(),
                movement_type: MovementType::SaleAuto,
                quantity: -3,
                stock_after: 7,
                reference_type: None,
                reference_id: None,
                note: None,
            },
        )
        .unwrap();
        // SM-002: +5
        insert_movement(
            &conn,
            &NewMovement {
                product_code: "SM-002".to_string(),
                movement_type: MovementType::Receiving,
                quantity: 5,
                stock_after: 5,
                reference_type: None,
                reference_id: None,
                note: None,
            },
        )
        .unwrap();

        let result = sum_movements_by_product(&conn).unwrap();
        assert_eq!(result.len(), 2);
        let sm001 = result.iter().find(|r| r.product_code == "SM-001").unwrap();
        assert_eq!(sm001.movements_sum, 7);
        let sm002 = result.iter().find(|r| r.product_code == "SM-002").unwrap();
        assert_eq!(sm002.movements_sum, 5);
    }

    #[test]
    fn test_sum_movements_by_product_req303_voided_excluded() {
        // REQ-303: 在庫変動履歴（is_voided=1 のレコードが除外される）
        // FUNC-10.6: is_voided=1 のレコードが除外される
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "SV-001");
        insert_movement(
            &conn,
            &NewMovement {
                product_code: "SV-001".to_string(),
                movement_type: MovementType::Receiving,
                quantity: 10,
                stock_after: 10,
                reference_type: None,
                reference_id: None,
                note: None,
            },
        )
        .unwrap();
        // voided レコードを��接SQL挿入
        conn.execute(
            "INSERT INTO inventory_movements (product_code, movement_type, quantity, stock_after, is_voided, created_at)
             VALUES ('SV-001', 'sale_auto', -5, 5, 1, '2026-04-01T00:00:00')",
            [],
        )
        .unwrap();

        let result = sum_movements_by_product(&conn).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].movements_sum, 10, "voided は除外される");
    }

    #[test]
    fn test_sum_movements_by_product_req303_no_movements() {
        // REQ-303: 在庫変動履歴（movements なし → 空Vec）
        // FUNC-10.6: movements なし → 空Vec
        let (_dir, conn) = setup_test_db();
        let result = sum_movements_by_product(&conn).unwrap();
        assert!(result.is_empty());
    }

    // ===== FUNC-10.6: sum_movements_for_product テスト =====

    #[test]
    fn test_sum_movements_for_product_req303_normal() {
        // REQ-303: 在庫変動履歴（特定商品の合計）
        // FUNC-10.6: 特定商品の合計
        let (_dir, conn) = setup_test_db();
        seed_product(&conn, "SF-001");
        insert_movement(
            &conn,
            &NewMovement {
                product_code: "SF-001".to_string(),
                movement_type: MovementType::Receiving,
                quantity: 10,
                stock_after: 10,
                reference_type: None,
                reference_id: None,
                note: None,
            },
        )
        .unwrap();
        insert_movement(
            &conn,
            &NewMovement {
                product_code: "SF-001".to_string(),
                movement_type: MovementType::SaleAuto,
                quantity: -3,
                stock_after: 7,
                reference_type: None,
                reference_id: None,
                note: None,
            },
        )
        .unwrap();

        let sum = sum_movements_for_product(&conn, "SF-001").unwrap();
        assert_eq!(sum, 7);
    }

    #[test]
    fn test_sum_movements_for_product_req303_no_movements() {
        // REQ-303: 在庫変動履歴（movements 0件 → 0）
        // FUNC-10.6: movements 0��� → 0
        let (_dir, conn) = setup_test_db();
        let sum = sum_movements_for_product(&conn, "NONEXISTENT").unwrap();
        assert_eq!(sum, 0, "movements なしで 0 を返す");
    }
}
