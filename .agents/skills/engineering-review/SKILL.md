---
name: engineering-review
description: Use this skill when reviewing code, PRs, or plans for general quality — correctness, design, tests, naming, style, and scope. Applies Google Engineering Practices as the philosophical SSOT. For inventory-system-specific design doc alignment and layer boundary checks, combine with inventory-code-review skill.
allowed-tools: Read, Grep, Glob, Bash
---

# engineering-review: 汎用レビュー哲学 SSOT

出典: Google Engineering Practices / CC BY 3.0
URL: https://google.github.io/eng-practices/
原文配置: `references/eng-practices/review/`（無改変、取得 SHA は `SOURCE.md` を参照）

---

## 責務境界（ドリフト源の一本化）

このスキルは**汎用レビュー哲学の SSOT**。

| 観点 | 担当スキル |
|------|-----------|
| 汎用レビュー哲学（bug優先・nit/blocking・scope規律・実証防御・指摘応答） | **このスキル** |
| 在庫システム設計書照合・層境界・在庫不変条件 | `inventory-code-review`（併用） |
| Codex CLI 往復・gh 投稿・hook 機械強制・plan-rally | `preflight-codex-review` / `respond-to-codex-review` / `claude-codex-review-loop` |

在庫設計書突合が必要なレビューは inventory-code-review も合わせて発動すること。

---

## 4 ステップワークフロー

土台原文: `reviewer/standard.md` + `reviewer/navigate.md` + `reviewer/speed.md`

1. **意図先読み** — CL（PR/diff）の説明と変更全体の目的を把握する。`reviewer/navigate.md` 参照。
2. **実 diff を読む** — Design を最初に評価し、残りを詳しく読む。`reviewer/standard.md` 参照。
3. **drift 疑いは repo 全体 grep** — 既知パターンのずれはファイル単独でなく全箇所を一括確認する（ピンポイント修正は次 round で同種残存を検出されて 1 round 浪費する）。
4. **severity 順に findings を報告** — Blocking / P1 / nit の順。詳細は `reviewer/comments.md` 参照。

---

## 10 項目チェックリスト

土台原文: `reviewer/looking-for.md`

レビュー時に必ず通す10観点（在庫固有観点は `inventory-code-review` に委譲）:

1. **Design** — システム全体として well-designed か。
2. **Functionality** — コードは意図通りに動くか。ユーザー（開発者を含む）にとって良い振る舞いか。
3. **Complexity** — 必要以上に複雑になっていないか。将来の開発者が理解・修正しやすいか。
4. **Tests** — 正しく設計されたテストが含まれているか。
5. **Naming** — 変数・関数・クラス等の命名が明確か。
6. **Comments** — コメントは明確で有用か。なぜそう書いたかが伝わるか（何を書いたかでなく）。
7. **Style** — Google スタイルガイドに従っているか（このプロジェクトでは `cargo fmt` / `prettier` + `eslint`）。
8. **Consistency** — 既存コードの慣行と一致しているか。
9. **Documentation** — 関連ドキュメント（設計書・README）が更新されているか。
10. **Every line** — レビューを依頼されたすべての行を確認したか。

詳細: `references/eng-practices/review/reviewer/looking-for.md`

---

## CL → PR 用語変換表

Google Engineering Practices は CL（Changelist）中心で書かれている。このプロジェクトでの対応:

| 原文用語 | このプロジェクトでの対応 |
|---------|----------------------|
| CL | PR / diff |
| LGTM | GitHub approve |
| Critique | GitHub PR review または Codex CLI |
| TAP / presubmit | `cargo fmt` + `cargo clippy` + `cargo test` + L1/L2 + `doc-consistency-check.sh` |
| Author | PR 作成者 |
| Reviewer | レビュアー（Claude / Codex） |

---

## nit / blocking の明示ラベルと scope 規律

土台原文: `reviewer/comments.md` / `reviewer/pushback.md`

- **nit:** — スタイル・細かい改善提案。merge gate に昇格させない。
- **Blocking** / **P1** — マージ前必須修正。
- **optional:** — 任意改善（~10 min + PR スコープ内 + レビュー 3 回以内なら同 PR で潰す）。

scope 規律: PR スコープ外の問題を発見したら別 PR として指摘し、現 PR をブロックしない。

詳細: `references/eng-practices/review/reviewer/comments.md`、`references/eng-practices/review/reviewer/pushback.md`

---

## on-demand 原文ポインタ表

迷ったときに読む原文（必要な時だけ読み、常時ロードしない）:

### Reviewer（レビュアー向け）

| ファイル | 内容 |
|---------|------|
| `references/eng-practices/review/reviewer/standard.md` | レビューの基本スタンダード（変更を承認する判断基準） |
| `references/eng-practices/review/reviewer/looking-for.md` | 何を見るか（10 項目の詳細） |
| `references/eng-practices/review/reviewer/navigate.md` | CL を読む順序と方法 |
| `references/eng-practices/review/reviewer/speed.md` | レビューの速度と応答時間 |
| `references/eng-practices/review/reviewer/comments.md` | コメントの書き方（nit / blocking / 提案） |
| `references/eng-practices/review/reviewer/pushback.md` | 著者からの反論への対処 |
| `references/eng-practices/review/reviewer/index.md` | reviewer セクション索引 |

### Developer（PR 作成者向け）

| ファイル | 内容 |
|---------|------|
| `references/eng-practices/review/developer/handling-comments.md` | レビューコメントへの対処（`respond-to-codex-review` の土台） |
| `references/eng-practices/review/developer/cl-descriptions.md` | CL 説明の書き方（PR description の参考） |
| `references/eng-practices/review/developer/small-cls.md` | 小さい CL を書く方法 |
| `references/eng-practices/review/developer/index.md` | developer セクション索引 |

### その他

| ファイル | 内容 |
|---------|------|
| `references/eng-practices/review/emergencies.md` | 緊急時レビューの判断基準 |
| `references/eng-practices/review/index.md` | review セクション索引 |
