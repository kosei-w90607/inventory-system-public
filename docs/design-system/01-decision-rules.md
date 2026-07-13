# 判断ルール集（DSR-01〜15）

> **親文書**: [README.md](README.md)
> **責務**: 実装時の迷いを一意に解消するルール集。「どちらを使うか」「いつ使うか」を DSR 番号で参照できる。

---

## 読み方

各 DSR は次の 4 部構成で書く。

- **ルール**: 守るべき内容を 1-2 文の断定形で示す
- **Why**: なぜそうするか。利用者前提（非 IT・高齢・赤黄色覚困難）と参照哲学（[03-philosophy.md](03-philosophy.md)）に接地させる
- **判定フロー / 具体例**: 迷ったときに辿るフロー、または実装上の実例
- **関連**: 対応する [02-component-catalog.md](02-component-catalog.md) のパターン、および `docs/quality/review-checklist.md` カテゴリ 9 の対応項目

---

## DSR-01 主動線 CTA（1 画面 1 primary）

**ルール**: 1 画面の主動線（Primary button）は 1 個に絞る。Primary は amber 系（`--primary`）1 個だけにし、それ以外の CTA は outline / ghost へ降格する。

**Why**: refactoring-ui §1「Not everything can be important」のとおり、すべてを強調するとヒエラルキーが崩れる。非 IT の利用者は「いま何を押せばよいか」を即断したい。Primary が複数あると、どれが本筋の操作か判断に迷う。GOV.UK「Do less」の精神で、1 画面の本筋操作を 1 つに定める。

**判定フロー / 具体例**: 商品一覧の主動線は「商品登録」1 個（Primary）。一覧へ戻る・修正などは outline。フォーム画面の主動線は「登録する / 保存する」1 個で、「一覧へ戻る」は outline に降格する。

**関連**: パターン①ページヘッダ / ④フォームセクション。review-checklist カテゴリ 9 対応（既存画面の共通レイアウト継承・別アプリ化防止）。

---

## DSR-02 Tabs vs SegmentedControl 判定フロー

**ルール**: 2 択の切替は SegmentedControl を使い、3 つ以上または内容が異質なら Tabs を使う。route 駆動の 2 択は SegmentedControl + `<Link>`、ローカルの view mode 切替は SegmentedControl + button group にする。

**Why**: 二択切替を画面ごとに別の見た目で組むと、Fluent 2「Coherent」（画面間で配置が一貫）が崩れ、利用者が同じ操作を別物と認識する。SegmentedControl は押しボタン状の濃い外枠を避けた中庸の active で統一し、視覚言語のばらつきを防ぐ。

**判定フロー / 具体例**:

```
切替対象は 2 択か？
├─ Yes → route 駆動（URL が変わる）か？
│        ├─ Yes（例: 日次/月次） → SegmentedControl + <Link>
│        └─ No（例: 商品別/部門別の view mode） → SegmentedControl + button group（aria-pressed）
└─ No（3 つ以上 or 内容が異質） → Tabs
```

実例: 売上データ取込み画面（`CsvImportPage.tsx`、PR #125）は「日報取込み / 商品別CSV取込み（Z004）」の 2 択だが、CMD（CMD-12 vs CMD-07）・保存先テーブル（`daily_report_imports` 系 vs `csv_imports` 系）・結果表示が全く異なるため「内容が異質」に該当し Tabs を採用した（UI-07-D9: 日報と Z004 を同一テーブル・同一結果として表示しない）。既定タブは業務上の主動線（`defaultValue="daily-report"`）にする。

**関連**: パターン⑤SegmentedControl。review-checklist カテゴリ 9 対応（共通レイアウト継承・active state が色以外でも判別可能か）。

---

## DSR-03 Toast vs Alert 使い分け基準

**ルール**: 一過性の操作結果は toast、画面に居座る回復導線つきの状態は inline Alert にする。Alert は置き場所で役割を分ける: **画面上部の Alert 帯はデータ安全系（取込み済み重複・上書き確認・取得失敗など「進めると危ない / 進めない」状態）の専用スロット**とし、入力検証エラー（選択ミス・形式不備）は**発生源直近のインライン 1 スロット**（毎試行置換・成功でクリア）に置く。toast は両者と併用してよい（即時フィードバック）。

