//! TS bindings 生成専用バイナリ（開発ツール）
//!
//! `cargo run --bin generate_bindings` で `<project-root>/src/lib/bindings.ts` を生成する。
//! GUI を立ち上げずに bindings.ts だけを更新したい場合に使用する。
//!
//! 出力先は `CARGO_MANIFEST_DIR`（src-tauri/）基準の絶対パスで解決される
//! （`lib.rs::export_specta_bindings`）。実行時の cwd に依存しないため、
//! project root / src-tauri / IDE task runner いずれからでも動く。
//!
//! 通常の tauri dev 起動時は `lib.rs::run()` 冒頭で `export_specta_bindings()`
//! が debug build 時に自動呼び出しされるため、このバイナリは必要に応じて実行する。

fn main() {
    inventory_system_tauri_scaffold_lib::export_specta_bindings();
    println!("TS bindings exported to src/lib/bindings.ts");
}
