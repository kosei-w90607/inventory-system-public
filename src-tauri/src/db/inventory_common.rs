//! 在庫ドメイン共通型・関数
//!
//! ListQuery, validate_and_offset を提供する。
//! 入庫・返品・廃棄の各リポジトリから参照される。

use super::DbError;

/// 一覧取得の共通クエリパラメータ
///
/// 21-io-inventory-repo.md §10.1
#[derive(Debug)]
pub struct ListQuery {
    pub page: u32,
    pub per_page: u32,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
}

/// ListQuery のバリデーション + offset 計算
///
/// page < 1 or per_page < 1 → DbError::QueryFailed
/// (page-1) * per_page のオーバーフロー → DbError::QueryFailed
/// 戻り値: (per_page as i64, offset as i64)
pub fn validate_and_offset(query: &ListQuery) -> Result<(i64, i64), DbError> {
    if query.page < 1 {
        return Err(DbError::QueryFailed("page は 1 以上が必要です".to_string()));
    }
    if query.per_page < 1 {
        return Err(DbError::QueryFailed(
            "per_page は 1 以上が必要です".to_string(),
        ));
    }
    let page_minus_one = query
        .page
        .checked_sub(1)
        .ok_or_else(|| DbError::QueryFailed("page のオーバーフロー".to_string()))?;
    let offset = page_minus_one
        .checked_mul(query.per_page)
        .ok_or_else(|| DbError::QueryFailed("offset 計算のオーバーフロー".to_string()))?;
    let limit = i64::from(query.per_page);
    let offset = i64::from(offset);
    Ok((limit, offset))
}
