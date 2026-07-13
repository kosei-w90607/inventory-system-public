# コンポーネントカタログ（13 パターン）

> **親文書**: [README.md](README.md)
> **責務**: 繰り返し使われる 13 パターンの canonical 定義。各パターンに使いどころ・JSX skeleton・使用トークン・全状態・a11y 要件・Do-Don't・canonical ファイル参照を記載する。

---

## テンプレートの読み方

各パターンは以下の統一形式で記述する。

- **使いどころ**: いつこのパターンを選ぶか（1-2 文）
- **canonical**: 規範となる実装ファイル。新規実装はここを一次参照にする
- **構造**: 実装から要点を抽出した JSX skeleton。属性は規範部分のみ残し、省略箇所は `…` で示す
- **使用トークン**: 色・スペーシング・タイポを [00-foundations.md](00-foundations.md) の語彙で示す
- **状態**: hover / focus / active / disabled / error の規定。当てはまらない状態は「規定なし」と明記する
- **アクセシビリティ**: label 関連付け・role・非色シグナル
- **Do / Don't**: 守ること・避けること

skeleton の例示文言・コードはすべて合成データ（架空の商品名・コード）で書く。

---

## ① ページヘッダ

**使いどころ**: 各ページ最上部のタイトル行。画面名（h1）と、その画面の主動線アクション（あれば 1 個）を横並びに置く。

**canonical**: `src/components/patterns/PageHeader.tsx`（`PageHeader{title, subtitle?, actions?}` の 3 variant）。適用例: `src/features/products/ProductListPage.tsx`（h1 + 主動線 actions）、`src/features/home/HomePage.tsx`（h1 + subtitle）

**構造**:

```tsx
<header className="flex flex-wrap items-center justify-between gap-3">
  <h1 className="text-2xl font-semibold">商品検索・一覧</h1>
  <Button type="button" asChild>
    <Link to="/products/new" search={{ returnTo }}>
      <PackagePlus aria-hidden="true" />
      商品登録
    </Link>
  </Button>
</header>
```

主動線が無い画面（例: 商品登録・修正）は `<header className="space-y-1">` に h1 のみを置き、右側のアクションを省く。

**バリエーション: 詳細ルートの戻る導線**（PR #114-#115）: read-only の記録詳細ルート（`src/features/inventory-records/ReturnRecordDetailPage.tsx` ほか入出庫 4 詳細ページ）は、actions に「前の画面へ戻る」ボタン（outline）を置く。データ取得失敗時も PageHeader + 戻るボタンは表示したままにし、エラー Alert だけで終わらせない（利用者を行き止まりにしない）。戻り先の `returnTo` param は [01-decision-rules.md](01-decision-rules.md) DSR-15 の検証を通してから使う。

**使用トークン**: h1 = タイポ `h1`（24px / weight 600）。アクションボタンは Primary（`amber-700`）。要素間ギャップは `space-3`（12px）。

**状態**: h1 自体に状態変化は規定なし。主動線ボタンは hover / focus / disabled をボタン primitive の既定に従う。

**アクセシビリティ**: 画面タイトルは 1 ページ 1 個の h1 とする（タイポグラフィ階層の起点）。装飾アイコンには `aria-hidden="true"` を付け、ボタンの可読ラベルは日本語テキストで持つ。

**Do**:
- 主動線（primary button）は 1 ページ 1 個に絞る（[01-decision-rules.md](01-decision-rules.md) DSR-01）
- アクションが複数あるときは 1 つだけ Primary、残りは outline / ghost に降格する

**Don't**:
- h1 を複数置かない
- ヘッダーに業務データを密に詰めない（ヘッダーは余白を取る領域、[03-philosophy.md](03-philosophy.md) japanese-webdesign の適用境界）

---

## ② サマリカード

**使いどころ**: ダッシュボードやレポート上部で、1 指標を 1 カードで見せる。回復導線の置き方は **query 構成で 3 パターン**に分かれる（PR-B D-B1 で規約化）:

1. **独立 query のカード** = per-card retry 必須（カード内 Alert + 再試行）
2. **同一 query 共有カード群** = per-card retry を採用してよい（許容例: ホームの在庫切れ・在庫少 2 カードは共有 `lowStock` query × per-card retry）
3. **カードが束ねられ個別回復導線が冗長な場合** = page-level Alert + 再試行を許容（canonical variant: 日次/月次売上の `SummaryCardsBar` — 単一系 query が 4 カードを供給するため、カード単位 retry は同一 query の再実行ボタンを 4 個並べる UX 過剰になる）

いずれのパターンでも「取得失敗からの回復導線（再試行）」がカード内またはページ内に必ず存在することが要件。部分障害許容（1 カードの失敗が他カードを巻き込まない）はパターン 1/2 に適用し、パターン 3 は page-level Alert がカード群を差し替える。

**canonical**: `src/components/patterns/SummaryCard.tsx`（パターン 1/2 用の単一カード）。パターン 3 の variant は `src/features/daily-sales/components/SummaryCardsBar.tsx` / `src/features/monthly-sales/components/SummaryCardsBar.tsx`（タイトルごと Skeleton 化 + sub 行 + Tooltip を持つ集計バー構造のため、patterns/SummaryCard とは構造非互換 — 統合は prop 肥大化を招くため見送り）

