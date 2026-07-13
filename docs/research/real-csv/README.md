# 実機 Casio SR-S4000 CSV 検証用ディレクトリ

本ディレクトリには Phase 2 UI-07 CSV 取込み画面の検証で使う実機 Casio SR-S4000 出力 CSV (Z001/Z002/Z004/Z005) を配置する。

- CSV / 画像実体は経営情報 (売価 / 原価 / 取引明細) を含むため `.gitignore` で git 管理外。`.gitkeep` と本 README のみ tracked。
- ファイル配置は user ローカルでのみ実施 (CI / 他開発者環境では空)。
- Z004 売上日報の本物実機データは Phase 4 UI-08 (PLU 書出し) 完成後の 1 日運用 → 翌日取得が前提 (memory `casio-sr-s4000-z-prefix-reference.md` の Z004 二態区分通り)。
- Z00X prefix の判別 (売上日報 vs PLU 設定書出し vs 部門 vs 取引キー等) は memory `feedback-z004-vs-plu-master-confusion.md` 参照。
