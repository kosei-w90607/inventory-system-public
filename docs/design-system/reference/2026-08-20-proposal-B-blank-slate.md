# 発注書B 白紙デザイン提案 — 在庫管理システム全画面

前提: 個人経営手芸店の店主（非IT・年配）が Windows デスクトップで毎日使う業務アプリ。各画面の仕事（扱うデータ・操作の意味）は一切変えず、見せ方のみを全画面一貫の 1 system として作り直す。既存 `docs/design-system/**` は読んでいない（白紙）。実装済みの「色だけで状態を伝えない」原則（例: `src/features/stock-inquiry/components/StockStatusBadge.tsx`）は結果的に優れているため system 側で追認・横展開する。

---

## 1. 診断（実読根拠つき、影響が大きい順）

| # | 問題 | 根拠（file:line） | 非IT高齢利用者への影響 |
|---|------|---------------------|--------------------------|
| D1 | 本文の大半が `text-sm`(14px) で描画され、`text-base`(16px以上) はほぼ未使用 | `src/components/ui/table.tsx:12`（table 全体 text-sm）、`src/features/products/components/ProductTable.tsx:48-63`、grep 集計: text-sm 出現100+件 vs text-base 出現5件未満 | 商品名・在庫数・金額など判断に直結する数字が最小サイズで表示され、老視で読み取り疲労が増す |
| D2 | 補助情報用の `text-xs`(12px) が本文にも流用されている | `src/features/csv-import/components/ErrorRowsTable.tsx`（text-xs 3箇所）、`src/components/ui/badge.tsx:8` | エラー行の内容など重要情報が最小フォントで表示される |
| D3 | table 行が `h-10`/`p-2` で全画面共通密度（業務用一覧も補助ログも同じ） | `src/components/ui/table.tsx:56-79` | 商品一覧・在庫照会など毎日見る一覧が窮屈で、行の読み違えが起きやすい |
| D4 | アイコンサイズが最低8種類（size-4×30, size-8×9, size-3×5, size-5×4, size-1×2, h-6 w-6×2, size-6×1, size-2×1, size-9×1, h-7 w-7×1）で無秩序に混在 | 全 `src/features`,`src/components` grep 集計、例 `src/features/home/components/ActionButton.tsx:59`(h-6 w-6) vs `src/components/layout/SidebarArea.tsx:20`(size-4) | 同じ重要度の情報が画面によって視覚的な強さが変わり、どこを見るべきか毎回学習し直しになる |
| D5 | ページ root の余白リズムが2系統混在（`min-h-screen space-y-6 p-6` 系8画面 vs `space-y-4 p-6` 系10画面+） | `src/features/home/HomePage.tsx:59`、`src/features/stocktake/StocktakePage.tsx:204`、`src/features/backup-restore/BackupRestorePage.tsx:333` （space-y-6 系）／`src/features/products/ProductListPage.tsx:58`、`src/features/stock-inquiry/StockInquiryPage.tsx:87`（space-y-4 系） | 画面を移動するたびに余白の詰まり方が微妙に変わり、「同じアプリ」という一貫した安心感が薄れる |
| D6 | `docs/SCREEN_DESIGN.md:92`「全ボタンにタイトル＋説明文」の設計意図に反し、実装は icon+label のみ | `src/features/home/components/ActionButton.tsx:58-77`（説明文を描画するコードが存在しない） | 「廃棄・破損」「手動販売出庫」等、語感だけでは用途が伝わりにくいボタンで誤タップの危険 |
| D7 | 検索欄の挙動が画面ごとに2種類（Enter必須のcommit型 / debounceのlive型）を暗黙選択 | `src/components/patterns/SearchBar.tsx:35-105`(Commit型) と `:111-185`(Live型)、`src/features/products/ProductListPage.tsx:76-82`(live採用) | ある画面でEnterを押す癖がついた利用者が別画面で反応せず「壊れた」と誤解する |
| D8 | 唯一の文字拡大手段 `DisplayScaleControl` が240pxサイドバー最下部の小さな Select に埋もれている | `src/components/layout/DisplayScaleControl.tsx:15-43`、`src/components/layout/Sidebar.tsx:11-25`（4エリア分スクロールした先） | 「商品コードが小さい」(コメント記載の実フィードバックH-6) の解決策自体が発見されにくい |
| D9 | サイドバー幅が `240px` 固定でありながら DisplayScale で文字拡大ができる（拡大時のラベル折返し未検証） | `src/components/layout/RootLayout.tsx:61`（grid-cols-[240px_...] 固定） | 文字を大きくした利用者ほどサイドバーで文字が欠ける／詰まるリスクが高い |
| D10 | badge の作法が3系統ばらばら（状態=outline+icon、分類=secondary pill、ランキング=amber pill）で明文化されていない | `src/features/stock-inquiry/components/StockStatusBadge.tsx:22-46`、`src/features/products/components/ProductTable.tsx:52`（廃番=secondary pill） | 「これは注意すべき情報」という視覚合図が画面ごとに変わり読み取りコストが増す |
| D11 | `PageHeader` は `subtitle` と `actions` を同時に持てない排他設計 | `src/components/patterns/PageHeader.tsx:27-45` | 「商品登録」ボタンを持つ商品一覧画面などで、画面の目的を1行で説明する余地が構造的にない |
| D12 | 同じ `DepartmentFilter` の幅が画面ごとに `w-[10rem]`/`w-[11rem]` と微妙に異なる | `src/features/stock-inquiry/StockInquiryPage.tsx:115` vs `src/features/products/ProductListPage.tsx:91` | 毎日行き来する在庫照会⇄商品一覧でレイアウトが微妙にずれ、視線の置き場所が安定しない |
| D13 | クリック可能な行の合図が `cursor-pointer` のみ（矢印・ホバー強調なし） | `src/features/stock-inquiry/components/ProductListTable.tsx:72-78`、`src/components/ui/table.tsx:43-54`(hover:bg-muted/50のみ) | マウス操作に不慣れな利用者に「押せる」ことが伝わりにくい |
| D14 | loading skeleton の形が画面ごとに手書きでバラバラ（`h-8 w-32`、`h-10 w-full`×3等） | `src/features/home/components/SummaryCards.tsx:29-34`、`src/features/products/ProductListPage.tsx:167-171` | 読み込み中の見た目が画面ごとにガタつき、待ち時間の体感が安定しない |
| D15 | `ProductListPage` が7個の同格な制御（検索・部門・廃番・並替え・順序・件数）を text-sm で2段に並列表示 | `src/features/products/ProductListPage.tsx:71-164` | 「何を絞り込む欄か／どう並べる欄か」の階層がなく、非IT利用者には一枚の壁に見える |
| D16 | `App.css`（vite初期テンプレート、Inter font・ダークモード等アプリ実態と無関係な設定）が未使用のまま残存 | `src/App.css:1-113`、`src/main.tsx:1-9`（import なし = どこからも読み込まれていない） | 直接の視覚影響は無いが、保守時に「この設定は生きているか」の混乱源になる |
| D17 | ボタン高さが `h-9`(36px)既定に対し table row は `h-10`(40px)など、操作対象ごとに最小サイズがバラバラ | `src/components/ui/button.tsx:21-30` | クリック目標の大きさが画面要素ごとに変わり、狙いを外しやすい |