**構造**:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
  </CardHeader>
  <CardContent>
    {isLoading ? (
      (loadingSkeleton ?? <Skeleton className="h-8 w-32" />)
    ) : isError ? (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-2">
          <span>取得失敗</span>
          <Button variant="outline" size="sm" onClick={onRetry}>再試行</Button>
        </AlertDescription>
      </Alert>
    ) : (
      children
    )}
  </CardContent>
</Card>
```

**使用トークン**: カード背景 `--card`（`stone-100`）。タイトルは `caption` 相当（`text-sm` + `text-muted-foreground`）。エラー時の Alert は `destructive` variant。カード間ギャップは `space-4`（16px）。

**状態**:
- **error**: パターン 1/2 では `isError` のときカード内 Alert（destructive）+「再試行」ボタン。パターン 3 では page-level Alert + 再試行がカード群を差し替える（`isError` を渡す画面は `onRetry` を必ず併せて渡す）
- **loading**: `loadingSkeleton` 未指定なら `h-8 w-32` の Skeleton（金額系の既定）。パターン 3 variant はタイトルごと Skeleton 化する集計バー構造
- hover / focus / active / disabled: カード自体には規定なし

**アクセシビリティ**: タイトルは `CardTitle`（見出し相当）で構造化する。「取得失敗」は色だけでなく日本語テキストで示し、回復導線（再試行ボタン）をカード内またはページ内に併置する。

**Do**:
- 取得失敗からの回復導線（再試行）をカード内 or ページ内に必ず置く（3 パターンのいずれかに従う）
- 独立 query のカードは loading / error / data を独立判定する（部分障害許容）

**Don't**:
- 独立 query のカード群で、1 カードの失敗により他カードまで非表示にしない
- 失敗を色やアイコンだけで伝えない
- 同一系 query が供給するカード群に、同じ query を再実行するだけの retry ボタンを複数並べない

---

## ③ テーブル

**使いどころ**: 商品一覧・在庫一覧・売上明細といった行 × 列の業務データを一覧表示する。

**canonical**: `src/features/products/components/ProductTable.tsx`

**構造**:

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>商品コード</TableHead>
      <TableHead>商品名</TableHead>
      <TableHead>部門</TableHead>
      <TableHead className="text-right">売価</TableHead>
      <TableHead className="text-right">在庫数</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map((item) => (
      <TableRow
        key={item.product_code}
        className={item.is_discontinued ? "text-muted-foreground" : undefined}
      >
        <TableCell className="font-mono text-sm font-medium">{item.product_code}</TableCell>
        <TableCell className="min-w-[14rem] whitespace-normal">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.name}</span>
            {item.is_discontinued && <Badge variant="secondary">廃番</Badge>}
          </div>
        </TableCell>
        <TableCell>{item.department_name}</TableCell>
        <TableCell className="text-right tabular-nums">{yen.format(item.selling_price)}</TableCell>
        <TableCell className="text-right tabular-nums">
          {item.stock_quantity.toLocaleString("ja-JP")} {item.stock_unit}
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**使用トークン**: コード列は等幅 `font-mono`。数値列は `tabular-nums` + `text-right` で桁を揃える。廃番行は `text-muted-foreground`（`stone-500`）で減衰させる。商品名セルは `min-w-[14rem]` で最小幅を確保し折り返す。

**状態**:
- 行の減衰: 廃番など従的状態の行は `text-muted-foreground` で薄くする
- hover / focus / active: 行自体には規定なし（行クリックで詳細展開する場合はパターン⑫を併用し、その規定に従う）
- disabled / error: テーブルには規定なし（取得失敗はパターン⑥でテーブルごと差し替える）

**列の状態表現の使い分け**:
- 状態が一覧の主情報なら独立した「状態列」を置く（DSR-04）
- 行の識別が主で状態が従なら、商品名セル内の `Badge`（例: `廃番`）+ 行全体の `text-muted-foreground` で示す

**バリエーション: 元記録リンク列**（PR #113/#115、canonical: `src/features/stock-movements/components/MovementTable.tsx`）: 在庫変動明細は `MovementTable{movements, returnTo?}` を在庫変動履歴 + 入出庫 4 詳細ページで共有する。`movement.source`（`{ label, route } | null`）が `null` なら「元記録なし」を表示し、値があれば returnTo 付きリンクで元業務記録の詳細へ遷移する。増減は矢印アイコン + 符号付き数値で示し、色のみに依存しない（DSR-08）。

**バリエーション: 直近実績サマリテーブル**（PR #116）: 業務入力画面（入庫 / 返品・交換 / 手動販売 / 廃棄の 4 画面で確立）の下部に「直近の{業務名}」見出しと「すべての履歴を見る」（outline、`/inventory/records` へ recordType 付き遷移）を横並びで置き、直近 N 件テーブル（Skeleton / Error / Empty / データの 4 状態、パターン⑥）と各行の「詳細を見る」導線を付ける。直近リストの取得失敗時は「入力中の内容はそのままです。保存や商品追加は続けられます」のように業務継続を保証する文言を出し、フォーム入力を壊さない。新規の業務入力画面でも同じ構成を踏襲する。

**アクセシビリティ**: `Table` primitive の `TableHead` でヘッダーセルを構造化する。状態は色だけでなく日本語ラベル（`廃番` 等の Badge）で示す（DSR-08）。桁揃えは `tabular-nums` で読み取りを助ける。

**Do**:
- コード列は `font-mono`、数値列は `tabular-nums + text-right`
- 折り返しを意図する列にのみ `min-w-0`（または最小幅）+ `whitespace-normal` を付ける

**Don't**:
- すべての列に truncate を当てて主要値を隠さない（DSR-12）
- 状態を色のみで符号化しない

---

## ④ フォームセクション

**使いどころ**: 商品登録・修正フォームを、意味境界（識別 / 分類 / 価格 / 在庫）でセクション分割する。各セクションは見出し + 1 行説明 + 区切り線を持つ。

**canonical**: `src/components/patterns/FormSection.tsx`（`FormSection{title, description?, children}`、description 未指定時は `<p>` 非描画）+ `src/features/products/components/ProductForm.tsx`（`FieldError` / 必須表示の適用例）

**構造**:

```tsx
function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Separator />
      {children}
    </section>
  );
}

