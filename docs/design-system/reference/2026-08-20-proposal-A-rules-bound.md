# 全画面デザイン改善提案（案A）

読取り根拠: `docs/design-system/00-04-foundations.md` 系4本 / `docs/SCREEN_DESIGN.md` / `docs/UI_TECH_STACK.md` / `docs/quality/review-checklist.md` / `.agents/skills/inventory-operator-ui/SKILL.md` と `src/` 全体（routes 33 / features 136 / components 54）を実読。機能・データ・操作の意味は変更しない前提で、見せ方のみを対象とする。

---

## 1. 診断（非IT高齢利用者への影響が大きい順、最大40件）

### A. 全画面横断（1件の修正が全画面に波及、最優先）

1. **業務テーブルの本文文字が全画面で 14px しかない**。`src/components/ui/table.tsx:12` の `<table>` root に `text-sm` が固定され、`TableHead`（`table.tsx:56-67`）/`TableCell`（`table.tsx:69-80`）はサイズを上書きしない。foundations は body=16px を「本文、テーブルセル」用途と明記（`docs/design-system/00-foundations.md:75`）しており、商品一覧・在庫照会・売上明細・入出庫履歴など全業務テーブルがこの規範より1段小さい文字で表示されている。DSR-13（`01-decision-rules.md:223-239`）が想定する「表示スケールで解く」対象そのものが、そもそも規範値を満たしていない。1箇所の修正で全画面に効く最大レバレッジ項目。
2. **成功/注意バナー4箇所が未定義トークンを参照し無色化している**。`src/features/home/HomePage.tsx:63`、`src/features/backup-restore/BackupRestorePage.tsx:357`、`src/features/plu-export/PluExportPage.tsx:517,563` は `text-success-strong border-success bg-success-soft`、`src/features/plu-export/PluExportPage.tsx:358` は `border-info bg-info-soft text-info-strong` を使うが、`src/styles/globals.css` の `@theme inline`（8-50行）に `--color-success-strong` / `--color-info` 系は一切登録がない。Tailwind 4 は未登録 `--color-*` からユーティリティを生成しないため、これらの class は無効化し Alert は無色の `default` variant にフォールバックする。よりによって「バックアップから復元しました」「PLUファイル保存後に手動確認が必要です」という、最も誤読を避けたい確認バナーで発生している。
3. **ホーム画面に amber（Primary）要素が実質ゼロ**。`ActionButton.tsx:69-76` は全 11 ボタンを `variant="outline"` 固定で描画し、`QuickActionGrid` / `InventoryActionGrid` に個別強調 class もない（`src/features/home/components/QuickActionGrid.tsx` 全文、`InventoryActionGrid.tsx` 全文で確認）。一方 `docs/SCREEN_DESIGN.md:93` は「『売上データ取込み』は毎日の最重要操作なので青枠で強調」と明記しており、最も来訪頻度の高い画面が DSR-01「1画面1 primary」の主張と逆に「0 primary」になっている。
4. **セクション見出しの文字サイズが画面ごとに2系統に分裂**。`text-lg font-semibold`（18px、foundations上はh3=「カード内見出し」用途）を使う画面: `receiving/ReceivingPage.tsx:352,633`、`return-exchange/ReturnExchangePage.tsx:500,919`、`disposal/DisposalPage.tsx:300,344,642`、`manual-sale/ManualSalePage.tsx:341,405,685`、`backup-restore/BackupRestorePage.tsx:569`、`daily-sales/DailySalesPage.tsx:164`、`monthly-sales/MonthlySalesPage.tsx:155`、`products/import/ProductImportPreview.tsx:241`、`inventory-records/*RecordDetailPage.tsx`（5ファイル、各2箇所）。対して `text-xl font-semibold`（20px、正しいh2）を使う画面: `integrity-check/IntegrityCheckPage.tsx:288`、`plu-export/PluExportPage.tsx:576`、`stocktake/StocktakePage.tsx:372`。カタログ④の canonical skeleton（`docs/design-system/02-component-catalog.md:211`）は `text-xl` を h2 の正典としており、同じ役割の見出しが画面によって1段小さく見える。
5. **一覧画面のフィルタバーが「枠あり/枠なし」で二分**。`receiving/ReceivingPage.tsx:351`, `return-exchange/ReturnExchangePage.tsx:499`, `manual-sale/ManualSalePage.tsx:404`, `disposal/DisposalPage.tsx:343,363`, `inventory-records/InventoryRecordsPage.tsx:149`, `operation-logs/OperationLogsPage.tsx:330`, `daily-sales/DailySalesPage.tsx:177` は検索/フィルタ域を `rounded-md border p-4` のカードで囲むが、最頻出の商品検索・一覧と在庫照会は `products/ProductListPage.tsx:71,109` / `stock-inquiry/StockInquiryPage.tsx:90` のように素の `flex flex-wrap` で枠なし表示。同じ役割の要素が画面によって「カード」か「浮遊コントロール」かに分かれる。
6. **ページ root の縦方向リズムが無根拠に3系統**。`min-h-screen space-y-6 p-6`（10画面: home / csv-import / daily-sales / monthly-sales / stocktake / threshold-settings / backup-restore / integrity-check 等）、`space-y-5 p-6`（7画面: receiving / return-exchange / manual-sale / disposal / plu-export / operation-logs / inventory-records一覧）、`space-y-4 p-6`（8画面: products系 / stock-inquiry / stock-movements / inventory-records詳細4画面）の3値が併存し、foundations のスペーシング6段（`00-foundations.md:85-98`）はどれをページ root に使うか定めていない。

