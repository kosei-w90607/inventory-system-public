---
description: 実装品質を保護するルール。形骸化実装・安易なスキップを防止する
paths:
  - "src-tauri/**/*.rs"
  - "src/**/*.{ts,tsx,js,jsx}"
---

# 実装品質保護

## 禁止事項

- `todo!()` や `unimplemented!()` を本番コードに残さない（テストコードは例外）
- `unwrap()` を本番コードで使わない（テストコードは許可）
- エラーを握りつぶさない（`let _ = ...` でResult を無視しない）
- 設計ドキュメントを読まずに実装を始めない

## 必須事項

- 実装前に該当する設計ドキュメントを読む:
  - docs/ARCHITECTURE.md — タスク仕様
  - docs/function-design/ — 関数設計
  - docs/DB_DESIGN.md — テーブル定義
- コミット前に品質チェック3点セットを通す:
  - `cargo fmt --check`
  - `cargo clippy -- -D warnings`
  - `cargo test`
- レイヤー間の呼び出し原則を守る: UI → CMD → BIZ → IO の一方向のみ

## エラー処理

### エラー型（各層固有）

各層で独自のエラー型を持つ。上位層に伝搬する際に変換する:

- IO層: `DbError`（ConnectionFailed / QueryFailed / DuplicateKey / NotFound）
- BIZ層: `BizError`（ValidationFailed / NotFound / DuplicateProductCode / DatabaseError）
- CMD層: `CmdError`（kind: validation / duplicate / not_found / internal）

エラーメッセージは利用者向け日本語で記述する。

### 補助ファイル操作のエラー処理（PR #29 P1 起因）

WAL/SHM ファイル等の補助ファイル操作で `let _ = std::fs::rename(...)` のようにエラーを完全に握りつぶさない。
補助ファイルは「失敗しても処理継続」が許容される場合でも、必ず `tracing::warn!` 等でログを残す。

```rust
// Bad
let _ = std::fs::rename(&wal_path, &dst_wal);

// Good
if let Err(e) = std::fs::rename(&wal_path, &dst_wal) {
    tracing::warn!(?e, ?wal_path, "WAL ファイルのリネームに失敗しましたが処理を継続します");
}
```

### filesystem 操作の catch-all 禁止（PR #29 P2 起因）

`read_dir` 等の filesystem 操作で `Err(_) => Vec::new()` のような catch-all は禁止。
NotFound（ディレクトリ未作成）と permission/IO error を必ず区別し、後者は `DbError::QueryFailed` として上位伝搬する。

```rust
// Bad
let entries = std::fs::read_dir(&backup_dir).map(|d| d.collect()).unwrap_or_else(|_| vec![]);

// Good
let entries = match std::fs::read_dir(&backup_dir) {
    Ok(d) => d,
    Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
    Err(e) => return Err(DbError::QueryFailed(format!("read_dir failed: {e}"))),
};
```

このパターンは `BIZ-07` `MNT-01` 等の filesystem 触る処理で再発しやすい。