// 各フィールド
<div className="space-y-1">
  <Label htmlFor="product-name">商品名（必須）</Label>
  <Input id="product-name" value={values.name} onChange={…} />
  <FieldError message={errors.name} />
</div>
```

**使用トークン**: セクション見出しはタイポ `h2`（20px / weight 600）。説明文は `text-sm text-muted-foreground`。セクション内の要素間は `space-3`（12px）、フィールド内ラベル↔説明は `space-1`（4px）。区切りに `Separator`。

**状態**:
- **error**: `FieldError` を入力直下に出す（`text-destructive` + `role="alert"`）
- **read-only**: 編集不可で値を見せる入力は `readOnly` + `bg-muted`（例: 編集時の商品コード・JAN・現在庫）
- **disabled**: 操作自体を不能化する入力は `disabled`（例: 編集時の数量単位 select）
- hover / focus / active: 入力 primitive の既定に従う

**read-only と disabled の使い分け**: 値を見せて編集だけ不能にするなら `readOnly + bg-muted`、操作そのものを止めるなら `disabled`（DSR-05）。

**アクセシビリティ**: すべての入力は `Label htmlFor` で関連付ける。必須はラベルに「（必須）」と明記し、色で示さない（DSR-06）。エラーは `role="alert"` で読み上げ対象にする。

**Do**:
- セクションは意味境界で切る。4 セクション以上に増えたら構成を見直す（DSR-09）
- 各セクションに見出し + 1 行説明 + `Separator` を付ける

**Don't**:
- 必須を色だけで示さない
- read-only と disabled を混同しない

---

## ⑤ SegmentedControl / 二択切替

**使いどころ**: アプリ内の二択切替（例: sales TabsHeader の日次/月次、monthly ModeTabs の商品別ランキング/部門別構成比）。これはこのアプリの「二択切替ボタン」の標準仕様であり、各画面で独自に padding / border / active tone を組まない。

**canonical**: `src/components/ui/segmented-control.tsx`

**構造**:

```tsx
// local view mode（button group）
<SegmentedControl
  ariaLabel="表示モード"
  value={mode}
  options={[
    { value: "by_product", label: "商品別ランキング" },
    { value: "by_department", label: "部門別構成比" },
  ]}
  onValueChange={setMode}
/>

// route-driven（Link に共有 class を適用）
<div className={segmentedControlListClass} role="group" aria-label="期間">
  <Link to="/sales/daily" className={cn(segmentedControlItemClass, isDaily ? active : inactive)}>
    日次
  </Link>
  <Link to="/sales/monthly" className={cn(segmentedControlItemClass, isMonthly ? active : inactive)}>
    月次
  </Link>