### B. 画面固有（横断規範があっても局所実装が外れている箇所）

7. **売上データ取込みのタブが構造非対称**。`docs/SCREEN_DESIGN.md:100` は日報取込み（既定タブ、毎日使用）を「3ステップウィザード形式」と明記するが、`src/features/daily-report-import/DailyReportImportPage.tsx` にステップ表示は一切なく（全文確認）、逆に使用頻度の低い Z004 タブ側 `src/features/csv-import/CsvImportPage.tsx:75` は `<StepIndicator currentStep={currentStep} />` を持つ。毎日触るタブに進捗の目印がなく、たまに触るタブにだけある。
8. **PLU書出しの「未反映を外す」操作が唯一の破壊的でない重要操作として amber 以外の視覚重み付けを欠く**（`src/features/plu-export/PluExportPage.tsx` 全文確認、576行の見出しは正しいh2だが、確定操作ボタンの強調が他の保存系ボタンと区別されにくい）。詳細画面差分のため mockup 対象外だが batch 2 で本文と合わせて確認する。
9. **在庫照会の状態列幅 `w-24`（`stock-inquiry/components/ProductListTable.tsx:61`）は3種のバッジ文言中最長「在庫切れ」+アイコンでほぼ埋まり、将来ラベル追加の余裕がない**。現状は壊れていないが、密度上の余白ゼロ。
10. **商品一覧の「並び替え」「表示件数」ラベルが `text-sm text-muted-foreground` の可視ラベル付き（`ProductListPage.tsx:111,142`）だが、検索欄自体は live 型のため可視ラベルなし（catalog⑨の仕様どおり）** — 仕様上意図的だが、同じフィルタ行内で「ラベルあり」「ラベルなし」が混在する見え方になり、視認上の統一感が僅かに崩れる（catalog⑨の設計は正しい前提での見た目上の課題）。
11. **ホーム3グリッドの見出し `text-lg font-medium`（`HomePage.tsx:86,91,96`）はA-4で指摘した h2/h3 混在とは別に、`font-medium`（500）で他画面の `font-semibold`（600）と weight も異なる** — 同一階層の見出しが太さでも割れている。

### C. 補助的（軽微、参考として記載）

12. アイコンサイズが 16/20/24px の3段運用（`00-foundations.md:102-110`）に対し、shadcn primitive 内部で `size-3`（12px）が使われる（`src/components/ui/badge.tsx:8`、`src/components/ui/button.tsx:23,27`）。primitive 内部の chrome であり operator への実害は小さいが token 監査として記録する。
13. 見出し隣接アイコンが `size-5`（20px、`integrity-check/IntegrityCheckPage.tsx:248`、`plu-export/PluExportPage.tsx:577`、`products/import/ProductImportPreview.tsx:237`、`products/ProductImportPage.tsx:80`）で、icon-size 表（`00-foundations.md:102-110`）の 24px（画面タイトル横）/20px（テーブルセル）どちらの用途にも明記がない。
14. `src/App.css`（Vite/Tauri テンプレート残骸: ダークモード media query、`#646cff` リンク色、`Inter` フォント）は `src/main.tsx:6` から import されておらず死んでいるが、リポジトリに残存し「もう一つのデザイン源」に見える。ダークモード非採用方針（`docs/UI_TECH_STACK.md:587-599`）と矛盾する内容を含むため、将来の誤 import リスクとして記録する。
15. `StatusChips.tsx:5-6` のコメントが `rose/amber` という旧トークン名を参照しており、実装は既に `red`/`warning` 系トークンへ移行済み（PR-C）。コメントのみの drift。

---

## 2. 全体規範の提案

