# PR #52 Codex Round 1 レビュー対応プラン

> 実装プラン本体（Plans.md から参照）
> **対象**: PR #52 `feat/phase-1-seed-env` on main
> **Codex レビュー**: 2026-04-21 返却、P1 0 / P2 1 / P3 1 / P4 1
> **対応方針**: P2 必須 + P3 同 PR 内で対応（memory `codex-non-blocker-incorporation.md`: ~10 min / PR スコープ内 / レビュー 3 回以内）、P4 は**ユーザー合意で運用変更**（hook リマインダに引きずられた中間 Plans 同期 commit を廃止、commit は節目のみ）
> **作業ブランチ**: `feat/phase-1-seed-env`（既存 PR に追記 push）

---

## Context

**なぜこの変更が必要か**:

Codex Round 1 で seed_demo の「冪等性」契約が中断復旧シナリオで崩れる欠陥 (P2) が指摘された。`run_seed` は suppliers → products → receiving → sales の 4 phase を **トランザクション無し**で順次実行しており、`seed_sales` 側は `existing_auto_count >= SALES_RECORDS (300)` で全 skip するゲートを持つ。そのため partial failure（例: receiving 途中で panic）で sale_records が 1..299 件だけ入った状態で再実行すると、2 回目の gate が成立せず 300 件追加投入され、合計が 300 を超えて**冪等性が壊れる**。PR 説明・コードコメントで「冪等」を強く打ち出しているので、実装と契約文言のズレを解消する。

同時に指摘された P3 `date_plus_days` の不要 `pub` も、同 PR で潰す（public 化している理由が allowlist 追加のためだけになっており、表面積が無駄に広い）。

**期待結果**:

1. partial failure 時の冪等性が **実装で** 担保される（契約文言の注釈逃げではなく物理的に防止）
2. `date_plus_days` が module private 化され、allowlist から除去されて突合テストの noise が減る
3. Codex Round 2 で「マージ可能」判定を取り、PR #52 を squash merge

---

## 対応案の選択根拠（P2）

Codex が提示した 2 案:
- **案 1**: `run_seed` 全体を 1 トランザクション化して partial write を防ぐ
- **案 2**: 契約文言を「完全実行済み DB への再実行のみ冪等」に限定明記 + partial 復旧は `--reset` 前提を明記

採用: **案 1**。理由:
- seed の売りである「決定的動作 + 冪等性」を実装で保証する方が契約として強い。契約文言で縛ると reader に implicit な認知負荷を強いる
- 実装コストは低い（`run_seed` 1 関数内で TX 開始 → commit するだけ、各 phase の signature は `&Connection` のまま。`Transaction: Deref<Target=Connection>` で透過的に動く）
- TX 化による副作用は性能のみ（400+ INSERT を 1TX 化）だが、seed は dev tooling の 1 回実行なので体感変化なし、むしろ FK 制約下で COMMIT 回数が減り若干速くなる

---

## 修正箇所

### P2: run_seed を 1TX 化 + reset 統合

**独立レビューで発覚した追加考慮** (subagent 指摘): 単に `run_seed` を 1TX 化するだけでは `--reset` フラグ使用時に `delete_all(&conn)`（auto-commit）→ `run_seed(&mut conn)`（新 TX）の**2 TX に分離**される。`delete_all` 成功後 `run_seed` 途中で panic すると DB が「seed 対象テーブル全 DELETE 済み + 未 seed」の空状態で残り、「実装で冪等性担保」という本プランの主張と矛盾する。

→ **`run_seed` に `reset: bool` を統合し、TX 内で `delete_all` を呼ぶ設計に拡張する**。

**対象ファイル**: `src-tauri/src/seed_demo.rs`

1. **`run_seed` 関数本体 (§seed_demo.rs:131-138)**
   - `pub fn run_seed(conn: &Connection) -> Result<SeedSummary, SeedError>` → `pub fn run_seed(conn: &mut Connection, reset: bool) -> Result<SeedSummary, SeedError>` に変更
   - 内部フロー:
     ```
     let tx = conn.transaction()?;
     if reset { delete_all(&tx)?; }        // Transaction: Deref<Target=Connection> で既存 delete_all(&Connection) と互換
     seed_suppliers(&tx, &mut summary)?;
     let specs = seed_products(&tx, &mut summary)?;
     seed_initial_receiving(&tx, &specs, &mut summary)?;
     seed_sales(&tx, &specs, &mut summary)?;
     tx.commit()?;
     ```
   - 正常完了時のみ `tx.commit()`、途中エラーで早期 return した場合は Transaction の Drop 実装が自動 rollback → **reset + seed が全て一体で atomic**

