# 監査裁定記録（Coordinator、2026-07-17）

[report.md](report.md) の 18 是正単位に対する Coordinator 裁定。findings の証拠正本は findings/ 配下、本書は裁定と risk 付与のみを記録する。

## 検証（P1 級 empirical defense）

上位 3 是正単位を構成する 7 findings（P3-1 / P3-3 / P7-1 / P5-1 / P5-2 / P5-3 / P8-2）を、監査 Writer と別の独立検証 context が cited file:line の実物・コード経路・数式で突合した。結果 **7/7 CONFIRMED**、誤読なし。訂正・補強は以下の 2 点。

- **P3-1 補強**: `resolve_backup_dir` の握りつぶしパターンは `docs/function-design/71-mnt-backup.md` のコード例が指定している。実装逸脱ではなく**設計自体の欠陥**であり、是正 1 は設計正本の改訂を含む。削除経路の中核（`run_cleanup` の retention 読取失敗 → 既定 3 日 fallback → 誤削除）は実装判断側で、経路成立を確認済み
- **P3-3 訂正**: migration 失敗は `lib.rs` の `?` で起動自体が失敗するため、「起動継続で二次エラー」は同一プロセス内では成立しない。ROLLBACK 失敗の握りつぶし（`.ok()`）自体は implementation-quality 規範違反として確定。害経路の記述を上記に読み替えた上で accept
- **P7-1 補強**: 36-biz の処理ステップ 3e は数学的に収束しない（補正後 `stock_quantity=M`、`movements_sum=2M-S`、`S≠M` の限り差分の符号反転が続く）。実装は矛盾を自己申告するコメント付きで movement 挿入を省略しており、設計と実装の双方が「正本はどれか」を失っている

## 裁定

**18 是正単位すべて accept。実行順・依存関係は report のとおり維持。** risk tier の先行付与:

| 是正 | Risk | 補足 |
|---|---|---|
| 順 1（backup/migration failure 処理） | **R4** | backup 削除挙動 = destructive data lifecycle。設計書 71 の改訂を含む design-first。rollback/recovery notes 必須 |
| 順 2（整合性補正の正本確定） | **R3 design-first** | 実装より先に 36-biz の不変条件を確定する。補正の意味論（movement 履歴を残すか、直接更新か）は operator への説明可能性に関わるため owner 判断を含む |
| 順 3（mutation→consumer query 契約） | **R3** | 順 2 の正本確定が先行条件（report の依存どおり） |
| 順 4 以降 | 着手時に個別判定 | R2〜R3 想定。順 8（CMD-11 service 境界）と順 9（IPC enum 化）は L 労力のため単独 packet |

## 進め方

- 各是正単位 = 1 change（Plan Packet + 通常 workflow）。順 1 と順 2 は design phase から始める
- 順 3 は「query key 追加だけで終えない」（P8-2 の mutation impact test を同一変更に含める）を Goal Invariant に組み込む
- 既知 backlog との重複（FilePicker = 順 11、`.codex` 参照は監査 scope 外で別 backlog）は着手時に backlog 側を統合し二重管理しない

## 監査 workflow 自体の振り返りメモ（次回のため）

- checkpoint 方式（1 package = 1 commit）は session 切れ耐性として機能し、10 checkpoint が計画どおり積まれた
- 発注書に「既知 backlog 事項の扱い」（既知でも記録、既知注記付き）が明文化されておらず、Writer が推論で正しく補った — 次回の監査発注書 template に明記する
- read-safe-file wrapper の旧 clone 参照を Writer が証拠汚染リスクとして自己検知し直読みへ切替えた。読取経路の健全性確認を発注書の環境節に加える価値がある