</div>
```

**使用トークン**:

| 項目 | 仕様 |
|---|---|
| root | `inline-flex h-9 w-fit rounded-lg bg-muted p-[3px]` |
| item | `h-[calc(100%-1px)] flex-none rounded-md px-3 py-1 text-sm font-medium` |
| active | `bg-stone-300 border-stone-300 text-stone-950 font-semibold` |
| inactive | `text-foreground/60 hover:text-foreground` |

**状態**:
- **active**: 選択中は `bg-stone-300` + `border-stone-300` + `font-semibold`
- **inactive**: `text-foreground/60`、hover で `text-foreground`
- **focus**: `border-stone-300` + soft ring。mouse click 後に濃い押しボタン状 outline が残らないこと
- disabled: item primitive の `disabled:opacity-50` に従う
- error: 規定なし

**実装ルール**:
- route-driven navigation（例: 日次/月次）は `<Link>` に `segmentedControlListClass` / `segmentedControlItemClass` / active / inactive class を適用する
- local view mode（例: 商品別ランキング/部門別構成比）は `SegmentedControl` の button group を使い、`aria-pressed` と `data-state=active|inactive` を出す
- SidebarLink / StatusChips は同じ stone 系 selection tone だが、画面ナビや状態 chip の視認性を優先して `border-stone-400` を許容する。二択切替は押しボタン状の濃い外枠を避けるため `border-stone-300` にする
- amber は在庫少や通知などの業務セマンティック色、または主要アクションに残し、選択状態の背景色とは分離する

**アクセシビリティ**: `role="group"` + `aria-label` で群を識別。button group は `aria-pressed` で選択状態を伝える。Windows native L3 では active / inactive / hover / クリック後 focus の 4 状態を比較し、同じ二択切替パターンに見えることを確認する。

**Do**:
- 二択は共有 visual primitive を使う
- 選択状態の背景色（stone 系）と業務セマンティック色（amber 等）を分離する

**Don't**:
- 各画面で独自の padding / border / active tone を組まない
- 3 つ以上の切替や内容が異質な切替に流用しない（その場合は Tabs、DSR-02）

---

## ⑥ 空状態・エラー・ローディング

**使いどころ**: 一覧・カード・レポートの「取得中」「取得失敗」「該当 0 件」を一貫した形式で示す。

**canonical**: `src/features/products/ProductListPage.tsx`（Skeleton → Alert → 空状態 → データの分岐構造）+ `src/components/patterns/EmptyState.tsx`（空状態の到達形）

**構造**:

```tsx
{query.isLoading ? (
  <div className="space-y-2">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
  </div>
) : query.isError ? (
  <Alert variant="destructive">
    <AlertTitle>商品一覧の取得に失敗しました</AlertTitle>
    <AlertDescription>
      検索条件を変えるか、しばらくしてからもう一度お試しください。
    </AlertDescription>
  </Alert>
) : query.data?.items.length === 0 ? (
  <EmptyState
    icon={PackageSearch}
    title="該当する商品がありません"
    description="検索条件を変更するか、新しい商品を登録してください"
    action={/* 「商品を登録する」link button（主動線がある画面のみ） */}
  />
) : (
  <ProductTable items={query.data.items} />
)}
```

**空状態の 2 系統**（PR-B D-B5 で規約化）:
- **0 件成功** = `EmptyState`（pure テーブル component 内 or ページ分岐内）。テーブル系は `rows.length === 0` の内部分岐の中身として埋め込む — props 駆動の pure presentational 責務は不変
- **取得失敗** = ページ側 Alert で差し替え（パターン③テーブルの「取得失敗はテーブルごと差し替え」の射程）。`EmptyState` は使わない

**適用除外**: `EmptySearchPlaceholder`（検索前の操作指示 = 空結果ではない）と shortcuts の `emptyMessage`（navigation config 駆動で利用者アクション不能）は semantic が「取得結果 0 件」と異なるため EmptyState 化しない。

**バリエーション: インライン選択エラー 1 スロット**（PR #125、canonical: `src/features/daily-report-import/DailyReportImportPage.tsx` の `SelectionErrorMessage`）: ファイル選択（DSR-14 の path-based 方式）など非フォーム文脈の入力検証エラーは、発生源（選択ボタン）直下の 1 スロットに `role="alert"` + destructive テキスト + アイコンで表示する。エラー state は選択試行のたびに置換し、成功で `null` にクリアする。画面上部の Alert 帯（データ安全系専用）とは役割を混ぜない（DSR-03 の 3 階層）。フォーム文脈の入力検証はパターン④の `FieldError`（入力直下）が既定で、本バリエーションは非フォーム文脈専用。

### ローディング状態の標準UI

| パターン | 用途 | コンポーネント |
|---------|------|-------------|
| **Skeleton** | 初回ロード（テーブル・カード・リスト） | shadcn/ui `Skeleton` |
| **Spinner** | ボタン内処理中（保存・送信） | lucide `Loader2` + `animate-spin` |
| **Progress Bar** | 確定的進捗（CSV取込み、バックアップ） | shadcn/ui `Progress` |
| **透過オーバーレイ** | 画面全体ロック必要時（データ整合性チェック中） | カスタム component + backdrop |

**不使用**: ドット点滅、波形アニメ等の装飾ローディング（業務アプリの集中を妨げる）

### 空状態（Empty State）の標準UI

正典は `src/components/patterns/EmptyState.tsx`（`EmptyState{icon?, title, description?, action?}`）。各画面で一貫した形式とする:
- **アイコン**（lucide、24px、`stone-400`、`aria-hidden`、省略可）
- **見出し**（h3、`text-base font-medium text-stone-700`、例: "該当する商品がありません"）
- **説明**（`text-sm text-stone-500`、例: "検索条件を変更するか、新しい商品を登録してください"、省略可）
- **アクション**（slot、例: "商品を登録する" link button。**主動線が画面ヘッダ等の直上に既にある場合はボタンを重複させず description の文言で次の一手を示す**、省略可）

3 行以内で簡潔にまとめる。利用者が「次に何をすればいいか」を即座に理解できることが目標。

### 色だけに依存しない状態表示

WCAG 2.1 AA の前提として、状態・警告・選択・比較の意味を色だけで伝えない。グレースケール表示でも、日本語ラベル、アイコン形状、位置、罫線、バッジ形状などで識別できることを求める。

在庫照会の `在庫切れ` / `在庫少` はこの対象である。赤 / amber の文字色は補助として残してよいが、実利用者が赤黄を識別できない場合でも意味が読める実装にする。

**使用トークン**: Skeleton は shadcn/ui 既定。エラーは `Alert` destructive variant。空状態は `EmptyState` 既定（囲み `rounded-md border p-12 text-center`、見出し `text-stone-700`、説明 `text-sm text-stone-500`、アイコン 24px `text-stone-400`）。

**状態**: 本パターン自体が loading / error / empty の 3 状態を表す。hover / focus / active / disabled は規定なし。

**アクセシビリティ**: エラー Alert は `AlertTitle`（原因）+ `AlertDescription`（次の一手）の 2 段で書く。空状態は「何が無いか + 次の一手」を文言で示し、意味を色やアイコンだけに閉じない（DSR-11）。

**Do**:
- loading は Skeleton、error は Alert（原因 + 解決策）、empty は文言 + 次の一手
- 空状態文言は「何が無いか」と「次に何をすればよいか」を書く

**Don't**:
- 装飾ローディング（ドット点滅・波形）を使わない
- エラーや空状態を 1 単語（例: "Error"）だけで済ませない

---

## ⑦ Toast

**使いどころ**: 保存・取込み・出力といった一過性の操作結果を低割込みで通知する。画面に居座らせる必要のない「完了しました」系。

**canonical**: `src/features/products/ProductFormPage.tsx`（保存成功 toast）、`src/lib/hooks/useExportFile.ts`（出力成功・失敗 toast + id 規約）

**構造**:

```tsx
import { toast } from "sonner";

