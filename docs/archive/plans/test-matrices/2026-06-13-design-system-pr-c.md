# Test Design Matrix: デザインシステム構築 PR-C 機械強制

> **親文書**: [2026-06-13-design-system-pr-c.md](../2026-06-13-design-system-pr-c.md)

| 対象 | 入力クラス | 期待 | Failure Mode | 検出手段 |
|---|---|---|---|---|
| C1 token 移行（mapping #1-14） | 在庫 low/stockout Badge・セル / 警告バー / 手動 Badge / 増減比較 / 1位ハイライト / progress | DOM 構造不変・class のみ置換。amber 系 hue 不変、rose→red / emerald→green は意図的色補正 | token 未定義クラスで build は通るが無スタイル化 / shade 取り違え / `bg-rank-top-bg/40` の alpha 落ち | 既存 test 不変 green + dev 目視（新 utility が色を持つこと）+ L3 実機 |
| C1 test 更新（mapping #16） | ProductRankingTable.test.tsx:92 の `[class*='bg-amber']` | role/text invariant へ置換（L87 コメント追従、R4 P3-a） | 更新漏れで C1 commit が test red | `npm test`（C1 green 条件） |
| C2 Button 置換（mapping #15） | 3 SortableHeader（daily ProductTable / monthly ProductRankingTable / DepartmentTable） | role/accessible name 不変、見た目維持（focus-visible ring のみ新規 = a11y 改善、R1 P3-1） | ghost の hover:bg-accent 残留 / size sm の h-8 で行高崩れ / px-3 で列頭ずれ | role-based 既存 test 不変 green + L3 実機 |
| C3 palette 外色 lint | 移行済み sources（違反 0）/ 一時違反 1 行挿入 | 前者 exit 0、後者 no-restricted-syntax error | token utility（warning-soft 等）誤検出 / test 除外漏れ / 動的 shade 補間は検出外（既知 limitation、R1 P3-4） | `npm run lint` + fail 実証（一時違反 → error → revert、PR body evidence） |
| C3 barrel 封じ lint | patterns/ ui/ の index.ts 不在 / 一時 barrel 作成 | 前者 no-op、後者 ExportAll/Named error | selector 不発（source.value regex） | fail 実証（一時 index.ts → error → 削除、PR body evidence） |
| C4 DS1 path 実在 | design-system docs の backtick `src/` 27 抽出（glob 1 件 skip、R3 P1-1） | 現状 pass / canonical 一時改変で ERROR | glob を実ファイル扱いして CI/pre-push 全落ち / コードブロック内 path の誤抽出 | `bash scripts/doc-consistency-check.sh` exit 0 + fail 実証 |
| C4 DS3 token HEX 整合 | foundations 全表（stone 裸 HEX / semantic `(#hex)` の二書式、R2 P2-1）↔ globals.css `:root` | 現状 `--danger` で ERROR → C1 修正後 pass。双方向（`:root` 不在 token も ERROR、R2 P3-2） | 二書式で抽出空振り / `@theme inline` の `--color-*` 誤突合 | fail 実証（HEX 1 字改変 → ERROR → revert） |
| C4 DS2/DS4 DSR 整合 | DSR-01〜13 の被参照 / category-9 の DSR 付記 | 現状 WARN 0。孤立/欠落で `[WARN]` 出力（exit 0 のまま、R1 P3-2） | WARN のため exit code で検証不能 | stdout `[WARN]` grep（一時 DSR 参照外し → grep → revert） |
| C5 docs 同期 | 既知逸脱 2 block（非対称: 4 ファイル/3 系統 vs 3 ファイル/2 系統、R3 P3-1）+ README reframe | 各 block 独立書換、`PR-C で是正予定` 0 件 | コピペ統一で catalog ⑬ に文脈外言及混入 / README の ast-grep 記述陳腐化（R3 P3-3） | doc-consistency exit 0 + `rg "PR-C で是正予定" docs/design-system/` 0 件 |
| 横断 | 全 commit | wire 契約不変（bindings / route / src-tauri 差分なし）、C1→C5 直列で各 commit green | C3 を C1/C2 前に置いて lint 大量赤 | `git diff --name-only` + CI 3 jobs |