**Why**: ux-principles #1（System status visibility）と #9（エラーは原因 + 解決策）に従う。「保存しました」のような結果は流れて消えてよいが、取得失敗のように利用者が次の手を打つ必要がある状態は、画面に残して回復導線を併置しないと、高齢の利用者がメッセージを見落として手が止まる。さらに、上部 Alert 帯に入力検証エラーまで流し込むと「危ない状態」の警告が日常の入力ミスに埋もれ、データ安全系の警告の重みが失われる（operator 向け注意情報は視線が最初に通る場所に集約する原則と同根）。入力検証エラーは発生源の直近に出す方が、非 IT の利用者がどの操作をやり直せばよいか迷わない。

**判定フロー / 具体例**:

```
利用者の追加操作が要るか？
├─ No（完了通知だけ） → toast（Sonner、自動消去）
└─ Yes（回復・再試行が要る） → inline Alert + 回復ボタン
         ├─ データ安全系（重複ブロック・上書き確認・取得失敗）
         │    → 画面上部の Alert 帯（destructive / warning トーン）
         └─ 入力検証（選択ミス・形式不備）
              → 発生源直近のインライン 1 スロット（毎試行置換・成功でクリア）+ toast 併用可
```

実例: 商品保存成功は `toast.success`。商品一覧の取得失敗は `Alert variant="destructive"`。サマリカードの取得失敗は Alert + 再試行 — 置き場所はパターン②の 3 パターン規約に従う（独立 query = カード内 / 同一系 query が束ねるカード群 = page-level Alert。daily/monthly `SummaryCardsBar` が後者の canonical variant）。

3 階層の実例（日報取込み、PR #125）: 上部 Alert 帯は `AlreadyImported`（destructive）/ `OverwriteRequired`（warning トーン）のデータ安全系専用。ファイル選択の検証エラーは選択ボタン直下の `SelectionErrorMessage`（`role="alert"`、パターン⑥のインライン 1 スロット）で毎回の選択試行で置換・成功で消去し、`toast.error` を併用する（`DailyReportImportPage.tsx`）。

**状態遷移後の可視性**: 保存・確定・取消などの状態遷移直後は `scrollPageToTop()`（`src/lib/page-scroll.ts`）を呼び、ページ上部の結果表示を利用者に確実に見せる（UI-08-D6「下部に出すと利用者が見落とす」。入庫 / 返品・交換 / 手動販売 / 廃棄 / PLU 書出しの 5 画面で使用済みの共有 util）。

**関連**: パターン⑥空状態・エラー / ⑦Toast / ⑧Dialog。review-checklist カテゴリ 9 対応（状態を変える control に recovery path が残っているか）。

---

## DSR-04 ステータスバッジ: 状態列 vs セル内 badge

**ルール**: 一覧で状態が主情報なら独立した「状態列」を置く。行の識別が主で状態が従なら、商品名セル内に `Badge` を置き、行全体を `text-muted-foreground` で減衰させる。

**Why**: IBM Carbon のデータテーブル設計と japanese-webdesign の「一度に把握したい」期待値の両立。状態列はスキャンしやすいが、列を増やすと商品名が読みにくくなる。商品名の可読性（非 IT 利用者の一次情報）を壊してまで状態列を足さない。

**判定フロー / 具体例**:

```
状態は一覧の主情報か？
├─ Yes（在庫照会の在庫状態等）  → 状態列を追加（StockStatusBadge）
└─ No（廃番フラグ等の従的情報） → 商品名セル内 Badge + 行 text-muted-foreground
```

実例: 在庫照会は「状態」列に `在庫切れ` / `在庫少` バッジ（`ProductListTable.tsx`）。商品一覧の廃番は商品名セル内の `廃番` Badge + 行減衰（`ProductTable.tsx`、PR #95 で状態列方針から変更）。

**関連**: パターン③テーブル / ⑬ステータスバッジ。review-checklist カテゴリ 9 対応（テーブル密度・幅・truncate が主要値の理解を壊していないか）。

---

## DSR-05 read-only vs disabled の使い分け

**ルール**: 値を見せて編集だけ不能にするなら `readOnly` + `bg-muted` を使う。操作そのものを不能化するなら `disabled` を使う。

**Why**: 両者は利用者への意味が違う。`readOnly` は「これは確定値で、見て確認するもの」、`disabled` は「いまは操作できない」。混同すると、利用者が「なぜ触れないのか」を誤解する。Fluent 2「Relevant」（予測通り動く）の観点で、見た目と挙動を一致させる。