// 保存成功
toast.success(`商品「${name}」を登録しました（商品コード: ${result.product_code}）`, {
  id: "product-save-success",
  duration: 5000,
});

// 出力成功 / 失敗（id は reportType ごとに dedup）
toast.success(`${label} を保存しました（${count} 件）`, { id: `export-${reportType}-success` });
toast.error(`出力に失敗しました: ${message}`, { id: `export-${reportType}-error` });
```

| 形式 | 割込み度 | 用途 | 実装 |
|------|---------|------|------|
| **Toast**（Sonner） | 低（自動消去） | 操作結果の通知。「保存しました」「取込み完了」 | 成功は緑系、警告は琥珀系、失敗は赤系 |

**判定基準**:
- **業務継続を妨げるか** = Yes → Dialog / No → Toast or Banner
- **認知されないと困るか** = Yes → Banner / No → Toast
- **利用者のアクション必須** = Yes → Dialog / No → Toast or Banner

**id 規約**: 同種の通知が連発しても重ならないよう、安定 id を付ける。保存系は `product-save-success`、出力系は `export-${reportType}-success` / `export-${reportType}-error` のように対象ごとに dedup する。

**使用トークン**: 成功 = Success（`green-700`）系、警告 = Warning（`amber-600`）系、失敗 = Destructive（`red-700`）系。色は Sonner の variant（`toast.success` / `toast.error`）経由で当て、生 Tailwind 色 class を書かない（DSR-08）。

**状態**: 自動消去（`duration` 既定 5000ms）。hover / focus / active / disabled / error は規定なし（error 内容は toast 文言で表す）。

**アクセシビリティ**: 通知文言は「何が」「どうなったか」を日本語で具体的に書く（例: 商品名 + 商品コードを含める）。Sonner が live region で読み上げる。

**Do**:
- 一過性の結果は toast、回復導線が要る状態は Alert（DSR-03）
- 連発し得る通知には安定 id を付ける

**Don't**:
- 利用者の操作が必須な内容を toast で流さない（Dialog にする）
- 自動消去で消えると困る持続的状態を toast にしない（Banner にする）

---

## ⑧ Dialog / 確認

**使いどころ**: 破壊的・不可逆な操作の直前に明示確認を挟む（例: 廃番化、上書き取込み）。復帰・再表示など可逆な操作には確認を挟まず直接実行する。

**canonical**: `src/features/products/components/DiscontinueConfirmDialog.tsx`（廃番化の確認）。先例: `src/features/csv-import/components/OverwriteConfirmDialog.tsx`

**構造**:

```tsx
<AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>この商品を廃番にしますか？</AlertDialogTitle>
      <AlertDialogDescription>
        商品「{productName}」は商品一覧の通常表示から外れます。あとから「表示に戻す」で戻せます。
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={onCancel}>キャンセル</AlertDialogCancel>
      <AlertDialogAction onClick={onConfirm}>廃番にする</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

| 形式 | 割込み度 | 用途 | 実装 |
|------|---------|------|------|
| **Dialog** | 高（明示ボタン必須） | 確認・警告。「廃番にしますか」「整合性チェック差異あり」 | shadcn/ui `AlertDialog` |
| **Banner** | 中（常時表示、手動閉鎖可） | 画面上部の持続的通知。「PLU未反映が3件」「バックアップ実行中」 | shadcn/ui `Alert` |

**確認境界**: 破壊的・不可逆操作のみ確認を通す。可逆操作（「表示に戻す」等）は直接実行する。廃番化 = 確認あり / 表示に戻す = 直接実行が実例（DSR-07）。

**使用トークン**: `AlertDialog` の shadcn/ui 既定。確認ボタン（`AlertDialogAction`）はボタン primitive 既定、キャンセルは `AlertDialogCancel`。

**状態**:
- **open**: parent state で制御。`open=false` への経路は (1) onConfirm (2) onCancel（Esc / 外側クリック / キャンセルボタン）の 2 つ
- hover / focus / active / disabled / error: ボタン primitive の既定に従う

**アクセシビリティ**: `AlertDialogTitle`（問い）+ `AlertDialogDescription`（影響と復帰可否）を必ず書く。Esc・外側クリックを `onOpenChange` 経由で cancel にブリッジし、キーボードだけで閉じられるようにする。確認ボタンの文言は操作内容そのもの（例: "廃番にする"）にする。

**Do**:
- 破壊的操作の直前にのみ確認を挟む
- 確認ボタンの文言を操作内容と一致させる

