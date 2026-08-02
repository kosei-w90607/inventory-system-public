use crate::biz::csv_import_service::CsvImportErrorType;
use crate::biz::plu_export_service::ExportMode;
use crate::biz::sales_service::{DailySaleSource, SalesMode};
use crate::db::disposal_repo::DisposalType;
use crate::db::inventory_repo::{MovementType, ReferenceType};
use crate::db::manual_sale_repo::ManualSaleReason;
use crate::db::product_repo::{ProductStockUnit, ProductTaxRate};
use crate::db::return_repo::{ReturnDirection, ReturnExchangeType};
use crate::db::sales_repo::CsvImportStatus;

fn assert_roundtrip<T>(value: T, wire: &str)
where
    T: serde::Serialize + serde::de::DeserializeOwned + PartialEq + std::fmt::Debug,
{
    assert_eq!(
        serde_json::to_string(&value).unwrap(),
        format!("\"{wire}\"")
    );
    assert_eq!(
        serde_json::from_str::<T>(&format!("\"{wire}\"")).unwrap(),
        value
    );
}

fn assert_serialize<T: serde::Serialize>(value: T, wire: &str) {
    assert_eq!(
        serde_json::to_string(&value).unwrap(),
        format!("\"{wire}\"")
    );
}

#[test]
fn test_request_response_enum_wire_roundtrip_req202_req203_req204_req401_req502() {
    for (value, wire) in [
        (ReturnExchangeType::Return, "return"),
        (ReturnExchangeType::Exchange, "exchange"),
    ] {
        assert_roundtrip(value, wire);
    }
    for (value, wire) in [(ReturnDirection::In, "in"), (ReturnDirection::Out, "out")] {
        assert_roundtrip(value, wire);
    }
    for (value, wire) in [
        (DisposalType::Disposal, "disposal"),
        (DisposalType::Damage, "damage"),
        (DisposalType::Other, "other"),
    ] {
        assert_roundtrip(value, wire);
    }
    for (value, wire) in [
        (ManualSaleReason::PluUnregistered, "plu_unregistered"),
        (ManualSaleReason::Other, "other"),
    ] {
        assert_roundtrip(value, wire);
    }
    for (value, wire) in [
        (ProductTaxRate::Rate10, "10"),
        (ProductTaxRate::Rate8, "8"),
        (ProductTaxRate::Rate0, "0"),
    ] {
        assert_roundtrip(value, wire);
    }
    for (value, wire) in [(ProductStockUnit::Pcs, "pcs"), (ProductStockUnit::Cm, "cm")] {
        assert_roundtrip(value, wire);
    }
    for (value, wire) in [(ExportMode::Full, "full"), (ExportMode::Diff, "diff")] {
        assert_roundtrip(value, wire);
    }
    for (value, wire) in [
        (SalesMode::ByProduct, "by_product"),
        (SalesMode::ByDepartment, "by_department"),
    ] {
        assert_roundtrip(value, wire);
    }
    for (value, wire) in [
        (MovementType::SaleAuto, "sale_auto"),
        (MovementType::SaleManual, "sale_manual"),
        (MovementType::Receiving, "receiving"),
        (MovementType::Return, "return"),
        (MovementType::Disposal, "disposal"),
        (MovementType::Stocktake, "stocktake"),
    ] {
        assert_roundtrip(value, wire);
    }
}