2. **`delete_all` 関数 (§seed_demo.rs:104-128)**
   - signature 変更なし (`&Connection` のまま)。`Transaction: Deref<Target=Connection>` なので `delete_all(&tx)` で透過的に呼べる
   - `pub` も維持（後方互換、ad-hoc 単体呼び出し・test 用）

3. **module doc comment (§seed_demo.rs:1-10)**
   - 現在: 「冪等性: 全 INSERT に `ON CONFLICT DO NOTHING` or SELECT-then-INSERT で重複防止」
   - 更新: 「冪等性: **全 phase + オプショナル reset を 1 トランザクションで実行** (partial failure 時は自動 rollback で reset 前の状態に復帰)。正常完了後の再実行は `ON CONFLICT DO NOTHING` + SELECT gate で全 skip」

### P2 影響: 呼び出し元の signature 適応

- **`src-tauri/src/bin/seed_demo_data.rs:148-192`**
  - `let conn = init_database(&cli.db_path)?;` → `let mut conn = init_database(&cli.db_path)?;`
  - `if cli.reset { ... delete_all(&conn)?; ... }` ブロックから `delete_all(&conn)?;` 呼び出しを削除（`run_seed` に統合）
  - ただし `confirm_reset()` tty 確認は bin に残す（CLI 責務）→ confirm OK の後は reset フラグを `run_seed` に渡すだけ
  - `run_seed(&conn)` → `run_seed(&mut conn, cli.reset)` に変更
  - `println!("[seed] reset: 全テーブル DELETE 完了")` のログは削除（TX 内実行でタイミング意味変、完了時の summary ログで代替）

- **`src-tauri/tests/seed_test.rs`**
  - `setup_temp_db()` は `Connection` を返すので戻り値変更不要、受け取り側で `let (_dir, mut conn) = setup_temp_db();` に変更
  - 5 関数すべての `run_seed(&conn)` / `run_seed(&conn1)` / `run_seed(&conn2)` → `run_seed(&mut conn, false)` / `run_seed(&mut conn1, false)` / `run_seed(&mut conn2, false)` に変更（既存テストは reset なし実行なので第 2 引数は `false`）

### P3: date_plus_days を private 化

- **`src-tauri/src/seed_demo.rs:395`**: `pub fn date_plus_days(offset: u32) -> String` → `fn date_plus_days(offset: u32) -> String`
  - 同モジュール内の `seed_sales` (§342) から呼ばれているので module-private で動作保証
- **`src-tauri/tests/design_compliance_test.rs:66`**: allowlist から `("seed_demo", "date_plus_days"),` の **1 行だけ**削除
  - §62-63 のコメント「dev tooling (Phase 1 Task 7-9): src/bin/seed_demo_data.rs から呼ぶデモデータ seed」はそのまま維持（`run_seed` / `delete_all` の説明として引き続き有効）
  - commit 2 の `git diff` で `-` が 1 行だけ現れることを確認（allowlist 削除の意図通り）

### P4: Plans.md 同期コミット多数（**ユーザー feedback により運用変更**）

Codex 本文は「運用上問題なし」判定だったが、ユーザーから「**Plans 更新自体は必要だが、commit はタスクの節目にまとめる**（フェーズ 1 つ / PR 1 つ終わったら 1 commit）」という feedback があり同意する。PR #52 は local commit 10 本中 Plans 同期 commit が 5 本という現実があり、Codex の P4 判定は甘かった。

**新運用ルール**:
- Plans.md の更新は hook リマインダに従いリアルタイムで行う（SSOT 維持のため）
- ただし **update → commit を毎回やらない**。Plans の差分はステージングせず、次の「節目」commit まで working tree に溜める
- 節目の定義: PR 完了 / レビュー round 完了 / フェーズ境界 / タグ打ち

**本 PR への適用**:
- commit 3（Codex Round 1 対応完了の Plans 同期）は「節目」なので維持
- commit 1（P2）/ commit 2（P3）の途中で Plans 更新リマインダが hook から出ても、Plans 編集はしても commit はしない（working tree に溜める）

