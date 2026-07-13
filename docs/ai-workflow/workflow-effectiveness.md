# Workflow Effectiveness

Workflow Effectiveness Review は、ワークフロー自体が効いたかを評価するための振り返りです。

## 目的

- どの step が実際に問題を防いだかを見る
- どの step が重いだけだったかを見る
- どの問題が後段まで漏れたかを見る
- AI review の signal / noise を見る
- Test Design Matrix が効いたかを見る
- 次回の workflow 調整につなげる

## いつ使うか

- R3/R4 PR 後
- workflow docs / skills / templates の変更後
- 同じ種類のレビュー漏れが繰り返された時
- Test Design Matrix をdogfoodした後
- sub-agent review がノイズ過多だった時

## 評価軸

- Prevented Issues
- Escaped Issues
- Tests that caught real bugs
- Sub-agent accepted / rejected / deferred findings
- External review findings
- Cost / friction
- Recommended adjustment
