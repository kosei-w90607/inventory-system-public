//! BIZ-04: PLU書出しロジック
//!
//! 商品マスタからカシオレジスターツール用PLUファイルを生成し、
//! 保存後に利用者が確認した対象だけ plu_dirty/plu_exported_at を更新する。
//!
//! docs/function-design/33-biz-plu-export-service.md に基づく実装。

use crate::constants::PLU_CLEAR_ROW_ENABLED;
use crate::db::plu_slot_repo::{self, PluSlotStatus, PluSlotUpdate};
use crate::db::product_repo::{self, Product, ProductUpdates};
use crate::db::system_repo::{self, NewOperationLog};
use crate::db::DbConnection;
use crate::io::plu_formatter::{self, PluExportRow, PluExportRowKind, PluFileOutput};
use crate::io::z004_parser;

use super::BizError;
use std::collections::{BTreeMap, BTreeSet, HashSet};

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/// 書出しモード
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
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
    pub plu_output: PluFileOutput,
    /// 書出し件数
    pub count: usize,
    /// PLUファイルに含めた商品コード一覧
    pub target_product_codes: Vec<String>,
    pub prepared_rows: Vec<PluPreparedRow>,
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
    pub memory_no: Option<i64>,
    pub reason: PluExcludedReason,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PluExcludedReason {
    MissingJan,
    InvalidJanFormat,
    InvalidCheckDigit,
    GroupPriceMismatch,
    NoFreeSlot,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum PluPreparedRowKind {
    Product,
    Clear,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct PluPreparedRow {
    pub memory_no: i64,
    pub row_kind: PluPreparedRowKind,
    pub target_product_codes: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct PluRegisterSnapshotSummary {
    pub snapshot_at: Option<String>,
    pub free_count: usize,
    pub external_count: usize,
    pub app_managed_count: usize,
    pub conflict_count: usize,
    pub release_pending_count: usize,
}

/// PLU保存済み確認リクエスト
#[derive(Debug, Clone)]
pub struct PluExportConfirmRequest {
    pub product_codes: Vec<String>,
    pub prepared_rows: Vec<PluPreparedRow>,
}

/// PLU保存済み確認結果
#[derive(Debug)]
pub struct PluExportConfirmResult {
    pub updated_count: usize,
    pub confirmed_at: String,
}

fn clear_row_enabled() -> bool {
    PLU_CLEAR_ROW_ENABLED
}

// ---------------------------------------------------------------------------
// 公開関数
// ---------------------------------------------------------------------------

pub fn import_plu_register_snapshot(
    conn: &mut DbConnection,
    raw_bytes: &[u8],
) -> Result<PluRegisterSnapshotSummary, BizError> {
    let observed = z004_parser::parse_plu_register_snapshot(raw_bytes)
        .map_err(|error| BizError::ImportError(error.to_string()))?;
    let snapshot_at = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let tx = conn.transaction().map_err(db_tx_error)?;
    let mut conflict_count = 0usize;

    for observed_slot in observed.into_iter().filter(|slot| slot.memory_no >= 217) {
        let current = plu_slot_repo::find_slot_by_memory_no(&tx, observed_slot.memory_no)?
            .ok_or_else(|| {
                BizError::ImportError(format!(
                    "PLU slot {} が存在しません",
                    observed_slot.memory_no
                ))
            })?;
        let observed_code = observed_slot.raw_code.as_deref();
        match (observed_code, current.status) {
            (None, PluSlotStatus::Free | PluSlotStatus::External) => plu_slot_repo::update_slot(
                &tx,
                PluSlotUpdate {
                    memory_no: current.memory_no,
                    scanning_code: None,
                    status: PluSlotStatus::Free,
                    reserved_at: None,
                    activated_at: None,
                    released_at: current.released_at.as_deref(),
                    updated_at: &snapshot_at,
                },
            )?,
            (None, PluSlotStatus::Reserved) => {}
            (None, PluSlotStatus::Active) => {
                conflict_count += 1;
                mark_products_dirty_for_jan(&tx, current.scanning_code.as_deref())?;
            }
            (None, PluSlotStatus::ReleasePending) => plu_slot_repo::update_slot(
                &tx,
                PluSlotUpdate {
                    memory_no: current.memory_no,
                    scanning_code: None,
                    status: PluSlotStatus::Free,
                    reserved_at: None,
                    activated_at: None,
                    released_at: Some(&snapshot_at),
                    updated_at: &snapshot_at,
                },
            )?,
            (Some(code), PluSlotStatus::Free) => {
                if is_eligible_jan(&tx, code)? {
                    let has_managed = plu_slot_repo::find_slots_by_scanning_code(&tx, code)?
                        .iter()
                        .any(|slot| {
                            matches!(slot.status, PluSlotStatus::Reserved | PluSlotStatus::Active)
                        });
                    let status = if has_managed {
                        PluSlotStatus::ReleasePending
                    } else {
                        PluSlotStatus::Active
                    };
                    plu_slot_repo::update_slot(
                        &tx,
                        PluSlotUpdate {
                            memory_no: current.memory_no,
                            scanning_code: Some(code),
                            status,
                            reserved_at: None,
                            activated_at: (status == PluSlotStatus::Active)
                                .then_some(snapshot_at.as_str()),
                            released_at: None,
                            updated_at: &snapshot_at,
                        },
                    )?;
                } else {
                    plu_slot_repo::update_slot(
                        &tx,
                        PluSlotUpdate {
                            memory_no: current.memory_no,
                            scanning_code: Some(code),
                            status: PluSlotStatus::External,
                            reserved_at: None,
                            activated_at: None,
                            released_at: None,
                            updated_at: &snapshot_at,
                        },
                    )?;
                }
            }
            (Some(code), PluSlotStatus::Reserved)
                if current.scanning_code.as_deref() == Some(code) =>
            {
                plu_slot_repo::update_slot(
                    &tx,
                    PluSlotUpdate {
                        memory_no: current.memory_no,
                        scanning_code: Some(code),
                        status: PluSlotStatus::Active,
                        reserved_at: current.reserved_at.as_deref(),
                        activated_at: Some(&snapshot_at),
                        released_at: None,
                        updated_at: &snapshot_at,
                    },
                )?;
            }
            (Some(code), PluSlotStatus::Reserved) => {
                conflict_count += 1;
                plu_slot_repo::update_slot(
                    &tx,
                    PluSlotUpdate {
                        memory_no: current.memory_no,
                        scanning_code: Some(code),
                        status: PluSlotStatus::External,
                        reserved_at: None,
                        activated_at: None,
                        released_at: None,
                        updated_at: &snapshot_at,
                    },
                )?;
            }
            (Some(code), PluSlotStatus::Active)
                if current.scanning_code.as_deref() != Some(code) =>
            {
                conflict_count += 1;
                mark_products_dirty_for_jan(&tx, current.scanning_code.as_deref())?;
            }
            (Some(_), PluSlotStatus::Active) => {}
            (Some(code), PluSlotStatus::ReleasePending)
                if current.scanning_code.as_deref() == Some(code) => {}
            (Some(code), PluSlotStatus::External)
                if current.scanning_code.as_deref() == Some(code) => {}
            (Some(code), PluSlotStatus::External | PluSlotStatus::ReleasePending) => {
                plu_slot_repo::update_slot(
                    &tx,
                    PluSlotUpdate {
                        memory_no: current.memory_no,
                        scanning_code: Some(code),
                        status: PluSlotStatus::External,
                        reserved_at: None,
                        activated_at: None,
                        released_at: None,
                        updated_at: &snapshot_at,
                    },
                )?;
            }
        }
    }

    let summary = summarize_slots(&tx, Some(snapshot_at.clone()), conflict_count)?;
    let summary_json = serde_json::json!({
        "free_count": summary.free_count,
        "external_count": summary.external_count,
        "app_managed_count": summary.app_managed_count,
        "conflict_count": summary.conflict_count,
    })
    .to_string();
    system_repo::upsert_setting(&tx, "plu_register_snapshot_at", &snapshot_at)?;
    system_repo::upsert_setting(&tx, "plu_register_snapshot_summary", &summary_json)?;
    system_repo::insert_operation_log(
        &tx,
        &NewOperationLog {
            operation_type: "plu_register_snapshot_import".to_string(),
            summary: format!(
                "レジ登録状況を読み込みました（conflict {}件）",
                conflict_count
            ),
            detail_json: Some(summary_json),
        },
    )?;
    tx.commit().map_err(db_tx_error)?;
    Ok(summary)
}

pub fn get_plu_slot_summary(conn: &DbConnection) -> Result<PluRegisterSnapshotSummary, BizError> {
    let snapshot_at = system_repo::get_setting(conn, "plu_register_snapshot_at")?;
    if snapshot_at.is_none() {
        return Ok(PluRegisterSnapshotSummary {
            snapshot_at: None,
            free_count: 0,
            external_count: 0,
            app_managed_count: 0,
            conflict_count: 0,
            release_pending_count: 0,
        });
    }
    let conflict_count = system_repo::get_setting(conn, "plu_register_snapshot_summary")?
        .and_then(|json| serde_json::from_str::<serde_json::Value>(&json).ok())
        .and_then(|value| value.get("conflict_count").and_then(|count| count.as_u64()))
        .unwrap_or(0) as usize;
    summarize_slots(conn, snapshot_at, conflict_count)
}

/// 指定モードでPLUファイルを生成し、slot予約を永続化する。
///
/// 33-biz-plu-export-service.md セクション16.3
pub fn prepare_plu_export(
    conn: &mut DbConnection,
    req: PluExportPrepareRequest,
) -> Result<PluExportPreparedResult, BizError> {
    if system_repo::get_setting(conn, "plu_register_snapshot_at")?.is_none() {
        return Err(BizError::ValidationFailed(
            "register_snapshot_required: レジ設定の読込みが必要です".to_string(),
        ));
    }
    let tx = conn.transaction().map_err(db_tx_error)?;
    let products = match req.mode {
        ExportMode::Full => product_repo::find_active_products_for_plu(&tx)?,
        ExportMode::Diff => product_repo::find_plu_dirty_products_for_plu(&tx)?,
    };

    let mut excluded = Vec::new();
    let mut blocked_slot_codes = HashSet::new();
    let mut valid_groups: BTreeMap<String, Vec<_>> = BTreeMap::new();

    for product in &products {
        match validate_plu_jan(product.product.jan_code.as_deref()) {
            Ok(jan) => {
                valid_groups
                    .entry(jan.to_string())
                    .or_default()
                    .push(product);
            }
            Err(reason) => {
                if let Some(jan_code) = product.product.jan_code.as_ref() {
                    blocked_slot_codes.insert(jan_code.clone());
                }
                excluded.push(PluExcludedProduct {
                    product_code: product.product.product_code.clone(),
                    jan_code: product.product.jan_code.clone(),
                    name: product.product.name.clone(),
                    memory_no: None,
                    reason,
                });
            }
        }
    }

    let mut rows = Vec::new();
    let mut prepared_rows = Vec::new();
    let mut target_product_codes = Vec::new();
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    for (jan, mut group) in valid_groups {
        group.sort_by(|a, b| a.product.product_code.cmp(&b.product.product_code));
        let first = group[0];
        let group_matches = group.iter().all(|p| {
            p.product.selling_price == first.product.selling_price
                && p.product.tax_rate == first.product.tax_rate
        });
        if !group_matches {
            blocked_slot_codes.insert(jan.clone());
            for p in group {
                excluded.push(PluExcludedProduct {
                    product_code: p.product.product_code.clone(),
                    jan_code: p.product.jan_code.clone(),
                    name: p.product.name.clone(),
                    memory_no: None,
                    reason: PluExcludedReason::GroupPriceMismatch,
                });
            }
            continue;
        }

        let group_codes: Vec<String> = group
            .iter()
            .map(|p| p.product.product_code.clone())
            .collect();
        let slots = plu_slot_repo::find_slots_by_scanning_code(&tx, &jan)?;
        let slot = if let Some(slot) = slots
            .iter()
            .find(|slot| matches!(slot.status, PluSlotStatus::Reserved | PluSlotStatus::Active))
        {
            slot.clone()
        } else if let Some(slot) = slots
            .iter()
            .find(|slot| slot.status == PluSlotStatus::External)
        {
            plu_slot_repo::update_slot(
                &tx,
                PluSlotUpdate {
                    memory_no: slot.memory_no,
                    scanning_code: Some(&jan),
                    status: PluSlotStatus::Active,
                    reserved_at: None,
                    activated_at: Some(&now),
                    released_at: None,
                    updated_at: &now,
                },
            )?;
            plu_slot_repo::find_slot_by_memory_no(&tx, slot.memory_no)?.expect("updated slot")
        } else if let Some(slot) = slots
            .iter()
            .filter(|slot| slot.status == PluSlotStatus::ReleasePending)
            .min_by_key(|slot| slot.memory_no)
        {
            let restored = if slot.activated_at.is_some() {
                PluSlotStatus::Active
            } else {
                PluSlotStatus::Reserved
            };
            plu_slot_repo::update_slot(
                &tx,
                PluSlotUpdate {
                    memory_no: slot.memory_no,
                    scanning_code: Some(&jan),
                    status: restored,
                    reserved_at: (restored == PluSlotStatus::Reserved).then_some(now.as_str()),
                    activated_at: (restored == PluSlotStatus::Active).then_some(now.as_str()),
                    released_at: None,
                    updated_at: &now,
                },
            )?;
            plu_slot_repo::find_slot_by_memory_no(&tx, slot.memory_no)?.expect("updated slot")
        } else if let Some(slot) = plu_slot_repo::find_min_free_slot(&tx)? {
            plu_slot_repo::update_slot(
                &tx,
                PluSlotUpdate {
                    memory_no: slot.memory_no,
                    scanning_code: Some(&jan),
                    status: PluSlotStatus::Reserved,
                    reserved_at: Some(&now),
                    activated_at: None,
                    released_at: None,
                    updated_at: &now,
                },
            )?;
            plu_slot_repo::find_slot_by_memory_no(&tx, slot.memory_no)?.expect("updated slot")
        } else {
            for product in group {
                excluded.push(PluExcludedProduct {
                    product_code: product.product.product_code.clone(),
                    jan_code: product.product.jan_code.clone(),
                    name: product.product.name.clone(),
                    memory_no: None,
                    reason: PluExcludedReason::NoFreeSlot,
                });
            }
            continue;
        };

        target_product_codes.extend(group_codes.iter().cloned());
        prepared_rows.push(PluPreparedRow {
            memory_no: slot.memory_no,
            row_kind: PluPreparedRowKind::Product,
            target_product_codes: group_codes,
        });
        rows.push(PluExportRow {
            memory_no: slot.memory_no,
            row_kind: PluExportRowKind::Product,
            product_code: first.product.product_code.clone(),
            jan_code: first.product.jan_code.clone(),
            name: first.product.name.clone(),
            selling_price: first.product.selling_price,
            tax_rate: first.product.tax_rate.as_str().to_string(),
            department_name: first.department_name.clone(),
        });
    }
    append_clear_rows(
        &tx,
        &mut rows,
        &mut prepared_rows,
        &blocked_slot_codes,
        clear_row_enabled(),
    )?;
    excluded.sort_by(|a, b| a.product_code.cmp(&b.product_code));

    rows.sort_by_key(|row| row.memory_no);
    prepared_rows.sort_by_key(|row| row.memory_no);
    let count = rows.len();

    if rows.is_empty() {
        return Err(BizError::ValidationFailed(build_all_excluded_message(
            &excluded,
        )));
    }
    let over_limit_warning = false;

    let plu_output = plu_formatter::generate_plu_tsv(&rows)
        .map_err(|e| BizError::ExportError(format!("PLUファイルの生成に失敗しました: {}", e)))?;

    tx.commit().map_err(db_tx_error)?;

    Ok(PluExportPreparedResult {
        plu_output,
        count,
        target_product_codes,
        prepared_rows,
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
    confirm_plu_export_saved_with_clear_enabled(conn, req, clear_row_enabled())
}

fn confirm_plu_export_saved_with_clear_enabled(
    conn: &mut DbConnection,
    req: PluExportConfirmRequest,
    clear_row_enabled: bool,
) -> Result<PluExportConfirmResult, BizError> {
    if req.product_codes.is_empty()
        && req
            .prepared_rows
            .iter()
            .all(|row| row.row_kind != PluPreparedRowKind::Clear)
    {
        return Err(BizError::ValidationFailed(
            "書出し済みにする商品がありません".to_string(),
        ));
    }
    if req.prepared_rows.is_empty() {
        return Err(BizError::ValidationFailed(
            "prepared_rows が空です".to_string(),
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

        let prepared_codes: BTreeSet<_> = req
            .prepared_rows
            .iter()
            .flat_map(|row| row.target_product_codes.iter().cloned())
            .collect();
        let request_codes: BTreeSet<_> = req.product_codes.iter().cloned().collect();
        if prepared_codes != request_codes {
            return Err(BizError::ValidationFailed(
                "prepare と confirm の商品集合が一致しません".to_string(),
            ));
        }
        let mut memory_numbers = HashSet::new();
        for row in &req.prepared_rows {
            if !memory_numbers.insert(row.memory_no) {
                return Err(BizError::ValidationFailed(
                    "同じPLUメモリNo.が複数含まれています".to_string(),
                ));
            }
            let slot =
                plu_slot_repo::find_slot_by_memory_no(&tx, row.memory_no)?.ok_or_else(|| {
                    BizError::ValidationFailed(format!("PLU slot {} が存在しません", row.memory_no))
                })?;
            match row.row_kind {
                PluPreparedRowKind::Product => {
                    if row.target_product_codes.is_empty() {
                        return Err(BizError::ValidationFailed(
                            "product行の商品集合が空です".to_string(),
                        ));
                    }
                    if !matches!(slot.status, PluSlotStatus::Reserved | PluSlotStatus::Active) {
                        return Err(BizError::ValidationFailed(
                            "PLU slot状態がprepare時と一致しません".to_string(),
                        ));
                    }
                    if slot.status == PluSlotStatus::Reserved {
                        plu_slot_repo::update_slot(
                            &tx,
                            PluSlotUpdate {
                                memory_no: slot.memory_no,
                                scanning_code: slot.scanning_code.as_deref(),
                                status: PluSlotStatus::Active,
                                reserved_at: slot.reserved_at.as_deref(),
                                activated_at: Some(&confirmed_at),
                                released_at: None,
                                updated_at: &confirmed_at,
                            },
                        )?;
                    }
                    for product_code in &row.target_product_codes {
                        let product = product_repo::find_by_product_code(&tx, product_code)?
                            .ok_or_else(|| {
                                BizError::NotFound(format!(
                                    "商品 {} が見つかりません",
                                    product_code
                                ))
                            })?;
                        if product.product.jan_code.as_deref() != slot.scanning_code.as_deref() {
                            return Err(BizError::ValidationFailed(
                                "prepare と confirm のJAN/slot対応が一致しません".to_string(),
                            ));
                        }
                    }
                }
                PluPreparedRowKind::Clear => {
                    if !row.target_product_codes.is_empty() {
                        return Err(BizError::ValidationFailed(
                            "clear行に商品が含まれています".to_string(),
                        ));
                    }
                    if slot.status == PluSlotStatus::ReleasePending && clear_row_enabled {
                        plu_slot_repo::update_slot(
                            &tx,
                            PluSlotUpdate {
                                memory_no: slot.memory_no,
                                scanning_code: None,
                                status: PluSlotStatus::Free,
                                reserved_at: None,
                                activated_at: None,
                                released_at: Some(&confirmed_at),
                                updated_at: &confirmed_at,
                            },
                        )?;
                    } else if !(slot.status == PluSlotStatus::Free && slot.scanning_code.is_none())
                    {
                        return Err(BizError::ValidationFailed(
                            "PLU clear slot状態がprepare時と一致しません".to_string(),
                        ));
                    }
                }
            }
        }

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

        system_repo::insert_operation_log(&tx, &NewOperationLog {
            operation_type: "plu_export".to_string(),
            summary: format!("PLU書出し済み確認を記録しました（{}件）", req.product_codes.len()),
            detail_json: Some(serde_json::json!({
                "count": req.product_codes.len(),
                "product_count": req.product_codes.len(),
                "clear_count": req.prepared_rows.iter().filter(|row| row.row_kind == PluPreparedRowKind::Clear).count(),
                "confirmed_at": confirmed_at,
            }).to_string()),
        })?;
        tx.commit()
            .map_err(|e| BizError::DatabaseError(crate::db::DbError::QueryFailed(e.to_string())))?;
    }

    Ok(PluExportConfirmResult {
        updated_count: req.product_codes.len(),
        confirmed_at,
    })
}

pub fn release_plu_slot_for_jan(conn: &DbConnection, jan_code: &str) -> Result<(), BizError> {
    let remaining: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM products WHERE jan_code=?1 AND plu_target=1 AND is_discontinued=0)",
        rusqlite::params![jan_code],
        |row| row.get(0),
    ).map_err(crate::db::DbError::from)?;
    if remaining {
        return Ok(());
    }
    let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    for slot in plu_slot_repo::find_slots_by_scanning_code(conn, jan_code)? {
        match slot.status {
            PluSlotStatus::Reserved => plu_slot_repo::update_slot(
                conn,
                PluSlotUpdate {
                    memory_no: slot.memory_no,
                    scanning_code: None,
                    status: PluSlotStatus::Free,
                    reserved_at: None,
                    activated_at: None,
                    released_at: slot.released_at.as_deref(),
                    updated_at: &now,
                },
            )?,
            PluSlotStatus::Active => plu_slot_repo::update_slot(
                conn,
                PluSlotUpdate {
                    memory_no: slot.memory_no,
                    scanning_code: Some(jan_code),
                    status: PluSlotStatus::ReleasePending,
                    reserved_at: slot.reserved_at.as_deref(),
                    activated_at: slot.activated_at.as_deref(),
                    released_at: None,
                    updated_at: &now,
                },
            )?,
            _ => {}
        }
    }
    Ok(())
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
        PluExcludedReason::NoFreeSlot => "レジの空きスロットがありません",
    }
}

fn db_tx_error(error: rusqlite::Error) -> BizError {
    BizError::DatabaseError(crate::db::DbError::QueryFailed(error.to_string()))
}

fn is_eligible_jan(conn: &DbConnection, code: &str) -> Result<bool, BizError> {
    if validate_plu_jan(Some(code)).is_err() {
        return Ok(false);
    }
    Ok(conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM products WHERE jan_code=?1 AND plu_target=1 AND is_discontinued=0)",
        rusqlite::params![code],
        |row| row.get(0),
    ).map_err(crate::db::DbError::from)?)
}

fn mark_products_dirty_for_jan(
    conn: &DbConnection,
    jan_code: Option<&str>,
) -> Result<(), BizError> {
    if let Some(jan_code) = jan_code {
        conn.execute(
            "UPDATE products SET plu_dirty=1 WHERE jan_code=?1",
            rusqlite::params![jan_code],
        )
        .map_err(crate::db::DbError::from)?;
    }
    Ok(())
}

fn summarize_slots(
    conn: &DbConnection,
    snapshot_at: Option<String>,
    conflict_count: usize,
) -> Result<PluRegisterSnapshotSummary, BizError> {
    let (free_count, external_count, app_managed_count, release_pending_count): (
        i64,
        i64,
        i64,
        i64,
    ) = conn
        .query_row(
            "SELECT
            SUM(status='free'),
            SUM(status='external'),
            SUM(status IN ('reserved','active','release_pending')),
            SUM(status='release_pending')
         FROM plu_slots",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(crate::db::DbError::from)?;
    Ok(PluRegisterSnapshotSummary {
        snapshot_at,
        free_count: free_count as usize,
        external_count: external_count as usize,
        app_managed_count: app_managed_count as usize,
        conflict_count,
        release_pending_count: release_pending_count as usize,
    })
}

fn append_clear_rows(
    conn: &DbConnection,
    rows: &mut Vec<PluExportRow>,
    prepared_rows: &mut Vec<PluPreparedRow>,
    blocked_slot_codes: &HashSet<String>,
    clear_row_enabled: bool,
) -> Result<(), BizError> {
    if !clear_row_enabled {
        return Ok(());
    }
    for slot in plu_slot_repo::find_slots_by_status(conn, PluSlotStatus::ReleasePending)? {
        if slot
            .scanning_code
            .as_ref()
            .is_some_and(|code| blocked_slot_codes.contains(code))
        {
            continue;
        }
        rows.push(PluExportRow {
            memory_no: slot.memory_no,
            row_kind: PluExportRowKind::Clear,
            product_code: String::new(),
            jan_code: None,
            name: String::new(),
            selling_price: 0,
            tax_rate: "10".to_string(),
            department_name: String::new(),
        });
        prepared_rows.push(PluPreparedRow {
            memory_no: slot.memory_no,
            row_kind: PluPreparedRowKind::Clear,
            target_product_codes: Vec::new(),
        });
    }
    Ok(())
}

// ===========================================================================
// テスト
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
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
        system_repo::upsert_setting(conn, "plu_register_snapshot_at", "2026-08-18T00:00:00")
            .unwrap();
    }

    fn prepared_rows_for_codes(conn: &DbConnection, codes: &[String]) -> Vec<PluPreparedRow> {
        let now = "2026-08-18T00:00:00";
        let mut rows = Vec::new();
        for (index, code) in codes
            .iter()
            .collect::<BTreeSet<_>>()
            .into_iter()
            .enumerate()
        {
            let memory_no = 217 + index as i64;
            let scanning_code = product_repo::find_by_product_code(conn, code)
                .unwrap()
                .and_then(|product| product.product.jan_code)
                .unwrap_or_else(|| format!("SYNTH-{index}"));
            plu_slot_repo::update_slot(
                conn,
                PluSlotUpdate {
                    memory_no,
                    scanning_code: Some(&scanning_code),
                    status: PluSlotStatus::Reserved,
                    reserved_at: Some(now),
                    activated_at: None,
                    released_at: None,
                    updated_at: now,
                },
            )
            .unwrap();
            rows.push(PluPreparedRow {
                memory_no,
                row_kind: PluPreparedRowKind::Product,
                target_product_codes: vec![(*code).clone()],
            });
        }
        rows
    }

    fn snapshot_bytes(codes: &[(i64, String)]) -> Vec<u8> {
        let by_memory: std::collections::HashMap<i64, &str> = codes
            .iter()
            .map(|(memory_no, code)| (*memory_no, code.as_str()))
            .collect();
        let mut text = String::from(
            "\"meta\",\"synthetic\"\r\n\"メモリNo.\",\"ｽｷｬﾆﾝｸﾞｺｰﾄﾞ\",\"名称\",\"個数\",\"金額\"\r\n",
        );
        for memory_no in 1..=5_000 {
            let code = by_memory
                .get(&(memory_no as i64))
                .copied()
                .unwrap_or("00000000000000");
            text.push_str(&format!("{memory_no},{code},,0,0\r\n"));
        }
        let (bytes, _, _) = encoding_rs::SHIFT_JIS.encode(&text);
        bytes.into_owned()
    }

    fn put_slot(conn: &DbConnection, memory_no: i64, code: Option<&str>, status: PluSlotStatus) {
        let activated = matches!(
            status,
            PluSlotStatus::Active | PluSlotStatus::ReleasePending
        )
        .then_some("2026-08-17T00:00:00");
        let reserved = (status == PluSlotStatus::Reserved).then_some("2026-08-17T00:00:00");
        plu_slot_repo::update_slot(
            conn,
            PluSlotUpdate {
                memory_no,
                scanning_code: code,
                status,
                reserved_at: reserved,
                activated_at: activated,
                released_at: None,
                updated_at: "2026-08-17T00:00:00",
            },
        )
        .unwrap();
    }

    #[test]
    fn test_prepare_plu_export_req907_requires_snapshot_without_writes() {
        // REQ-907: A-N1 paired empty-write oracle.
        let (_dir, mut conn) = setup_test_db();
        let summary = get_plu_slot_summary(&conn).unwrap();
        assert_eq!(summary.snapshot_at, None);
        assert_eq!(
            (
                summary.free_count,
                summary.external_count,
                summary.app_managed_count,
                summary.conflict_count,
            ),
            (0, 0, 0, 0)
        );
        let before: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM plu_slots WHERE status <> 'free'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let result = prepare_plu_export(
            &mut conn,
            PluExportPrepareRequest {
                mode: ExportMode::Full,
            },
        );
        assert!(
            matches!(result, Err(BizError::ValidationFailed(message)) if message.contains("register_snapshot_required"))
        );
        let after: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM plu_slots WHERE status <> 'free'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!((before, after), (0, 0));
    }

    #[test]
    fn test_get_plu_slot_summary_req907_reports_release_pending_count() {
        // REQ-907 / UI-08-D11: release_pending-only でも Diff 導線を有効化できる summary oracle.
        let (_dir, conn) = setup_test_db();
        system_repo::upsert_setting(&conn, "plu_register_snapshot_at", "2026-08-20T17:34:00")
            .unwrap();
        put_slot(
            &conn,
            217,
            Some("4901234567894"),
            PluSlotStatus::ReleasePending,
        );
        put_slot(&conn, 218, Some("4901234567887"), PluSlotStatus::Active);

        let summary = get_plu_slot_summary(&conn).unwrap();

        assert_eq!(summary.release_pending_count, 1);
        assert_eq!(summary.app_managed_count, 2);
    }

    #[test]
    fn test_import_plu_register_snapshot_req907_reconciles_all_statuses_and_logs_summary() {
        // REQ-907: A-N3/N3b/N4/N4b/N5/N5b/N6/N6b/N7/N8/N8b/N8c/N9/N9b/N9c.
        let (_dir, mut conn) = setup_test_db();
        let eligible = valid_jan_from_seed(81);
        seed_product_for_plu_with_jan(
            &conn,
            "SNAP-ELIG",
            Some(&eligible),
            "eligible",
            1,
            false,
            false,
        );
        let active_missing = valid_jan_from_seed(82);
        seed_product_for_plu_with_jan(
            &conn,
            "SNAP-MISS",
            Some(&active_missing),
            "missing",
            1,
            false,
            false,
        );
        let active_conflict = valid_jan_from_seed(83);
        seed_product_for_plu_with_jan(
            &conn,
            "SNAP-CONFLICT",
            Some(&active_conflict),
            "conflict",
            1,
            false,
            false,
        );
        let reserved_same = valid_jan_from_seed(84);
        let reserved_dropped = valid_jan_from_seed(85);

        put_slot(&conn, 219, Some("RES-EMPTY"), PluSlotStatus::Reserved);
        put_slot(&conn, 220, Some(&reserved_same), PluSlotStatus::Reserved);
        put_slot(&conn, 221, Some(&active_missing), PluSlotStatus::Active);
        put_slot(&conn, 222, Some(&active_conflict), PluSlotStatus::Active);
        put_slot(&conn, 223, Some("EXT-EMPTY"), PluSlotStatus::External);
        put_slot(&conn, 224, Some("EXT-SAME"), PluSlotStatus::External);
        put_slot(&conn, 225, Some("EXT-OLD"), PluSlotStatus::External);
        put_slot(&conn, 226, Some("REL-EMPTY"), PluSlotStatus::ReleasePending);
        put_slot(&conn, 227, Some("REL-SAME"), PluSlotStatus::ReleasePending);
        put_slot(&conn, 228, Some("REL-OLD"), PluSlotStatus::ReleasePending);
        put_slot(&conn, 229, Some(&reserved_dropped), PluSlotStatus::Reserved);

        let summary = import_plu_register_snapshot(
            &mut conn,
            &snapshot_bytes(&[
                (217, eligible.clone()),
                (218, eligible.clone()),
                (220, reserved_same),
                (222, "DIFFERENT-A".to_string()),
                (224, "EXT-SAME".to_string()),
                (225, "EXT-NEW".to_string()),
                (227, "REL-SAME".to_string()),
                (228, "REL-NEW".to_string()),
                (229, "DIFFERENT-R".to_string()),
                (230, "12345678EEEEEE".to_string()),
            ]),
        )
        .unwrap();

        let status = |memory_no| {
            plu_slot_repo::find_slot_by_memory_no(&conn, memory_no)
                .unwrap()
                .unwrap()
        };
        assert_eq!(status(217).status, PluSlotStatus::Active);
        assert_eq!(status(218).status, PluSlotStatus::ReleasePending);
        assert_eq!(
            status(218).scanning_code.as_deref(),
            Some(eligible.as_str())
        );
        assert_eq!(status(219).status, PluSlotStatus::Reserved);
        assert_eq!(status(220).status, PluSlotStatus::Active);
        assert_eq!(status(221).status, PluSlotStatus::Active);
        assert_eq!(
            status(222).scanning_code.as_deref(),
            Some(active_conflict.as_str())
        );
        assert_eq!(status(223).status, PluSlotStatus::Free);
        assert_eq!(status(224).status, PluSlotStatus::External);
        assert_eq!(status(225).scanning_code.as_deref(), Some("EXT-NEW"));
        assert_eq!(status(226).status, PluSlotStatus::Free);
        assert_eq!(status(227).status, PluSlotStatus::ReleasePending);
        assert_eq!(status(228).status, PluSlotStatus::External);
        assert_eq!(status(229).status, PluSlotStatus::External);
        assert_eq!(status(230).status, PluSlotStatus::External);
        assert!(
            product_repo::find_by_product_code(&conn, "SNAP-MISS")
                .unwrap()
                .unwrap()
                .product
                .plu_dirty
        );
        assert!(
            product_repo::find_by_product_code(&conn, "SNAP-CONFLICT")
                .unwrap()
                .unwrap()
                .product
                .plu_dirty
        );
        assert!(summary.snapshot_at.is_some());
        assert!(summary.conflict_count >= 3);
        let summary_json = system_repo::get_setting(&conn, "plu_register_snapshot_summary")
            .unwrap()
            .unwrap();
        let value: serde_json::Value = serde_json::from_str(&summary_json).unwrap();
        assert_eq!(value.as_object().unwrap().len(), 4);
        let logs: i64 = conn.query_row(
            "SELECT COUNT(*) FROM operation_logs WHERE operation_type='plu_register_snapshot_import'",
            [], |row| row.get(0),
        ).unwrap();
        assert_eq!(logs, 1);
    }

    #[test]
    fn test_import_plu_register_snapshot_req907_preserves_managed_slot_on_duplicate_observation() {
        // REQ-907: A-N3c amendment 2.
        for managed_status in [PluSlotStatus::Reserved, PluSlotStatus::Active] {
            let (_dir, mut conn) = setup_test_db();
            let jan = valid_jan_from_seed(if managed_status == PluSlotStatus::Reserved {
                91
            } else {
                92
            });
            seed_product_for_plu_with_jan(&conn, "DUP-MANAGED", Some(&jan), "dup", 1, false, true);
            put_slot(&conn, 217, Some(&jan), managed_status);
            import_plu_register_snapshot(&mut conn, &snapshot_bytes(&[(218, jan.clone())]))
                .unwrap();
            assert_eq!(
                plu_slot_repo::find_slot_by_memory_no(&conn, 217)
                    .unwrap()
                    .unwrap()
                    .status,
                managed_status
            );
            let stale = plu_slot_repo::find_slot_by_memory_no(&conn, 218)
                .unwrap()
                .unwrap();
            assert_eq!(stale.status, PluSlotStatus::ReleasePending);
            assert_eq!(stale.scanning_code.as_deref(), Some(jan.as_str()));
        }
    }

    #[test]
    fn test_import_plu_register_snapshot_req907_rolls_back_settings_log_and_slots() {
        // REQ-907: A-N9c snapshot reconciliation and evidence are one transaction.
        let (_dir, mut conn) = setup_test_db();
        system_repo::upsert_setting(&conn, "plu_register_snapshot_at", "before-at").unwrap();
        system_repo::upsert_setting(&conn, "plu_register_snapshot_summary", "before-summary")
            .unwrap();
        let duplicate_external = "12345678EEEEEE";

        let result = import_plu_register_snapshot(
            &mut conn,
            &snapshot_bytes(&[
                (217, duplicate_external.to_string()),
                (218, duplicate_external.to_string()),
            ]),
        );

        assert!(matches!(result, Err(BizError::DatabaseError(_))));
        assert_eq!(
            system_repo::get_setting(&conn, "plu_register_snapshot_at")
                .unwrap()
                .as_deref(),
            Some("before-at")
        );
        assert_eq!(
            system_repo::get_setting(&conn, "plu_register_snapshot_summary")
                .unwrap()
                .as_deref(),
            Some("before-summary")
        );
        let logs: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM operation_logs WHERE operation_type='plu_register_snapshot_import'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(logs, 0);
        assert_eq!(
            plu_slot_repo::find_slot_by_memory_no(&conn, 217)
                .unwrap()
                .unwrap()
                .status,
            PluSlotStatus::Free
        );
        assert_eq!(
            plu_slot_repo::find_slot_by_memory_no(&conn, 218)
                .unwrap()
                .unwrap()
                .status,
            PluSlotStatus::Free
        );
    }

    #[test]
    fn test_prepare_plu_export_req907_uses_min_free_and_sticky_allocation() {
        // REQ-907: A-P1/A-P2 hole fixture uses independent memory numbers.
        let (_dir, mut conn) = setup_test_db();
        let jan_a = valid_jan_from_seed(101);
        let jan_b = valid_jan_from_seed(102);
        seed_product_for_plu_with_jan(&conn, "ALLOC-A", Some(&jan_a), "A", 1, false, true);
        seed_product_for_plu_with_jan(&conn, "ALLOC-B", Some(&jan_b), "B", 1, false, true);
        conn.execute(
            "UPDATE plu_slots SET status='external', scanning_code='EXT-' || memory_no",
            [],
        )
        .unwrap();
        for memory_no in [217, 300, 401, 5_000] {
            put_slot(&conn, memory_no, None, PluSlotStatus::Free);
        }

        let first = prepare_plu_export(
            &mut conn,
            PluExportPrepareRequest {
                mode: ExportMode::Diff,
            },
        )
        .unwrap();
        assert_eq!(
            first
                .prepared_rows
                .iter()
                .filter(|row| row.row_kind == PluPreparedRowKind::Product)
                .map(|row| row.memory_no)
                .collect::<Vec<_>>(),
            vec![217, 300]
        );
        let second = prepare_plu_export(
            &mut conn,
            PluExportPrepareRequest {
                mode: ExportMode::Full,
            },
        )
        .unwrap();
        assert_eq!(
            second
                .prepared_rows
                .iter()
                .filter(|row| row.row_kind == PluPreparedRowKind::Product)
                .map(|row| row.memory_no)
                .collect::<Vec<_>>(),
            vec![217, 300]
        );
        let reserved: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM plu_slots WHERE status='reserved'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(reserved, 2);
    }

    #[test]
    fn test_prepare_plu_export_req907_adopts_external_before_free_or_release_pending() {
        // REQ-907: A-P3b / A-R6 amendment 2.
        let (_dir, mut conn) = setup_test_db();
        let jan = valid_jan_from_seed(111);
        seed_product_for_plu_with_jan(&conn, "ADOPT", Some(&jan), "adopt", 1, false, true);
        put_slot(&conn, 217, Some(&jan), PluSlotStatus::ReleasePending);
        put_slot(&conn, 218, Some(&jan), PluSlotStatus::ReleasePending);
        put_slot(&conn, 300, Some(&jan), PluSlotStatus::External);
        let free_before: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM plu_slots WHERE status='free'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        let result = prepare_plu_export(
            &mut conn,
            PluExportPrepareRequest {
                mode: ExportMode::Diff,
            },
        )
        .unwrap();
        let product_row = result
            .prepared_rows
            .iter()
            .find(|row| row.row_kind == PluPreparedRowKind::Product)
            .unwrap();
        assert_eq!(product_row.memory_no, 300);
        assert_eq!(
            plu_slot_repo::find_slot_by_memory_no(&conn, 300)
                .unwrap()
                .unwrap()
                .status,
            PluSlotStatus::Active
        );
        assert_eq!(
            plu_slot_repo::find_slot_by_memory_no(&conn, 217)
                .unwrap()
                .unwrap()
                .status,
            PluSlotStatus::ReleasePending
        );
        assert_eq!(
            plu_slot_repo::find_slot_by_memory_no(&conn, 218)
                .unwrap()
                .unwrap()
                .status,
            PluSlotStatus::ReleasePending
        );
        assert_eq!(
            result
                .prepared_rows
                .iter()
                .filter(|row| row.row_kind == PluPreparedRowKind::Clear)
                .count(),
            2
        );
        let free_after: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM plu_slots WHERE status='free'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(free_after, free_before);
    }

    #[test]
    fn test_prepare_plu_export_req907_reallocates_after_reservation_dropped() {
        // REQ-907 / B-F2: register 側で失われた予約 memory は external のまま再利用しない。
        let (_dir, mut conn) = setup_test_db();
        let jan = valid_jan_from_seed(116);
        seed_product_for_plu_with_jan(
            &conn,
            "RESERVATION-DROPPED",
            Some(&jan),
            "reservation dropped",
            1,
            false,
            true,
        );
        put_slot(&conn, 300, Some(&jan), PluSlotStatus::Reserved);
        import_plu_register_snapshot(
            &mut conn,
            &snapshot_bytes(&[(300, "DIFFERENT-SYNTH".to_string())]),
        )
        .unwrap();
        let dropped = plu_slot_repo::find_slot_by_memory_no(&conn, 300)
            .unwrap()
            .unwrap();
        assert_eq!(dropped.status, PluSlotStatus::External);

        let prepared = prepare_plu_export(
            &mut conn,
            PluExportPrepareRequest {
                mode: ExportMode::Diff,
            },
        )
        .unwrap();
        let row = prepared
            .prepared_rows
            .iter()
            .find(|row| row.row_kind == PluPreparedRowKind::Product)
            .unwrap();
        assert_ne!(row.memory_no, 300);
        assert_eq!(row.memory_no, 217, "再予約は最小の free slot を使う");
        let replacement = plu_slot_repo::find_slot_by_memory_no(&conn, row.memory_no)
            .unwrap()
            .unwrap();
        assert_eq!(replacement.status, PluSlotStatus::Reserved);
        assert_eq!(replacement.scanning_code.as_deref(), Some(jan.as_str()));
        assert_eq!(
            plu_slot_repo::find_slot_by_memory_no(&conn, 300)
                .unwrap()
                .unwrap()
                .status,
            PluSlotStatus::External
        );
    }

    #[test]
    fn test_prepare_plu_export_req907_restores_only_min_release_pending_slot() {
        // REQ-907: A-R6 without an external candidate restores only the minimum stale slot.
        let (_dir, mut conn) = setup_test_db();
        let jan = valid_jan_from_seed(112);
        seed_product_for_plu_with_jan(&conn, "RESTORE", Some(&jan), "restore", 1, false, true);
        put_slot(&conn, 300, Some(&jan), PluSlotStatus::ReleasePending);
        put_slot(&conn, 217, Some(&jan), PluSlotStatus::ReleasePending);

        let result = prepare_plu_export(
            &mut conn,
            PluExportPrepareRequest {
                mode: ExportMode::Diff,
            },
        )
        .unwrap();

        let product_row = result
            .prepared_rows
            .iter()
            .find(|row| row.row_kind == PluPreparedRowKind::Product)
            .unwrap();
        assert_eq!(product_row.memory_no, 217);
        assert_eq!(
            plu_slot_repo::find_slot_by_memory_no(&conn, 217)
                .unwrap()
                .unwrap()
                .status,
            PluSlotStatus::Active
        );
        assert_eq!(
            plu_slot_repo::find_slot_by_memory_no(&conn, 300)
                .unwrap()
                .unwrap()
                .status,
            PluSlotStatus::ReleasePending
        );
        assert!(result
            .prepared_rows
            .iter()
            .any(|row| { row.memory_no == 300 && row.row_kind == PluPreparedRowKind::Clear }));
    }

    #[test]
    fn test_confirm_plu_export_req907_activates_product_and_frees_clear_exact_set() {
        // REQ-907: A-P3/A-R5 with retry idempotence.
        let (_dir, mut conn) = setup_test_db();
        let jan = valid_jan_from_seed(121);
        seed_product_for_plu_with_jan(&conn, "CONFIRM-A", Some(&jan), "confirm", 1, false, true);
        put_slot(&conn, 217, Some(&jan), PluSlotStatus::Reserved);
        put_slot(&conn, 218, Some("STALE"), PluSlotStatus::ReleasePending);
        let req = PluExportConfirmRequest {
            product_codes: vec!["CONFIRM-A".to_string()],
            prepared_rows: vec![
                PluPreparedRow {
                    memory_no: 217,
                    row_kind: PluPreparedRowKind::Product,
                    target_product_codes: vec!["CONFIRM-A".to_string()],
                },
                PluPreparedRow {
                    memory_no: 218,
                    row_kind: PluPreparedRowKind::Clear,
                    target_product_codes: vec![],
                },
            ],
        };
        confirm_plu_export_saved(&mut conn, req.clone()).unwrap();
        assert_eq!(
            plu_slot_repo::find_slot_by_memory_no(&conn, 217)
                .unwrap()
                .unwrap()
                .status,
            PluSlotStatus::Active
        );
        let cleared = plu_slot_repo::find_slot_by_memory_no(&conn, 218)
            .unwrap()
            .unwrap();
        assert_eq!(cleared.status, PluSlotStatus::Free);
        assert!(cleared.scanning_code.is_none());
        assert!(cleared.released_at.is_some());
        assert!(
            !product_repo::find_by_product_code(&conn, "CONFIRM-A")
                .unwrap()
                .unwrap()
                .product
                .plu_dirty
        );
        confirm_plu_export_saved(&mut conn, req).unwrap();

        let mismatched = confirm_plu_export_saved(
            &mut conn,
            PluExportConfirmRequest {
                product_codes: vec!["CONFIRM-A".to_string()],
                prepared_rows: vec![PluPreparedRow {
                    memory_no: 219,
                    row_kind: PluPreparedRowKind::Product,
                    target_product_codes: vec!["CONFIRM-A".to_string()],
                }],
            },
        );
        assert!(matches!(mismatched, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    fn test_clear_row_fallback_req907_emits_nothing_and_keeps_release_pending() {
        // REQ-907: A-R7 explicit false injection.
        let (_dir, mut conn) = setup_test_db();
        put_slot(&conn, 217, Some("STALE"), PluSlotStatus::ReleasePending);
        let mut rows = Vec::new();
        let mut prepared = Vec::new();
        append_clear_rows(&conn, &mut rows, &mut prepared, &HashSet::new(), false).unwrap();
        assert!(rows.is_empty());
        assert!(prepared.is_empty());
        assert_eq!(
            plu_slot_repo::find_slot_by_memory_no(&conn, 217)
                .unwrap()
                .unwrap()
                .status,
            PluSlotStatus::ReleasePending
        );

        let result = confirm_plu_export_saved_with_clear_enabled(
            &mut conn,
            PluExportConfirmRequest {
                product_codes: vec![],
                prepared_rows: vec![PluPreparedRow {
                    memory_no: 217,
                    row_kind: PluPreparedRowKind::Clear,
                    target_product_codes: vec![],
                }],
            },
            false,
        );
        assert!(result.is_err());
        assert_eq!(
            plu_slot_repo::find_slot_by_memory_no(&conn, 217)
                .unwrap()
                .unwrap()
                .status,
            PluSlotStatus::ReleasePending
        );
    }

    #[test]
    fn test_prepare_plu_export_req907_no_free_slot_excludes_only_affected_groups() {
        // REQ-907: A-P4 non-empty output paired with NoFreeSlot exclusions.
        let (_dir, mut conn) = setup_test_db();
        let active_jan = valid_jan_from_seed(131);
        seed_product_for_plu_with_jan(
            &conn,
            "HAS-SLOT",
            Some(&active_jan),
            "active",
            1,
            false,
            true,
        );
        seed_product_for_plu(&conn, "NO-SLOT-A", "A", 1, false, true);
        seed_product_for_plu(&conn, "NO-SLOT-B", "B", 1, false, true);
        conn.execute(
            "UPDATE plu_slots SET status='external', scanning_code='EXT-' || memory_no",
            [],
        )
        .unwrap();
        put_slot(&conn, 217, Some(&active_jan), PluSlotStatus::Active);

        let result = prepare_plu_export(
            &mut conn,
            PluExportPrepareRequest {
                mode: ExportMode::Full,
            },
        )
        .unwrap();
        assert_eq!(
            result
                .prepared_rows
                .iter()
                .filter(|row| row.row_kind == PluPreparedRowKind::Product)
                .count(),
            1
        );
        let no_free: Vec<_> = result
            .excluded
            .iter()
            .filter(|item| item.reason == PluExcludedReason::NoFreeSlot)
            .collect();
        assert_eq!(no_free.len(), 2);
    }

    #[test]
    fn test_prepare_plu_export_req907_full_and_diff_include_clear_but_not_external() {
        // REQ-907: A-E1/A-E4 ordering and row composition.
        let (_dir, mut conn) = setup_test_db();
        let dirty_jan = valid_jan_from_seed(141);
        let clean_jan = valid_jan_from_seed(142);
        seed_product_for_plu_with_jan(
            &conn,
            "ROW-DIRTY",
            Some(&dirty_jan),
            "dirty",
            1,
            false,
            true,
        );
        seed_product_for_plu_with_jan(
            &conn,
            "ROW-CLEAN",
            Some(&clean_jan),
            "clean",
            1,
            false,
            false,
        );
        put_slot(&conn, 300, Some(&dirty_jan), PluSlotStatus::Reserved);
        put_slot(&conn, 217, Some(&clean_jan), PluSlotStatus::Active);
        put_slot(&conn, 401, Some("STALE"), PluSlotStatus::ReleasePending);
        put_slot(&conn, 402, Some("EXTERNAL"), PluSlotStatus::External);

        let full = prepare_plu_export(
            &mut conn,
            PluExportPrepareRequest {
                mode: ExportMode::Full,
            },
        )
        .unwrap();
        assert_eq!(
            full.prepared_rows
                .iter()
                .map(|row| row.memory_no)
                .collect::<Vec<_>>(),
            vec![217, 300, 401]
        );
        let diff = prepare_plu_export(
            &mut conn,
            PluExportPrepareRequest {
                mode: ExportMode::Diff,
            },
        )
        .unwrap();
        assert_eq!(
            diff.prepared_rows
                .iter()
                .map(|row| row.memory_no)
                .collect::<Vec<_>>(),
            vec![300, 401]
        );
        assert!(!full.prepared_rows.iter().any(|row| row.memory_no == 402));
    }

    #[test]
    fn test_prepare_plu_export_req907_keeps_invalid_jan_slot_without_output() {
        // REQ-907: A-E6 invalid JAN is excluded without product or clear output for its slot.
        let (_dir, mut conn) = setup_test_db();
        let invalid_jan = "4901234567890";
        let valid_jan = valid_jan_from_seed(143);
        seed_product_for_plu_with_jan(
            &conn,
            "INVALID-SLOT",
            Some(invalid_jan),
            "invalid",
            1,
            false,
            true,
        );
        seed_product_for_plu_with_jan(
            &conn,
            "VALID-SLOT",
            Some(&valid_jan),
            "valid",
            1,
            false,
            true,
        );
        put_slot(&conn, 217, Some(invalid_jan), PluSlotStatus::Active);
        put_slot(&conn, 218, Some(&valid_jan), PluSlotStatus::Active);

        for mode in [ExportMode::Full, ExportMode::Diff] {
            let result = prepare_plu_export(&mut conn, PluExportPrepareRequest { mode }).unwrap();
            assert!(!result.prepared_rows.iter().any(|row| row.memory_no == 217));
            assert_eq!(
                result
                    .prepared_rows
                    .iter()
                    .filter(|row| row.row_kind == PluPreparedRowKind::Clear)
                    .count(),
                0
            );
            assert_eq!(
                result
                    .prepared_rows
                    .iter()
                    .filter(|row| row.row_kind == PluPreparedRowKind::Product)
                    .map(|row| row.memory_no)
                    .collect::<Vec<_>>(),
                vec![218]
            );
            assert!(result.excluded.iter().any(|item| {
                item.product_code == "INVALID-SLOT"
                    && item.reason == PluExcludedReason::InvalidCheckDigit
            }));
            let slot = plu_slot_repo::find_slot_by_memory_no(&conn, 217)
                .unwrap()
                .unwrap();
            assert_eq!(slot.status, PluSlotStatus::Active);
            assert_eq!(slot.scanning_code.as_deref(), Some(invalid_jan));
        }
    }

    #[test]
    fn test_product_join_req907_prefers_managed_then_min_release_pending_slot() {
        // REQ-907: ProductWithRelations exposes exactly one deterministic plu_memory_no.
        let (_dir, conn) = setup_test_db();
        let jan = valid_jan_from_seed(144);
        seed_product_for_plu_with_jan(&conn, "JOIN-SLOT", Some(&jan), "join", 1, false, true);
        put_slot(&conn, 300, Some(&jan), PluSlotStatus::ReleasePending);
        put_slot(&conn, 217, Some(&jan), PluSlotStatus::ReleasePending);
        put_slot(&conn, 401, Some(&jan), PluSlotStatus::Active);

        let product = product_repo::find_by_product_code(&conn, "JOIN-SLOT")
            .unwrap()
            .unwrap();
        assert_eq!(product.plu_memory_no, Some(401));

        put_slot(&conn, 401, Some("OTHER"), PluSlotStatus::Active);
        let product = product_repo::find_by_product_code(&conn, "JOIN-SLOT")
            .unwrap()
            .unwrap();
        assert_eq!(product.plu_memory_no, Some(217));
    }

    #[test]
    fn test_product_service_req907_releases_only_after_last_eligible_shared_jan() {
        // REQ-907: A-R1 shared JAN and reserved/active transitions.
        let (_dir, mut conn) = setup_test_db();
        let jan = valid_jan_from_seed(151);
        seed_product_for_plu_with_jan(&conn, "SHARED-A", Some(&jan), "A", 1, false, true);
        seed_product_for_plu_with_jan(&conn, "SHARED-B", Some(&jan), "B", 1, false, true);
        put_slot(&conn, 217, Some(&jan), PluSlotStatus::Active);

        crate::biz::product_service::update_product(
            &mut conn,
            "SHARED-A",
            &crate::biz::product_service::ProductUpdateRequest {
                plu_target: Some(false),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(
            plu_slot_repo::find_slot_by_memory_no(&conn, 217)
                .unwrap()
                .unwrap()
                .status,
            PluSlotStatus::Active
        );
        crate::biz::product_service::update_product(
            &mut conn,
            "SHARED-B",
            &crate::biz::product_service::ProductUpdateRequest {
                plu_target: Some(false),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(
            plu_slot_repo::find_slot_by_memory_no(&conn, 217)
                .unwrap()
                .unwrap()
                .status,
            PluSlotStatus::ReleasePending
        );

        let reserved_jan = valid_jan_from_seed(152);
        seed_product_for_plu_with_jan(
            &conn,
            "RESERVED-OFF",
            Some(&reserved_jan),
            "R",
            1,
            false,
            true,
        );
        put_slot(&conn, 218, Some(&reserved_jan), PluSlotStatus::Reserved);
        crate::biz::product_service::update_product(
            &mut conn,
            "RESERVED-OFF",
            &crate::biz::product_service::ProductUpdateRequest {
                plu_target: Some(false),
                ..Default::default()
            },
        )
        .unwrap();
        let freed = plu_slot_repo::find_slot_by_memory_no(&conn, 218)
            .unwrap()
            .unwrap();
        assert_eq!(freed.status, PluSlotStatus::Free);
        assert!(freed.scanning_code.is_none());
    }

    #[test]
    fn test_product_service_req907_discontinue_does_not_restore_plu_target() {
        // REQ-907: A-R2.
        let (_dir, mut conn) = setup_test_db();
        let jan = valid_jan_from_seed(161);
        seed_product_for_plu_with_jan(&conn, "DISC-SLOT", Some(&jan), "D", 1, false, true);
        put_slot(&conn, 217, Some(&jan), PluSlotStatus::Active);
        assert!(crate::biz::product_service::toggle_discontinue(&mut conn, "DISC-SLOT").unwrap());
        let discontinued = product_repo::find_by_product_code(&conn, "DISC-SLOT")
            .unwrap()
            .unwrap();
        assert!(!discontinued.product.plu_target);
        assert_eq!(
            plu_slot_repo::find_slot_by_memory_no(&conn, 217)
                .unwrap()
                .unwrap()
                .status,
            PluSlotStatus::ReleasePending
        );
        assert!(!crate::biz::product_service::toggle_discontinue(&mut conn, "DISC-SLOT").unwrap());
        assert!(
            !product_repo::find_by_product_code(&conn, "DISC-SLOT")
                .unwrap()
                .unwrap()
                .product
                .plu_target
        );
    }

    #[test]
    fn test_product_import_req907_releases_old_jan_and_reserves_new_jan() {
        // REQ-907: A-R3 CSV overwrite is the permitted JAN-change path.
        let (_dir, mut conn) = setup_test_db();
        let old_jan = valid_jan_from_seed(171);
        let new_jan = valid_jan_from_seed(172);
        seed_product_for_plu_with_jan(&conn, "JAN-CHANGE", Some(&old_jan), "old", 1, false, true);
        put_slot(&conn, 217, Some(&old_jan), PluSlotStatus::Active);

        crate::biz::product_service::commit_import(
            &mut conn,
            vec![crate::biz::product_service::ImportRow {
                line_no: 2,
                product_code: "JAN-CHANGE".to_string(),
                name: "new".to_string(),
                department_id: 1,
                selling_price: 500,
                cost_price: 300,
                tax_rate: "10".to_string(),
                stock_unit: Some("pcs".to_string()),
                initial_stock: None,
                jan_code: Some(new_jan.clone()),
                maker_code: None,
                supplier_id: None,
                pos_stock_sync: Some(true),
                plu_target: None,
                warnings: Vec::new(),
            }],
            vec!["JAN-CHANGE".to_string()],
        )
        .unwrap();
        assert_eq!(
            plu_slot_repo::find_slot_by_memory_no(&conn, 217)
                .unwrap()
                .unwrap()
                .status,
            PluSlotStatus::ReleasePending
        );
        let prepared = prepare_plu_export(
            &mut conn,
            PluExportPrepareRequest {
                mode: ExportMode::Diff,
            },
        )
        .unwrap();
        let new_row = prepared
            .prepared_rows
            .iter()
            .find(|row| row.row_kind == PluPreparedRowKind::Product)
            .unwrap();
        assert_ne!(new_row.memory_no, 217);
        assert_eq!(
            plu_slot_repo::find_slot_by_memory_no(&conn, new_row.memory_no)
                .unwrap()
                .unwrap()
                .scanning_code
                .as_deref(),
            Some(new_jan.as_str())
        );
    }

    #[test]
    fn test_prepare_plu_export_req402_does_not_update_dirty_or_exported_at() {
        // REQ-402 / D-027: PLUファイル生成だけでは未反映を解除しない
        let (_dir, mut conn) = setup_test_db();
        seed_product_for_plu(&conn, "PLU-P01", "準備対象A", 1, false, true);
        seed_product_for_plu(&conn, "PLU-P02", "準備対象B", 1, false, true);

        let req = PluExportPrepareRequest {
            mode: ExportMode::Diff,
        };
        let result = prepare_plu_export(&mut conn, req).unwrap();

        assert_eq!(result.count, 2);
        assert_eq!(
            result.target_product_codes,
            vec!["PLU-P01".to_string(), "PLU-P02".to_string()]
        );
        assert!(!result.plu_output.bytes.is_empty());

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
            prepared_rows: prepared_rows_for_codes(
                &conn,
                &["PLU-CF1".to_string(), "PLU-CF2".to_string()],
            ),
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
        // REQ-402 / REQ-907: confirm は商品件数ではなく prepared row の exact set を検証する。
        let (_dir, mut conn) = setup_test_db();
        let product_codes: Vec<String> = (0..=4_784)
            .map(|idx| format!("PLU-LIMIT-{idx:04}"))
            .collect();
        let shared_jan = valid_jan_from_seed(9_999);

        {
            let tx = conn.transaction().unwrap();
            for code in &product_codes {
                seed_product_for_plu_with_jan(&tx, code, Some(&shared_jan), code, 1, false, true);
            }
            tx.commit().unwrap();
        }

        plu_slot_repo::update_slot(
            &conn,
            PluSlotUpdate {
                memory_no: 217,
                scanning_code: Some(&shared_jan),
                status: PluSlotStatus::Reserved,
                reserved_at: Some("2026-08-18T00:00:00"),
                activated_at: None,
                released_at: None,
                updated_at: "2026-08-18T00:00:00",
            },
        )
        .unwrap();
        let prepared_rows = vec![PluPreparedRow {
            memory_no: 217,
            row_kind: PluPreparedRowKind::Product,
            target_product_codes: product_codes.clone(),
        }];
        let result = confirm_plu_export_saved(
            &mut conn,
            PluExportConfirmRequest {
                product_codes: product_codes.clone(),
                prepared_rows,
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
                prepared_rows: vec![],
            },
        );
        assert!(matches!(empty, Err(BizError::ValidationFailed(_))));

        let duplicate_rows = prepared_rows_for_codes(&conn, &["PLU-RB1".to_string()]);
        let duplicate = confirm_plu_export_saved(
            &mut conn,
            PluExportConfirmRequest {
                product_codes: vec!["PLU-RB1".to_string(), "PLU-RB1".to_string()],
                prepared_rows: duplicate_rows,
            },
        );
        assert!(matches!(duplicate, Err(BizError::ValidationFailed(_))));

        let missing_rows =
            prepared_rows_for_codes(&conn, &["PLU-RB1".to_string(), "NO-SUCH-PLU".to_string()]);
        let missing = confirm_plu_export_saved(
            &mut conn,
            PluExportConfirmRequest {
                product_codes: vec!["PLU-RB1".to_string(), "NO-SUCH-PLU".to_string()],
                prepared_rows: missing_rows,
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
        let (_dir, mut conn) = setup_test_db();
        seed_product_for_plu(&conn, "PLU-001", "テスト毛糸A", 1, false, true);
        seed_product_for_plu(&conn, "PLU-002", "テスト毛糸B", 1, false, false);
        seed_product_for_plu(&conn, "PLU-DISC", "廃番品", 1, true, true);

        let req = PluExportPrepareRequest {
            mode: ExportMode::Full,
        };
        let result = prepare_plu_export(&mut conn, req).unwrap();

        assert_eq!(result.count, 2, "廃番を除いた2件が書出される");
        assert_eq!(
            result.target_product_codes,
            vec!["PLU-001".to_string(), "PLU-002".to_string()]
        );
        assert!(!result.over_limit_warning);
        assert!(!result.plu_output.bytes.is_empty());

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
    fn test_prepare_plu_export_req402_rate8_uses_tax2_internal() {
        let (_dir, mut conn) = setup_test_db();
        seed_product_for_plu(&conn, "PLU-TAX8", "税率8商品", 1, false, true);
        conn.execute(
            "UPDATE products SET tax_rate = '8' WHERE product_code = 'PLU-TAX8'",
            [],
        )
        .unwrap();

        let result = prepare_plu_export(
            &mut conn,
            PluExportPrepareRequest {
                mode: ExportMode::Diff,
            },
        )
        .unwrap();
        let (decoded, _, had_errors) = encoding_rs::SHIFT_JIS.decode(&result.plu_output.bytes);
        assert!(!had_errors);
        assert!(decoded.contains("税2(内税)"), "PLU output: {decoded}");
    }

    #[test]
    fn test_prepare_plu_export_req402_diff_mode() {
        // REQ-402: PLU書出し
        // BIZ-04: Diffモードでplu_dirty=1の商品のみ書出されること
        let (_dir, mut conn) = setup_test_db();
        seed_product_for_plu(&conn, "PLU-D01", "ダーティ商品", 1, false, true);
        seed_product_for_plu(&conn, "PLU-C01", "クリーン商品", 1, false, false);

        let req = PluExportPrepareRequest {
            mode: ExportMode::Diff,
        };
        let result = prepare_plu_export(&mut conn, req).unwrap();

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
        let (_dir, mut conn) = setup_test_db();

        let req = PluExportPrepareRequest {
            mode: ExportMode::Diff,
        };
        let result = prepare_plu_export(&mut conn, req);

        assert!(matches!(result, Err(BizError::ValidationFailed(_))));
    }

    #[test]
    fn test_plu_format_failure_req402_maps_to_export_error() {
        // REQ-402 / BIZ-04-D2: formatter failure は書出し専用 error 語彙へ変換する。
        let (_dir, mut conn) = setup_test_db();
        seed_product_for_plu(&conn, "PLU-ERR", "合成商品😀", 1, false, true);

        let result = prepare_plu_export(
            &mut conn,
            PluExportPrepareRequest {
                mode: ExportMode::Diff,
            },
        );

        assert!(
            matches!(
                result,
                Err(BizError::ExportError(ref message))
                    if message.starts_with("PLUファイルの生成に失敗しました:")
            ),
            "unexpected result: {result:?}"
        );
    }

    #[test]
    fn test_prepare_plu_export_req402_excludes_products_without_valid_13_digit_jan() {
        // REQ-402 / D-028 / CV17 1.1.1: JAN不備商品は全体失敗ではなく対象外リストへ分離する。
        let (_dir, mut conn) = setup_test_db();
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
            &mut conn,
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
        let (_dir, mut conn) = setup_test_db();
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
            &mut conn,
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
            &mut conn,
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
        assert!(!result.plu_output.bytes.is_empty());
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
                prepared_rows: result.prepared_rows,
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

        let prepared_rows = prepared_rows_for_codes(&conn, &["PLU-AT1".to_string()]);
        confirm_plu_export_saved(
            &mut conn,
            PluExportConfirmRequest {
                product_codes: vec!["PLU-AT1".to_string()],
                prepared_rows,
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

        let prepared_rows = prepared_rows_for_codes(&conn, &["PLU-LOG".to_string()]);
        confirm_plu_export_saved(
            &mut conn,
            PluExportConfirmRequest {
                product_codes: vec!["PLU-LOG".to_string()],
                prepared_rows,
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
        // REQ-402 / REQ-907: 固定件数で全体を拒否せず、空き不足分だけ no_free_slot にする。
        let (_dir, mut conn) = setup_test_db();
        for idx in 0..=4_784 {
            let code = format!("OL-{:04}", idx);
            let jan = valid_jan_from_seed(idx as u64);
            seed_product_for_plu_with_jan(&conn, &code, Some(&jan), "上限確認", 1, false, true);
        }

        let req = PluExportPrepareRequest {
            mode: ExportMode::Full,
        };
        let result = prepare_plu_export(&mut conn, req).unwrap();
        assert_eq!(result.prepared_rows.len(), 4_784);
        assert_eq!(result.excluded.len(), 1);
        assert!(matches!(
            result.excluded[0].reason,
            PluExcludedReason::NoFreeSlot
        ));
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
