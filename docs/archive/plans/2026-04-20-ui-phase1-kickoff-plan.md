# 第7段階 Phase 1 着手セッション 実装計画

## Context

バックエンド全層（IO/BIZ/CMD/MNT）は v0.6.0 で完成済み。第7段階 Phase 1（UI基盤構築、目標タグ `v0.7.0-ui-foundation`）に着手する。今回のセッションは Phase 1 全体の一部（導入準備まで）を扱い、P0 の実機試行と UI-12 実装は別セッションに送る。

**現状**:
- `src/` は `create-tauri-app` scaffold のみ。React 19.1.0 + TypeScript 5.8.3 + `@tauri-apps/api` v2 のみ導入済み
- Tailwind / shadcn/ui / TanStack Query / Zustand / React Hook Form / Vitest は **全て未導入**
- `src-tauri/src/cmd/` は 13 コマンドすべて実装済み（CMD-01〜CMD-11 + CMD-13）
- `docs/UI_TECH_STACK.md` §2.5 / §6.9 / §7.1 は Phase 1 で追記予定の空欄あり
- `Plans.md` §第7段階 に 7-1〜7-11 として 15 タスク分解済み

---

## 今回セッションのスコープ

**選択**: P0 比較表だけ作って別日実機試行 + 7-1 Tailwind + 7-2 shadcn/ui 導入まで

今日やる:
1. **P0 3項目の比較表・評価基準を UI_TECH_STACK.md に書き込む**（7-4 / 7-5a / 7-5b の前段階、実機試行なし）
   - 7-4 ルーティング: TanStack Router vs React Router v7 の比較表を §7.1 に追記
   - 7-5a invoke 型定義方式: tauri-specta vs 手動の比較表を §2.5 に追記
   - 7-5b TanStack Query キャッシュ戦略表: queryKey 命名 + 画面別 staleTime/gcTime の **初期案** を §2.5 に追記
   - いずれも「別日の実機試行で最終決定」と明記
2. **7-1 Tailwind CSS 4 + PostCSS 導入** → `tailwind.config.ts` に stone ベースカスタムパレット設定（UI_TECH_STACK.md §4.1 の具体値をそのまま反映）
3. **7-2 shadcn/ui 初期化** → `components.json` 作成、18 コンポーネント導入（Button / Input / Label / Dialog / AlertDialog / DropdownMenu / Select / Checkbox / RadioGroup / Tabs / Card / Table / Toast / Form / Badge / Skeleton / Separator / ScrollArea）

今日やらない（別セッション送り）:
- 7-3 UI-12 共通レイアウト実装（P0 ルーティング確定後）
- 7-4 / 7-5a / 7-5b 実機試行と最終決定（別日、install + プロトタイプ）
- 7-5c invoke ラッパ + TanStack Query 初期化（P0 確定後）
- 7-6 Storybook 判断（UI-12 完成後）
- 7-7 Vitest + @axe-core/react 初期化
- 7-8a/b/c Error Boundary + 共通テンプレ + unsaved changes ガード
- 7-9 seed-demo-data.rs
- 7-10 .env 構成
- 7-11 UI_DEV_WORKFLOW.md
- タグ `v0.7.0-ui-foundation`

---

## 実装順序（今日のセッション内）

```
Step 1. UI_TECH_STACK.md §7.1 に 7-4 比較表追記（ルーティング）
Step 2. UI_TECH_STACK.md §2.5 に 7-5a 比較表追記（invoke 型定義方式）
Step 3. UI_TECH_STACK.md §2.5 に 7-5b キャッシュ戦略表追記（queryKey + staleTime/gcTime 初期案）
Step 4. 7-1 Tailwind 4 + PostCSS 導入
  - 依存追加: tailwindcss@4 / @tailwindcss/postcss / postcss / autoprefixer / tailwind-merge / class-variance-authority / clsx
  - postcss.config.ts 作成
  - tailwind.config.ts 作成（stone 系カスタムパレット、UI_TECH_STACK.md §4.1 の HEX を反映）
  - src/styles/globals.css に Tailwind 4 ディレクティブ + CSS 変数定義
  - src/main.tsx で globals.css 読み込み
  - Tailwind クラスが App.tsx で効くことを dev サーバで確認
Step 5. 7-2 shadcn/ui 初期化
  - npx shadcn@latest init → components.json 生成、base color: stone
  - 18 コンポーネント追加（shadcn CLI で一括 add）
  - lucide-react 導入確認
  - 各コンポーネントが src/components/ui/*.tsx に配置されたことを確認
Step 6. Plans.md の 7-1 / 7-2 にチェック、P0 比較表が書かれたことを備考に記録
Step 7. git commit（7-1/7-2 は 2 commit 分割: `feat(ui): introduce Tailwind 4 + stone palette` と `feat(ui): init shadcn/ui with 18 components`、UI_TECH_STACK.md 更新は `docs: P0 比較表追記`）
```

