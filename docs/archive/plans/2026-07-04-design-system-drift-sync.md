# Plan Packet: design-system 3 週間 drift 同期（PR #113-#125 パターン昇格）

## Risk

Risk: R2

Reason:
docs/design-system/ 配下と README 索引のみを変更する docs-only。runtime contract / コード / CI 設定に触れない。ただし規約文書は今後の実装 PR の判断基準になるため R1 ではなく R2（Plan Packet 必須、Test Matrix 任意）。

## Goal

docs/design-system/（最終更新 2026-06-13 PR #97-#99）に、PR #113-#125 で確立した UI パターンを昇格し、実装現物と規約文書の 3 週間 drift を解消する。特に PR #125 の 3 パターン（path-based ファイル選択 / エラー表示階層 / タブ 2 トラック分離）は Phase 3 以降の画面実装が参照する前提のため必須昇格。

## Scope

- `01-decision-rules.md`:
  - DSR-02: 「2 択だが内容が異質なら Tabs」の実例欠落を UI-07（日報 / Z004 の 2 トラック、`CsvImportPage.tsx`）で補完
  - DSR-03: toast vs Alert の 2 値判定を 3 階層ルールへ拡張（上部 Alert 帯 = データ安全系専用 / インライン 1 スロット = 入力検証・発生源直近・毎試行置換・成功でクリア / toast = 即時フィードバック併用）+ 状態遷移後の `scrollPageToTop()` 規約（`src/lib/page-scroll.ts`、5 画面で使用済み）を追記
  - DSR-14 新設: ファイル選択方式（`plugin-dialog` + `plugin-fs` path-based。WebView2 HTML file input 白画面バグ回避。複数ファイル選択画面から優先移行、plain input は暫定例外）
  - DSR-15 新設: returnTo / リダイレクト系 param の検証（`normalizeReturnTo` 規約 = `/` 始まりかつ `//` 始まりでないことを検証、open-redirect 対策。4 詳細ページで確立済み）
  - タイトル / 読み方の DSR 範囲表記を 01〜15 へ更新
- `02-component-catalog.md`（パターン番号は 13 のまま、既存パターンへのバリエーション追記）:
  - ① ページヘッダ: 詳細ルートの「前の画面へ戻る」導線（エラー時にも戻る導線を残す。returnTo は DSR-15 で検証）
  - ③ テーブル: 元記録リンク列（`MovementTable` + `MovementRecord.source` contract、null は「元記録なし」）/ 直近実績サマリテーブル（recent list + 「すべての履歴を見る」導線、4 業務入力画面で確立）
  - ⑥ 空状態・エラー・ローディング: インライン選択エラー 1 スロット（`SelectionErrorMessage`、`role="alert"`、毎試行置換・成功クリア）
- `README.md`: 索引行の DSR 範囲・キーワードを更新
- 本 Plan Packet の archive（merge 後）

## Non-scope

- `FilePicker` 共通 component 化（Plans.md backlog「ファイル選択 UI の共通化」で実施。component 登録は共通化完了後）
- Z004 / UI-01c / UI-03 の plain file input の plugin-dialog 移行（同 backlog）
- /inventory/records 横断ハブの規約化 — 見送り。唯一の実装で再利用実績なし。Phase 3/4 で 2 例目が出たら再棚卸し
- 備考の複数行表示 + 「備考なし」fallback の規約化 — 見送り。return-exchange 系 2 ファイルのみで他業務詳細へ未展開。展開後に昇格（demand-driven、memory feedback-design-phase-backfill-demand-driven）
- PLU prepare/confirm 二段階の規約化 — 見送り。CV17 / SR-S4000 のハードウェア固有制約由来で汎用化不能。同型フロー（外部ツール手動投入 + 事後確認）が 2 例目で発生したら抽象化を検討
- `normalizeReturnTo` の共通 util 抽出、read-only detail route の共通 hook 化（規約は昇格するが実装リファクタは別 PR）
- 実装コード・テスト・CI の変更一切

## Acceptance Criteria

- `./scripts/doc-consistency-check.sh` PASS（DS1〜DS4 含む）
- 昇格した全パターンの canonical ファイルパスが実在する（DS1）
- DSR-14 / DSR-15 の新設に伴う README 索引・01 冒頭表記の整合
- 昇格文面の事実主張（component 名 / ファイルパス / 挙動）が実装現物と一致（本 packet 起草時に rg で裏取り済み: plugin-dialog/fs import、`SelectionErrorMessage`、`defaultValue="daily-report"`、`scrollPageToTop` 5 画面、`normalizeReturnTo` 4 ページ、`MovementTable` 5 消費箇所、「すべての履歴を見る」4 画面）

## Design Sources

- Requirements / spec: REQ-401（UI-07 2 トラック）、REQ-206/207/208（記録追跡導線）
- Architecture: docs/ARCHITECTURE.md POS Adapter Boundary（Z004 / 日報の track 分離根拠）
- Function / command / DTO: docs/function-design/55-ui-csv-import.md §55.0（UI-07-D9/D10/D11）、66-ui-stock-movements.md §66.5、61〜64（recent list）、67-ui-plu-export.md UI-08-D6（scrollPageToTop）
- DB: 変更なし
- Screen / UI: docs/UI_TECH_STACK.md §6.5.4（WebView2 file input 白画面バグと path-based 移行）
- Decision log / ADR: decision-log D-025（2 トラック分離）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | なし（docs-only） | 該当なし |
| Command / DTO / generated binding / wire shape | なし | 該当なし |
| DB / transaction / audit / rollback / migration | なし | 該当なし |
| Screen / UI / route state / Japanese wording | design-system 3 ファイル + README | 本 PR で更新 |
| CSV / TSV / report / import / export format | なし | 該当なし |
| Durable decision / ADR | 既存 D-025 / UI-07-D9〜D11 / UI-08-D6 を引用（新規判断なし、実装済み事実の昇格のみ） | existing sufficient |