**後続の対応**（本プラン外、実装完了後に別途）:
- memory に feedback 型で保存（「Plans 同期 commit は節目にまとめる」+ Why: Codex P4 + ユーザー feedback、How to apply: hook リマインダで Plans 更新はするが commit は節目まで溜める）
- hook 挙動自体の settings 変更（PostToolUse の Plans 更新リマインダを「commit しろ」から「編集しろ」に文言を変える等）は別セッションで相談

---

## 検証

### commit 毎の段階検証（高速回帰確認）

| commit | 個別テスト | 確認内容 |
|--------|----------|---------|
| commit 1 直後 | `cargo test --test seed_test` (5 tests) | TX 化後も 5 本全 pass。特に `seed_populates_100_products` / `seed_populates_300_sale_records` / `seed_populates_400_inventory_movements` が **`tx.commit()` 後の外部 `conn.query_row` で件数を返すこと** を確認（TX 内の INSERT が commit されて初めて外部 SELECT が値を読む SQLite SERIALIZABLE 挙動の確認）。`seed_is_idempotent` が 2 回目 `run_seed` の SELECT gate (§307-316) で commit 済み 1 回目結果を読んで全 skip することを確認 |
| commit 2 直後 | `cargo test --test design_compliance_test` (1 test) | `date_plus_days` を `fn` に変えたことで pub fn 抽出対象外になり、`KNOWN_ALLOWLIST` から削除しても WARN 「UNEXPECTED」が出ないことを確認 |
| commit 3 直後 | `./scripts/doc-consistency-check.sh --target plan docs/plans/squishy-sniffing-waterfall.md` | Plans.md 同期 commit が既存プランファイル参照を壊していないか確認 |

### 全体検証（commit 3 push 前に実行）

```bash
cd src-tauri
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test                       # 563 tests pass 維持（期待）
cd ..
./scripts/doc-consistency-check.sh   # 全 19 項目 pass
```

### seed 実機確認（手動 smoke）

```bash
# 通常 seed
cargo run --bin seed_demo_data -- --db /tmp/seed-tx-test.db
# 期待: products=100 / sale_records=300 / inventory_movements=400 / suppliers=5

# 2 回目（冪等性）
cargo run --bin seed_demo_data -- --db /tmp/seed-tx-test.db
# 期待: 全 skip（products_skipped=100, sale_records_skipped=300 等）

# reset + seed（atomic 確認）
cargo run --bin seed_demo_data -- --db /tmp/seed-tx-test.db --reset
# 期待: yes 入力 → reset → 再投入、全件 inserted 表示
```

### pre-push hook

push 時に fmt / clippy / test / REQ 番号 / typedInvoke count / env-safety の全 section が通過することを確認（memory `feedback-bash-wrap-exit-code-capture.md` に従い FAIL=1 集約方式）。

---

## コミット分割

| # | prefix | 内容 | 対象ファイル |
|---|--------|------|------------|
| 1 | `fix(seed)` | `run_seed` を 1 トランザクション化して partial failure 時の冪等性担保 (Codex P2) | `src-tauri/src/seed_demo.rs` / `src-tauri/src/bin/seed_demo_data.rs` / `src-tauri/tests/seed_test.rs` |
| 2 | `refactor(seed)` | `date_plus_days` を private 化し allowlist 削除 (Codex P3) | `src-tauri/src/seed_demo.rs` / `src-tauri/tests/design_compliance_test.rs` |
| 3 | `docs(plans)` | PR #52 Codex Round 1 対応 (P2/P3) 完了を Active Tasks に反映 | `Plans.md` |

各 commit で `cargo fmt --check && cargo clippy -- -D warnings && cargo test` が通ることを確認してから次に進む。

**重要**: commit 1 / 2 実行中に PostToolUse hook から「Plans.md 更新リマインダ」が出ても、Plans の編集はしても **commit はしない**（working tree に溜めて commit 3 で一括 stage）。これが今回の運用変更の実質的な差分。

---

## Post-processing