*40件上限のうち代表17件を記載。同型（icon size / spacing / badge 系統）の重複は集約して件数を圧縮した。*

---

## 2. 全体規範（この提案が前提とする規範。design doc へ転記可能な粒度）

### 2.1 Token
- 色: 既存 `src/styles/globals.css` の stone ベース + amber primary + destructive/warning/success の soft/border/strong/emphasis 4段は変更せず流用する（すでに WCAG 的に妥当な設計のため置き換えない）。
- 半径: 既存 `--radius: 0.5rem` 系を継続。新設しない。
- アイコン: 3段のみ — `icon-sm`=16px（表内・badge内・補助）／`icon-md`=20px（ボタン・入力欄内・ナビ）／`icon-lg`=28px（ホーム大ボタン・EmptyState・完了画面）。既存の8種類の混在（D4）をこの3段に写像する。
- 影: shadow は `shadow-xs`（既存 button outline のみ）を維持。新設のドロップシャドウは追加しない（フラットな業務画面を維持）。

### 2.2 Layout
- 共通 `<PageShell>` を新設: `p-6 space-y-6`固定。`min-h-screen` は付けない（RootLayout の `<main>` が既に `overflow-auto` でスクロールを持つため冗長、D5 の統一先）。全26画面がこれ1つを使う。
- サイドバーは240px幅を維持するが、ラベルは `whitespace-normal`（折返し許容）に変更し、DisplayScale拡大時に文字が欠けないようにする（D9対応）。
- フォーム系画面は本文カラムに `max-w-[1200px]` を設け、業務テーブル系画面（商品一覧・在庫照会・入出庫履歴等）は現行どおり全幅 + `overflow-x-auto`（`table.tsx:9` を維持）。

