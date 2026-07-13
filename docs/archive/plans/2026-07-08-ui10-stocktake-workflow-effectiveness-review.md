# Workflow Effectiveness Review: UI-10 棚卸し画面実装（PR #159）

> **対象**: [2026-07-07-ui10-stocktake-implementation.md](2026-07-07-ui10-stocktake-implementation.md)（+ [design packet](2026-07-07-ui10-stocktake-design.md)）
> **実施日**: 2026-07-08 / merge = `16b3dc6`（squash merge、PR #159）

## Workflow Used

- Project Profile: R3
- Plan Packet: 実装コミット（`4114d85`）と同一コミットで事後的に作成（★構造的な根本原因、詳細は下記）
- Test Design Matrix: 同上（Codex が実装と同時に自作、独立レビューを経ていない）
- review-only sub-agent: 未使用（Fable 直接レビュー）
- external review: Codex CLI、計 10 ラウンド以上
- human approval: owner Windows native L3（初回 5 項目 pass、追加 2 項目を後日 pass）
- gates: `cargo fmt/clippy/test`、`npm test/typecheck/lint/format`、`doc-consistency-check.sh`、traceability

## 根本原因

Design Phase（73、PR #158）は事前レビュー済みで正しく完了していた。しかし実装フェーズで、Codex に 73 だけを渡し、Plan Packet（Scope + Test Design Matrix）の作成も含めて実装を一任した。結果、Plan Packet 自体が実装コード（`StocktakePage.tsx` 等）と同一コミットで事後的に作成され、**実装着手前の独立レビューという工程が構造的に丸ごと欠落した**。

owner 談（本 PR のやり取り中）: 「最近俺自身もプランの存在を忘れかけてた。ワークフローを整備しすぎて触らずとも回る仕組みができたがゆえに、前にもプラン無しで書かせて死ぬほどラリー続いてこれ良くないねって是正したのにまたやらかした」。**これは過去に一度是正されたはずのインシデントの再発**であり、ドキュメント上のルールを明記するだけでは再発を防げなかった実例。

## 時系列（発生した見落としと発見経路）

| # | 見落とし | 発見経路 | 本来防げたはずの工程 |
|---|---|---|---|
| 1 | 進行中判定が `localStorage` + エラーメッセージパースに依存 | Fable 一次レビュー | Plan Packet 事前レビュー |
| 2 | 新規 CMD テストの一つが実質空 | Fable 一次レビュー | Test Design Matrix 事前レビュー |
| 3 | 確定警告の視認性が弱い / 一覧に差異・カウント日時がない / 前回比較が埋没 | owner Windows native L3（初回） | Design Phase の情報構造・文言強度の具体化不足 |
| 4 | 一覧の在庫列（`system_stock`）と差異列（`current_stock` 基準）のソース不一致 | Codex レビュー | UI-10-D10 実装時のセルフチェック |
| 5 | `AlertDialogDescription`（sr-only）に不可逆性 title が欠落 | Codex レビュー | 同上 |
| 6 | 連続 HID スキャン用のフォーカス管理が丸ごと未実装 | owner 運用質問（「他画面みたいに連続スキャンできるの？」） | **73 §73.5 に Design Phase 初版から明記済みの契約だった** — Plan Packet 事前レビューがあれば Test Design Matrix に入っていたはず |
| 7 | T17 が Enter 経路でなくボタン click 経由でテストしていた | Codex レビュー | テスト設計レビュー |
| 8 | force_fill 未入力超過の到達性を過小評価 | owner 再指摘（「本当に起きないのか」） | 実装時の楽観的判断の検証不足 |
| 9 | PR 本文（Test Matrix/Design Note/L3）が最初期のまま陳腐化 | Fable 自身が気づく | 複数レビュー往復後の定期的な読み直し不足 |
| 10 | 開始日時の `T` 区切り未フォーマット（前回サマリ・前回比較カード） | owner スクリーンショット指摘 | 同一パターン（`formatCountedAt`）の横展開時の網羅確認不足 |
| 11 | 継続表示ヘッダが開始日時でなく内部 ID を表示 | **Fable 契約監査**（73 全体 vs 実装コード突き合わせ） | 同上、UI-10-F1/D1/73.10 Wording に明記済みの契約だった |
| 12 | `stocktake_not_in_progress` が一覧取得以外の経路で未処理 | Fable 契約監査 | 同上 |
| 13 | **確定直後、結果画面の「前回の棚卸し」が今回確定した棚卸し自身に置き換わる**（重大） | **Codex 独立契約監査**（Fable も見落とし） | 同上。機械的契約監査を2人でやってようやく見つかった |
| 14 | **商品名検索フォールバックが丸ごと未実装** | **owner Windows native L3 実機ウォークスルー**（Fable/Codex 契約監査を2周してもなお発見できず） | 73 §73.5 に Design Phase 初版から明記済みの契約だった。コードを読むだけの契約監査では原理的に発見不能 |
| 15 | 商品名検索欄の Enter に IME `isComposing` guard 欠落 | Codex レビュー | `ReceivingPage.tsx` の既存パターンの部分的な移植漏れ |