#[test]
fn test_response_only_enum_wire_serialize_req303_req501() {
    for (value, wire) in [
        (ReferenceType::CsvImport, "csv_import"),
        (ReferenceType::ManualSale, "manual_sale"),
        (ReferenceType::ReceivingRecord, "receiving_record"),
        (ReferenceType::ReturnRecord, "return_record"),
        (ReferenceType::DisposalRecord, "disposal_record"),
        (ReferenceType::Stocktake, "stocktake"),
    ] {
        assert_serialize(value, wire);
    }
    for (value, wire) in [
        (DailySaleSource::Auto, "auto"),
        (DailySaleSource::Manual, "manual"),
    ] {
        assert_serialize(value, wire);
    }
    for (value, wire) in [
        (CsvImportStatus::Completed, "completed"),
        (CsvImportStatus::CompletedPartial, "completed_partial"),
        (CsvImportStatus::RolledBack, "rolled_back"),
    ] {
        assert_serialize(value, wire);
    }
    for (value, wire) in [
        (CsvImportErrorType::UnmatchedProduct, "unmatched_product"),
        (CsvImportErrorType::InvalidFormat, "invalid_format"),
        (CsvImportErrorType::InvalidJan, "invalid_jan"),
        (CsvImportErrorType::InvalidNumber, "invalid_number"),
    ] {
        assert_serialize(value, wire);
    }
}

#[test]
fn test_request_enum_invalid_literals_are_rejected_req202_req203_req204_req303_req401_req502() {
    macro_rules! rejects {
        ($ty:ty) => {
            assert!(serde_json::from_str::<$ty>("\"invalid\"").is_err())
        };
    }
    rejects!(ReturnExchangeType);
    rejects!(ReturnDirection);
    rejects!(DisposalType);
    rejects!(ManualSaleReason);
    rejects!(ProductTaxRate);
    rejects!(ProductStockUnit);
    rejects!(ExportMode);
    rejects!(SalesMode);
    rejects!(MovementType);

    #[derive(serde::Deserialize)]
    struct Query {
        movement_type: Option<MovementType>,
    }
    assert_eq!(
        serde_json::from_str::<Query>(r#"{"movement_type":null}"#)
            .unwrap()
            .movement_type,
        None
    );
    assert_eq!(
        serde_json::from_str::<Query>(r#"{}"#)
            .unwrap()
            .movement_type,
        None
    );
    assert!(serde_json::from_str::<Query>(r#"{"movement_type":"invalid"}"#).is_err());
}

#[test]
fn test_canonical_wire_matches_serde_req202_req203_req204_req303_req401() {
    macro_rules! parity {
        ($value:expr) => {{
            let value = $value;
            assert_eq!(
                serde_json::to_string(&value).unwrap(),
                format!("\"{}\"", value.as_str())
            );
        }};
    }
    parity!(ReturnExchangeType::Return);
    parity!(ReturnExchangeType::Exchange);
    parity!(ReturnDirection::In);
    parity!(ReturnDirection::Out);
    parity!(DisposalType::Disposal);
    parity!(DisposalType::Damage);
    parity!(DisposalType::Other);
    parity!(ManualSaleReason::PluUnregistered);
    parity!(ManualSaleReason::Other);
    parity!(CsvImportStatus::Completed);
    parity!(CsvImportStatus::CompletedPartial);
    parity!(CsvImportStatus::RolledBack);
    parity!(CsvImportErrorType::UnmatchedProduct);
    parity!(CsvImportErrorType::InvalidFormat);
    parity!(CsvImportErrorType::InvalidJan);
    parity!(CsvImportErrorType::InvalidNumber);
    parity!(ProductTaxRate::Rate10);
    parity!(ProductTaxRate::Rate8);
    parity!(ProductTaxRate::Rate0);
    parity!(ProductStockUnit::Pcs);
    parity!(ProductStockUnit::Cm);
    parity!(MovementType::SaleAuto);
    parity!(MovementType::SaleManual);
    parity!(MovementType::Receiving);
    parity!(MovementType::Return);
    parity!(MovementType::Disposal);
    parity!(MovementType::Stocktake);
    parity!(ReferenceType::CsvImport);
    parity!(ReferenceType::ManualSale);
    parity!(ReferenceType::ReceivingRecord);
    parity!(ReferenceType::ReturnRecord);
    parity!(ReferenceType::DisposalRecord);
    parity!(ReferenceType::Stocktake);
}