### 2.3 Typography（新設スケール、file:line D1/D2 対応）
- `display` 28px/700 — ページ h1（PageHeader タイトル）
- `title` 20px/600 — セクション h2（FormSection 見出し等）
- `body` 16px/400 — 表セル・フォーム値・ボタンラベル・本文全般（**最低ライン**）
- `support` 14px/400 — 補助キャプション・ラベル文言（text-muted-foreground のみに限定）
- `micro` 12px/500 — badge 内文字のみ（本文には使わない、D2対応）

### 2.4 Density
- 業務一覧テーブル（商品/在庫/入出庫履歴/棚卸し等の主要一覧）は行高を `py-3`（実測約48px）に引き上げ、ログ・詳細補助テーブル（操作ログ明細・在庫変動履歴の1行等）は現行 `p-2`(40px) を維持する2段密度制を採る。
- 入力欄・ボタンは共通 `h-10`(40px) を最小値とする（現行 button default h-9=36px から引き上げ、D17対応）。
- クリック可能な行には `hover:bg-accent` の明確な背景変化 + 行右端に展開/選択を示す chevron アイコン(16px)を追加する（D13対応）。

### 2.5 Color 使用ルール
- `primary`(amber-700) は画面あたり主要CTA 1個のみに使う（既存 `Button variant="default"` の使われ方を維持・明文化）。
- 状態（stock/PLU/操作ログ/棚卸し等すべて）は semantic soft/border/strong の3点セット固定パターンのみ許可し、単色塗りつぶしでの意味づけを禁止（既存 `StockStatusBadge` の作法を全画面のルールへ昇格）。
- 色は必ずアイコン+日本語ラベルと同時に使う（色のみの状態伝達は不可、CLAUDE.md/inventory-operator-ui 既定方針と一致）。

### 2.6 状態表示（badge 3種の明文化、D10対応）
1. **状態 badge**: outline + icon + soft背景（例: 在庫切れ/在庫少/通常、PLU未反映、操作ログの有効/取消済み）。
2. **分類 badge**: secondary pill、iconなし（例: 廃番、手動、交換の戻り/渡し）。
3. **強調 badge**: primary/amber emphasis pill（例: 月次ランキング1位、最新バックアップ）。
新規画面はこの3種のいずれかから選び、4種目を作らない。

### 2.7 フィードバック
- 成功: Sonner toast（既存 duration=3000、bottom-right を継続）+ 緑チェック。
- 失敗: toast は「何が失敗したか」+ 可能なら次アクション（既存パターンを踏襲・全画面へ強制）。
- 読み込み中: 共通 `<ListSkeleton rows={n} />` を新設し、手書き Skeleton（D14）を置き換える。
- 空状態: 既存 `EmptyState` component を唯一の様式として継続採用（すでに横展開済みのため変更なし）。