## What Worked

1. 複数レビュアー（Fable・Codex）による多段階レビュー体制が、最終的に上記 15 件のほぼ全てを是正まで持ち込んだ
2. owner の素朴な運用質問（#6, #8）と実機 L3 ウォークスルー（#3, #14）が、機械的レビューでは原理的に拾えない見落としを発見する最重要トリガーになった
3. Codex への「独立した契約監査」依頼（#13）が、Fable 単独では見逃していた重大バグを発見した。二重チェックの価値が明確に実証された
4. Before/After 比較 Artifact による視覚的合意形成（#3 の是正）が、口頭説明より速く正確な意思決定につながった
5. エラーメッセージのモック値をわざと設計書の期待値と変えるテスト手法（T18, T19）が、「モックが偶然正しい値を返すために契約逸脱を見逃す」パターンを潰した

## What Did Not Work

1. **Plan Packet が実装着手前に存在しなかった**（根本原因、上記参照）
2. 過去に是正したはずのワークフロー規律が、実際の運用では徹底されなかった。「ルールをドキュメントに書く」ことと「実際に守られる」ことは別問題
3. PR 本文が何度もレビューサイクルを回した割に更新されず、最初期のコミット時点のまま陳腐化していた。`Plans.md` は都度更新する習慣が既にあったのに、PR 本文側は見落とされていた

## Test Adequacy

Weak or missing tests（是正前）:
- T11: `mockGetLast` が常に同一値を返す実装だったため、確定後の前回比較差し替わりバグ（#13）を検出できなかった
- T13: モックのエラーメッセージがバックエンドの固定文言と偶然一致していたため、UI 側で固定文言をハードコードしていない契約逸脱を検出できなかった
- フォーカス管理・商品名検索フォールバックは実装自体が存在しなかったため、そもそもテストも存在しなかった

Mutation-style observation: エラーメッセージのモック値を設計書の期待値と意図的に変えて検証する手法（T18〜T20）が、「テストが green」と「契約を満たしている」の乖離を可視化するのに有効だった。

## Escaped / Late Findings の分類

- **契約書き忘れパターン**（#6, #11, #14）: 73 に最初から明記されていた契約が実装から漏れていた。Plan Packet 事前レビューがあれば Test Design Matrix の段階で拾えたはず
- **機械的レビューの原理的限界パターン**（#13, #14）: コードを読むだけの契約監査では発見できず、実機で実際に操作するか、独立した2人目の視点が必要だった
- **横展開漏れパターン**（#10, #15）: 既存の確立パターン（`formatCountedAt`、`isComposing` guard）を新規実装時に一部だけ移植し忘れた

## Recommended Workflow Adjustment

Keep:
- 複数レビュアー（Fable・Codex）による多段階レビュー体制
- owner の運用質問・実機 L3 ウォークスルーを軽視しない姿勢
- 独立した契約監査を2者に依頼するダブルチェック
- モック値を設計書の期待値とわざと変えるテスト手法

Change:
- Plan Packet は実装コミットと別コミットで、実装着手前に必ず作成する
- PR 本文は複数ラウンドのレビューを経た後、マージ前に一度全体を読み直して最新化する

Follow-up:
- Plan Packet 作成タイミングの機械的強制（hook 等）を検討する。ドキュメント上のルール明記だけでは今回と同じく再発する可能性が高い（現に一度是正して再発した実績がある）
- 「設計書の契約が実装から漏れていないか」の契約監査を、R3 実装の標準ステップとして明示的にテンプレート化する

## Applied / Deferred Workflow Changes

Applied（本 PR 内で実施済み、2026-07-08）:
- `docs/DEV_WORKFLOW.md` Plan Packet Rules / Implementation Rules に「Scope + Test Design Matrix を実装コミットと別に先にコミットする」規律を追記
- `.agents/skills/inventory-implementation/SKILL.md` Plan-first Rule に同趣旨を追記
- `docs/function-design/73-ui-stocktake.md` の全体契約監査を実施し、発見した見落とし（#11, #12, #13, #14）を是正
- Windows native L3 チェックリスト（73.13）を「画面/到達手順/観測可能な合格基準」形式に全面刷新

Deferred:
- Plan Packet 作成タイミングの機械的強制（hook 等）
- 一覧フィルタのリセットボタン（`docs/Plans.md` Backlog へ）

Not applied:
- （なし）
