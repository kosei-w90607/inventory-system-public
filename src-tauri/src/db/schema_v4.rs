//! migration v4: 日報取込みテーブル追加
//!
//! docs/db-design/pos-tables.md 12b-12e / REQ-401 に基づく実装。

/// v4 マイグレーション: Z001/Z002/Z005日報取込み用テーブルとindexを追加する。
pub(crate) fn get_v4_daily_report_schema() -> &'static str {
    r#"
CREATE TABLE daily_report_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_date TEXT NOT NULL,
    source_adapter TEXT NOT NULL CHECK(source_adapter IN ('casio_sr_s4000')),
    bundle_hash TEXT NOT NULL,
    source_files_json TEXT NOT NULL,
    gross_amount INTEGER,
    net_amount INTEGER,
    status TEXT NOT NULL CHECK(status IN ('completed','rolled_back')),
    imported_at TEXT NOT NULL,
    rolled_back_at TEXT,
    note TEXT
);

CREATE TABLE daily_report_summary_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    daily_report_import_id INTEGER NOT NULL REFERENCES daily_report_imports(id),
    source_file TEXT NOT NULL CHECK(source_file IN ('Z001')),
    line_key TEXT NOT NULL,
    label TEXT NOT NULL,
    amount INTEGER,
    quantity INTEGER,
    count INTEGER,
    sort_order INTEGER NOT NULL
);

CREATE TABLE daily_report_payment_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    daily_report_import_id INTEGER NOT NULL REFERENCES daily_report_imports(id),
    source_file TEXT NOT NULL CHECK(source_file IN ('Z002')),
    payment_key TEXT NOT NULL,
    label TEXT NOT NULL,
    amount INTEGER,
    count INTEGER,
    sort_order INTEGER NOT NULL
);

CREATE TABLE daily_report_department_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    daily_report_import_id INTEGER NOT NULL REFERENCES daily_report_imports(id),
    source_file TEXT NOT NULL CHECK(source_file IN ('Z005')),
    department_id INTEGER REFERENCES departments(id),
    raw_department_name TEXT NOT NULL,
    normalized_department_name TEXT,
    amount INTEGER NOT NULL,
    quantity INTEGER,
    count INTEGER,
    sort_order INTEGER NOT NULL
);

CREATE INDEX idx_daily_report_imports_report_date ON daily_report_imports(report_date);
CREATE INDEX idx_daily_report_imports_bundle_hash ON daily_report_imports(bundle_hash);
CREATE INDEX idx_daily_report_summary_lines_import_id ON daily_report_summary_lines(daily_report_import_id);
CREATE INDEX idx_daily_report_payment_lines_import_id ON daily_report_payment_lines(daily_report_import_id);
CREATE INDEX idx_daily_report_department_lines_import_department ON daily_report_department_lines(daily_report_import_id, department_id);
"#
}