### 2.8 Navigation
- `PageHeader` に `subtitle` と `actions` を同時指定できる4番目の variant を追加し、業務名の後に1行で「何をする画面か」を必ず添える（D11対応、D6の「説明不足」問題をホーム以外にも一貫適用）。
- `DisplayScaleControl` はサイドバー内の位置は維持しつつ、初回起動時のみ吹き出しで1度だけ案内する（D8対応、恒常UIは増やさない）。
- 詳細/記録系画面（各業務記録詳細）には常に「戻る」導線を画面上部に明示する（既存 `ArrowLeft` パターンを全記録詳細画面に強制）。

---

## 3. 画面別適用（`docs/SCREEN_DESIGN.md` §1 使用頻度順、26 UI route。5画面の pathless layout route[`csv-import`/`inventory/receiving`/`return`/`manual-sale`/`disposal`] は Outlet のみで独自UIを持たないため表から除外）

| 使用頻度 | 画面 (route) | 仕事は不変 / 変更点 | 効き目 | 工数 | 根拠 |
|---|---|---|---|---|---|
| 毎日 | ホーム `/` | 仕事不変。ActionButtonに1行説明追加、PageShell化、summary card数値をbody16pxへ | 主要ボタンの誤タップ減、朝一の状況把握が速い | S | §2.3, §2.8, D6 |
| 毎日 | 売上データ取込み `/csv-import/` | 仕事不変。3ステップwizardの見出しをtitle20pxに統一、ListSkeleton化 | ステップの現在地が読み取りやすい | S | §2.3, §2.7 |
| 毎日 | 取込み記録詳細 `/csv-import/records/$importId` | 仕事不変。PageShell化、戻る導線を明示 | 迷子になりにくい | S | §2.2, §2.8 |
| 毎日 | 日次売上レポート `/reports/daily` | 仕事不変。table行密度を業務一覧密度(48px)へ、手動badgeを分類badge規格に統一 | 数字の読み違い減 | M | §2.4, §2.6 |
| 毎日 | 在庫照会 `/stock/` | 仕事不変。行hover+chevron追加、DepartmentFilter幅統一、body16px化 | 「押せる行」が伝わる、隣接画面との統一感 | M | §2.4, D12, D13 |
| 毎日 | 在庫変動履歴 `/stock/$code/movements` | 仕事不変。詳細補助テーブルとして現行密度維持、typography統一のみ | 一貫した見た目 | S | §2.3, §2.4 |
| 毎日 | 月次売上レポート `/reports/monthly` | 仕事不変。ランキングbadgeを強調badge規格に統一、比較色を規範どおり補助化 | 既存の良い設計を全画面基準に格上げ | S | §2.6 |
| 週数回 | 入庫記録 `/inventory/receiving/` | 仕事不変。SearchBarをlive+ボタン併記型へ統一、入力欄h-10化 | 検索操作の学習コスト減 | M | D7, §2.4 |
| 週数回 | 入庫記録詳細 `/inventory/receiving/records/$recordId` | 仕事不変。PageShell化 | 一貫した余白 | S | §2.2 |
| 週数回 | 商品検索・一覧 `/products/` | 仕事不変。フィルタ行を「検索条件」と「並び替え」の2グループに視覚分離、PageHeaderにsubtitle追加 | 制御群の目的が一目でわかる | M | D15, §2.8 |
| 月数回 | 返品・交換 `/inventory/return/` | 仕事不変。SearchBar統一、h-10化、状態badge規格を戻り/渡し表示へ適用 | 操作ミス（レジ戻し済み誤解等）の視認性向上 | L | D7, §2.6 |
| 月数回 | 返品・交換詳細 `/inventory/return/records/$recordId` | 仕事不変。PageShell化 | 一貫した余白 | S | §2.2 |
| 月数回 | 手動販売出庫 `/inventory/manual-sale/` | 仕事不変。SearchBar統一、h-10化 | 検索操作の学習コスト減 | L | D7, §2.4 |
| 月数回 | 手動販売出庫詳細 `/inventory/manual-sale/records/$recordId` | 仕事不変。PageShell化 | 一貫した余白 | S | §2.2 |
| 月数回 | 商品登録 `/products/new` | 仕事不変。FormSection見出しtitle20px、必須ラベル規約を維持しつつbody16px化 | 入力欄の可読性向上 | M | §2.3 |
| 月数回 | 商品修正 `/products/$code/edit` | 仕事不変。同上 | 同上 | M | §2.3 |
| 月数回 | 廃棄・破損 `/inventory/disposal/` | 仕事不変。SearchBar統一、h-10化 | 検索操作の学習コスト減 | L | D7, §2.4 |
| 月数回 | 廃棄・破損詳細 `/inventory/disposal/records/$recordId` | 仕事不変。PageShell化 | 一貫した余白 | S | §2.2 |
| 月数回 | 入出庫履歴 `/inventory/records` | 仕事不変。業務一覧密度48pxへ、状態badge規格統一（有効/取消済み/訂正済み） | 大量記録から目的行を探しやすい | M | §2.4, §2.6 |
| 年数回 | 棚卸し `/stocktake` | 仕事不変。進捗ヘッダのtypography統一、確定AlertDialogの文言配置は現行維持 | 長時間作業での疲労軽減 | M | §2.3 |
| 年数回 | 一括インポート `/products/import` | 仕事不変。3ステップ見出し統一、ListSkeleton化 | ステップの現在地把握 | S | §2.3, §2.7 |
| 年数回 | PLU書出し `/products/plu-export` | 仕事不変。状態badge規格（PLU未反映/保存済み等）へ統一、typography統一 | 既存の日本語主情報設計を全画面基準に格上げ | S | §2.6 |
| 年数回 | 整合性検証 `/settings/integrity` | 仕事不変。typography・PageShell統一のみ | 一貫した見た目 | S | §2.2, §2.3 |
| 年数回 | バックアップ・復元 `/settings/backup` | 仕事不変。最新badgeを強調badge規格へ、AlertDialogの2段確認は現行維持 | 復元操作の重大性が視覚的に一貫して伝わる | M | §2.6 |
| 年数回 | 操作ログ `/settings/logs` | 仕事不変。detail_json展開ボタンの入力欄h-10化、typography統一 | 一貫した見た目 | S | §2.4 |
| 年数回 | 在庫少の基準 `/settings/thresholds` | 仕事不変。1セクションフォームのbody16px化 | 数値入力欄の可読性向上 | S | §2.3 |