## Design Intent Trace

R2 につき簡略。昇格元の設計判断 ID: UI-07-D9/D10/D11（55-ui）、UI-08-D6（67-ui）、D-025（decision-log）。本 PR は新規設計判断を作らず、実装済みパターンの規約文書への転記のみ。

## Design Intent Audit

- Source docs can answer what is being built and why: Yes — 各パターンの why は既存の function-design 判断 ID と UI_TECH_STACK §6.5.4 に接地
- Plan-only durable decisions found and promoted: なし（本 PR 自体が昇格作業）
- Assumptions and constraints: パターン番号 13 を維持し、既存パターンのバリエーション追記で表現する（カタログ肥大の抑制）
- Deferred design gaps: Non-scope 節の見送り 3 件（ハブ / 備考 fallback / PLU 二段階）+ FilePicker 共通化 backlog
- Test Design Matrix: 任意（R2 docs-only、省略）

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | not applicable — UI 規約のみで adapter 境界に触れない | — |
| Fact check / design decision split | 適用 — 昇格文面の事実主張は rg で実装現物と突合済み | 本 packet Acceptance Criteria |
| Lifecycle / retry | not applicable — docs-only | — |
| Operator workflow | 適用 — エラー階層 / 注意情報配置は memory feedback-operator-ui-critical-notes-placement の判断軸に整合させる | DSR-03 拡張文面 |
| Replacement path | not applicable | — |
| Data safety / evidence | 適用 — 上部 Alert 帯を「データ安全系専用」と限定する規約自体がデータ安全境界の表現 | DSR-03 拡張文面 |
| Reporting / accounting semantics | not applicable | — |
| Manual verification | not applicable — 表示挙動の変更なし、L3 不要 | — |

## Design Readiness

- Existing design docs are sufficient because: 昇格対象パターンの設計判断は既に function-design / UI_TECH_STACK / decision-log に存在し、本 PR は design-system への転記・体系化のみ
- Source docs updated in this PR: docs/design-system/01-decision-rules.md / 02-component-catalog.md / README.md
- Design gaps intentionally deferred: Non-scope 節参照
- Durable decisions discovered: なし

Minimum design checks: docs-only につきレイヤー / backend / DTO / 永続化 / エラー各項目は該当なし。operator 文言観点は DSR-03 / DSR-14 の文面に反映。

## Test Plan

- targeted tests: なし（docs-only）
- negative tests: なし
- compatibility checks: `./scripts/doc-consistency-check.sh`（DS1 canonical path 実在 / DS2 DSR 参照整合 / DS3 token HEX / DS4 review-checklist 対応、M1 曖昧表現、R3 リンク実在）
- data safety checks: 合成データのみ使用（skeleton 例示は架空データ規約を維持）
- main wiring/integration checks: なし

## Boundary / Wire Contract

not applicable — docs-only、wire 契約に触れない。

## Review Focus

- 昇格文面が実装現物と一致しているか（component 名 / パス / 挙動）
- DSR-03 3 階層ルールが既存 DSR-08（色のみ禁止）/ memory 判断軸（operator-ui-critical-notes-placement）と矛盾しないか
- 見送り 3 件の判断が demand-driven 基準に照らして妥当か

## Spec Contract

R2 につき省略（Test Matrix 任意、runtime contract 変更なし）。

## Trace Matrix

R2 につき省略。

## Data Safety

- 実店舗データ / 実ファイル内容は記載しない（例示は全て合成データ）
- 実 POS ファイルパス・店舗固有情報を含めない

## Implementation Results

- `01-decision-rules.md`: DSR-02 実例追加（UI-07 Tabs）、DSR-03 3 階層拡張 + `scrollPageToTop()` 規約、DSR-14（path-based ファイル選択）/ DSR-15（returnTo 検証）新設、タイトル DSR-01〜15 化
- `02-component-catalog.md`: ① 詳細ルートの戻る導線 / ③ 元記録リンク列 + 直近実績サマリテーブル / ⑥ インライン選択エラー 1 スロット（パターン番号は 13 のまま）
- `README.md`: 索引行を DSR-01〜15 + 新キーワードへ更新
- `./scripts/doc-consistency-check.sh` 全チェック通過（DS1 のディレクトリ参照エラーと DS2 の DSR-14 孤立警告は同 PR 内で修正済み: canonical を具体ファイルへ変更、⑥ から DSR-14 参照を追加）
- 見送り 3 件（/inventory/records ハブ / 備考 fallback / PLU prepare-confirm）は Non-scope 節に理由記録

## Review Response

Review-only skipped because: docs-only（R2）で runtime 挙動変更なし。doc-consistency-check の機械検査 + 昇格文面の rg 実装突合で代替。DEV_WORKFLOW R2 規定（review-only は R3 default）に整合。
