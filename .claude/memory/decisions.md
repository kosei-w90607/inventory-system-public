# 意思決定記録

## 2026-04-06: BIZ-02 冪等性設計

- idempotency_key (TEXT NOT NULL UNIQUE) + request_fingerprint で DB レベル担保
- CMD層が UUID v4 で idempotency_key を生成
- テーブル再作成方式で migration v2 実装（SQLite NOT NULL 後付け不可のため）
- 予約プレフィックス `__legacy__:` でバックフィル値を区別

## 2026-04-06: FUNCTION_DESIGN.md 分割

- 1471行 → 9ファイルに分割（docs/function-design/ 配下）
- 番号体系: 10=共通, 2x=IO, 3x=BIZ, 4x=CMD, 5x=UI, 9x=トレーサビリティ
- 元ファイルは目次+リンク形式に縮小（74行）

## 2026-04-06: バックエンドファースト方針

- CMD層・UI層は後回し。BIZ層・IO層を先に固める
- 第3段階 BIZ-02 → 第4段階以降と進み、CMD/UI はまとめて実装
