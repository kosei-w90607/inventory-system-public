# 再利用パターン

## PR 分割パターン（Phase 6 で確立）

1. PR #N: IO層（型定義 + リポジトリ関数 + テスト）
2. PR #N+1: BIZ層（業務ロジック + トランザクション + テスト）
3. 各PR: TDD → cargo test/clippy/fmt → Codex レビュー → マージ

## BIZ層シグネチャパターン

- BIZ関数: `fn xxx(conn: &mut DbConnection, req: XxxRequest) -> Result<XxxResult, BizError>`
- TX開始: `conn.transaction()` (RAII、Drop時に自動ROLLBACK)
- IO関数はTX内で `&tx` を Deref経由で `&DbConnection` として渡す

## テストパターン

- `tempfile::TempDir` で隔離されたテストDB
- `serial_test` クレートで並列テスト安全性
- failpoint (AtomicBool + RAII guard) でTX内失敗注入

## Option<Option<T>> パターン

- ProductUpdates の nullable フィールド: None=更新しない / Some(None)=NULLにする / Some(Some(v))=値更新
