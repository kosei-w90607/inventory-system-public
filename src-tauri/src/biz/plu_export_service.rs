//! BIZ-04: PLU書出しロジック
//!
//! 商品マスタからカシオレジスターツール用PLUファイルを生成し、
//! 保存後に利用者が確認した対象だけ plu_dirty/plu_exported_at を更新する。
//!
//! docs/function-design/33-biz-plu-export-service.md に基づく実装。

use crate::constants::SCANNING_PLU_EXPORT_LIMIT;
use crate::db::product_repo::{self, Product, ProductUpdates};
use crate::db::system_repo::{self, NewOperationLog};
use crate::db::DbConnection;
use crate::io::plu_formatter::{self, PluCsvOutput, PluExportRow};

use super::BizError;
use std::collections::{BTreeMap, HashSet};

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/// 書出しモード
#[derive(Debug, Clone)]
pub enum ExportMode {
    /// 全件（is_discontinued=0）
    Full,
    /// 差分（plu_dirty=1）
    Diff,
}

/// PLUファイル生成リクエスト
#[derive(Debug)]
pub struct PluExportPrepareRequest {
    pub mode: ExportMode,
}

/// PLUファイル生成結果
#[derive(Debug)]
pub struct PluExportPreparedResult {
    /// IO-04生成のPLUファイルデータ
    pub csv_output: PluCsvOutput,
    /// 書出し件数
    pub count: usize,
    /// PLUファイルに含めた商品コード一覧
    pub target_product_codes: Vec<String>,
    /// PLUファイルに含めなかった商品一覧
    pub excluded: Vec<PluExcludedProduct>,
    /// PLU上限超過警告（互換維持フィールド）
    pub over_limit_warning: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PluExcludedProduct {
    pub product_code: String,
    pub jan_code: Option<String>,
    pub name: String,
    pub reason: PluExcludedReason,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PluExcludedReason {
    MissingJan,
    InvalidJanFormat,
    InvalidCheckDigit,
    GroupPriceMismatch,
}

/// PLU保存済み確認リクエスト
#[derive(Debug)]
pub struct PluExportConfirmRequest {
    pub product_codes: Vec<String>,
}

/// PLU保存済み確認結果
#[derive(Debug)]
pub struct PluExportConfirmResult {
    pub updated_count: usize,
    pub confirmed_at: String,
}

// ---------------------------------------------------------------------------
// 公開関数
// ---------------------------------------------------------------------------

/// 指定モードでPLUファイルを生成する。DB状態は更新しない。
///
/// 33-biz-plu-export-service.md セクション16.3
pub fn prepare_plu_export(
    conn: &DbConnection,
    req: PluExportPrepareRequest,
) -> Result<PluExportPreparedResult, BizError> {
    let products = match req.mode {
        ExportMode::Full => product_repo::find_active_products_for_plu(conn)?,
        ExportMode::Diff => product_repo::find_plu_dirty_products_for_plu(conn)?,
    };

    if products.is_empty() {
        return Err(BizError::ValidationFailed(
            "書出し対象の商品がありません".to_string(),
        ));
    }

    let mut excluded = Vec::new();
    let mut valid_groups: BTreeMap<String, Vec<_>> = BTreeMap::new();

    for product in &products {
        match validate_plu_jan(product.product.jan_code.as_deref()) {
            Ok(jan) => {
                valid_groups
                    .entry(jan.to_string())
                    .or_default()
                    .push(product);
            }
            Err(reason) => excluded.push(PluExcludedProduct {
                product_code: product.product.product_code.clone(),
                jan_code: product.product.jan_code.clone(),
                name: product.product.name.clone(),
                reason,
            }),
        }
    }

    let mut rows = Vec::new();
    let mut target_product_codes = Vec::new();
    for (_jan, mut group) in valid_groups {
        group.sort_by(|a, b| a.product.product_code.cmp(&b.product.product_code));
        let first = group[0];
        let group_matches = group.iter().all(|p| {
            p.product.selling_price == first.product.selling_price
                && p.product.tax_rate == first.product.tax_rate
        });
        if !group_matches {
            for p in group {
                excluded.push(PluExcludedProduct {
                    product_code: p.product.product_code.clone(),
                    jan_code: p.product.jan_code.clone(),
                    name: p.product.name.clone(),
                    reason: PluExcludedReason::GroupPriceMismatch,
                });
            }
            continue;
        }

        target_product_codes.extend(group.iter().map(|p| p.product.product_code.clone()));
        rows.push(PluExportRow {
            product_code: first.product.product_code.clone(),
            jan_code: first.product.jan_code.clone(),
            name: first.product.name.clone(),
            selling_price: first.product.selling_price,
            tax_rate: first.product.tax_rate.clone(),
            department_name: first.department_name.clone(),
        });
    }
    excluded.sort_by(|a, b| a.product_code.cmp(&b.product_code));

    let count = rows.len();
    if count > SCANNING_PLU_EXPORT_LIMIT {
        return Err(BizError::ValidationFailed(format!(
            "スキャニングPLU書出し件数が上限の{}件を超えています",
            SCANNING_PLU_EXPORT_LIMIT
        )));
    }

    if rows.is_empty() {
        return Err(BizError::ValidationFailed(build_all_excluded_message(
            &excluded,
        )));
    }
    let over_limit_warning = false;

    let csv_output = plu_formatter::generate_plu_tsv(&rows)
        .map_err(|e| BizError::ImportError(format!("PLUファイルの生成に失敗しました: {}", e)))?;

    Ok(PluExportPreparedResult {
        csv_output,
        count,
        target_product_codes,
        excluded,
        over_limit_warning,
    })
}

/// 保存済み確認された商品だけPLU未反映状態を解除する。
///
/// 33-biz-plu-export-service.md セクション16.3
pub fn confirm_plu_export_saved(
    conn: &mut DbConnection,
    req: PluExportConfirmRequest,
) -> Result<PluExportConfirmResult, BizError> {
    if req.product_codes.is_empty() {
        return Err(BizError::ValidationFailed(
            "書出し済みにする商品がありません".to_string(),
        ));
    }
    let mut seen = HashSet::new();
    for code in &req.product_codes {
        if code.trim().is_empty() {
            return Err(BizError::ValidationFailed("商品コードが空です".to_string()));
        }
        if !seen.insert(code) {
            return Err(BizError::ValidationFailed(format!(
                "同じ商品コードが複数含まれています: {}",
                code
            )));
        }
    }

    let confirmed_at = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    {
        let tx = conn
            .transaction()
            .map_err(|e| BizError::DatabaseError(crate::db::DbError::QueryFailed(e.to_string())))?;

        for product_code in &req.product_codes {
            if product_repo::find_by_product_code(&tx, product_code)?.is_none() {
                return Err(BizError::NotFound(format!(
                    "商品 {} が見つかりません",
                    product_code
                )));
            }

            let updates = ProductUpdates {
                plu_dirty: Some(false),
                plu_exported_at: Some(Some(confirmed_at.clone())),
                ..Default::default()
            };
            let updated = product_repo::update_product(&tx, product_code, &updates)?;
            if !updated {
                return Err(BizError::NotFound(format!(
                    "商品 {} が見つかりません",
                    product_code
                )));
            }
        }

        tx.commit()
            .map_err(|e| BizError::DatabaseError(crate::db::DbError::QueryFailed(e.to_string())))?;
    }

    let log = NewOperationLog {
        operation_type: "plu_export".to_string(),
        summary: format!(
            "PLU書出し済み確認を記録しました（{}件）",
            req.product_codes.len()
        ),
        detail_json: Some(format!(
            r#"{{"count":{},"confirmed_at":"{}"}}"#,
            req.product_codes.len(),
            confirmed_at
        )),
    };
    if let Err(e) = system_repo::insert_operation_log(conn, &log) {
        tracing::warn!(error = %e, "操作ログ記録に失敗");
    }

    Ok(PluExportConfirmResult {
        updated_count: req.product_codes.len(),
        confirmed_at,
    })
}

/// plu_dirty=1の商品一覧を返す（UI-08の差分対象プレビュー用）
///
/// 33-biz-plu-export-service.md セクション16.4
pub fn list_plu_dirty(conn: &DbConnection) -> Result<Vec<Product>, BizError> {
    Ok(product_repo::find_plu_dirty_products(conn)?)
}

fn validate_plu_jan(jan_code: Option<&str>) -> Result<&str, PluExcludedReason> {
    let Some(jan) = jan_code else {
        return Err(PluExcludedReason::MissingJan);
    };
    if jan.len() != 13 || !jan.chars().all(|ch| ch.is_ascii_digit()) {
        return Err(PluExcludedReason::InvalidJanFormat);
    }
    if !plu_formatter::is_valid_ean13_code(jan) {
        return Err(PluExcludedReason::InvalidCheckDigit);
    }
    Ok(jan)
}

fn build_all_excluded_message(excluded: &[PluExcludedProduct]) -> String {
    let details = excluded
        .iter()
        .map(|p| format!("{}（{}）", p.product_code, excluded_reason_label(&p.reason)))
        .collect::<Vec<_>>()
        .join("、");
    format!(
        "PLUファイルに書き出せる商品がありません。商品マスタで13桁JANを確認してください。対象: {}",
        details
    )
}

fn excluded_reason_label(reason: &PluExcludedReason) -> &'static str {
    match reason {
        PluExcludedReason::MissingJan => "JAN未登録",
        PluExcludedReason::InvalidJanFormat => "JANが13桁ではありません",
        PluExcludedReason::InvalidCheckDigit => "JANのチェックディジットが不正です",
        PluExcludedReason::GroupPriceMismatch => "同じJANの商品で売価または税率が一致していません",
    }
}

// ===========================================================================
// テスト
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constants::SCANNING_PLU_EXPORT_LIMIT;
    use crate::db::product_repo::{self, NewProduct};
    use crate::db::test_support::setup_test_db;

