# デザイントークン（foundations）

> **親文書**: [README.md](README.md)
> **責務**: カラーパレット・セマンティックトークン・タイポグラフィ・スペーシング・アイコンサイズの正典。UI 実装で使うすべてのデザイントークンはここを一次参照とする。SegmentedControl 仕様は [02-component-catalog.md](02-component-catalog.md) ⑤ が正典。

---

## カラーパレット

**ベースパレット（Tailwind `stone` ベース + カスタムトークン）**:

| 用途 | 変数名 | Tailwind相当 | HEX | 根拠 |
|------|-------|------------|-----|------|
| 背景 | `--background` | `stone-50` | #fafaf9 | 長時間凝視で目の負担が少ないウォームニュートラル |
| 前景（本文） | `--foreground` | `stone-900` | #1c1917 | コントラスト比12.6:1（AAA+） |
| カード背景 | `--card` | `stone-100` | #f5f5f4 | 背景との差分8% で情報ブロック識別 |
| ボーダー | `--border` | `stone-200` | #e7e5e4 | 4.5:1 境界可視性 |
| サブテキスト | `--muted-foreground` | `stone-500` | #78716c | コントラスト比 4.5:1（AA） |

**セマンティックカラー**:

| 状態 | `--{name}` | Tailwind | 用途 |
|------|-----------|---------|------|
| Primary | `--primary` | `amber-700` (#b45309) | 主要ボタン、ハイライト。ウォーム系主アクセント |
| Success | `--success` | `green-700` (#15803d) | 取込み完了、前月比プラス |
| Warning | `--warning` | `amber-600` (#d97706) | PLU通知、手動バッジ、在庫少 |
| Destructive | `--destructive` | `red-700` (#b91c1c) | 在庫切れ、前月比マイナス |
| Warning Soft | `--warning-soft` | `amber-50` (#fffbeb) | 在庫少 Badge soft 背景 |
| Warning Border | `--warning-border` | `amber-200` (#fde68a) | 在庫少 Badge outline |
| Warning Strong | `--warning-strong` | `amber-900` (#78350f) | warning 系強調テキスト |
| Warning Emphasis | `--warning-emphasis` | `amber-700` (#b45309) | 在庫少セル強調 |
| Destructive Soft | `--destructive-soft` | `red-50` (#fef2f2) | 在庫切れ soft 背景 |
| Destructive Border | `--destructive-border` | `red-200` (#fecaca) | 在庫切れ outline |
| Destructive Strong | `--destructive-strong` | `red-900` (#7f1d1d) | 在庫切れ強調テキスト |
| Success Soft | `--success-soft` | `green-50` (#f0fdf4) | 前月比プラス soft 背景 |
| Success Emphasis | `--success-emphasis` | `green-600` (#16a34a) | 増減プラス数値 |
| Rank Top BG | `--rank-top-bg` | `amber-50` (#fffbeb) | 1位行背景 |
| Rank Top Badge BG | `--rank-top-badge-bg` | `amber-100` (#fef3c7) | 1位 Badge 背景 |
| Rank Top Badge Text | `--rank-top-badge-text` | `amber-800` (#92400e) | 1位 Badge テキスト |

各色の明色版（background 用）は `{color}-50` を使用し、コントラスト確保。

**ウォーム系採用の論拠（4根拠 × refactoring-ui §4 引用）**:

> refactoring-ui §4 "Color": *"Pure grays look lifeless — add subtle saturation. For warm UIs, tint grays with yellow or brown; for cool UIs, use blue tint."*

1. **環境の一致**: 手芸店の商材（毛糸・布・木製道具）は暖色系。UIの色温度が店舗の雰囲気と一致することで、店主の感覚的ストレスが減る
2. **利用者との距離感**: テック系クール（Slate / Gray）は専門家向け感が強い。小売店主に対してウォームの方が親しみやすく、恐怖感を与えない
3. **長時間利用の疲労軽減**: 低彩度ウォームニュートラルは、青色光を強めるクール系に比べて長時間使用での目の疲労が少ない（一般論だが医学的裏付けあり）
4. **差別化**: 既存の在庫管理 SaaS は大半が Slate/Gray の没個性。Stoneベースは個別のアイデンティティを提供（IBM Carbon は Gray 10 ベース、Shopify は Gray、Polaris は Gray、Atlassian は Neutral N10）

---

## 4色エリアモデルの扱い

SCREEN_DESIGN.md §2 で定義された 4色エリア（緑=毎日の業務 / 青=商品管理 / オレンジ=入出庫 / 黄=システム管理）は、**画面遷移図（仕様書内の俯瞰図）限定**とする。

**実装UIでは使用しない**。理由:

> refactoring-ui §1 "Visual Hierarchy": *"Not everything can be important. Create hierarchy through size, weight, and color."*

4色全てがサイドバーに並ぶと、全エリアが同じ重要度で主張し、ヒエラルキーが崩壊する。サイドバーは **単色ウォームグレー**（`stone-100` 背景 + `stone-900` テキスト）+ **アクティブ項目のみ Primary アクセント1色** で構成する。

グループ分類は**アイコン + テキスト見出し + 区切り線**で表現する（色ではなく構造で区分）。

---

## タイポグラフィ

| 階層 | サイズ | line-height | font-weight | 用途 |
|------|-------|------------|------------|------|
| h1 | 24px (1.5rem) | 1.3 | 600 | 画面タイトル（各ページ1つ） |
| h2 | 20px (1.25rem) | 1.35 | 600 | セクション見出し |
| h3 | 18px (1.125rem) | 1.4 | 600 | カード内見出し |
| body | 16px (1rem) | 1.5 | 400 | 本文、テーブルセル |
| label | 14px (0.875rem) | 1.5 | 500 | ラベル、ボタン、タブ |
| caption | 12px (0.75rem) | 1.5 | 400 | 補助説明、タイムスタンプ |

**フォントファミリー**: システムフォントスタック（`-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif`）。カスタムWebフォントは読み込み遅延のリスクと業務アプリの堅実性を優先して不採用。

**根拠**: refactoring-ui §2 "Hierarchy" *"Establish hierarchy through size, weight, and color — don't rely on size alone."* 本書では sizeとweightの組合せ（例: h1は size=24 + weight=600、body は size=16 + weight=400）で4段の階層を作る。

---

## スペーシング

Tailwind のデフォルトスケールを採用し、以下6段のみ使用:

| Token | px | 用途 |
|-------|----|------|
| `space-1` | 4 | アイコン隣接 |
| `space-2` | 8 | 要素間密着（ボタン内 padding 横） |
| `space-3` | 12 | 関連要素（ラベルとインプット） |
| `space-4` | 16 | セクション内の要素間 |
| `space-6` | 24 | セクション間、カード間 |
| `space-8` | 32 | ページ余白、大セクション区切り |

**根拠**: refactoring-ui §3 *"Use a system, not guesswork."* 自由な値は許可せず、コードレビューで違反を検出。

---

## アイコンサイズ

| サイズ | 用途 |
|-------|------|
| 16px | ボタン内、ラベル隣接 |
| 20px | テーブルセル、リスト項目 |
| 24px | 画面タイトル横、空状態 |

それ以外のサイズは使わない。統一感を優先。

---

## 業務ステータスの視認性

> 出典: `docs/SCREEN_DESIGN.md` §6（2026-06-07 追加）。横断規約として本ファイルへ移設。

**利用者前提**: 主利用者は非IT系の店舗オーナーで、日常業務中に長時間・繰り返し操作する。老眼や色の識別しづらさを前提に、読めること / 区別できることを機能要件として扱う。

**既存画面の視覚言語を継承する**: 新規画面や follow-up UI は、実装済み画面の共通レイアウト、テーブル / カード / チップ、spacing、typography、stone 系トークン、active / hover 表現を先に確認し、同じアプリとして見える範囲で改善する。ページごとにデザイン方向性が分裂する変更は、共有 UI 方針の変更として Plan Packet で明示する。

**色だけで意味を伝えない**: 在庫状態、警告、前月比、取込み結果などの業務ステータスは、赤 / 黄 / 緑などの hue だけで意味を符号化しない。日本語ラベル + アイコン / 形 / 位置 / バッジ / 状態列のいずれかを組み合わせる（WCAG 1.4.1）。

**色は二次シグナル**: セマンティックカラーは注意喚起の速度を上げるために使う。色を失っても「在庫切れ」「在庫少」「比較不可」などの意味が読める構造を優先する。

**L3 判定**: Windows native L3 で実利用者が状態を言い分けられない、または通常距離で読めない場合は polish ではなく機能欠陥として扱う。

関連: [01-decision-rules.md](01-decision-rules.md) DSR-08（semantic 色のみで意味を伝えない）。

---

## デスクトップアプリ前提の UI 設計制約

> 出典: `docs/SCREEN_DESIGN.md` §6（Phase 1 確定）。横断規約として本ファイルへ移設。

- **レスポンシブ不要**: 単一店舗 PC で動かす単一ウィンドウ前提。モバイル / タブレット対応はしない
- **初期ウィンドウ**: Tauri 起動時は 1280x800 / 最小 1024x720 の単一ウィンドウで開始する。業務テーブルの視認性を優先し、800x600 起動は採用しない
- **hover 許容**: タッチデバイス前提でないため hover 動作で情報補強してよい（tooltip / dropdown 等）
- **アクセシビリティ**: shadcn/ui + Radix UI primitives がキーボードナビ + ARIA 属性を担保。Vitest / RTL 基盤は PR #64 で導入済み

---

## URL 設計

> 出典: `docs/SCREEN_DESIGN.md` §6（feedback memory `feedback-desktop-app-url-design.md` 適用）。横断規約として本ファイルへ移設。

- **状態の URL 化**: タブ切替・フィルタ・選択中エンティティ等の状態は URL（route + search params）に持たせる。`useState` でローカル状態に閉じない
- **メリット**: テスト容易（URL で再現可能）/ F5 耐性 / queryKey 独立 / コード分割（route 単位 lazy load）/ 利用者が直接 URL 共有可能（将来 Web 拡張時の前提整備）
- **実装例**: 日次/月次レポートは `/reports/daily` / `/reports/monthly` の別 route。商品検索フィルタは search params