**判定フロー / 具体例**:

```
値を見せたいか？
├─ Yes（確認用に表示、編集不可） → readOnly + bg-muted
└─ No（操作経路ごと閉じる）       → disabled
```

実例: 編集時の商品コード・JAN・現在庫は `readOnly` + `bg-muted`（値は見せる）。編集時の数量単位 select は `disabled`（選択操作自体を止める）。

**関連**: パターン④フォームセクション。review-checklist カテゴリ 9 対応（主要テキスト・状態が読める設計か）。

---

## DSR-06 必須表示の統一パターン

**ルール**: 必須項目は色だけで示さず、ラベルに「（必須）」と明記する。

**Why**: WCAG 1.4.1（色のみで情報を伝えない）。赤色のアスタリスクだけで必須を示すと、赤を識別しにくい利用者には伝わらない。日本語テキストの「（必須）」なら誰でも読める。Polaris の語彙統一の方針で、全フォームで同じ表記に揃える。

**判定フロー / 具体例**: 必須フィールドのラベルは「商品名（必須）」「部門（必須）」「売価（必須）」のように書く。任意項目には何も付けない（または明示が要るなら「任意」）。アスタリスクや色の赤化は単独で必須シグナルにしない。

**関連**: パターン④フォームセクション。review-checklist カテゴリ 9 対応（業務ステータスが色だけで符号化されていないか）。

---

## DSR-07 確認ダイアログを出す境界

**ルール**: 破壊的・不可逆な操作の直前にのみ確認ダイアログを挟む。復帰・再表示など可逆な操作は確認なしで直接実行する。

**Why**: ux-principles #5（Error prevention）と GOV.UK「Do less」の両立。重要操作には確認が要るが、可逆操作にまで確認を挟むと、毎日使う業務で操作が重くなり、利用者が確認を読まず反射的に押すようになる。確認を「本当に効くところ」に絞ることで、確認の重みを保つ。

**判定フロー / 具体例**:

```
その操作は破壊的・不可逆か？
├─ Yes（廃番化・上書き取込み等）    → 確認ダイアログ（AlertDialog）
└─ No（表示に戻す・再表示等）       → 直接実行
```

実例: 「廃番にする」は確認あり（`DiscontinueConfirmDialog`）。「表示に戻す」は直接実行。

**関連**: パターン⑧Dialog/確認。review-checklist カテゴリ 9 対応（状態を変える control に recovery path が残っているか）。

---

## DSR-08 semantic 色のみで意味を伝えない

**ルール**: 色は `success` / `warning` / `destructive` 系のセマンティックトークンで当て、`emerald-` / `rose-` などの生 Tailwind 色 class を `src/features/**` に直書きしない。色は二次シグナルとし、意味は日本語テキストとアイコンが一次で担う。

**Why**: WCAG 1.4.1 と inventory-operator-ui の中核ルール（色相だけで業務状態を符号化しない）。赤黄を識別しにくい利用者でも、テキストとアイコン形状で意味が読める必要がある。生 Tailwind 色を直書きするとトークン体系から外れ、`00-foundations.md` のパレットと不整合になる。palette 外色の直書きは eslint `no-restricted-syntax`（PR-C 導入）が `src/features/**` + `src/components/patterns/**` で機械検出する。

**判定フロー / 具体例**: 在庫状態は `Badge` + `lucide` アイコン（`CircleAlert` / `TriangleAlert`）+ 日本語ラベル（`在庫切れ` / `在庫少`）で示す。比較のプラス / マイナスも記号 + テキストを併記する。

> **是正済み（PR-C）**: 旧逸脱（`StockStatusBadge.tsx` / `ProductListTable.tsx` / `StockDetailContent.tsx` / `SummaryCardsBar.tsx` の `rose-` / `amber-` / `emerald-` 直書き）は semantic shade token（`00-foundations.md`）へ移行済み。rose→red / emerald→green は意図的色補正として L3 承認。再混入は eslint palette 外色 ban と doc-consistency DS3（token HEX 整合）が機械防止する。

**関連**: パターン⑬ステータスバッジ / ⑥空状態・エラー / ⑦Toast。review-checklist カテゴリ 9 対応（業務ステータスが色だけで符号化されていないか / 色トークン継承）。

---

## DSR-09 Form セクション分割の基準

