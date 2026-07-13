---
description: プロジェクトでよく使うコマンド一覧（cargo / npm）
paths:
  - "src-tauri/**/*.rs"
  - "src/**/*.{ts,tsx,js,jsx}"
  - "package.json"
  - "Cargo.toml"
---

# プロジェクトコマンド

## ビルド・チェック（Rust）

```bash
cargo check                    # コンパイルチェック
cargo test                     # テスト実行
cargo clippy -- -D warnings    # リント（警告ゼロを維持）
cargo fmt                      # フォーマット
```

## フロントエンド

```bash
npm install                    # 依存インストール
npm run build                  # ビルド
npm run dev                    # 開発サーバー
```

> Docker は退役済み。詳細経緯は [docs/DEV_SETUP_CHECKLIST.md §A.1](../../docs/DEV_SETUP_CHECKLIST.md) 退役記録を参照（2026-04-03 退役、WSL2 直接運用に切替済）。