    fn valid_jan_from_seed(seed: u64) -> String {
        let body = format!("{:012}", 490_000_000_000_u64 + seed);
        let sum: u32 = body
            .chars()
            .enumerate()
            .map(|(idx, ch)| {
                let digit = ch.to_digit(10).unwrap();
                if idx % 2 == 0 {
                    digit
                } else {
                    digit * 3
                }
            })
            .sum();
        let check = (10 - (sum % 10)) % 10;
        format!("{}{}", body, check)
    }

    fn jan_seed_from_product_code(product_code: &str) -> u64 {
        product_code
            .bytes()
            .fold(0_u64, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u64))
            % 900_000
    }

    /// テスト用に商品を登録するヘルパー
    fn seed_product_for_plu(
        conn: &DbConnection,
        product_code: &str,
        name: &str,
        department_id: i64,
        is_discontinued: bool,
        plu_dirty: bool,
    ) {
        let jan_code = valid_jan_from_seed(jan_seed_from_product_code(product_code));
        seed_product_for_plu_with_jan(
            conn,
            product_code,
            Some(&jan_code),
            name,
            department_id,
            is_discontinued,
            plu_dirty,
        );
    }

    fn seed_product_for_plu_with_jan(
        conn: &DbConnection,
        product_code: &str,
        jan_code: Option<&str>,
        name: &str,
        department_id: i64,
        is_discontinued: bool,
        plu_dirty: bool,
    ) {
        let product = NewProduct {
            product_code: product_code.to_string(),
            jan_code: jan_code.map(String::from),
            name: name.to_string(),
            department_id,
            supplier_id: None,
            selling_price: 500,
            cost_price: 300,
            tax_rate: "10".to_string(),
            maker_code: None,
            stock_quantity: 10,
            stock_unit: "pcs".to_string(),
            is_discontinued,
            plu_dirty,
            plu_exported_at: None,
            plu_target: true,
            pos_stock_sync: true,
        };
        product_repo::insert_product(conn, &product).unwrap();
    }

    #[test]
    fn test_prepare_plu_export_req402_does_not_update_dirty_or_exported_at() {
        // REQ-402 / D-027: PLUファイル生成だけでは未反映を解除しない
        let (_dir, conn) = setup_test_db();
        seed_product_for_plu(&conn, "PLU-P01", "準備対象A", 1, false, true);
        seed_product_for_plu(&conn, "PLU-P02", "準備対象B", 1, false, true);

        let req = PluExportPrepareRequest {
            mode: ExportMode::Diff,
        };
        let result = prepare_plu_export(&conn, req).unwrap();

        assert_eq!(result.count, 2);
        assert_eq!(
            result.target_product_codes,
            vec!["PLU-P01".to_string(), "PLU-P02".to_string()]
        );
        assert!(!result.csv_output.bytes.is_empty());

        for code in ["PLU-P01", "PLU-P02"] {
            let product = product_repo::find_by_product_code(&conn, code)
                .unwrap()
                .unwrap();
            assert!(
                product.product.plu_dirty,
                "{code} remains dirty after prepare"
            );
            assert!(
                product.product.plu_exported_at.is_none(),
                "{code} exported_at remains unset after prepare"
            );
        }
    }

    #[test]
    fn test_confirm_plu_export_saved_req402_updates_only_requested_products() {
        // REQ-402 / D-027: 保存後確認した exact product_code set だけ未反映解除する
        let (_dir, mut conn) = setup_test_db();
        seed_product_for_plu(&conn, "PLU-CF1", "確認対象A", 1, false, true);
        seed_product_for_plu(&conn, "PLU-CF2", "確認対象B", 1, false, true);
        seed_product_for_plu(&conn, "PLU-CF3", "未確認対象", 1, false, true);

        let req = PluExportConfirmRequest {
            product_codes: vec!["PLU-CF1".to_string(), "PLU-CF2".to_string()],
        };
        let result = confirm_plu_export_saved(&mut conn, req).unwrap();

        assert_eq!(result.updated_count, 2);
        assert!(result.confirmed_at.contains('T'));

        for code in ["PLU-CF1", "PLU-CF2"] {
            let product = product_repo::find_by_product_code(&conn, code)
                .unwrap()
                .unwrap();
            assert!(!product.product.plu_dirty, "{code} was confirmed");
            assert!(
                product.product.plu_exported_at.is_some(),
                "{code} exported_at was set"
            );
        }

        let untouched = product_repo::find_by_product_code(&conn, "PLU-CF3")
            .unwrap()
            .unwrap();
        assert!(
            untouched.product.plu_dirty,
            "unconfirmed product remains dirty"
        );
        assert!(
            untouched.product.plu_exported_at.is_none(),
            "unconfirmed product exported_at remains unset"
        );
    }

    #[test]
    fn test_confirm_plu_export_saved_req402_accepts_target_codes_exceeding_row_limit() {
        // REQ-402 / D-028: dedup後の行数上限はprepare側の責務で、confirmはexact product_code setを受ける。
        let (_dir, mut conn) = setup_test_db();
        let product_codes: Vec<String> = (0..=SCANNING_PLU_EXPORT_LIMIT)
            .map(|idx| format!("PLU-LIMIT-{idx:04}"))
            .collect();

        {
            let tx = conn.transaction().unwrap();
            for code in &product_codes {
                seed_product_for_plu_with_jan(&tx, code, Some(code), code, 1, false, true);
            }
            tx.commit().unwrap();
        }

        let result = confirm_plu_export_saved(
            &mut conn,
            PluExportConfirmRequest {
                product_codes: product_codes.clone(),
            },
        )
        .unwrap();

        assert_eq!(result.updated_count, product_codes.len());
        for code in [
            product_codes.first().unwrap(),
            product_codes.last().unwrap(),
        ] {
            let product = product_repo::find_by_product_code(&conn, code)
                .unwrap()
                .unwrap();
            assert!(!product.product.plu_dirty, "{code} was confirmed");
            assert!(
                product.product.plu_exported_at.is_some(),
                "{code} exported_at was set"
            );
        }
    }

    #[test]
    fn test_confirm_plu_export_saved_req402_rejects_invalid_sets_and_rolls_back() {
        // REQ-402 / D-027: 空・重複・欠番は拒否し、途中更新しない
        let (_dir, mut conn) = setup_test_db();
        seed_product_for_plu(&conn, "PLU-RB1", "ロールバックA", 1, false, true);
        seed_product_for_plu(&conn, "PLU-RB2", "ロールバックB", 1, false, true);

        let empty = confirm_plu_export_saved(
            &mut conn,
            PluExportConfirmRequest {
                product_codes: vec![],
            },
        );
        assert!(matches!(empty, Err(BizError::ValidationFailed(_))));

        let duplicate = confirm_plu_export_saved(
            &mut conn,
            PluExportConfirmRequest {
                product_codes: vec!["PLU-RB1".to_string(), "PLU-RB1".to_string()],
            },
        );
        assert!(matches!(duplicate, Err(BizError::ValidationFailed(_))));

        let missing = confirm_plu_export_saved(
            &mut conn,
            PluExportConfirmRequest {
                product_codes: vec!["PLU-RB1".to_string(), "NO-SUCH-PLU".to_string()],
            },
        );
        assert!(matches!(missing, Err(BizError::NotFound(_))));

        for code in ["PLU-RB1", "PLU-RB2"] {
            let product = product_repo::find_by_product_code(&conn, code)
                .unwrap()
                .unwrap();
            assert!(
                product.product.plu_dirty,
                "{code} remains dirty after failed confirm"
            );
            assert!(
                product.product.plu_exported_at.is_none(),
                "{code} exported_at remains unset after failed confirm"
            );
        }
    }

    #[test]
    fn test_prepare_plu_export_req402_full_mode() {
        // REQ-402: PLU書出し
        // BIZ-04: Fullモードで全active商品が書出され、DB状態は更新されないこと
        let (_dir, conn) = setup_test_db();
        seed_product_for_plu(&conn, "PLU-001", "テスト毛糸A", 1, false, true);
        seed_product_for_plu(&conn, "PLU-002", "テスト毛糸B", 1, false, false);
        seed_product_for_plu(&conn, "PLU-DISC", "廃番品", 1, true, true);

        let req = PluExportPrepareRequest {
            mode: ExportMode::Full,
        };
        let result = prepare_plu_export(&conn, req).unwrap();

        assert_eq!(result.count, 2, "廃番を除いた2件が書出される");
        assert_eq!(
            result.target_product_codes,
            vec!["PLU-001".to_string(), "PLU-002".to_string()]
        );
        assert!(!result.over_limit_warning);
        assert!(!result.csv_output.bytes.is_empty());

        let p1 = product_repo::find_by_product_code(&conn, "PLU-001")
            .unwrap()
            .unwrap();
        assert!(p1.product.plu_dirty, "prepareではplu_dirtyを更新しない");
        assert!(p1.product.plu_exported_at.is_none());

        let p2 = product_repo::find_by_product_code(&conn, "PLU-002")
            .unwrap()
            .unwrap();
        assert!(
            !p2.product.plu_dirty,
            "元からplu_dirty=0だった商品はそのまま"
        );
        assert!(p2.product.plu_exported_at.is_none());
    }

    #[test]
    fn test_prepare_plu_export_req402_diff_mode() {
        // REQ-402: PLU書出し
        // BIZ-04: Diffモードでplu_dirty=1の商品のみ書出されること
        let (_dir, conn) = setup_test_db();
        seed_product_for_plu(&conn, "PLU-D01", "ダーティ商品", 1, false, true);
        seed_product_for_plu(&conn, "PLU-C01", "クリーン商品", 1, false, false);

        let req = PluExportPrepareRequest {
            mode: ExportMode::Diff,
        };
        let result = prepare_plu_export(&conn, req).unwrap();

        assert_eq!(result.count, 1, "plu_dirty=1の1件のみ");
        assert_eq!(result.target_product_codes, vec!["PLU-D01".to_string()]);

        let clean = product_repo::find_by_product_code(&conn, "PLU-C01")
            .unwrap()
            .unwrap();
        assert!(!clean.product.plu_dirty);
        assert!(clean.product.plu_exported_at.is_none(), "未書出しのまま");
    }

    #[test]
    fn test_prepare_plu_export_req402_empty_returns_validation_error() {
        // REQ-402: PLU書出し
        // BIZ-04: 0件 → ValidationFailed
        let (_dir, conn) = setup_test_db();

        let req = PluExportPrepareRequest {
            mode: ExportMode::Diff,
        };
        let result = prepare_plu_export(&conn, req);

        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    fn test_prepare_plu_export_req402_excludes_products_without_valid_13_digit_jan() {
        // REQ-402 / D-028 / CV17 1.1.1: JAN不備商品は全体失敗ではなく対象外リストへ分離する。
        let (_dir, conn) = setup_test_db();
        seed_product_for_plu(&conn, "JAN-OK", "JAN正常", 1, false, true);
        seed_product_for_plu_with_jan(&conn, "JAN-NONE", None, "JANなし", 1, false, true);
        seed_product_for_plu_with_jan(
            &conn,
            "JAN-SHORT",
            Some("12345678"),
            "JAN短い",
            1,
            false,
            true,
        );
        seed_product_for_plu_with_jan(
            &conn,
            "JAN-BAD",
            Some("4901234567890"),
            "JAN検査桁不正",
            1,
            false,
            true,
        );

        let result = prepare_plu_export(
            &conn,
            PluExportPrepareRequest {
                mode: ExportMode::Diff,
            },
        )
        .unwrap();

        assert_eq!(result.count, 1);
        assert_eq!(result.target_product_codes, vec!["JAN-OK".to_string()]);
        assert_eq!(result.excluded.len(), 3);
        assert!(result.excluded.iter().any(|excluded| {
            excluded.product_code == "JAN-NONE"
                && matches!(excluded.reason, PluExcludedReason::MissingJan)
        }));
        assert!(result.excluded.iter().any(|excluded| {
            excluded.product_code == "JAN-SHORT"
                && matches!(excluded.reason, PluExcludedReason::InvalidJanFormat)
        }));
        assert!(result.excluded.iter().any(|excluded| {
            excluded.product_code == "JAN-BAD"
                && matches!(excluded.reason, PluExcludedReason::InvalidCheckDigit)
        }));
    }

    #[test]
    fn test_prepare_plu_export_req402_fails_when_all_targets_are_excluded_with_details() {
        // REQ-402 / D-028: 全件が要修正の場合は、商品コードと理由をValidationFailedに含める。
        let (_dir, conn) = setup_test_db();
        seed_product_for_plu_with_jan(&conn, "JAN-NONE", None, "JANなし", 1, false, true);
        seed_product_for_plu_with_jan(
            &conn,
            "JAN-SHORT",
            Some("12345678"),
            "JAN短い",
            1,
            false,
            true,
        );

        let result = prepare_plu_export(
            &conn,
            PluExportPrepareRequest {
                mode: ExportMode::Diff,
            },
        );

        match result {
            Err(BizError::ValidationFailed(message)) => {
                assert!(message.contains("PLUファイルに書き出せる商品がありません"));
                assert!(message.contains("商品マスタで13桁JANを確認してください"));
                assert!(message.contains("JAN-NONE（JAN未登録）"));
                assert!(message.contains("JAN-SHORT（JANが13桁ではありません）"));
            }
            other => panic!("ValidationFailed が期待されるが {:?} が返った", other),
        }
    }

    #[test]
    fn test_prepare_plu_export_req402_deduplicates_same_jan_and_confirm_clears_group() {
        // REQ-402 / D-028: 同一JAN同価格は代表1行、confirm対象はグループ全員を解除する。
        let (_dir, mut conn) = setup_test_db();
        let same_jan = valid_jan_from_seed(7001);
        seed_product_for_plu_with_jan(
            &conn,
            "DEDUP-B",
            Some(&same_jan),
            "代表候補B",
            1,
            false,
            true,
        );
        seed_product_for_plu_with_jan(
            &conn,
            "DEDUP-A",
            Some(&same_jan),
            "代表候補A",
            1,
            false,
            true,
        );

        let mismatch_jan = valid_jan_from_seed(7002);
        seed_product_for_plu_with_jan(
            &conn,
            "MISMATCH-A",
            Some(&mismatch_jan),
            "不一致A",
            1,
            false,
            true,
        );
        seed_product_for_plu_with_jan(
            &conn,
            "MISMATCH-B",
            Some(&mismatch_jan),
            "不一致B",
            1,
            false,
            true,
        );
        product_repo::update_product(
            &conn,
            "MISMATCH-B",
            &ProductUpdates {
                selling_price: Some(700),
                ..Default::default()
            },
        )
        .unwrap();

        let result = prepare_plu_export(
            &conn,
            PluExportPrepareRequest {
                mode: ExportMode::Diff,
            },
        )
        .unwrap();

        assert_eq!(result.count, 1);
        assert_eq!(
            result.target_product_codes,
            vec!["DEDUP-A".to_string(), "DEDUP-B".to_string()]
        );
        assert!(!result.csv_output.bytes.is_empty());
        assert!(result.excluded.iter().any(|excluded| {
            excluded.product_code == "MISMATCH-A"
                && matches!(excluded.reason, PluExcludedReason::GroupPriceMismatch)
        }));
        assert!(result.excluded.iter().any(|excluded| {
            excluded.product_code == "MISMATCH-B"
                && matches!(excluded.reason, PluExcludedReason::GroupPriceMismatch)
        }));

        confirm_plu_export_saved(
            &mut conn,
            PluExportConfirmRequest {
                product_codes: result.target_product_codes,
            },
        )
        .unwrap();

        let dedup_a = product_repo::find_by_product_code(&conn, "DEDUP-A")
            .unwrap()
            .unwrap();
        let dedup_b = product_repo::find_by_product_code(&conn, "DEDUP-B")
            .unwrap()
            .unwrap();
        assert!(!dedup_a.product.plu_dirty, "DEDUP-A should be cleared");
        assert!(!dedup_b.product.plu_dirty, "DEDUP-B should be cleared");
    }

    #[test]
    fn test_confirm_plu_export_saved_req402_exported_at_updated() {
        // REQ-402: PLU書出し
        // BIZ-04: 保存済み確認で plu_exported_at が更新されること
        let (_dir, mut conn) = setup_test_db();
        seed_product_for_plu(&conn, "PLU-AT1", "タイムスタンプ確認", 1, false, true);

        confirm_plu_export_saved(
            &mut conn,
            PluExportConfirmRequest {
                product_codes: vec!["PLU-AT1".to_string()],
            },
        )
        .unwrap();

        let p = product_repo::find_by_product_code(&conn, "PLU-AT1")
            .unwrap()
            .unwrap();
        assert!(p.product.plu_exported_at.is_some());
        // ISO 8601形式であること
        let exported_at = p.product.plu_exported_at.unwrap();
        assert!(exported_at.contains('T'), "ISO 8601形式: {}", exported_at);
    }

    #[test]
    fn test_confirm_plu_export_saved_req402_operation_log_recorded() {
        // REQ-402: PLU書出し
        // BIZ-04: 保存済み確認の operation_log が記録されること
        let (_dir, mut conn) = setup_test_db();
        seed_product_for_plu(&conn, "PLU-LOG", "ログ確認", 1, false, true);

        confirm_plu_export_saved(
            &mut conn,
            PluExportConfirmRequest {
                product_codes: vec!["PLU-LOG".to_string()],
            },
        )
        .unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM operation_logs WHERE operation_type = 'plu_export'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "plu_export ログが1件記録される");

        let detail_json: String = conn
            .query_row(
                "SELECT detail_json FROM operation_logs WHERE operation_type = 'plu_export'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(detail_json.contains(r#""count":1"#));
        assert!(detail_json.contains(r#""confirmed_at":"#));
    }

    #[test]
    fn test_prepare_plu_export_req402_scanning_plu_limit() {
        // REQ-402: PLU書出し
        // CV17 1.1.1 / SR-S4000: PLU総枠5000から現地通常PLU216枠を引き、4,784件が上限
        let (_dir, conn) = setup_test_db();
        for idx in 0..=SCANNING_PLU_EXPORT_LIMIT {
            let code = format!("OL-{:04}", idx);
            let jan = valid_jan_from_seed(idx as u64);
            seed_product_for_plu_with_jan(&conn, &code, Some(&jan), "上限確認", 1, false, true);
        }

        let req = PluExportPrepareRequest {
            mode: ExportMode::Full,
        };
        let result = prepare_plu_export(&conn, req);

        match result {
            Err(BizError::ValidationFailed(message)) => {
                assert!(message.contains("4784"));
            }
            other => panic!("ValidationFailed が期待されるが {:?} が返った", other),
        }
    }

    #[test]
    fn test_list_plu_dirty_req402() {
        // REQ-402: PLU書出し
        // BIZ-04: list_plu_dirty は plu_dirty=1 の商品リストを返す
        let (_dir, conn) = setup_test_db();
        seed_product_for_plu(&conn, "LD-001", "ダーティA", 1, false, true);
        seed_product_for_plu(&conn, "LD-002", "ダーティB", 1, false, true);
        seed_product_for_plu(&conn, "LD-003", "クリーン", 1, false, false);

        let result = list_plu_dirty(&conn).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].product_code, "LD-001");
        assert_eq!(result[1].product_code, "LD-002");
    }
}
