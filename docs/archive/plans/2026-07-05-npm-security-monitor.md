# Plan Packet: npm dependency-security 常設 monitoring（chore/npm-advisory-monitoring）

Risk: R1

新規 script + GitHub Actions workflow のみ（アプリコード・依存・lockfile 不変）。

## Goal

D-030 で目的変更した常設 hygiene 監視を実装する: 日次で `npm audit`（high 以上）と監視対象 advisory の state 変化を check し、findings を issue で通知する。通知は情報提供のみで自動対処はしない（対処は user 判断）。

## Scope

1. `scripts/npm-security-monitor.sh`: check 本体（ローカル実行可）。markdown report を stdout、exit 0 = clean / 1 = findings / 2 = check 失敗
2. `.github/workflows/npm-security-monitor.yml`: 日次 06:00 JST + workflow_dispatch。findings → 固定タイトル issue 作成 or 既存へ追記、clean → open alert issue を解消コメント付き close、check 失敗 → run を fail（issue は作らない）
3. `docs/Plans.md`: 進行中エントリ + 次の行動 / Backlog 更新

## Non-scope

- 自動対処（`npm audit fix` 実行等）— D-030 で明示的に禁止
- moderate / low の通知（既存 backlog の別 PR 評価対象。通知は high+ のみ、report に参考値として記載）
- 監視 advisory の自動追加（リストは script 内で手動管理）

## 設計判断

- **npm ci なしで audit 実行**: `npm audit` は package.json + package-lock.json のみで動作することを一時 dir で実証済み（node_modules 不要）。daily run が数秒で済む
- **通知の dedupe**: 固定タイトル「npm dependency security alert」の open issue を検索し、あれば追記・なければ作成。emoji をタイトルに入れない（GitHub search の完全一致安定性のため）
- **check 失敗（exit 2）は issue でなく run failure**: registry / API 到達不可は一時障害が多く、issue spam を避ける。恒常化すれば run history の赤で気づける
- **監視対象 advisory は GHSA-g7cv-rxg3-hmpx のみで開始**: D-030 後も withdrawn 化は「監視リスト整理」の参考情報として通知価値がある

## Acceptance Criteria

- ローカルで `./scripts/npm-security-monitor.sh` が現状 exit 0 + 「✅ 全て clean」report（実測済み: audit high 0、advisory active 変化なし）
- withdrawn 検知経路の動作確認（実測済み: withdrawn_at を強制した copy で exit 1 + 📣 report）
- check 失敗経路の動作確認（実測済み: JSON parse 失敗で exit 2）
- merge 後に `gh workflow run` で workflow_dispatch 実行 → run green + Step Summary に report 表示

## Test Plan

- script 3 経路のローカル実証（上記 AC、実施済み）
- merge 後 post-merge 検証: `gh workflow run "npm security monitor"` → `gh run watch` で green 確認（workflow は default branch 登録後にのみ dispatch 可能なため merge 後実施）

## Review Focus

- workflow の permissions が最小か（contents: read + issues: write のみ）
- issue dedupe / close のライフサイクルに漏れがないか（連日 findings → 追記、解消 → close、再発 → 新規作成）
- exit code の分岐（0/1/2）が script と workflow で一致しているか

## Implementation Results

- PR #132（`c0cd142`）: script + workflow 本体。3 経路（clean / findings / check 失敗）ローカル実証済み
- **初回 dispatch 検証（run 28740478216）は fail（exit 2）**: monitor step に GH_TOKEN がなく、script 内 `gh api /advisories/` が runner 上で未認証。ローカル検証は実行者の gh 認証で通過してしまい検出不能だった。issue 操作 step には設定済みで check 本体のみ漏れ
- PR #133（`4fe9283`）: GH_TOKEN を monitor step に追加する 1 行 fix
- **再 dispatch 検証（run 28740693249）: success**。clean 経路で issue 誤作成なし（`gh issue list` で 0 件確認）、exit 0 routing 正常
- 教訓: gh CLI を使う script の CI 移植は「ローカルの暗黙認証」が抜け穴。runner での dispatch 実行が本当の検証（packet の Test Plan に post-merge 検証を入れておいたのが機能した）

## Review Response

Review-only skipped because: R1 監視 script + workflow のみ（アプリコード不変）。3 経路のローカル実証 + merge 後 dispatch 検証で担保。