---

## 4. Mockup

3画面の静的 HTML を `design-B/mockup-{home,products,stock}.html` に作成済み（外部資源なし、inline CSS、実装の日本語文言を使用、数値はダミー）。各 file 末尾に現行実装との差分コメントを記載。

---

## 5. 採用順序（batch案）

1. **Batch 1（土台・全画面前提）**: §2.1〜§2.4 の token・PageShell・ListSkeleton・icon 3段を実装。個別画面の見た目はまだ変えず基盤のみ。依存: なし。工数目安 M。
2. **Batch 2（発見性・操作一貫性）**: PageHeader 4th variant（D11）、SearchBar 統一（D7）、DepartmentFilter 幅統一（D12）、DisplayScale初回案内（D8）。依存: Batch1のtoken。工数目安 S〜M。
3. **Batch 3（毎日〜週数回の7画面）**: ホーム／売上データ取込み／日次・月次レポート／在庫照会・変動履歴／商品一覧へ Batch1-2 を適用し、業務一覧密度(48px)とbadge規格を反映。依存: Batch1-2。工数目安 M。
4. **Batch 4（月数回の9画面＝入出庫4業務+詳細+商品登録修正+履歴）**: 最もフォームが大きい4画面（返品/手動販売/廃棄/入庫）の検索欄・行密度統一を含む。依存: Batch1-2。工数目安 L。
5. **Batch 5（年数回の7画面）**: 棚卸し・一括インポート・PLU書出し・設定3画面・整合性検証。使用頻度が低いため最後。依存: Batch1-2。工数目安 M。

