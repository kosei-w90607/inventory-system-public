# Workflow Effectiveness Review: D-028 JANなし商品のPLU対象扱い実装（Codex 実装委譲の初適用）

> **対象**: PR #124 (private archive)（squash merge `3b131e4`、2026-07-04）
> **packet**: [2026-07-03-d028-janless-plu-implementation.md](2026-07-03-d028-janless-plu-implementation.md) / [test matrix](test-matrices/2026-07-03-d028-janless-plu-implementation.md)
> **評価対象 workflow**: 2026-07-03 採用の役割分担（Fable=orchestrator / Codex CLI=実装（経路A 指示ファイル手渡し）/ sonnet subagent=観点ベース review / Fable 直接監査=高リスク箇所）の初の実装委譲

## 結果サマリ

| 指標 | 実績 |
|---|---|
| Codex 実装（Round 1） | rally 収束済み packet + 指示ファイルから一発で Draft PR。1134 行 / 38 files。自走で review-only 実施（P2 2件 / P3 1件を自己検出・修正） |
| 受け入れ Round 1 指摘 | P1 0 / P2 2 / P3 3（P1 ゼロ。P2 も設計乖離1 + テスト網羅1で、業務ロジックのバグは 0） |
| Codex 修正（Round 2） | 5指摘すべて一発反映（`fdc2424`）、docs 同期含む |
| 機械ゲート | CI 8 checks green（R1/R2 とも初回で green） |
| Windows native L3 | 手順5系統すべて合格（手順4の初回不通過は手順書側の nav ラベル誤記が原因で、実装起因ではない） |
| 総サイクル | packet 手渡し → merge まで同日内（実装 ~30min + 受け入れ2 round + L3） |

## 機能したもの（継続）

- **rally 収束済み packet + 自己完結指示ファイル**: Codex は設計質問ゼロで完走。「実装開始前の突合（standing 項目）」も機能し、設計自己変更なし。packet の【クラス一括】行（型波及）も指示どおり処理された
- **二重レビュー網の相互補完**: sonnet review は matrix 網羅性の欠落（P2-2 dedup confirm テスト）を検出、Fable 直接監査は設計書との文言契約乖離（P2-1 §16.3-6 message）を検出。**片方だけでは両方拾えなかった**。既定 sonnet + 高リスク直接監査の二重化は維持する
- **Draft PR 契約 + 受け入れゲート**: Codex 報告を claim として扱い、AC 全項目を orchestrator が照合する運びは、報告と実態の乖離ゼロを確認するコストとして妥当だった
- **背景 watcher（push / PR 出現で orchestrator を起こす）**: 経路Aの非同期性を吸収。tee ログ + watcher で Codex の進行が追跡可能だった

## 機能しなかったもの / 摩擦（改善）

1. **Plans.md の並行編集衝突**: 引継ぎの「タスクA（dashboard cleanup）は衝突ファイルなし」が誤り — Codex 指示の Completion Contract に Plans.md 更新が含まれていた。PR が CONFLICTING になり CI が発火せず（conflict PR は pull_request workflow が走らない）、orchestrator の merge 解消（`cb5195d`）で回復。**教訓: Codex 委譲中に main 側で dashboard を動かす場合、Codex の Completion Contract が触るファイルを衝突対象として扱う**
2. **tee ログの付け忘れ（運用）**: R1 はログ無しで走った。実害は Draft PR body + packet §Implementation Results で吸収できたが、起動コマンドは「」付きコピペ形式で渡すのが確実（R2 で確立）
3. **Codex の PR コメント返信が未投稿**: Completion Contract の報告項目のうち、コード外の GitHub 操作（コメント投稿）は不達だった。orchestrator が対応表を代理投稿して閉じた。**教訓: Codex への Completion Contract は「commit + push + packet 記入」までを必須とし、PR コメントは orchestrator 側の作業に寄せる**
4. **L3 手順書の nav ラベル誤記**: orchestrator が「商品マスタ一覧」と書いた（正: 「商品検索・一覧」）。**教訓: L3 手順書の画面ラベル・導線は navigation.ts / 実装から実文字列を引いてから書く**（今回も文言類は実装から引いたが、導線ラベルだけ記憶で書いて外した）
5. **Codex 側 sandbox の `.git` 制約**: Codex は一時 clone 経由で push し、ローカル checkout が stale になった。次回の指示ファイルにも「開始時 git pull」を継続して書く

## 判断の更新

- 役割分担（Codex 実装 / sonnet review / Fable 監査）は**継続**。初適用で P1 ゼロ・同日 merge の実績
- review subagent モデル: `opus`（4.8）は user 環境のツール呼び不調で不採用、`sonnet`=4.6 継続 + Fable 直接監査の二重化（詳細: memory `feedback-role-split-codex-implements-sonnet-reviews`）。次セッションから user 起動レシピ `CLAUDE_CODE_SUBAGENT_MODEL=claude-sonnet-5` で review が Sonnet 5 に上がる見込み（memory `user-launch-recipe-fable-orchestrator`）
- L3 の UX 指摘は「合格基準充足なら merge、改善は follow-up 分離」を既定化（memory `feedback-operator-ui-critical-notes-placement`、本件では UI-08 表示改善 follow-up を backlog 登録）
