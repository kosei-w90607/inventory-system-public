# 手動販売出庫 PLU警告 Alert の縦一文字表示修正

> owner 実機報告（2026-07-07、UI-11a L3 実施時に発見された無関係バグ）。Plans.md Backlog「手動販売出庫 PLU警告 Alert の縦一文字表示」の消化。

## Risk

Risk: R2

Reason:
operator が実運用で見る警告表示の layout 修正のため。CMD / BIZ / IO / DB / bindings 非接触、route / 文言 / 業務ロジック変更なし。

## Goal

手動販売出庫の保存前 PLU 警告 Alert で、警告明細が 1 文字ずつ縦に折り返す表示バグを解消し、通常の横書きで読めるようにする。

## Scope

- `src/features/manual-sale/ManualSalePage.tsx`: 警告 `<ul>` を shadcn `Alert` 直下から `AlertDescription` 内へ移動（root cause: `Alert` は `grid grid-cols-[0_1fr]` で、`col-start-2` を持たない生の子要素は幅 0px の 1 列目に auto-place される）。
- 同アンチパターン（Alert 直下の生 HTML 要素）の repo 全体機械走査 — 実施済み、違反は本箇所 1 件のみ。
- RTL: 警告明細が `AlertDescription` 内に描画される構造 assertion を既存テストに追加（jsdom は layout を持たないため、grid 列配置の直接検証ではなく DOM 構造で退行を防ぐ）。

## Non-scope

- 警告文言・警告判定ロジック（BIZ 側）の変更。
- `alert.tsx`（shadcn 生成物）自体の変更。
- 他画面の Alert 使用箇所（走査の結果、違反なしを確認済み）。

## Acceptance Criteria

- 保存前 PLU 警告の明細（商品コード + 警告文言）が横書き 1 行で読める（evidence: Windows native L3 目視 1 項目）。
- 警告明細 `<ul>` が `AlertDescription` 要素の内側に描画される（evidence: RTL 構造 assertion）。
- 既存テスト全 green、lint / typecheck pass（evidence: PR CI checks）。

## Test Plan

- targeted: `npx vitest run src/features/manual-sale`（既存 + 構造 assertion 追加）。
- 回帰: `npm test` 全件。
- L3: Windows native で手動販売出庫に PLU 登録済み商品を追加 → 警告 Alert の明細が横書きであることを owner 目視（軽量 1 項目）。

## Review Focus

- `AlertDescription` 内へ移動後の視覚差分が最小か（`mt-2 list-disc pl-5` の維持、`text-muted-foreground` 継承の許容可否）。
- 警告テキストの assertion が text ベースで維持されているか。

## Implementation Results

2026-07-07 Fable 直接修正（1 ファイル軽微修正の conductor 例外適用）:

- `ManualSalePage.tsx`: 警告 `<ul>` を `AlertDescription` 内へ移動（className は不変、視覚差分は文字色が `text-muted-foreground` 継承になる点のみ = AlertDescription 内の説明文と同格でむしろ一貫）。
- repo 全体機械走査（Alert ブロック抽出 + Title/Description 除去 + 残存生タグ検出）: 違反は本箇所 1 件のみ、横展開なし。
- RTL: 警告明細が `data-slot="alert-description"` 内に描画される構造 assertion を既存警告テストへ追加（`alert.tsx:50` で data-slot 実在を確認済み）。
- テスト: manual-sale 20/20 → 全体 567/567 green、typecheck / lint pass。

## Review Response

（レビュー後に記録）