各項目は既存規範との関係を明記する: **[準拠]** 既存どおりでよい / **[拡張]** 既存規範を具体化・補完 / **[変更提案]** 既存の実装または軽微な記述を修正 / **[欠落]** 規範文書に記載がなく新設が必要。

### token
- **[変更提案]** `success-strong` / `info` 系トークンを `00-foundations.md` の色テーブルへ正式追加し `globals.css` に実装するか、既存の `success-emphasis` / `warning-*` に統一して未定義参照を除去する（診断#2）。新規 `info` ファミリを増やすとトークン数が肥大化するため、推奨は「情報系バナーは `warning` トーンへ統合」（PLU書出しの案内文は既に注意喚起の性質が強く warning が意味的に近い）。
- **[準拠]** stone ベース+セマンティックトークンの構成自体は健全（PR-Cで生Tailwind色混入は既に0件、実測確認済み）。

### layout
- **[欠落]** ページ root の spacing（診断#6）を規定する記述が `00-foundations.md` に無い。「情報密度が高い一覧/明細画面は `space-y-4`、業務入力ウィザードや複数セクションを持つ画面は `space-y-6`」のように用途別に1つへ収斂させる基準を新設する。
- **[拡張]** フィルタ/検索域のカード化（診断#5）を「一覧画面の検索・フィルタ行は `rounded-md border p-4` で統一する」とカタログ⑨に明記する。現状は「検索欄・フィルタ単体」のトークンは定義済みだが「検索行全体の器」の規定がない。

### typography
- **[変更提案]** セクション見出し（診断#4）を全画面 `text-xl font-semibold`（h2, 20px）へ統一する。カタログ④の skeleton は既に正しい値を示しており、実装側が追随していないだけなので規範自体の変更は不要、実装是正のみで足りる。
- **[変更提案]** テーブル本文（診断#1）を 16px に是正する。`table.tsx` の root class から `text-sm` を外し、必要なら `TableHead` のみ `text-sm`（見出し語は短く許容範囲）を残し `TableCell` は無指定（親 `<table>` の 16px 継承）にする。影響範囲が全画面のため、後述の採用順序で最優先バッチに置く。

### density
- **[準拠]** japanese-webdesign 由来の「業務データは密度高め」方針（`03-philosophy.md:54-66`）は日次売上8列などで妥当に運用されている。テーブル文字サイズの是正（16px化）は密度を下げる方向ではなく、行高 `h-10`/`p-2` は変えずに文字だけ上げるため、密度方針とは非対立。

### color
- **[準拠]** DSR-08（色のみで意味を伝えない）は在庫状態バッジ・増減表示で実装済み、逸脱の再混入なし（実測: 生Tailwind色 grep 0件）。
- **[変更提案]** ホームの primary 不在（診断#3）を是正する。「1画面に primary は1個」の原則自体は維持しつつ、home のみ「最重要導線ボタン1個を `variant="default"`（primary色）にする」例外を DSR-01 に追記する（現行 DSR-01 は outline 降格の話しかしておらず、「グリッド内の1ボタンを昇格させる」パターンが未記載）。

### 状態表示
- **[準拠]** 在庫状態・増減・記録元は既にバッジ+日本語+アイコンの3点セットで統一済み。追加提案なし。

### フィードバック
- **[変更提案]** 診断#2のトークン欠落を修正すれば、Toast/Alert のフィードバック体系自体（DSR-03の3階層）は既に妥当。構造変更は不要、値の存在保証だけが要る。

### navigation
- **[拡張]** PageHeader の subtitle（診断#5）を「使用頻度が低い・操作を伴う画面ほど1文説明を必須にする」という基準として `02-component-catalog.md`①に追記する。現行は「主動線がなければ subtitle 省略可」という設計だが、実際の欠落は使用頻度と逆相関しており、基準の言語化が要る。

---

## 3. 画面別適用（33 route、`docs/SCREEN_DESIGN.md` §1 の使用頻度順）

仕事は全画面で不変。凡例: 工数 S=半日以内 / M=1〜2日 / L=3日以上（横断規範の初回適用込み）。