---

## 主要修正ファイル

### 新規作成

**設定**:
- `postcss.config.ts`
- `tailwind.config.ts`
- `components.json`

**src/ 配下**:
- `src/styles/globals.css`
- `src/components/ui/**`（shadcn 18 コンポーネント）
- `src/lib/utils.ts`（shadcn の `cn()` ヘルパ）

### 修正

- `docs/UI_TECH_STACK.md` §2.5（invoke 型定義方式比較表 + キャッシュ戦略初期案）
- `docs/UI_TECH_STACK.md` §7.1（ルーティング比較表）
- `src/main.tsx`（globals.css 読込）
- `src/App.tsx`（Tailwind クラス動作確認用の最小置き換え。UI-12 本体は別セッション）
- `package.json`（依存追加）
- `Plans.md`（7-1/7-2 チェック、備考追記、Test Count は UI 層テストはまだ増えないので無記入）

### 既存活用（修正不要）

- `src-tauri/src/cmd/*.rs` 13 ファイル（次回セッションで invoke ラッパが参照する型契約の源泉）
- `docs/UI_TECH_STACK.md` §4.1（stone パレット具体値）、§2.3（shadcn コンポーネント一覧）

---

## P0 比較表の骨子（UI_TECH_STACK.md への追記内容）

### §7.1 ルーティング比較表（7-4 用）

| 評価軸 | TanStack Router | React Router v7 |
|--------|-----------------|-----------------|
| 型安全性 | ネイティブ TS、route param が型推論 | `type-safe-routes` 別途必要 |
| TanStack Query 統合 | 同一作者、`loader` ↔ Query 親和性高 | 独立。ブリッジコード必要 |
| 学習コスト | 新しめ、情報量は React Router より少 | 業界標準 |
| バンドルサイズ | 大きめ | 小さめ |
| エコシステム成熟度 | 活発、devtools 充実 | 業界標準 |
| 本プロジェクト適合性 | ★★★ | ★★ |

**判定プロセス（別日実施）**: 別 branch に TanStack Router を install → UI-12 のサイドバー遷移を実装してみる（2h）→ 詰まったら React Router v7 で同じことを試す。両方の感触を記録して UI_TECH_STACK.md §7.1 に決定結果 + 根拠を追記。

### §2.5 invoke 型定義方式比較表（7-5a 用）

| 評価軸 | tauri-specta 自動生成 | 手動型定義 |
|--------|----------------------|-----------|
| CMD 追加時の保守 | 自動（build.rs で生成） | Rust/TS 両側に書く |
| 型の真実性 | Rust 構造体から生成、乖離ゼロ | 人為的乖離リスク |
| ビルド時間 | specta proc-macro で微増 | 影響なし |
| エコシステム成熟度 | 活発、Tauri 2 対応 | 言うまでもなく |
| 本プロジェクト適合性 | ★★★（CMD 13 本＋今後拡張） | ★ |

**判定プロセス（別日実施）**: `specta` / `tauri-specta` を Cargo.toml に追加 → 1 コマンドだけ `#[tauri::command]` + `#[specta::specta]` で注釈 → `collect_commands!` で TS 生成 → 型が Rust と一致するか確認。2h 以内に詰まったら手動方式にフォールバック。

### §2.5 TanStack Query キャッシュ戦略表（7-5b 用、初期案）

queryKey 命名規約（案）:
```
['entity', operation, ...params]
例:
['product', 'list', { page, keyword }]
['product', 'detail', productCode]
['sales', 'daily', saleDate]
['inventory', 'low']
```

画面別 staleTime / gcTime（初期案、実機運用で要検証）:

| 画面 | staleTime | gcTime | 理由 |
|------|-----------|--------|------|
| 商品一覧/検索 | 30s | 5min | CRUD 頻度中 |
| 商品詳細 | 0 | 5min | 編集画面から戻った時は即時再取得 |
| 在庫照会（ホーム・UI-06a） | 10s | 5min | CSV 取込み直後に即時反映したい |
| 日次/月次売上 | 5min | 30min | 集計結果、頻繁には変わらない |
| PLU未反映件数 | 30s | 5min | 書出し直後の反映重要 |
| 設定 | Infinity | Infinity | 明示 invalidate 時のみ再取得 |

