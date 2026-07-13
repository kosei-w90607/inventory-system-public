# Workflow Effectiveness Review: REQ-401 SALES 第2スライス（PR #127）

> **対象**: [2026-07-04-req401-sales-slice2-official-reports.md](2026-07-04-req401-sales-slice2-official-reports.md)（+ [test matrix](test-matrices/2026-07-04-req401-sales-slice2-official-reports.md)）
> **実施日**: 2026-07-05 / merge = `8ca337a`

## ワークフロー実績

実コード棚卸し（Explore, sonnet 明示）→ R3 packet + Test Matrix 起草 → rally R1（並列 2 レンズ: 事実突合 + 契約縮退）→ R2 収束確認 → Codex CLI 実装委譲（経路A、feature branch、ローカル main 不触）→ orchestrator 受け入れ（独立 gates 再実行 + spot-check + fresh review-only sub-agent）→ CI → Windows native L3。第1スライスと同型。

- 受け入れ: P1/P2 = 0、P3×3（2 件同 PR 修正、1 件 backlog 分離）。第1スライス（受け入れ 2 round + L3 3 round）より収束が速い
- L3: #1〜#7 一発合格、#8 は条件付き合格（実データで条件が発生しない = 正常。自動テスト S2-18/S2-19 担保）

## 効いたこと

1. **packet での設計判断事前確定（SALES2-D1〜D5）と落とし穴の明示**（CMD passthrough / amount の DTO 別 Option 性 / 水増し禁止 / test_ 命名）が Codex 実装の一発精度に直結した。受け入れ P1/P2 = 0 は第1スライスからの明確な改善
2. **rally 事実突合レンズ**が棚卸し Explore の誤読（「CMD 層 DTO 二重定義」— 実際は L19 の無関係 struct の誤認）を packet 段階で検出。実装に流れていれば存在しない構造への同期テストを書かせるところだった
3. **契約縮退レンズ**が設計正本の未規定領域（`warnings` 生成仕様）を「実装者判断に落ちる前」に検出。SALES2-D5 として確定し、docs 必須昇格まで scope 化できた
4. **model probe → 全委譲 model 明示**: probe が `claude-fable-5` を返し、env var 不発の前提（memory user-launch-recipe-fable-orchestrator）を再確認。sonnet 明示運用で問題なし

## 直すこと（次回への lesson）

1. **Explore の「実装パターン」主張は packet 起草前に orchestrator が rg で裏取りする**。今回は rally が救ったが、起草前 1 分の grep（`rg "pub struct" sales_cmd.rs`）で誤読は防げた。rally を安全網でなく最終確認にする
2. **rally 指摘の反映直後に keyword grep sweep を自分で実施する**。R1 反映時に S2-08 本文の書き換えを忘れ、SALES2-D5 のサマリ表伝播も 3 箇所漏らした（R2 が検出、うち 1 箇所は R2 後の自前 grep が検出）。`rg "<旧表現>|<新 ID>"` の全数確認を反映作業の一部に組み込む（feedback-codex-drift-fix-grep-all-locations の orchestrator 適用）
3. **受け入れで疑義を出す前に既存パターンを grep する**。生 `<a href>` CTA への疑義は、L3 通過済みの既存 3 箇所が同パターンという実証で reviewer に反証された（feedback-recommend-pause-grep-existing-pattern の再確認）。疑義自体は Link/生アンカー混在という実在課題の発見につながったので backlog 化で回収
4. **条件付き L3 項目は「実データで条件が発生しない場合の担保」を最初からチェックリストに明記する**。#8 は owner が再現方法に迷った。「この条件は実データでは通常発生しません。発生しない場合は自動テスト（S2-18/S2-19）担保で合格」と書いておけば迷いはなかった

## Backlog へ送ったもの

- internal navigation の `<Link>` / 生 `<a href>` 混在の統一（Plans.md Frontend follow-up）
- 「一部日だけ日報がある月」の日数 coverage 表示（SALES2-D3、Plans.md backlog「UI-09b 日報 coverage 表示」）