**Don't**:
- 可逆操作に確認を挟んで操作を重くしない（DSR-07）
- 「OK / キャンセル」のような曖昧ボタン文言にしない

---

## ⑨ 検索 + フィルタ

**使いどころ**: 一覧画面上部の検索欄 + 部門フィルタ。HID バーコードスキャナの Enter 確定に対応し、選択状態を URL state に連動させる。

**canonical**: `src/components/patterns/SearchBar.tsx`（検索欄。`debounceMs` 未指定 = commit 型（Enter/ボタン確定 + trim、商品一覧）/ 指定 = live 型（debounce + Enter flush、在庫照会）。両モードとも `event.isComposing` ガードで IME 変換確定 Enter の誤発火を防止）、`src/components/patterns/DepartmentFilter.tsx`（部門フィルタ。allLabel 既定「すべての部門」）

**構造**:

```tsx
// 検索欄（commit 型）: draft 内部保持 + Enter/検索ボタンで確定（trim あり）。
// id は呼び出し側で旧 contract を維持する（商品一覧 = "product-search-input"。
// 未指定時の既定は "search-input" — 既存画面の置換では必ず明示する）
<SearchBar
  id="product-search-input"
  value={q}
  onSearchChange={(value) => updateSearch({ q: value })}
/>

// 検索欄（live 型）: debounce + Enter 即時 flush（trim なし）。Label / id / ボタンなし、type="search"
<SearchBar
  debounceMs={200}
  value={q}
  onSearchChange={onSearchChange}
/>

// 部門フィルタ: 候補は listDepartments の master 全件（filtered result 由来にしない）。
// widthClass / idPrefix は呼び出し側で現値を維持する
<DepartmentFilter
  options={departmentOptions}
  selected={dept ?? null}
  onChange={(deptId) => updateSearch({ dept: deptId ?? undefined })}
  widthClass="w-[11rem]"
  idPrefix="product-dept-filter"
/>
```

**使用トークン**: commit 型は wrapper `min-w-[18rem] flex-1` + 要素間 `space-2`（8px）+ ラベル `text-muted-foreground`。live 型は input 単体 `max-w-md`（wrapper / ラベルなし）。フィルタは `w-[11rem]`（商品一覧）等の固定幅を呼び出し側で指定。

**状態**:
- **disabled**: フィルタは候補ロード中 `disabled` にできる
- focus: 検索欄は両モードとも初期 focus を当て、スキャナ入力を即受け付ける
- hover / active / error: 規定なし（部門候補の取得失敗は呼び出し側で別途文言表示）

**入力の確定経路**: commit 型は draft（local state）→ Enter / 検索ボタンで確定（trim あり）。live 型は `debounceMs` の遅延反映 + Enter で即時 flush（trim なし）。HID スキャナの Enter はどちらのモードでも通常キーボードの Enter と同じ経路を通る。IME 変換中の Enter は両モードとも `isComposing` 除外で検索確定と混ざらないようにする。

**フィルタ候補のソース**: 部門候補は `listDepartments` の master 全件から作る。現在の絞込み結果（filtered result）から候補を作ると、選択値が候補から消えて他候補へ切り替えられなくなる縮退が起きるため、これを禁止する（DSR-10）。

**アクセシビリティ**: 検索 `Input` は両モードとも `aria-label="商品検索"` で識別する。commit 型はさらに可視 `Label htmlFor` を併置し、`placeholder` は補助に留める。live 型は可視 Label を持たない設計（在庫照会の検索駆動レイアウト）のため、`aria-label` を省略しないことが必須要件 — `placeholder` だけに識別を頼らない。フィルタの未選択は「すべての部門」という日本語 default で示す。

**Do**:
- commit 型の検索は Enter 確定（スキャナ互換）+ ボタン確定の両経路を持つ
- live 型の検索は Enter 即時 flush を持つ（スキャナ互換は Enter 経路で担保）
- フィルタ候補は master 全件から作る（DSR-10）

**Don't**:
- フィルタ候補を絞込み結果から派生させない
- IME 変換中の Enter を検索確定と取り違えない
- live 型で `aria-label` を外さない（可視 Label がない分、これが唯一の識別子）

---

## ⑩ ページネーション

**使いどころ**: 件数の多い一覧の前後送り。1 ページあたり表示件数（perPage）と前へ / 次へを提供する。

**canonical**: `src/features/products/components/ProductPagination.tsx`（前へ / 次へ + 件数表示）。perPage 切替（50 / 100 / 200）は呼び出し側ページの `Select` が担う（`src/features/products/ProductListPage.tsx` + `PRODUCT_PER_PAGE_OPTIONS`）

**構造**:

```tsx
// ページ送り（component 本体）
<div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
  <div>{totalCount.toLocaleString("ja-JP")} 件中 {page} / {totalPages} ページ</div>
  <div className="flex items-center gap-2">
    <Button variant="outline" size="sm" disabled={!canPrev} aria-label="前のページ" onClick={…}>
      <ChevronLeft aria-hidden="true" />
      前へ
    </Button>
    <span className="min-w-20 text-center font-medium text-foreground">{page} / {totalPages} ページ</span>
    <Button variant="outline" size="sm" disabled={!canNext} aria-label="次のページ" onClick={…}>
      次へ
      <ChevronRight aria-hidden="true" />
    </Button>
  </div>
</div>

// perPage 切替（呼び出し側ページ）
<Select value={String(perPage)} onValueChange={…}>
  <SelectTrigger id="product-per-page" className="w-[7rem]"><SelectValue /></SelectTrigger>
  <SelectContent>
    {PRODUCT_PER_PAGE_OPTIONS.map((o) => <SelectItem key={o} value={String(o)}>{o} 件</SelectItem>)}
  </SelectContent>
</Select>
```