invalidation pattern:
- CMD 成功後、該当 entity の全 query を invalidate（例: 商品登録成功 → `['product']` 配下全 invalidate）
- 大量 invalidate は mutation の `onSuccess` に集約

---

## 検証方法

### 今日のセッション完了時の確認

1. **依存解決**:
   - `npm install` 完了、エラーなし
2. **Tailwind 動作**:
   - `npm run dev` 起動、App.tsx に書いた `className="bg-stone-50 text-stone-900"` が効いている
   - stone 系カラーがブラウザで表示（#fafaf9 背景）
3. **shadcn/ui 動作**:
   - `src/components/ui/` に 18 ファイルが作られている
   - App.tsx で `<Button>テスト</Button>` が表示、Radix UI のフォーカスリングが動作
4. **CMD 層が壊れていない**:
   - `cargo check`（src-tauri）→ エラーなし
   - 既存 cargo test 通過（バックエンド側変更なしの確認）
5. **ドキュメント**:
   - UI_TECH_STACK.md §7.1 / §2.5 に比較表が追記されている
   - Plans.md の 7-1 / 7-2 にチェック、P0 比較表追記が備考に記録されている
6. **品質ゲート**:
   - `./scripts/doc-consistency-check.sh` → R3（リンク実在）で新規ファイルパスが通る
   - `scripts/pre-push.sh` 全 pass

### 今日終わらない残作業（次回セッション先頭でやる）

- 7-4 / 7-5a の実機試行と最終決定（TanStack Router install、tauri-specta install）
- 決定結果を UI_TECH_STACK.md §7.1 / §2.5 の比較表下に「決定: ○○ / 根拠: ○○」として追記
- 7-3 UI-12 共通レイアウト実装
- 7-5c invoke ラッパ + TanStack Query 初期化
- 以降 7-6〜7-11 の順次実装

---

## 実装時判断（Claude 側で決定、利用者判断不要）

- **shadcn の base color**: CLI デフォルト `stone` プリセットで init。UI_TECH_STACK.md §4.1 の具体 HEX との差分は UI-12 実装時（別セッション）に `tailwind.config.ts` で上書き調整。
- **Tailwind 4 設定形式**: 公式 docs 準拠で `@tailwindcss/postcss` プラグイン + `globals.css` で `@import "tailwindcss";` + `@theme` ディレクティブによる CSS-first 設定。`tailwind.config.ts` は shadcn 互換性のため併用（content path / plugins 指定用）。install 時に Tailwind 4 公式 docs で裏取り。
- **git commit 分割**: 3 commit（①P0 比較表追記、②Tailwind 導入、③shadcn/ui 導入）。`scripts/pre-push.sh` は各 commit 前ではなく push 前に 1 回通す（hook で自動実行）。
- **subagent 活用判断**: 今回は 4 ファイル未満の広域探索と中規模導入作業のみ。主 Claude で処理（CLAUDE.md の subagent 活用方針に準拠）。shadcn 18 コンポーネント add が長引いた場合のみ別判断。

---

## 前セッション終盤で指摘された抜け漏れ（仕切り直し後に再検討）

以下 3 点はプラン本体に未反映。次セッションで反映するか議論する:

1. **DEV_SETUP_CHECKLIST.md 第7段階追記** — Plans.md Backlog に「Phase 1 着手前」と書かれているタスクが本プランに入っていない。今回セッションで書くか、別セッション送りか判断要。
2. **Plans.md のマーカー運用** — 7-1/7-2 はチェック済みだが、7-4/7-5a/7-5b は「比較表のみ追記、決定は別日」の中間状態。チェックせず `cc:WIP` マーカーで「比較表追記済み、実機試行待ち」と残すのが CLAUDE.md のマーカー凡例準拠。
3. **shadcn/ui × Tailwind 4 の整合性裏取り** — Tailwind 4 + shadcn は比較的新しい組合せ。`npx shadcn init` 実行前に公式 docs の Tailwind 4 対応ページで最新手順確認（globals.css の `@import` 形式 / `tailwindcss-animate` vs `tw-animate-css` の選択）。Context7 MCP で `shadcn/ui` / `tailwindcss` 両方を query して裏取りが安全。