---

## 6. 現行実装から変える判断（最大15件）

| # | 現状 | 提案 | なぜ非IT高齢利用者に良いか |
|---|------|------|------------------------------|
| 1 | 本文がほぼ全て14px (`table.tsx:12`等) | 本文最低16px、12pxはbadge限定 | 老視での読み取り疲労を一般的な可読性原則に沿って減らす |
| 2 | SearchBarがcommit型/live型を画面ごとに暗黙選択（`SearchBar.tsx:35-185`） | 全画面 live型+検索ボタン併記に統一 | Enterが要る画面/要らない画面の再学習をなくす |
| 3 | root wrapperが`min-h-screen space-y-6`と`space-y-4`の2系統混在 | 共通PageShell(p-6 space-y-6)に統一 | 画面移動時の余白の詰まり方が変わらない |
| 4 | iconサイズ8種混在 | 16/20/28pxの3段に統一 | 同じ重要度の情報が画面によって見た目の強さが変わらない |
| 5 | ホームActionButtonが説明文を持たない（`ActionButton.tsx:58-77`、doc記載と不一致） | 各ボタンに1行説明を追加 | 語感だけで用途が伝わりにくいボタンの誤操作を防ぐ |
| 6 | DisplayScale拡大手段がサイドバー最下部のSelectに埋もれる | 初回起動時のみの案内を追加（常設UIは増やさない） | 唯一の文字拡大手段が発見される |
| 7 | badgeの作法が状態/分類/ランキングで暗黙的にばらばら | 3種のbadge kindを明文化 | 「注意すべき情報」という視覚合図が一貫する |
| 8 | PageHeaderがsubtitleとactionsを排他持ち（`PageHeader.tsx:27-45`） | 両方同時指定できるvariantを追加 | ボタンのある画面でも1行の目的説明を出せる |
| 9 | DepartmentFilter幅が画面ごとに`w-[10rem]`/`w-[11rem]`と微差 | 共通幅トークンに統一 | 隣接画面往来時のわずかなレイアウトずれをなくす |
| 10 | table行高が業務一覧もログ補助テーブルも同じ40px | 業務一覧は48pxへ、補助テーブルは40px維持の2段密度 | 毎日見る一覧を目視で追いやすくする |
| 11 | loading skeletonが画面ごとに手書きでバラバラな形 | 共通ListSkeletonコンポーネント化 | 読み込み中の見た目のガタつきをなくす |
| 12 | クリック可能行の合図がcursor-pointerのみ | hover背景強調+chevron追加 | マウス操作に不慣れな利用者にも「押せる」ことが伝わる |
| 13 | `App.css`が未使用のまま残存（`main.tsx`未import） | 未使用ファイルとして整理対象に記録 | 保守時の「これは生きているか」という混乱を防ぐ（視覚影響は軽微） |
| 14 | サイドバー240px固定、DisplayScale拡大時のラベル折返し未検証 | ラベルをwhitespace-normalにし折返しを許容 | 文字拡大機能と構造的に矛盾しなくなる |
| 15 | ボタン既定36px・table行40px・入力欄別値と操作対象ごとに最小サイズがばらばら | 全操作対象の最小高さを40pxに統一 | クリック目標の大きさが画面要素ごとに変わらず狙いやすい |

---

## 対象外（機能変更を伴うため本提案の範囲外）
- ステータス件数バッジ・count API 新設（在庫照会チップの件数表示）はREQ設計判断であり見せ方の範囲を超えるため対象外。
- cm/m表示切替、部門別フィルタのDTO拡張（月次ランキング）等、doc記載のBIZ/BE拡張待ち事項は範囲外。