**使用トークン**: 件数・ページ表示は `text-sm text-muted-foreground`。ページボタンは outline variant、`size="sm"`。現在ページ表示は `min-w-20 text-center font-medium`。perPage 切替は `w-[7rem]`。

**状態**:
- **disabled**: 先頭ページで「前へ」、末尾ページで「次へ」を `disabled` にする
- hover / focus / active / error: ボタン primitive の既定に従う

**perPage 規約**: 表示件数の選択肢は `PRODUCT_PER_PAGE_OPTIONS = [50, 100, 200]`。リテラル直書きせず定数を参照する。

**アクセシビリティ**: 前後ボタンに `aria-label`（"前のページ" / "次のページ"）を付け、方向アイコンには `aria-hidden`。現在地（page / totalPages）はテキストで常時可視にする。

**Do**:
- 端ページで前後ボタンを disabled にする
- perPage は定数（50 / 100 / 200）を参照する

**Don't**:
- 現在ページ・総ページ数をアイコンだけで示さない
- perPage の選択肢をマジックナンバーで直書きしない

---

## ⑪ 日付・月ナビ

**使いどころ**: 日次 / 月次レポートの期間移動。前 / 次ボタン + ネイティブ日付・月 input + 日本語ラベルの 3 点セット。

**canonical**: `src/features/daily-sales/components/DateNavigator.tsx`（日付）、`src/features/monthly-sales/components/MonthNavigator.tsx`（月）

**構造**:

```tsx
<div className="flex items-center gap-2">
  <Button variant="outline" size="sm" onClick={() => onChange(addDays(date, -1))} aria-label="前日">
    前日
  </Button>
  <span className="min-w-[10rem] text-center text-sm font-medium" aria-live="polite">{label}</span>
  <input
    type="date"
    value={date}
    onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) onChange(e.target.value); }}
    className="rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    aria-label="日付を選択"
  />
  <Button variant="outline" size="sm" onClick={() => onChange(addDays(date, 1))} aria-label="翌日">
    翌日
  </Button>
</div>
```

月ナビは `type="month"` + `/^\d{4}-\d{2}$/` 検証 + `prevMonth` / `nextMonth` に置き換える（境界で前後値が無い場合は無操作）。

**使用トークン**: 前後ボタンは outline + `size="sm"`。日本語ラベルは `text-sm font-medium`、最小幅 `min-w-[10rem]`（日付）/ `min-w-[8rem]`（月）。input は `border-input bg-background`。要素間 `space-2`。

**状態**:
- focus: input は `focus-visible:ring-2`
- hover / active / disabled: ボタン primitive の既定（月途中状態を見たい業務要件のため未来日/未来月のガードは置かない）
- error: 入力値が形式に合わなければ無操作（不正値で onChange を発火させない）

**アクセシビリティ**: 前後ボタンに `aria-label`（"前日" / "翌日" / "前月" / "翌月"）。現在期間ラベルは `aria-live="polite"` で変更を読み上げる。input にも `aria-label` を付ける。

**Do**:
- 前後ボタン + ネイティブ input + 日本語ラベルの 3 点を揃える
- 期間ラベルを `aria-live="polite"` にする

**Don't**:
- 期間を数値だけで示し日本語ラベルを省かない
- 形式不正の入力をそのまま onChange に流さない

---

## ⑫ 行インライン展開

**使いどころ**: 一覧で行を選ぶと、その行の直下に詳細を展開する。詳細カードを画面下部に固定するとスクロール往復が増えるため、選択行の直下にインライン展開する（実機デモ起源の方針）。

**canonical**: `src/features/stock-inquiry/components/ProductListTable.tsx`（選択行直下 colSpan 展開）+ `src/features/stock-inquiry/components/StockDetailContent.tsx`（展開内容、loading / error / data 内包）

**構造**:

```tsx
{items.map((item) => {
  const isSelected = item.product_code === selected;
  return (
    <Fragment key={item.product_code}>
      <TableRow
        data-state={isSelected ? "selected" : undefined}
        className="cursor-pointer"
        onClick={() => onSelect(item.product_code)}
      >
        <TableCell className="font-mono text-sm font-medium">{item.product_code}</TableCell>
        <TableCell>{item.name}</TableCell>
        {/* …状態列 / 在庫数 / 売価… */}
      </TableRow>
      {isSelected && (
        <TableRow className="bg-muted hover:bg-muted">
          <TableCell colSpan={6} className="p-0 align-top whitespace-normal">
            <StockDetailContent query={detailQuery} />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
})}
```

**使用トークン**: 展開行は `bg-muted`（`stone-100`）で選択行と視覚的に一体化させる。展開セルは `whitespace-normal` で table 既定の `whitespace-nowrap` を打ち消し、長い商品名 / CTA 群の横はみ出しを防ぐ。

