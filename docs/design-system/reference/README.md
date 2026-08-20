# design-system/reference — 参考資料（お手本と提案原文）

[04-backbone.md](../04-backbone.md) の成立根拠と、背骨どおりに描いた「お手本」を置く。**ここにあるものは実装の正本ではない**（正本は 00〜04 と各 function-design）。背骨や規範が変わったらお手本も更新する。

| ファイル | 内容 | 扱い |
|---|---|---|
| [mockup-c-home.html](mockup-c-home.html) | 統合案 C のホーム画面（icon 24 + 題名 + 1 行説明の入口、primary 1 つ、warning トーンのバナー） | お手本。静的 HTML、外部資源なし、ダミーデータ。ブラウザで直接開ける |
| [mockup-c-products.html](mockup-c-products.html) | 同 商品検索・一覧（枠に入れた検索・絞り込みの 2 段、live 検索欄 + ボタン、16px 本文、chevron、PLU 列の状態 badge、廃番の分類 badge） | 同上 |
| [mockup-c-stock.html](mockup-c-stock.html) | 同 在庫照会（商品一覧と同じ枠・検索欄・行、状態 badge 3 点セット、開いた行の詳細 + 操作） | 同上 |
| [2026-08-20-proposal-A-rules-bound.md](2026-08-20-proposal-A-rules-bound.md) | Opus 5 提案 A（既存規範準拠）原文。実装の逸脱診断（file:line 付き）、規範へのフィードバック 10 件 | 提案原文。file:line は 2026-08-20 時点の snapshot で、以後の変更で古くなる |
| [2026-08-20-proposal-B-blank-slate.md](2026-08-20-proposal-B-blank-slate.md) | Opus 5 提案 B（白紙）原文。system としての再定義（PageShell / badge 3 種 / 2 段密度 / 検索統一 等） | 同上。採否は 04-backbone の各行に記載（28px icon・48px 行高は不採用 / 見送り） |

3 つの mockup は 1 つの CSS（token）から機械生成しており、画面間でバラつかないこと自体を確認点にしている。

## 使い方

- 新しい一覧画面や入口を作るとき: 対応する mockup を開き、枠・検索欄・行・badge の作りを合わせる
- レビューで「背骨 n に反している」と指摘するとき: mockup の該当箇所を根拠として指す
- 背骨を改定したとき: mockup の該当箇所を同時に直す（batch packet の Required Design Artifacts に含める）
