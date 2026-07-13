//! ビジネスロジック層
//!
//! ARCHITECTURE.md: UI → CMD → BIZ → IO の一方向。
//! トランザクション管理はBIZ層が制御する。

pub mod csv_import_service;
pub mod daily_report_import_service;
pub mod integrity_service;
pub mod inventory_service;
pub mod plu_export_service;
pub mod product_service;
pub mod sales_service;
pub mod stocktake_service;

// CMD層がBIZ経由で使用するDB型の re-export（CMD→db直接依存を避けるため、UI層未実装のため一部はまだ未使用）
#[allow(unused_imports)]
pub use crate::db::product_repo::{Department, Supplier};
#[allow(unused_imports)]
pub use crate::db::product_repo::{ProductSearchQuery, ProductWithRelations};
#[allow(unused_imports)]
pub use crate::db::sales_repo::CsvImport;
#[allow(unused_imports)]
pub use crate::db::stocktake_repo::{
    LastStocktakeSummary, Stocktake, StocktakeItemDetail, StocktakeProgress,
};
#[allow(unused_imports)]
pub use crate::db::DbConnection;
#[allow(unused_imports)]
pub use crate::db::PaginatedResult;
// CMD-02〜05 用 re-export
pub use crate::db::disposal_repo::{
    DisposalRecordDetail, DisposalRecordSummary, InventoryRecordQuery, InventoryRecordSummary,
};
pub use crate::db::inventory_common::ListQuery;
pub use crate::db::manual_sale_repo::ManualSaleRecordDetail;
pub use crate::db::receiving_repo::{ReceivingRecordDetail, ReceivingRecordWithSupplier};
pub use crate::db::return_repo::{ReturnRecordDetail, ReturnRecordSummary};
// CMD-06 用 re-export
pub use crate::db::inventory_repo::{MovementQuery, MovementRecord};
pub use crate::db::product_repo::StockDetail;

use crate::db::DbError;
use std::fmt;

/// BIZ層のエラー型
///
/// 30-biz-product-service.md §4.7
#[derive(Debug)]
pub enum BizError {
    /// 入力バリデーション失敗
    ValidationFailed(String),
    /// 対象レコードが見つからない
    NotFound(String),
    /// 商品コード重複
    DuplicateProductCode(String),
    /// IO層エラーのラップ
    DatabaseError(DbError),
    /// インポートエラー（BIZ-03 CSV取込みパイプライン）
    ImportError(String),
    /// 同じ冪等キーで異なる内容のリクエスト
    IdempotencyConflict(String),
    /// 棚卸し進行中（BIZ-06）
    StocktakeInProgress(String),
    /// 棚卸し未進行（BIZ-06）
    StocktakeNotInProgress(String),
}

impl fmt::Display for BizError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BizError::ValidationFailed(msg) => write!(f, "バリデーションエラー: {}", msg),
            BizError::NotFound(msg) => write!(f, "見つかりません: {}", msg),
            BizError::DuplicateProductCode(code) => {
                write!(f, "商品コード重複: {}", code)
            }
            BizError::DatabaseError(e) => write!(f, "データベースエラー: {}", e),
            BizError::ImportError(msg) => write!(f, "インポートエラー: {}", msg),
            BizError::IdempotencyConflict(msg) => write!(f, "冪等性キー競合: {}", msg),
            BizError::StocktakeInProgress(msg) => write!(f, "棚卸し進行中: {}", msg),
            BizError::StocktakeNotInProgress(msg) => write!(f, "棚卸し未進行: {}", msg),
        }
    }
}

impl std::error::Error for BizError {}

/// DbError → BizError の自動変換
///
/// DuplicateKey は DuplicateProductCode に正規化しない（呼び出し元で判断）。
/// INSERT 時の DuplicateKey → DuplicateProductCode の変換は各BIZ関数内で明示的に行う。
impl From<DbError> for BizError {
    fn from(err: DbError) -> Self {
        BizError::DatabaseError(err)
    }
}
