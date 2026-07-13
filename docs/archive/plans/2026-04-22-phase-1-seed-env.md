# 進捗確認 + 次アクション整理プラン

## Context

**2026-04-21 時点の達成状態**: Phase 1 UI 基盤の「動く土台」が完成。

- ✅ 7-1 Tailwind CSS 4 / 7-2 shadcn/ui 18 components / 7-2.5 preflight
- ✅ 7-4 TanStack Router (ADR-001)
- ✅ 7-5a tauri-specta (ADR-002)
- ✅ 7-5b TanStack Query キャッシュ戦略表 (ADR-003)
- ✅ 7-5c invoke ラッパ C 案 + QueryClient + typedInvoke 撤去機構 (ADR-004, PR #48)
- ✅ 7-3 UI-12 共通レイアウト + ウィンドウタイトル動的更新 (PR #50)
- ✅ Plans.md 同期 + archive 移動 (PR #51, `05f4aae`, merged 2026-04-21)

**git 状態**: main clean、HEAD `05f4aae`。

**Plans.md の更新漏れ**:
- L8 `Branch: docs/plans-sync-ui-12` が PR #51 マージ後も残存
- Active Tasks に PR #51 マージ完了記録なし
- Current Phase の merge commit 参照 `d512d01` (UI-12) のまま、PR #51 の `05f4aae` への更新未了

これらは次の Plans.md 同期で潰す（重要度低）。

---

## Phase 1 残タスクの位置付け整理

Plans.md L87-95 をベースに、Phase 2 UI-00 との依存関係で分類：

### Phase 2 UI-00 着手前にまとめて整備した方が効率的
| Task | 内容 | 理由 |
|------|------|------|
| 7-8a | Error Boundary 戦略文書化 (UI_TECH_STACK.md §6.9 新設) | UI-00 初動で即設置する基盤。ページ/アプリ/Suspense 統合方針 |
| 7-8b | 横断UI要素標準化 (Toast/Dialog/EmptyState/ErrorState) | UI-00 で使う (空状態、エラー状態、操作成功トースト) |
| 7-9 | デモデータ seed (`scripts/seed-demo-data.rs` 商品 100 件 / 売上 30 日 / 変動履歴) | UI-00 ダッシュボード数値の手動投入地獄を回避 |
| 7-10 | 環境変数 `.env` 構成 (`VITE_DEBUG` / `VITE_MOCK_MODE` 命名規約 + `.env.development` / `.env.test`) | UI-00 実装中の devtools 制御 + 将来のモック切替 |

### UI-00 実装中に並走でも OK
| Task | 内容 | 理由 |
|------|------|------|
| 7-11 | UI 開発 workflow 文書化 (3層駆動開発: 自動テスト / 設計書照合 / 利用者デモ) | 経験値溜まってから書いた方が精度上がる。UI-00 完了後が望ましい |

### Phase 2 後半〜Phase 3 まで後送り可
| Task | 内容 | 理由 |
|------|------|------|
| 7-6 | Storybook 導入判断 | 「コンポーネント 10 超でトリガー」。Layout 系 5 + shadcn 18 = 23 だが shadcn は事実上 primitive。UI-00 + UI-07 + UI-09a 実装後に再判定が妥当 |
| 7-7 | Vitest 初期化 + `@axe-core/react` | Phase B-2 と統合予定。UI-00 の実装が一段落してからテスト戦略立てる |
| 7-8c | unsaved changes ガード (`useUnsavedChangesWarning` hook) | UI-00 (ダッシュボード) で不要。UI-01b 商品登録・編集 (Phase 3) から要 |

---

## 選択肢

**A 案: Phase 1 残タスク (7-8a + 7-8b + 7-9 + 7-10) をまとめて 1 PR で潰す → UI-00 着手**
- 期間: 1-2 セッション
- PR 粒度: 大 (4 件バンドル)
- メリット: UI-00 で必要な基盤が揃った状態で着手できる、横断UIのテンプレ実装先行で UI-00 の実装スピード向上
- デメリット: PR 大きくて Codex レビュー往復増える可能性、UI-00 着手が遅れる

**B 案: 7-9 seed + 7-10 env の 2 件だけ先行 → UI-00 着手 → 7-8a/8b は UI-00 実装中に必要な順で整備**
- 期間: 0.5 セッション (seed+env) + UI-00
- PR 粒度: 中 (2 件バンドル + UI-00 PR)
- メリット: UI-00 で実際に動くデモが早く見せられる、Error Boundary と横断 UI の抽象化が UI-00 の具象を見てから決まる
- デメリット: UI-00 PR の中で 7-8a/8b 要素が混ざると PR スコープが膨らむ

**C 案: 既定線通り UI-00 に直行。Phase 1 残は必要になったタイミングで個別 PR**
- 期間: UI-00 着手即座
- PR 粒度: 小 (UI-00 のみ、必要時に 1 件ずつ追加 PR)
- メリット: 最速で UI-00 の実機デモに到達、ユーザーフィードバック取得が早い
- デメリット: UI-00 実装中に Error Boundary / Toast 等で「あれ、これ先に決めないと」で止まる可能性、UI-00 PR の中に Ad-hoc で混入させる技術負債

**D 案: Plans.md 更新漏れ (L8 branch 名 + PR #51 完了記録) を軽微な docs PR で先に潰す → その後 A/B/C 検討**
- 期間: 0.1 セッション (5 分)
- メリット: SSOT 健全性回復
- デメリット: すぐ次の PR でも潰せるので、単独 PR 化はやや過剰

---

## 推奨 (私の見立て)

**B 案を推奨**。理由:

1. **7-9 seed が無いと UI-00 動作確認が詰む**: UI-00 は昨日の売上 / 在庫切れ件数 / 在庫少件数 + PLU 未反映通知 のダッシュボード。seed 無しだと 100 件 SQL 手打ちの地獄
2. **7-10 env は 10 分で片付く**: `.env.development` + `.env.test` + `VITE_DEBUG` 1 本追加だけ
3. **7-8a/8b は UI-00 の具象を見てからの方が決定精度高い**: Error Boundary の境界線や Toast API は、抽象で決めると必ず UI-00 実装時に作り直しになる。実装駆動が最適
4. **PR 粒度が Codex レビュー 1-2 往復で潰せるサイズ**: 4 件バンドルは Codex 審査が重くなりがち

ただしユーザーの開発速度優先度 / ポートフォリオ展示タイミング / Phase 2 全体の PR 数見通しで判断軸が変わるので、最終決定はユーザーに委ねる。

---

## 推奨 B 案で進む場合の Task 分解

### PR #52: 7-9 seed + 7-10 env + Plans.md 同期 (ハイブリッド)
1. `scripts/seed-demo-data.rs` (Rust binary: 商品 100 件 + 部門 3 + 取引先 5 + 売上 30 日分 + 変動履歴)
2. **env 設計**（下記 env 設計原則セクション参照）
3. Plans.md 更新 (L8 branch 削除、Active Tasks に PR #51 完了 1 行追加、Current Phase を PR #51 merge commit `05f4aae` に更新)
4. DEV_SETUP_CHECKLIST.md に seed 実行手順 + env 初期化手順追記

### env 設計原則（10-10 で確定する方針）

#### セキュリティ前提（ユーザー懸念反映）
- **Vite `VITE_` prefix はバンドル埋め込み = 公開情報扱い必須**（クライアントサイド JS に平文で含まれる）
- **Tauri デスクトップ配布 binary は逆アセンブル可能** → フロントエンド側に真の秘密は原理的に置けない
- **秘密情報が必要になった場合**（将来のバックアップ暗号化鍵 / クラウド同期等）は Rust 側 OS keychain (keyring crate) 経由が原則。フロント env には絶対に置かない
- 現状 Phase 1-2 では真の秘密は発生しない（ローカル SQLite のみ、外部 API 連携なし）が、設計原則は今確立する

#### ファイル構成
| ファイル | git 管理 | 用途 | 値の性質 |
|---------|---------|------|---------|
| `.env.example` | commit | 変数一覧ドキュメント、空値のテンプレ | 値なし |
| `.env.development` | commit | dev 時デフォルト値 | 公開可能値のみ |
| `.env.test` | commit | テスト時デフォルト値 | 公開可能値のみ |
| `.env.production` | commit | prod build 時デフォルト値 | 公開可能値のみ |
| `.env` | **gitignore** | 個人機固有上書き | 何でも書ける（個人機ローカル） |
| `.env.local` | **gitignore** | 全環境共通の個人機上書き | 同上 |

Vite は `.env` → `.env.{mode}` → `.env.{mode}.local` の順で読むので、`.env.*.local` は gitignore 対象。

#### 命名規約
- `VITE_DEBUG` (boolean, default false): devtools 有効化、TanStack Query devtools、詳細 console ログ
- `VITE_MOCK_MODE` (boolean, default false): backend IPC を mock 実装に差し替え（将来の UI-09a/b 等で実測値なしの開発用）
- `VITE_APP_VERSION`: `package.json` の version を `vite.config.ts` の `define` で注入（env ファイルには書かない、ビルド時固定）
- **禁止命名**: `VITE_*_SECRET` / `VITE_*_KEY` / `VITE_*_TOKEN` / `VITE_*_PASSWORD` （バンドル公開されるため原理的にアウト）

#### CI 静的検査（重要、事故防止）
`scripts/check-env-safety.sh` を CI frontend job に追加：
1. `.env.production` に `VITE_DEBUG=true` / `VITE_MOCK_MODE=true` が無いか検査（本番で devtools / mock が動く事故防止）
2. `.env.*` ファイル全体で `SECRET` / `TOKEN` / `KEY` / `PASSWORD` キーワードを含む変数がないか検査（誤って VITE_ prefix で秘密を置く事故防止）
3. `.gitignore` に `.env` / `.env.local` / `.env.*.local` が記載されているか検査
4. `git ls-files` で `.env` / `.env.local` / `.env.*.local` が commit されていないか検査
5. pre-push hook にも同じチェックを追加（push 前に検知）

#### 型定義
`src/env.d.ts` に ImportMetaEnv の型定義を追加：
```typescript
interface ImportMetaEnv {
  readonly VITE_DEBUG: string  // Vite env は常に string、boolean 判定は別途
  readonly VITE_MOCK_MODE: string
  readonly VITE_APP_VERSION: string
}
```

`src/lib/env.ts` に boolean 変換 helper 配置:
```typescript
export const isDebug = import.meta.env.VITE_DEBUG === 'true'
export const isMockMode = import.meta.env.VITE_MOCK_MODE === 'true'
```

**厳格 equality**（`=== 'true'`）にして、`'1'` / `'yes'` / 空文字等での意図しない true 判定を防ぐ。

#### UI_TECH_STACK.md 追記先
- §2.5 TanStack Query 戦略表の末尾に「env / 環境変数設計」サブセクション新設
- セキュリティ前提 + ファイル構成表 + 命名規約 + CI 検査方針を記載
- FRONTEND CI 設計との対応（`scripts/check-env-safety.sh` → CI frontend job / pre-push hook）

#### DEV_SETUP_CHECKLIST.md 追記先
- §7 フェーズ6（SQLite 依存追加）の後に「env 初期化」ステップ追記
- `.env.example` → `.env` コピー手順
- 個人機固有値の埋め方（現状空、将来拡張時の場所）

### PR #53: UI-00 ホーム画面 (関数設計 + 実装の 1 PR 統合)
- `docs/function-design/5X-ui-00-home.md` 新規 (UI 関数設計テンプレ 2 段階化の「業務ロジックあり版」を初適用)
- `src/routes/index.tsx` を search_products demo から UI-00 ダッシュボードに差し替え
- サマリカード 3 指標コンポーネント
- PLU 未反映通知バー
- 毎日機能への大ボタン 3〜5 個
- Error Boundary と Toast を UI-00 中で発生したニーズに応じて最小限導入 (7-8a/8b の種)

### PR #54 以降: 7-8a Error Boundary 文書化 + 7-8b 横断UI テンプレ標準化
- UI-00 で得た具象を抽象化して UI_TECH_STACK.md §6.9 + コンポーネントテンプレ集として確定
- UI-07 着手前に整備完了するのが理想

---

## PR #52 実装詳細（セルフレビュー反映）

### Branch / Commit 分割
- **branch 名**: `feat/phase-1-seed-env`
- **commit 5 本**（各 commit は独立に fmt/clippy/typecheck 通る単位）:
  1. `feat(seed): add seed-demo-data binary for dev SQLite` — `src-tauri/src/bin/seed_demo_data.rs` + `Cargo.toml` `[[bin]]` セクション追加
  2. `chore(env): scaffold .env.example / .env.{development,test,production} + gitignore` — env ファイル 4 本 + `.gitignore` に `.env` / `.env.local` / `.env.*.local` 追記 + `src/env.d.ts` + `src/lib/env.ts`
  3. `ci(env): add check-env-safety.sh to frontend CI job and pre-push hook` — `scripts/check-env-safety.sh` + `.github/workflows/ci.yml` frontend job step 追加 + `scripts/pre-push.sh` に env 検査 section 追加
  4. `docs(env): env design principles in UI_TECH_STACK.md §6 + DEV_SETUP_CHECKLIST §7 env init` — UI_TECH_STACK.md §6 横断関心事サブセクション新設（§2.5 Query 戦略表より §6 が自然、セキュリティ原則として独立配置）+ DEV_SETUP_CHECKLIST.md §7 末尾に env 初期化ステップ追加
  5. `docs(plans): close UI-12 PR #50 sync + Phase 1 seed/env intro` — Plans.md 更新（L8 branch 削除、L7 Current Phase を merge commit `05f4aae` に更新、Active Tasks に PR #51 完了 1 行 + 7-9/7-10 進捗 1 行、7-9/7-10 を `[x]` 済）

### seed script 設計
- **配置**: `src-tauri/src/bin/seed_demo_data.rs`（Cargo bin target で `cargo run --bin seed_demo_data` 実行可）
- **対象 DB**: `--db <path>` CLI 引数で指定、デフォルトは Tauri app_data_dir の `inventory.db`（既存マイグレーション後 DB に追記可能）
- **冪等性**: 純 INSERT + 既存重複時は `ON CONFLICT DO NOTHING`（product_code / department_code / supplier_name UNIQUE 制約で冪等確保）。`--reset` フラグで全テーブル DELETE → INSERT（dev 専用、confirm プロンプト）
- **データ規模**: 商品 100 件（部門 3 × 30-40 件） + 部門 3 件（生地 / 毛糸 / 手芸用品） + 取引先 5 件 + 売上 30 日分（日平均 10 件 = 計 300 件） + 変動履歴（receiving 100 件 + sale_auto 300 件 = 計 400 件）
- **決定的動作**: `rand::rngs::StdRng::seed_from_u64(42)` で rand seed 固定（re-run 再現性、CI 検証の安定化）。日付も `2026-04-21` 基準 + 相対日数で固定化
- **進捗ログ**: 各 phase（departments → suppliers → products → sales → movements）完了時に件数を stdout に 1 行出力（デバッグ性）
- **tests**: `src-tauri/tests/seed_test.rs` で一時 DB に seed → row count 検証（冪等性テスト: 同一 seed 2 回実行で row count 変化なし確認）

### env 設計 — PR #52 確定値

#### セキュリティ前提（ユーザー懸念反映）
- **Vite `VITE_` prefix はバンドル埋め込み = 公開情報扱い必須**（クライアントサイド JS に平文で含まれる）
- **Tauri デスクトップ配布 binary は逆アセンブル可能** → フロントエンド側に真の秘密は原理的に置けない
- **秘密情報が必要になった場合**（将来のバックアップ暗号化鍵 / クラウド同期等）は Rust 側 OS keychain (keyring crate) 経由が原則。フロント env には絶対に置かない
- 現状 Phase 1-2 では真の秘密は発生しない（ローカル SQLite のみ、外部 API 連携なし）が、設計原則は今確立する

#### ファイル構成
| ファイル | git 管理 | 用途 | 値の性質 |
|---------|---------|------|---------|
| `.env.example` | commit | 変数一覧ドキュメント、空値のテンプレ、**ヘッダコメントに VITE_ 公開性原則明記** | 値なし |
| `.env.development` | commit | dev 時デフォルト値（`VITE_DEBUG=true`, `VITE_MOCK_MODE=false`） | 公開可能値のみ |
| `.env.test` | commit | テスト時デフォルト値（両方 false） | 公開可能値のみ |
| `.env.production` | commit | prod build 時デフォルト値（両方 false を静的強制） | 公開可能値のみ |
| `.env` | **gitignore** | 個人機固有上書き | 何でも書ける（個人機ローカル） |
| `.env.local` / `.env.*.local` | **gitignore** | 環境別個人機上書き | 同上 |

#### 命名規約
- `VITE_DEBUG` (boolean, default false): devtools 有効化、TanStack Query devtools、詳細 console ログ
- `VITE_MOCK_MODE` (boolean, default false): backend IPC を mock 実装に差し替え（将来の UI-09a/b 等で実測値なしの開発用）
- `VITE_APP_VERSION`: `package.json` の version を `vite.config.ts` の `define` で注入（env ファイルには書かない、ビルド時固定）
- **禁止命名**: `VITE_*_SECRET` / `VITE_*_KEY` / `VITE_*_TOKEN` / `VITE_*_PASSWORD`（バンドル公開されるため原理的にアウト）

#### 型定義
`src/env.d.ts`:
```typescript
interface ImportMetaEnv {
  readonly VITE_DEBUG: string
  readonly VITE_MOCK_MODE: string
  readonly VITE_APP_VERSION: string
}
```

`src/lib/env.ts`:
```typescript
export const isDebug = import.meta.env.VITE_DEBUG === 'true'
export const isMockMode = import.meta.env.VITE_MOCK_MODE === 'true'
```
厳格 equality（`=== 'true'`）で `'1'` / `'yes'` / 空文字での意図しない true 判定を防ぐ。

#### CI 静的検査（`scripts/check-env-safety.sh`）
以下 4 項目を検査（**bash exit code capture**: 各 check は `if ! ...; then FAIL=1; fi` パターンで集約、最後に `exit $FAIL` — memory `feedback-bash-wrap-exit-code-capture.md` 適用）:

1. `.env.production` に `VITE_DEBUG=true` / `VITE_MOCK_MODE=true` が無いか（prod で devtools / mock が動く事故防止）
2. `.env.{development,test,production}` 全体で `SECRET` / `TOKEN` / `KEY` / `PASSWORD` キーワードを含む変数がないか（誤って VITE_ prefix で秘密を置く事故防止）— **`.env.example` はドキュメント目的で除外**
3. `.gitignore` に `.env` / `.env.local` / `.env.*.local` が記載されているか
4. `git ls-files` で `.env` / `.env.local` / `.env.*.local` が tracked になっていないか

**配置**: `scripts/check-env-safety.sh`（`doc-consistency-check.sh` / `check-typedinvoke-count.sh` と並列）、`chmod +x` 実行権限付与
**CI 統合**: `.github/workflows/ci.yml` の frontend job の `npm run lint` step 直後
**pre-push 統合**: `scripts/pre-push.sh` に `# env safety check` section 追加

#### ドキュメント配置判断
- **UI_TECH_STACK.md §6 横断関心事**に「env 設計」サブセクション新設（§2.5 Query 戦略表より、§6 の方がセキュリティ原則配置として自然）
- 独立 `docs/ENV_DESIGN.md` は作らない（現状の記述量 30-40 行で UI_TECH_STACK.md §6 に収まる、肥大化したら後日分割）
- `.env.example` ヘッダ: `# WARNING: VITE_ prefix 変数はバンドルに平文で含まれます。秘密情報 (KEY/TOKEN/SECRET/PASSWORD) は絶対に書かないこと。詳細は docs/UI_TECH_STACK.md §6 参照`

### 検証計画
- **ローカル検証**（PR push 前に全通過必須）:
  - `cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test`
  - `cargo run --bin seed_demo_data -- --db /tmp/test-seed.db && sqlite3 /tmp/test-seed.db "SELECT COUNT(*) FROM products"` → 100
  - `npm run typecheck && npm run lint && npm run format:check && npm run build`
  - `scripts/doc-consistency-check.sh`
  - `scripts/check-typedinvoke-count.sh`
  - `scripts/check-env-safety.sh`
- **CI**: rust job（cargo fmt/clippy/test）+ frontend job（typecheck/lint/format/build + check-env-safety + audit）+ docs job（doc-consistency）の 3 job green 確認 — `gh pr checks <N> --watch`（memory `feedback-ci-polling-use-gh-watch.md` 適用、自前 `until` polling 禁止）
- **CI で seed 実行**: しない（seed は dev 用、CI では migration だけ実行）
- **動作確認**: PR マージ前に `cargo tauri dev` 起動 → seed 後の 100 件を search_products demo で確認（Phase 1 6b WSL2 Linux IME 制約はあるが英字検索で疎通確認可）

### Codex レビュー対応フロー
- PR #52 push 後 → `gh pr checks <N> --watch` で CI green 待ち → Codex 自動レビュー起動待ち
- Round N 指摘時: P1 必須対応 / P2 必須対応 / P3 任意改善は軽微（~10 min、PR スコープ内）なら同 PR 内、レビュー 3 往復以内目安（memory `codex-non-blocker-incorporation.md` 適用）/ P4 typo 等は即対応
- 各 round で Plans.md Active Tasks に対応状況 1 行追加（分離 commit、prefix `docs(plans)`）
- マージ判断: Codex「マージ可能」判定 + user 承認（**Claude は勝手にマージしない**）

### 後処理
- **プラン archive**: マージ後、本プラン `~/.claude/plans/squishy-sniffing-waterfall.md` → `docs/archive/plans/2026-04-21-phase-1-seed-env.md` に移動。**相対パスリンク変換必須**（memory `feedback-archive-relative-path-conversion.md`）: プラン内の絶対パス `/home/kosei/inventory-system/docs/...` 参照を `../../...` 形式に変換
- **memory 保存**（PR #52 マージ後、Plan mode 抜けた後に実施）:
  1. `feedback-env-design-principles.md` — VITE_ prefix 公開性原則、秘密はフロントに置かない、CI 静的検査基準
  2. `feedback-seed-script-cargo-bin.md` — dev seed は `src-tauri/src/bin/` + Cargo bin target が Rust プロジェクトの慣習
  3. 既存 MEMORY.md index に 2 エントリ追加
- **memory 軽量監査**: 本セッションの feedback（env 取扱、B 案選定、プランセルフレビュー実行）が memory 反映されているか確認、sentinel `.last_audit` 更新
- **次アクション**: PR #52 マージ完了後、PR #53 UI-00 ホーム画面の設計合意ドキュメント起票（`docs/plans/ui-00-home-design-agreement.md`）

### 実行制約（明示）
- **Claude は勝手に以下を実行しない**: PR マージ / force push / main branch 直接 push / Codex レビュー無視での push / branch 削除
- Codex レビュー中は PR #53 設計着手に進まない（context 圧迫防止、並行進行禁止 — user 過去指示）
- pre-push hook 失敗時は `--no-verify` 使わず、根本原因修正（`.git/hooks/` は sandbox 経由で readonly だが pre-push 自体は script 経由で実行される）

---

## Critical Files (参照先)

- `/home/kosei/inventory-system/Plans.md` — 全体進捗 SSOT
- `/home/kosei/inventory-system/docs/UI_TECH_STACK.md` — 技術スタック決定書、§2.5 TanStack Query 戦略表、§6.9 Error Boundary 戦略 (未作成、7-8a で新設予定)
- `/home/kosei/inventory-system/docs/SCREEN_DESIGN.md` — UI-00 含む 19 画面設計、毎日 5 画面モックアップ完成
- `/home/kosei/inventory-system/docs/architecture/ui-task-specs.md` — UI-00 タスク仕様
- `/home/kosei/inventory-system/docs/FUNCTION_DESIGN.md` — 関数設計目次 (UI-00 未記載、次 PR で追加)

## Verification

本プランは方針整理なので実装検証は次フェーズ (B 案なら PR #52) で実施:
- seed 実行 → SQLite に 100 件流入確認
- `cargo tauri dev` でダッシュボード表示確認
- `.env.development` 読み込み確認 (`import.meta.env.VITE_DEBUG` で boolean 取得)