| 画面（route） | 変更点 | 非IT利用者への効き目 | 工数 | 根拠 |
|---|---|---|---|---|
| ホーム `index.tsx` | テーブル16px化は対象外（テーブルなし）。CSVインポートボタンのみ `variant="default"` へ昇格、3グリッド見出しを `text-xl font-semibold` に統一 | 「今日やること」が一目で分かる、迷わず最初の1手が押せる | S | §2 color/typography |
| 売上データ取込み `csv-import/index.tsx` | 日報タブに StepIndicator を追加、テーブル16px化（プレビュー表） | 3ステップの現在地が毎日わかる | M | 診断#7 |
| 日次売上レポート `reports/daily.tsx` | 明細テーブル16px化、`text-lg`見出しを`text-xl`へ | 商品別明細の金額・数量が読みやすい | S | 診断#1/#4 |
| 在庫照会 `stock/index.tsx` | フィルタ行をカード化、テーブル16px化 | 検索と一覧が同じ「枠」として見え迷わない | S | 診断#1/#5 |
| 月次売上レポート `reports/monthly.tsx` | 部門テーブル/ランキング16px化、`text-lg`見出しを`text-xl`へ | 構成比・順位の数字が読みやすい | S | 診断#1/#4 |
| 入庫記録 `inventory/receiving.tsx` | 明細/直近テーブル16px化、見出し`text-xl`統一 | 数量・原価の入力確認が読みやすい | S | 診断#1/#4 |
| 商品検索・一覧 `products/index.tsx` | フィルタ行カード化、テーブル16px化 | 主要業務入口の一覧が最も見やすくなる | S | 診断#1/#5 |
| 返品・交換 `inventory/return.tsx` | 明細/直近テーブル16px化、見出し統一 | 戻り/渡しの数量が読みやすい | S | 診断#1/#4 |
| 手動販売出庫 `inventory/manual-sale.tsx` | 同上 | 販売内容確認が読みやすい | S | 診断#1/#4 |
| 商品登録 `products/new.tsx` | フォーム自体は4セクション適合済み、変更なし（テーブルなし） | 現状維持で問題なし | — | §2 準拠 |
| 商品修正 `products/$code.edit.tsx` | 同上 | 現状維持で問題なし | — | §2 準拠 |
| 廃棄・破損 `inventory/disposal.tsx` | 明細/直近テーブル16px化、見出し統一 | ロス内容の確認が読みやすい | S | 診断#1/#4 |
| 入出庫履歴 `inventory/records.tsx` | 一覧テーブル16px化（フィルタは既にカード化済み） | 過去記録の検索結果が読みやすい | S | 診断#1 |
| 入庫記録詳細 `inventory/receiving.records.$recordId.tsx` | 明細テーブル16px化、`text-lg`見出しを`text-xl`へ | 明細確認が読みやすい | S | 診断#1/#4 |
| 返品記録詳細 `inventory/return.records.$recordId.tsx` | 同上 | 同上 | S | 診断#1/#4 |
| 手動販売記録詳細 `inventory/manual-sale.records.$recordId.tsx` | 同上 | 同上 | S | 診断#1/#4 |
| 廃棄記録詳細 `inventory/disposal/records/$recordId.tsx` | 同上 | 同上 | S | 診断#1/#4 |
| CSV取込み記録詳細 `csv-import.records.$importId.tsx` | 同上 | 同上 | S | 診断#1/#4 |
| 棚卸し `stocktake.tsx` | 一覧テーブル16px化（見出しは既に`text-xl`で適合） | 部門絞り込み結果が読みやすい | S | 診断#1 |
| 一括インポート `products/import.tsx` | プレビューテーブル16px化、`text-lg`見出しを`text-xl`へ | 新規/エラー/重複行の見分けが読みやすい | S | 診断#1/#4 |
| PLU書出し `products/plu-export.tsx` | バナーの `info` トークン修正（診断#2）を最優先反映 | 「手動確認が必要」という最重要注意が正しく色で目立つ | S | 診断#2 |
| 在庫整合性検証 `settings/integrity.tsx` | 差異テーブル16px化（見出しは既に適合） | 差異の数値が読みやすい | S | 診断#1 |
| バックアップ・復元 `settings/backup.tsx` | 一覧テーブル16px化、`success`トークン修正（診断#2）、見出し統一 | 「復元しました」が正しく緑で見え、控え一覧の日時が読みやすい | S | 診断#1/#2/#4 |
| 操作ログ `settings/logs.tsx` | 一覧テーブル16px化（フィルタは既にカード化済み） | ログの日時・種別が読みやすい | S | 診断#1 |
| 設定（在庫少の基準） `settings/thresholds.tsx` | 変更なし（1セクションフォームで適合済み、テーブルなし） | 現状維持で問題なし | — | §2 準拠 |
| 在庫変動履歴 `stock/$code.movements.tsx` | 一覧テーブル16px化 | 増減履歴の数値が読みやすい | S | 診断#1 |

（一括のテーブル16px化・見出しサイズ統一は横断規範修正のバッチ1で全画面へ一度に及ぶため、上表の「工数S」は個別画面の追加調整分のみを指す。詳細は§5参照。）