1. `git push origin feat/phase-1-seed-env`
2. `gh pr checks 52 --watch`（memory `feedback-ci-polling-use-gh-watch.md` に従い gh の watch を使う、自前 polling 禁止）
3. CI pass 確認後、**Codex Round 2 用レビュー依頼テキストを生成**して user に提示:
   - 「PR #52 Round 1 指摘 3 件（P2 seed 冪等性 / P3 date_plus_days private / P4 Plans 運用）全対応完了。Round 2 レビューお願いします」 + 修正概要（TX 化 + reset 統合 / pub 外し / 運用変更）
   - memory `codex-review-workflow.md` に従い、user が Codex app に貼り付けて実行
4. Round 2 で P1/P2 0 を確認できたら user に報告 → squash merge 判断
5. **memory 保存**（Plan mode 抜けた後に実施）:
   - `feedback-plans-sync-commit-milestone-only.md` を作成（Plans.md 更新はリアルタイム、commit は節目のみ）
   - Why: Codex PR #52 P4 指摘 + ユーザー合意、PR #52 で 10 commit 中 Plans 同期 5 本の実績
   - How to apply: hook リマインダで Plans.md 編集はするが commit せず working tree に溜め、PR 完了 / round 完了 / フェーズ境界 / タグ打ちのタイミングで一括 commit
   - 既存 memory 索引 `MEMORY.md` に 1 行追加
6. **hook settings 見直し**（別セッションで相談）: PostToolUse Plans 同期 hook の文言を「commit しろ」から「編集しろ、commit は節目で」に変える案

---

## 実行制約

- **Plan mode**: 承認前の file edit はこのプランファイルのみ
- **LSP**: 実装フェーズで Write/Edit 前に LSP definition/references で `run_seed` / `date_plus_days` の呼び出し面を確認（突合テスト以外に漏れがないか）
- **Skills gate**: `.claude/state/skills-decision.json` を更新してから Write/Edit
- **サブエージェント**: 今回の修正は 3 ファイル編集 + 1 ファイル削除行のみで主 Claude で完結（CLAUDE.md subagent ポリシーで 1〜3 ファイル編集は主 Claude 範疇）

---

## リスクと緩和

| リスク | 緩和策 |
|-------|-------|
| `conn.transaction()` の `&mut` 要件で呼び出し元が破壊的変更 | 変更箇所は bin 1 / test 5 の計 6 箇所 + signature 変更（reset bool 追加）のみ。いずれも `let conn = ...` → `let mut conn = ...` + `run_seed(..., false)` の軽微な修正 |
| TX 化により 400+ INSERT が 1TX に → 性能影響 | seed は dev tooling の 1 回実行で prepared statement も既にキャッシュ済み。**性能差は実測しないと分からないが、実用上はほぼ同等**（journal hold 時間が数十 ms 増、commit 回数減の相殺）。体感影響なし |
| `Transaction` の Drop rollback で Result 型の伝搬が壊れる | `run_seed` が `Result<SeedSummary, SeedError>` を返す構造は変わらず、`?` で早期 return すれば Drop が走って自動 rollback される。既存エラーパスは維持 |
| 将来 phase 関数内で入れ子 TX が欲しくなる | `Transaction: Deref<Target=Connection>` だが `tx` 内から `tx.transaction()` は `&mut self` 競合で呼べない（rusqlite の API 制約）。将来どうしても必要なら SAVEPOINT (`tx.savepoint()`) を使う方向で検討、今回は不要 |
| commit 1 push 後に CI fail | **revert せず fix commit を積む**（`feat/phase-1-seed-env` は既存 PR、force-push は Codex Round 1 履歴と整合しにくい）。commit 2 は commit 1 の CI pass を待ってから push、または 1 と 2 をまとめて push して CI 一括確認も可 |
| Codex Round 2 でさらに指摘が出る | Round 2 P1/P2 0 なら merge、P3 以下は `codex-non-blocker-incorporation.md` の 10min / PR スコープ / 3 round 上限で判断。**Round 3 に持ち越す場合は新規 P2 のみ対応、P3 以下は Backlog 送り** |

---

## 参考

- PR #52: private archive PR #52
- memory: `codex-non-blocker-incorporation.md` / `feedback-ci-polling-use-gh-watch.md` / `plan-self-review-before-implementation.md`
- rusqlite API: `Connection::transaction(&mut self) -> Result<Transaction<'_>>`, `Transaction::commit(self) -> Result<()>`, Drop impl で自動 rollback