**ルール**: フォームは意味境界でセクション分割し、各セクションに見出し + 1 行説明 + `Separator` を付ける。セクションが 4 つ以上になったら構成を再考する。

**Why**: IBM Carbon の Progressive disclosure と refactoring-ui のヒエラルキー。長いフォームを 1 枚で見せると、高齢の利用者がどこまで入力したか見失う。意味のまとまり（識別 / 分類 / 価格 / 在庫）で区切ると、入力の見当がつく。セクションが増えすぎる場合は、その画面に項目を詰めすぎていないか（GOV.UK「Do less」）を疑う。

**判定フロー / 具体例**: 商品フォームは「商品の識別 / 分類と取引先 / 価格 / 在庫」の 4 セクション。各セクションは `<h2>` 見出し + `text-muted-foreground` の 1 行説明 + `Separator`。5 セクション以上になりそうなら、項目の要否や画面分割を先に検討する。

**関連**: パターン④フォームセクション。review-checklist カテゴリ 9 対応（共通レイアウト・typography 継承）。

---

## DSR-10 フィルタ候補のソース選定

**ルール**: select / filter の候補が master 全件由来か filtered result 由来かを明示的に決める。filtered result から候補を作り、現在の選択値が候補から消える縮退は禁止する。

**Why**: inventory-operator-ui のルール。絞込み結果から候補を再生成すると、選択中の値だけが候補に残り、他の値へ直接切り替えられなくなる。利用者は「フィルタを外す」操作を知らないことが多く、行き止まりになる。master 全件を候補にすれば、いつでも他候補へ移れる。

**判定フロー / 具体例**:

```
filter 候補はどこから作るか？
├─ master 全件（推奨） → listDepartments の全件を SelectItem に展開
└─ filtered result      → 選択値が候補から消えないことを証明できなければ採用しない
```

実例: 部門フィルタは `listDepartments` の master 全件を候補にする（`DepartmentFilter.tsx`）。現在の検索結果に含まれる部門だけを候補にはしない。

**関連**: パターン⑨検索 + フィルタ。review-checklist カテゴリ 9 対応（Select / filter の候補を現在の filtered result から派生していないか）。

---

## DSR-11 空状態・エラー文言・Tooltip の表示基準

**ルール**: 空状態は「何が無いか」+「次の一手」を文言で示す。意味を Tooltip だけに閉じ込めない。

**Why**: ux-principles #9（エラーは原因 + 解決策）と WCAG（hover/focus 依存の情報を必須化しない）。「該当する商品がありません」だけでは利用者は止まる。次にどうすればよいか（検索条件を変える / 登録する）まで書く。Tooltip は hover / focus でしか出ず、高齢の利用者や touch 操作では届きにくいため、Tooltip は補足に限る。

**判定フロー / 具体例**: 空状態は見出し（"商品が見つかりません"）+ 説明（"検索条件を変更するか、新しい商品を登録してください"）+ 必要なら Primary アクションで構成する。Tooltip に入れた補足（例: 売上明細数の算出根拠）は、無くても画面の主要操作が成立する内容に限る。

**関連**: パターン⑥空状態・エラー・ローディング / ⑬ステータスバッジ。review-checklist カテゴリ 9 対応（表示文言が業務上の意味と一致しているか）。

---

## DSR-12 truncate と情報密度のバランス

**ルール**: `min-w-0` + `truncate` は意図した列にのみ当てる。truncate した主要値には、全文を確認できる手段（折り返し・展開・別表示）を残す。

**Why**: japanese-webdesign の「情報密度 = 信頼」と inventory-operator-ui の「主要値を回復手段なしに隠さない」の両立。業務データは密に見せたいが、商品名や金額を黙って切り詰めると、利用者は欠けた情報に気づけない。truncate は意図的に、かつ回復手段とセットで使う。

**判定フロー / 具体例**: カードの金額は `min-w-0` + `truncate` でカードの溢れを防ぐ（`SummaryCardsBar.tsx`）。一方で商品名列は `min-w-[14rem]` + `whitespace-normal` で折り返す（`ProductTable.tsx`）。行インライン展開の詳細セルは `whitespace-normal` で切らずに全文を見せる（パターン⑫）。

**関連**: パターン③テーブル / ②サマリカード / ⑫行インライン展開。review-checklist カテゴリ 9 対応（テーブル・カード・チップの密度・幅・truncate が主要値の理解を壊していないか）。

---

## DSR-13 表示スケールの設計方針

