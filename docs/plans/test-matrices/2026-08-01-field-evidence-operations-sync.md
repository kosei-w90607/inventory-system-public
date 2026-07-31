# Test Design Matrix: 店舗調査証跡と導入時運用契約の同期

## Risk

- R3: POS CSV・CV17 operator workflow・日報代替受入・PLU rolloutの正本同期。

## Contracts Under Test

- FIELD-Z004-D1〜D3
- REPORT-ACCEPT-D1
- PLU-ROLLOUT-D1
- DAILY-SOURCE-D1

## Failure Modes

- Z004を将来取得候補、PLU設定マスタ、または在庫増減未実装と誤記する。
- CV17上の同一出力群をapp内の単一集計/transactionと誤解する。
- layout A/Bの差と現行IO-02の対応範囲を逆転させる。
- layout A/B対応をoperator向けの経路選択にして、通常手順を複数提示する。
- 紙廃止を確定済みと誤記する。
- 実店舗artifactを追跡する。

## Test Matrix

| ID | Contract | Check | Expected |
|---|---|---|---|
| M1 | FIELD-Z004-D1 | verification/memory/architecture/32/D-025でZ004列とBIZ pipelineを確認 | 数量・金額を持つ確認済みreport + 実装済み在庫増減 |
| M2 | FIELD-Z004-D3 | verification/23/Plansのlayout記述を突合 | IO-02 layout A未対応が一貫 |
| M3 | FIELD-Z004-D1 | AC記載の限定stale grep（`在庫[自動]引落し候補` / `在庫[自動]増減候補` / `使えるか...評価` / `在庫接続未実装`。active plan/archiveは除外） | source docsで0件 |
| M4 | FIELD-Z004-D2 | `日報ファイル群` 周辺をレビュー | CV17/operator集合とcore二系統が併記 |
| M5 | REPORT-ACCEPT-D1 | verification/56/57のExcel・紙記述を突合 | Excelは毎日上書きされ日別履歴なし、紙だけが現行履歴、受入保留が一貫 |
| M6 | REPORT-ACCEPT-D1 | 紙廃止・完全代替の断定grep | active docsで断定なし |
| M7 | PLU-ROLLOUT-D1 | memory/Plans/handoffを突合 | 段階移行とfixed slot follow-upが一貫 |
| M8 | DAILY-SOURCE-D1 | verification/55/Plans/handoffを突合 | EcrDatas標準経路、前回フォルダ記憶、復旧経路、layout互換性が分離 |
| M9 | Data safety | `git status --short` / diff name review | 実店舗artifact 0件 |
| M10 | Scope | `git diff --name-only origin/main...HEAD -- .github/workflows src src-tauri` | 0行 |

## State Lifecycle Matrix

docs-only。runtime state lifecycleは変更しない。後続Z004実装ではpreview/commit/duplicate/rollback/retry/re-import、同日複数精算、返品を別Matrixで必須化する。

## Adjacent Pattern Audit

- IO-07 layout A/B契約とIO-02現行contractを比較する。
- 日次・月次の公式集計と商品別表示の分離記述を比較する。
- D-025/D-028/Plans/handoffのfollow-up語彙を比較する。

## Negative Paths

- 「Z004だけで日報全体を置換」と書かない。
- 「Z004在庫増減は未実装」と書かない。
- 「4ファイルを1 transactionで一括取込み」と書かない。
- 「EcrDatasを自動探索する」と書かない。
- 「SD/EcrDatas/明示書出しのどれでもよい」と書かない。
- 「印刷は不要と確定」と書かない。

## Boundary Checks

- 実ファイルの内容・hash・商品識別子をtracked docsへ転記しない。
- adapter factsとapp core decisionを別paragraph/表で表現する。
- current implementationとfuture follow-upを時制で区別する。

## Compatibility Checks

- Rust/TypeScript/DB/wire/workflow YAMLは無変更。
- 現行Z001/Z002/Z005 importとZ004 parser runtime contractは無変更。
- D-023 POS adapter boundaryとD-025 report separationを維持。

## Data Safety Checks

- approved-readable/Issue採取ファイル、DB、screenshotsはrepo外のまま。
- tracked diffに実店舗値がないことを目視確認。
- synthetic fixtureの追加も本changeでは行わない。

## Main Wiring / Integration Checks

- `bash scripts/doc-consistency-check.sh --target plan`
- final candidateで `bash scripts/local-ci.sh full`
- R3 independent Plan Review / Final Review。

## Mutation-style Adequacy Questions

- M1: 「PLU別売上」を「PLU設定マスタ」または「在庫増減候補」に置換したらレビュー/token checkで検出できるか。
- M2: IO-02をlayout A対応済みに置換したらsource突合で検出できるか。
- M4: core二系統の但し書きを削除したら「日報ファイル群」が単一bundle化していないか検出できるか。
- M6: 「紙を完全代替済み」に置換したら受入保留との矛盾を検出できるか。
- M8: EcrDatas標準経路を「任意の取込み元」に置換、またはSDバックアップを通常手順へ昇格したら、手順一本化との矛盾を検出できるか。

## Residual Test Gaps

- Z004の複数数量・返品・同日複数精算は実機未確認または後続確認。
- layout A/Bのbyte-level parser対応は未実装。
- 日報画面のバインダー代替はoperator受入未実施。
- EcrDatasの標準経路は決定済みだが、保持・命名・部分転送・再取込み境界は未設計。