**状態**:
- **selected（active 相当）**: 選択行に `data-state="selected"`、展開行に `bg-muted` を明示固定する（table primitive の自動トリガに依存しない）
- hover: 行は `cursor-pointer`。展開行は `hover:bg-muted` で hover でも色が動かないようにする
- focus / disabled / error: 行自体に規定なし。詳細の error / loading は `StockDetailContent` 側（query 状態）が担う

**フォールバック**: 一覧取得が失敗し選択商品が残る場合は、インライン展開できないため `StockDetailCard`（`StockDetailContent` を `Card` で包む）で独立描画する（部分障害許容）。

**アクセシビリティ**: 選択状態を `data-state` で構造化する。展開行は colSpan で全幅を使い、詳細内の状態（在庫数・売価・最終入庫日）はラベル + 値の対で示す。展開内の将来ボタンは `aria-disabled` + Tooltip で不能理由を伝える。

**Do**:
- 詳細は選択行の直下にインライン展開する
- 展開行の背景色を明示固定し、選択行と一体に見せる

**Don't**:
- 詳細カードを画面下部に固定してスクロール往復を強いない
- 展開セルで横はみ出しを起こさない（`whitespace-normal` を当てる）

---

## ⑬ ステータスバッジ

**使いどころ**: 在庫状態・警告・処理結果・比較状態といった、利用者が業務判断に使うステータスを表示する。色は補助シグナルとし、意味は日本語ラベルと非色シグナルで伝える。

**canonical**: `src/features/stock-inquiry/components/StockStatusBadge.tsx`

**構造**:

```tsx
// status === "stockout"
<Badge variant="outline" className={cn("font-medium", STATUS_STYLE.stockout)}>
  <CircleAlertIcon aria-hidden="true" />
  在庫切れ
</Badge>

// status === "low"
<Badge variant="outline" className={cn("font-medium", STATUS_STYLE.low)}>
  <TriangleAlertIcon aria-hidden="true" />
  在庫少
</Badge>

// status === "ok"
<Badge variant="outline" className={cn("font-medium", STATUS_STYLE.ok)}>
  通常
</Badge>
```

標準パターン:

- `Badge` + `lucide-react` アイコン + 日本語ラベルを第一候補にする。例: `CircleAlert` + `在庫切れ`、`TriangleAlert` + `在庫少`
- テーブル内の状態は、列追加がレイアウトを壊さない場合は状態列を優先する。列追加で商品名が読みにくくなる場合は、在庫数セル内ラベルや左罫線などの非色シグナルを検討する
- tooltip は補足に限る。tooltip だけに意味を閉じ込めない
- 新規 package は追加しない。現行の shadcn/Radix primitive、Tailwind、`lucide-react` で実装できる範囲を優先する
- テストは色クラスだけを assert しない。`在庫切れ` / `在庫少` などの text、role、label、値の invariant を assert する

**使用トークン**: 状態色は semantic shade token（`00-foundations.md`）で当てる。`通常` は `border-stone-200 bg-stone-50 text-stone-600`（stone は palette 内で直書き可）、`在庫少` は `border-warning-border bg-warning-soft text-warning-strong`、`在庫切れ` は `border-destructive-border bg-destructive-soft text-destructive-strong`。soft 背景 + border + 濃いめテキストの 3 点セットで Badge outline を構成する。

> **是正済み（PR-C）**: 旧逸脱（`StockStatusBadge.tsx` / `ProductListTable.tsx` / `StockDetailContent.tsx` の `rose-` / `amber-` 直書き）は上記 semantic shade token へ移行済み（rose→red は意図的色補正、L3 承認）。生 Tailwind 色の再混入は eslint palette 外色 ban が機械防止する。

**状態**: バッジ自体は状態（stockout / low / ok）ごとに見た目を切り替える。hover / focus / active / disabled は規定なし。

**アクセシビリティ**: 状態は日本語ラベル（`在庫切れ` / `在庫少` / `通常`）+ アイコン形状で示し、色だけに依存しない（WCAG 1.4.1）。アイコンには `aria-hidden`、意味はテキストが担う。実利用者が赤黄を識別できない場合でも意味が読める実装にする。

**Do**:
- Badge + アイコン + 日本語ラベルで状態を示す
- テストは text / role / label / 値の invariant を assert する

**Don't**:
- 状態を色（hue）だけで符号化しない（DSR-08）
- 意味を tooltip だけに閉じ込めない

---

## 小さい文字・密な表への対応（横断）

- 局所的な `text-lg` 化を初手にしない。行高、列幅、`min-w-0`、`truncate`、折り返し可否、主要値の回復手段を同時に設計する（DSR-12）
- 表示サイズ / webview zoom は全画面横断の別設計とする。Tauri capability、永続化、月次/日次など密画面の L3 を含めて扱う（DSR-13）
- 2026-06-07 H-6 feedback: daily 5 画面通し確認で、商品コードは小さいが他の視認性問題はないと確認。商品コード readability は Phase 2 blocker にせず、将来の全体文字サイズ / 表示スケール option と合わせて調整する
- 2026-06-07 follow-up: 商品コードは UI-06a / UI-09a の table cell で最小級 `text-xs` から通常 table text に上げる。全体表示は Sidebar footer の 3 段階 WebView zoom（`standard=1`, `large=1.15`, `extra_large=1.3`）で扱い、保存先は `localStorage`（`inventory.displayScale.v1`）とする。UI-11a/b/c の設定画面契約へ DB-backed に移すかは Phase 4 側で別途判断する