---

## 4. mockup

`design-A/mockup-home.html` / `design-A/mockup-products.html` / `design-A/mockup-stock.html` に、上記診断#1〜#6の是正を反映した静的HTMLを1ファイルずつ作成した（各ファイル冒頭に現行との差分注記あり）。現行の stone パレット・spacing・コンポーネント形状は維持し、以下のみ変更している。
- テーブル本文 14px→16px
- セクション見出し 18px→20px（該当箇所）
- ホームの主動線ボタンのみ primary（amber）色に昇格
- 商品一覧・在庫照会のフィルタ行をカード化
- ホームの成功バナーを正しいトークン（success-emphasis 系）で描画

---

## 5. 採用順序（batch案）

1. **batch 1（半日、最高レバレッジ）**: `src/components/ui/table.tsx` の `text-sm` 除去（診断#1、全テーブル画面へ自動波及）+ `globals.css` の success/info トークン追加または PLU/backup/home 側の class 差し替え（診断#2）。依存なし、即着手可能。
2. **batch 2（半日）**: ホームの primary 昇格（診断#3）+ 3グリッド見出し統一（診断#11）。batch 1 と独立。
3. **batch 3（1日）**: 全画面のセクション見出し `text-lg`→`text-xl` 一括置換（診断#4、grep対象は本書診断#4に列挙済みの17ファイル）。batch 1 と独立して着手可。
4. **batch 4（1日）**: 商品一覧・在庫照会のフィルタ行カード化（診断#5）+ ページ root spacing の3系統統一（診断#6、規範の言語化が先行条件）。
5. **batch 5（半日、任意）**: 日報取込みタブへの StepIndicator 追加（診断#7）。UI-07 の状態機械に触れるため他バッチより慎重な回帰確認が要る。

依存関係: batch 1・2・3 は互いに独立し並行着手可能。batch 4 は §2「layout」規範の言語化（本書提案）が先に固まっている必要がある。batch 5 は最後（状態機械変更のリスクが最も高いため）。

---

## 6. 規範へのフィードバック（既存 design doc / DSR / checklist の不足・矛盾、最大10件）

1. `docs/design-system/00-foundations.md:75` の body=16px 規定が `src/components/ui/table.tsx:12` のテーブル実装に反映されていない。doc-consistency の機械チェック対象にテーブルprimitiveのフォントサイズ検査がない（診断#1）。
2. `docs/design-system/00-foundations.md` の色テーブル（8-40行）に `success-strong` / `info` 系が定義されないまま、feature側で4箇所使用されている（診断#2）。トークン新設時の「使用前に foundations へ登録」を徹底するチェック項目が review-checklist カテゴリ9に無い。
3. `docs/design-system/01-decision-rules.md` DSR-01（19-29行）は「複数CTAをoutlineへ降格する」規定のみで、「0 primaryになった画面をどう扱うか」の逆方向ケースが未記載（診断#3/#11）。
4. `docs/design-system/00-foundations.md` のスペーシング節（85-98行）はトークン一覧のみで、ページroot（複数セクションを束ねる最上位div）にどの段を使うかの選定基準が無い（診断#6）。
5. `docs/design-system/02-component-catalog.md` ⑨検索+フィルタ（520-577行）は検索欄・フィルタ単体のトークンのみ規定し、「検索行全体を囲む器（カード化するか否か）」の規定が無い（診断#5）。
6. `docs/SCREEN_DESIGN.md:93` の「青枠で強調」という設計意図が、実装（`ActionButton.tsx`）にトレースされていない。設計判断ログと実装の対応関係を確認する機械/レビュー手段が無い。
7. `docs/design-system/02-component-catalog.md` ①ページヘッダ（24-61行）は subtitle を「省略可」とするのみで、いつ必須にするかの基準が無い（診断#5）。
8. `docs/design-system/00-foundations.md` のアイコンサイズ表（102-110行）に「見出し隣接アイコン」の用途区分が無く、実装が20px/24pxのどちらを選ぶべきか判断できない（診断#13）。
9. `docs/design-system/01-decision-rules.md` DSR-09（167-176行）はフォームセクション見出しの記述はあるが、フォーム以外の画面（結果表示・明細・直近実績）のセクション見出しサイズを明記しておらず、`text-lg`/`text-xl`の混在を止められていない（診断#4）。
10. `src/App.css` のような未importの旧テンプレートCSSを削除・アーカイブする棚卸しルールが `docs/UI_TECH_STACK.md` に無い（診断#14）。ダークモード非採用方針と矛盾する内容が repo に残存するリスクを止める仕組みがない。