**ルール**: 「文字が小さい」への対処として、個別の font-size 増を初手にしない。全体の見やすさは display-scale option（PR #77 導入済み、WebView zoom）で扱う。

**Why**: inventory-operator-ui のルール。1 箇所だけ文字を大きくすると、画面間で文字サイズがばらつき、Fluent 2「Coherent」が崩れる。視認性は機能要件であり、capability・永続化・L3 検証を伴う全画面横断の設計で解く。局所対応はその場しのぎになり、別画面で同じ不満が再発する。

**判定フロー / 具体例**:

```
「小さくて読みにくい」指摘が来た
├─ 全体的な読みにくさ → display-scale option（Sidebar footer の 3 段階 zoom: standard=1 / large=1.15 / extra_large=1.3）
└─ 特定セルの最小級 text-xs → 通常 table text へ上げる（局所だが「縮めすぎを戻す」方向のみ）
```

font-size を全体一律に底上げする再設計は本ルールの scope 外（将来検討、参照のみ）。

**関連**: パターン⑬ステータスバッジ末尾「小さい文字・密な表への対応」。review-checklist カテゴリ 9 対応（非 IT・高齢利用者が通常距離で主要テキストを読める設計か / 状態を変える control へ戻れるか）。

---

## DSR-14 ファイル選択はネイティブダイアログ（path-based）を優先する

**ルール**: ファイル選択は `@tauri-apps/plugin-dialog` の `open()` でパスを取得し、`@tauri-apps/plugin-fs` の `readFile()` で読み込む path-based 方式を優先する。HTML `<input type="file">` を新規画面で採用しない。既存の plain input（Z004 取込み / 商品一括インポート / レシート画像）は暫定例外とし、backlog「ファイル選択 UI の共通化」で移行する。

**Why**: WebView2 では HTML file input がネイティブダイアログ起動後に DOM 変化まで再描画されず白画面になるバグがある（JS 例外なし・console 無出力。PR #125 の Windows native L3 実機検証で検出、経緯は [UI_TECH_STACK.md §6.5.4](../UI_TECH_STACK.md)）。WSL2 / 机上レビューでは再現しないため、実装規約として予防するしかない。複数ファイル選択の画面は再現リスクが高く、優先移行対象とする。

**判定フロー / 具体例**: 日報取込み（`useDailyReportImportFlow.ts` の `chooseFiles`）が移行第一号。`open({ multiple: true, filters: [{ name: "CSV", extensions: ["csv", "CSV"] }] })` でパス取得 → `readFile(path)` でバイト読込み。capability は `dialog:allow-open` + `fs:allow-read-file`。`open()` のキャンセルは `null` を返すので state 据え置きで安全に扱える。選択エラーの表示は DSR-03 のインライン 1 スロットに従う。共通 `FilePicker` パターン部品は backlog の共通化完了後に [02-component-catalog.md](02-component-catalog.md) へ登録する。

**関連**: パターン⑥空状態・エラー・ローディング（インライン選択エラー）。review-checklist カテゴリ 9 対応（操作の起点が予測通り動くか）。

---

## DSR-15 returnTo 等のリダイレクト系 param は検証してから使う

**ルール**: `returnTo` など遷移先を運ぶ search param は、そのまま `<Link to>` / href に渡さない。「`/` 始まり、かつ `//` 始まりでない」ことを検証し、不合格ならアプリ内の既定ルートへフォールバックする。

**Why**: 任意文字列を遷移先として使うと、外部 URL / protocol-relative URL への想定外遷移（open-redirect 型）が起きうる。デスクトップアプリでも業務動線が壊れ、利用者が迷子になる。PR #114-#115 の入出庫 4 詳細ページで `normalizeReturnTo` として確立した規約を全 returnTo 系 param に適用する。

**判定フロー / 具体例**: `normalizeReturnTo(value)` は `value.startsWith("/") && !value.startsWith("//")` のみ許可し、それ以外は `/inventory/records` へフォールバックする（`ReturnRecordDetailPage.tsx` ほか入出庫 4 詳細ページ。現状は各ファイルへの複製実装で、共通 util 抽出は別 PR）。新規に returnTo を受ける route を作るときは同じ検証を必ず入れる。

**関連**: パターン①ページヘッダ（詳細ルートの戻る導線）。review-checklist カテゴリ 9 対応（状態を変える control へ戻れるか / 導線が行き止まりにならないか）。
