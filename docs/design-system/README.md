# デザインシステム参照ドキュメント

> **目的**: 本ディレクトリはデザイン規約の単一参照源（SSOT）。Codex を含む誰が実装しても外れない「決まったパーツ + 決まった選択ルール」を定義する。
> **位置付け**: `docs/UI_TECH_STACK.md` §4 をここへ分離し、UI_TECH_STACK は技術スタック・設定・A11y 要件を引き続き持つ。

---

## サブ docs 一覧

| ファイル | 責務 | 主な内容 |
|--------|------|--------|
| [00-foundations.md](00-foundations.md) | デザイントークン（色 / タイポ / スペーシング / アイコン）の正典 | カラーパレット・セマンティックトークン・タイポグラフィ階層・スペーシングスケール・アイコンサイズ・業務ステータス視認性 |
| [01-decision-rules.md](01-decision-rules.md) | DSR-01〜15: 実装判断を一意に決めるルール集 | 主動線 CTA / Tabs vs SegmentedControl / Toast vs Alert 3 階層 / ステータスバッジ配置 / read-only vs disabled / 必須表示 / 確認ダイアログ境界 / semantic 色 / Form セクション / フィルタソース / 空状態・Tooltip / truncate・密度 / 表示スケール / ファイル選択方式 / returnTo 検証 |
| [02-component-catalog.md](02-component-catalog.md) | 13 パターンカタログ（使いどころ / JSX skeleton / トークン / 状態 / a11y / Do-Don't / canonical ファイル参照） | ①ページヘッダ ②サマリカード ③テーブル ④フォームセクション ⑤SegmentedControl ⑥空状態・エラー・ローディング ⑦Toast ⑧Dialog/確認 ⑨検索+フィルタ ⑩ページネーション ⑪日付・月ナビ ⑫行インライン展開 ⑬ステータスバッジ |
| [03-philosophy.md](03-philosophy.md) | 参照哲学の正典（何を取り、何を取らないか） | 核心4本柱（refactoring-ui / ux-principles / GOV.UK / IBM Carbon）+ 補助3原則（Polaris / Atlassian / Fluent 2）+ japanese-webdesign 観点借用 |

---

## 既存 docs との責務境界

| ドキュメント | 責務 | 本ディレクトリとの関係 |
|-----------|------|-------------------|
| `docs/SCREEN_DESIGN.md` | 画面固有の判断（各画面の項目・操作フロー・状態遷移） | 横断規約は本ディレクトリへ移設済み、画面固有部分は SCREEN_DESIGN に残る |
| `docs/UI_TECH_STACK.md` | 技術スタック選定・A11y 要件・Tauri 特有の決定（§1〜§3・§5・§6・§7） | §4 デザインシステム本文は本ディレクトリへ移設、UI_TECH_STACK §4 はスタブ + リンク |
| `docs/quality/review-checklist.md` | PR レビュー観点チェックリスト | カテゴリ 9 の参照先が本ディレクトリの対応パターン見出しへ張り替わる（A5 で更新） |

---

## サブファイル命名規約

`0x`=デザイン基盤。番号は内容領域を示す:

| 番号 | 領域 |
|-----|------|
| `00` | foundations（トークン層） |
| `01` | decision-rules（DSR 判断ルール） |
| `02` | component-catalog（パターン集） |
| `03` | philosophy（参照哲学） |

---

## 機械強制の現状（PR-C 導入済み）

新規依存なしで実現できる範囲は PR-C で導入済み:

- palette 外色 / 生 `<button>` / barrel 迂回: eslint `no-restricted-syntax`（`eslint.config.js`、既存 eslint のみ。既存違反 = 色 14 箇所 + button 3 箇所は先行解消済み）
- docs 整合: `scripts/doc-consistency-check.sh` の DS1〜DS4（canonical path 実在 / DSR 参照整合 / token HEX 整合 / review-checklist 対応）

## 将来項目（npm 凍結解除後に検討）

以下は Mini Shai-Hulud 凍結解除後の候補であり、現時点では実装しない。静的な palette 外色強制は上記 eslint で導入済みのため、ここに残るのは eslint の AST Literal 検査で届かない構造ケース:

- `ast-grep` 構造 lint（動的 shade 補間 `` `bg-${c}-${n}` `` 型、`<input>` / `<select>` の primitive 強制）
- `stylelint` CSS カスタムプロパティ整合チェック
- `eslint-plugin-tailwindcss` Tailwind クラス順序・未知クラス強制
