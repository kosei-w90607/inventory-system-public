//! BIZ-02: 在庫変動ロジック
//!
//! ARCHITECTURE.md タスク仕様 BIZ-02 + 31-biz-inventory-service.md §12 に基づく実装。
//! apply_stock_change（共通在庫変動）+ 4業務関数（入庫/返品/手動販売/廃棄）。

//! CMD-02〜05 が全シンボルを使用。

mod common;
mod disposal;
mod list;
mod manual_sale;
mod receiving;
mod returns;

#[cfg(test)]
mod invariants;
#[cfg(test)]
mod test_support;

// --- 公開シンボル ---

// 共通型（StockChangeOutcome はテスト内不変条件チェックでのみ使用）
#[cfg(test)]
pub(crate) use common::StockChangeOutcome;

// apply_stock_change は pub(crate) を維持（BIZ-03 CSV取込みから呼び出し可）
pub(crate) use common::apply_stock_change;

// 入庫
pub use receiving::{create_receiving, ReceivingCreateRequest, ReceivingCreateResult};

// 返品
pub use returns::{create_return, ReturnCreateRequest, ReturnCreateResult};

// 手動販売
pub use manual_sale::{create_manual_sale, ManualSaleCreateRequest, ManualSaleCreateResult};

// 廃棄
pub use disposal::{create_disposal, DisposalCreateRequest, DisposalCreateResult};

// 一覧取得
pub use list::{
    get_disposal_record, get_manual_sale_record, get_receiving_record, get_return_record,
    list_disposals, list_inventory_records, list_movements, list_receivings, list_returns,
};
