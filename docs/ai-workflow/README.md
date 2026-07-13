# AI Workflow Overview

このディレクトリは AI Quality Workflow Pack の共通コアです。

Inventory-system では [../DEV_WORKFLOW.md](../DEV_WORKFLOW.md) と [../project-profile.md](../project-profile.md) が優先です。このディレクトリは共通概念の参考であり、repo-local の risk routing や gate と矛盾した場合は inventory 側の文書に従います。

## このワークフローが解く問題

AI実装では次の問題が起きやすいです。

- 仕様をもっともらしく誤解する
- happy path のテストだけを書く
- テストが実装をなぞるだけになる
- レビューが説明に引っ張られる
- docs / tests / implementation の drift が起きる
- source-derived data や secret を誤って混ぜる
- ワークフロー自体が重くなったり、逆に効いていないのに使い続けたりする

このパックは、以下のループを作ります。

```text
Project Profile
↓
Plan Packet
↓
Test Design Matrix
↓
Implementation
↓
Review-only Sub-agent
↓
External Review / Human Approval
↓
Workflow Effectiveness Review
↓
Workflow Adjustment
```

## 重要ファイル

- `core.md`: 共通思想
- `risk-levels.md`: R0-R4の変更リスク
- `source-of-truth.md`: docs / ADR / plans / memory の関係
- `test-design.md`: 有効なテストを設計する考え方
- `workflow-effectiveness.md`: ワークフロー自体の効果測定
- `project-profile-guide.md`: 別repoへ導入するためのプロファイル設計
