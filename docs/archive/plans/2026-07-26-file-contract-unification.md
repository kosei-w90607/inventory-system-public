# Plan Packet — 監査是正 順9: file 選択・上限・Z004 flow の一契約化 + 実 hook test

## Workflow State

- Phase: archive
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 83d8fdd
- Amendments: 947e20c, ed855f9
- Coordinator: Fable 5（本 thread。scope 精査・Design Phase・packet・裁定）
- Writer: Codex（owner relay 発注。Plan 承認後の単独 writer）
- Plan Reviewer: Sonnet 5 fresh context（Fable が subagent 起動・裁定）
- Final Reviewer: Sonnet 5 fresh context（Fable が subagent 起動・裁定）
- Reviewed Content HEAD: 7d6e441
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: ①視認確認 — 3 画面（csv-import / product-import / return-exchange）の FilePicker 表示・選択後 state の dev スクショを PR body で owner が目視 PASS/FAIL。②Windows native L3 1 項目 — 代表 1 画面（csv-import）で FilePicker の native dialog 起動 → 選択 → 取込み 1 flow（L3 Eligibility 充足: WebView2 固有挙動は native でのみ観察可、既存ツールのみ、fault-injection 不要）

- State Narrative（2026-07-26）: Fable 5 が scope 精査を実施。P1-2 / P4b-2 / P8b-1 の
  証拠を現 HEAD（`43ddb9d` 基準）で確認し、owner 裁定（2026-07-26）: 共通 FilePicker は
  **drag&drop を維持して共通化**（native dialog 一本化は不採用）。Design Phase 成果
  （D-054、UI_TECH_STACK 共通 FilePicker + cross-language 定数規範、UI-01c-D14/D15、
  UI-03-D20、55-ui の FilePicker / 生成定数化）と本 packet・Matrix を同一 plan-first
  commit にまとめ、`kickoff -> spec-check -> design -> plan-draft -> plan-gate` を
  materialize する。Plan 承認前に production code は変更しない。

- State Narrative（2026-07-26、Plan Review 一次）: Plan Reviewer（Sonnet 5 fresh
  context）は P1=1 / P2=3 / P3=0、総評「条件付き承認可」。P1 = UI_TECH_STACK 内の
  旧「暫定例外維持」記述と新 D-054 節の自己矛盾 — accept、旧記述を D-054 supersede へ
  書換え。P2-1 = Contract Probe の「外部前提なし」は誤りで tauri-specta に定数 export
  API がない — accept、実装方式を「specta export 後の手書き append（idempotent）」に
  確定し Probe を訂正。P2-2 = File 型中間 handler の signature 変更の明記漏れ — accept、
  Scope / Ledger に追加。P2-3 = 商品 import guard の CMD 単独は既存の CMD+BIZ 二重防御
  慣行と非対称 — accept、**BIZ `preview_import` 安全網も追加**する方向で UI-01c-D15 /
  Scope / Ledger / Matrix（X9）を更新。是正は plan-gate 内修正、再レビューは同 reviewer
  context の差分確認。

- State Narrative（2026-07-26、owner Plan 承認 / state-only）: 再レビューは同 reviewer
  context の差分確認 2 round で P1/P2/P3 = 0/0/0（「BIZ 不変」同型残存の grep 0 件確認
  込み）。owner は Plan を承認した（この change での介入 1 回目 / 予算 3 回）。
  plan-first `83d8fdd` を `Plan Commit` へ固定し、plan-gate 内是正 `947e20c` /
  `ed855f9` を `Amendments` へ記録、`plan-gate -> plan-approved -> implementing` を
  隣接 forward transition として materialize する。評価条件（reviewer P1/P2=0、
  plan-first が全実装 commit に先行）はこの commit より前に存在する。実装は Codex 発注
  （owner relay）。Final Review 以降は次セッションの Coordinator が
  `Plans.md` 次の行動 0 → 本 packet の順で再開する。

- State Narrative（2026-07-27、Final Review 一次裁定）: Final Reviewer（Sonnet 5
  fresh context）が実装 `9a78a4a`（Draft PR #26）をレビュー。X1〜X9 は全件 clean
  committed tree への実注入で red を独立再実測（writer の kill 主張に虚偽なし）。
  findings P1=1 / P2=2 / P3=2。P1 = FilePicker 共通化で旧 `extractFilename` の
  Windows WebView2 drag&drop 絶対パス防御が drop 経路から消失（`FilePicker.tsx`
  handleDrop が `file.name` 無加工。dialog 経路のみ正規化）— Coordinator が
  `77012b1` の実配線（useCsvImportFlow / useProductImportFlow 両方が適用）と現
  HEAD の production 参照ゼロを実読で裏取りし accept。P2-1 = 55-ui-csv-import.md
  §機能一覧（extractFilename 現役記載 / FileDropzone plain input 記載）の stale —
  accept。P2-2 = FilePicker 5 箇所で aria-label が可視ボタン文言を含まない
  （WCAG 2.5.3 Label in Name、今回の統合で新規導入）— accept。P3 2 件（死コード
  extractFilename / basename ロジック重複）は P1 是正へ統合して消化。是正は Codex
  追発注（relay 2/2）、Matrix へ X10（drop 経路 basename 正規化）を plan-first で
  追加済み。再レビューは同 Final Reviewer 系統の fresh context による差分確認 +
  X10 実注入で行う。

- State Narrative（2026-07-27、Final Review 収束 / state-only）: writer 是正
  `7d6e441` に対し差分再レビュー（Sonnet 5 fresh context）を実施、P1/P2/P3 =
  0/0/0。X10 / X7 / X8 は clean committed tree への実注入で red を独立再実測。
  移設 test（`src/lib/extractFilename.test.ts`）の case 等価、Non-scope（日報
  hook は共有 basename 関数への等価置換のみ）、writer docs 変更が裁定 narrative
  無改変の追記のみであることを確認。L1 / release check / traceability / AC sweep
  の証跡は PR #26 body を正とする。評価条件が全て本 commit より前に存在するため、
  `implementing -> local-verified -> independent-review -> human-confirm` を隣接
  forward transition として materialize し、`Reviewed Content HEAD` を content
  candidate `7d6e441` に固定する。残 gate = Human Gate ①視認 ②L3 1 項目 →
  owner の Ready 承認（介入 2/3）→ ready-hosted-final。

- State Narrative（2026-07-27、Human Gate 完了 / state-only）: owner が Human Gate
  を実施（この change での介入 2 回目 / 予算 3 回）。①視認 = PR body の 3 画面
  synthetic スクショを目視 PASS。②L3 = 現行 parser 受理 shape の synthetic Z004
  で native dialog 起動 → file 選択 → プレビュー → 取込みの 1 flow 完走を確認。
  あわせて実採取 layout A file（メタ 6 行・日付 5 行目）の「精算日を抽出できません」
  graceful stop を再観測 — これは PR #125 L3 / 2026-07-06 issue #135 に続く既知
  挙動の 3 回目の再確認であり、本 packet の Non-scope（parser 変更なし）どおり。
  追跡は既存 backlog「Z004 parser の layout A 対応」（Post-PLU Z004 再評価、
  D-025）に既在のため新規積増しなし。owner が Ready を承認し、
  `human-confirm -> ready-hosted-final` を materialize する。以後 = 本 commit を
  含む exact HEAD で L1 full → PR body 全体 refresh → owner の Ready 化 +
  hosted dispatch → hosted green 確認 → merge（介入 3/3）。

- State Narrative（2026-07-27、Post-Merge Closeout）: exact HEAD `af5877a` の L1 full
  PASS と PR body 全体 refresh の後、owner が Ready 化 + hosted dispatch を実行、
  hosted final green（run 30212830170、exact HEAD 一致）を Coordinator が実確認。
  owner が squash merge `9cba5aa`（介入 3/3、予算どおり）。packet / Matrix を
  `docs/archive/plans/` へ移動して `merge -> archive` を materialize、`Plans.md` /
  PROJECT_HANDOFF を同期。振り返りは
  [WER](2026-07-27-file-contract-unification-workflow-effectiveness-review.md)。
  L3 で再観測した実採取 layout A file の graceful stop は既存 backlog
  「Z004 parser の layout A 対応」（Post-PLU Z004 再評価、D-025）で追跡する。

## Owner Effort Budget

- 介入回数上限: 3（Plan 承認 / L3+視認+Ready / merge）
- 実働時間上限: 30分
- relay 往復上限: 2（実装発注 + 必要時の追発注）

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 3 回` + `承認すると利用者から見て何が完了するか1文`。

## Risk

Risk: R3

Reason:
商品 import CMD の受理挙動（20MB 超過拒否の追加 = command wire behavior 変更）、
operator の file 選択 workflow 3 画面の変更、bindings 生成物の拡張（定数 export）を
伴うため R2 ではない。DB schema・データ lifecycle・restore 系・POS 出力形式は
一切触れないため R4 には上げない。労力は監査見積りどおり M。

## Goal

Goal Invariant:

### 最小完了条件

- file サイズ上限が `constants.rs` 単一 SSOT から frontend（bindings 生成定数）と
  全 import 系 CMD（商品 import 含む）の両方に効く。
- 3 画面の file 選択が共通 FilePicker（native dialog + 任意 drop）経由になり、
  WebView2 白画面バグの再発面が picker 一箇所に集約される。
- `useCsvImportFlow` の公開挙動（guard / 3 mutation / kind 別 recovery / blocker /
  invalidation）が実配線 test で検査される。

### 失敗定義

- frontend に file サイズ上限の local 複製（`20 * 1024 * 1024` 等のリテラル）が残る。
- 商品 import CMD が上限超過 file を受理する。
- 移行対象画面に plain `<input type="file">` / 画面ローカル dropzone が残る。
- FilePicker の cancel（null）が選択済み state を消す、または drop 経路が失われる。
- P8b-1 記載の mutation（guard 削除・recovery 反転・blocker 削除・invalidation 削除）が
  test green のまま生存する。
- 日報取込み（PR #125 実装）の既存挙動が変わる。

### 非目的

- 日報取込み画面の FilePicker 再実装（path-based 移行済み。共通化は動作等価な
  リファクタに留め、挙動変更しない。工数超過時は現状維持で defer 可）。
- P8b-2（home の query orchestration test）— 別是正単位。
- CSV parse/commit の BIZ/CMD ロジック変更、`CSV_IMPORT_LINE_LIMIT` の扱い変更。
- SCREEN_DESIGN の画面レイアウト変更（picker の見た目は既存 dropzone 相当を維持）。

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- 生成系: bindings 生成に `CSV_IMPORT_FILE_SIZE_LIMIT` の export を追加
  （constants.rs SSOT → bindings.ts。D-054①。実装方式は specta export 後の手書き
  append — Contract Probe 参照）。
- CMD/BIZ: 商品 import に上限超過の validation 拒否を **CMD 早期拒否 + BIZ
  `preview_import` 安全網の二重**で追加（UI-01c-D15。売上/日報の既存二重防御
  パターンと同型。文言は既存上限文言と整合させる）。
- UI 中間層: `selectFile` / `handleReceiptFile` 等、Web `File` 型を受け取る中間
  handler / hook / component props の signature を FilePicker 出力
  `{ bytes, filename, size }` へ変更する（D-054② の伝播。挙動は等価）。
- UI: 共通 `FilePicker` component 新設（D-054②: dialog 経路 + 任意 drop 経路、
  出力 `{ bytes, filename, size }`、cancel null 据え置き、accept / disabled /
  上限表示 / accessible label props）。移行対象 = csv-import `FileDropzone` /
  `PreviewStep` 再選択、product-import `ProductImportDropzone` /
  `ProductImportPreview` 再選択、return-exchange の画像 input（UI-03-D20、
  Blob プレビュー）。
- UI: 3 frontend hook の local 20MB 定数を bindings 生成定数 import へ置換。
- Test: `useCsvImportFlow` を daily-report の実配線 pattern（renderHook +
  QueryClient）で検査（P8b-1。20MB guard / parse・commit・rollback の成功失敗 /
  `import_error` recovery / `useBlocker` / 成功後 invalidation）。FilePicker unit test。
- 再発防止: file サイズリテラル local 複製と plain file input / 画面ローカル dropzone
  再導入の静的 sweep test。
- source design docs（D-054 / UI_TECH_STACK / 60-ui D14・D15 / 63-ui D20 / 55-ui）は
  本 plan-first commit で更新済み。

## Non-scope

- 日報取込みの挙動変更（既存 path-based 実装の維持。共通化 refactor は等価変換のみ）。
- P8b-2 / home 系 test、`ErrorState.tsx`、import recovery 分岐のロジック変更。
- `dragDropEnabled` window 設定の変更（drop 維持のため据え置き）。
- DB schema / BIZ 業務ロジック。

## Acceptance Criteria

- `rg -n '20 \* 1024 \* 1024|20971520' src` が 0 hit（sweep 結果を PR body に記録）。
- `rg -n 'type="file"' src/features` が 0 hit（共通 FilePicker 内のみ許容、
  `src/components` 配下の FilePicker 実装は除外）。
- `bindings.ts` に `CSV_IMPORT_FILE_SIZE_LIMIT` が生成される（diff を PR に含める）。
- `cargo test` green。新規 `test_import_products_req104_rejects_oversize_file` を含む。
- `npm test` green。実配線化した `useCsvImportFlow.test.tsx`（REQ-401）、
  `FilePicker.test.tsx`（REQ-104/REQ-401/REQ-202 共通部品）、静的 sweep
  `file-contract-no-local-duplicates.test.ts` を含む。
- 3 画面の dev スクショで FilePicker 表示・選択後 state（`ファイルを選択` 導線と選択済み
  filename 表示）が読めること（synthetic のみ）。PR body 視認確認節に添付し owner の
  目視 `PASS` 記録を得る。
- `cargo fmt --check` / `cargo clippy -- -D warnings` / L1 `local-ci.sh full` CLEAN。

## Design Sources

- Requirements / spec: REQ-401（Z004 取込み）、REQ-104（商品一括 import）、
  REQ-202（返品・レシート画像）、監査 finding P1-2 / P4b-2 / P8b-1
- Architecture: `docs/ARCHITECTURE.md`（層責務。変更なし）
- Function / command / DTO: `docs/function-design/60-ui-product-import.md`
  （UI-01c-D14/D15）、`63-ui-return-exchange.md`（UI-03-D20）、`55-ui-csv-import.md`、
  `42-cmd-sales-stocktake.md`（既存 20MB 記述、参照のみ）
- DB: なし
- Screen / UI: `docs/UI_TECH_STACK.md` 共通 FilePicker 節 + cross-language 定数規範
- Decision log / ADR: `docs/decision-log.md` D-054

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 60-ui UI-01c-D15（商品 import guard） | updated in this PR |
| Command / DTO / generated binding / wire shape | UI_TECH_STACK 定数規範 + 本 packet Boundary / Wire Contract | updated in this PR |
| DB / transaction / audit / rollback / migration | 変更なし | existing sufficient |
| Screen / UI / route state / Japanese wording | UI_TECH_STACK FilePicker 節、60-ui / 63-ui / 55-ui | updated in this PR |
| CSV / TSV / report / import / export format | 形式不変（選択 UI と guard のみ） | existing sufficient |
| Durable decision / ADR | decision-log D-054 | updated in this PR |

## Registration / Generation Obligations

| 新規追加物 | 登録・生成義務 |
|---|---|
| bindings への定数 export | `cargo run --bin generate_bindings` 再生成（L1 生成系検査対象） |
| 新規 Tauri command | なし（既存 command の validation 追加のみ） |
| function-design doc 新設 | なし（既存 doc 更新のみ） |
| route / operator 画面新設 | なし（既存 3 画面の部品置換） |
| REQ coverage 追加 | 新規 test に REQ 番号を含め `generate_traceability` 再生成。**REQ タグは test の domain と一致させる**（順8 Final Review P2 の再発防止: csv-import=REQ-401 / 商品 import=REQ-104 / 返品=REQ-202） |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| P4b-2 / REQ-104 | UI_TECH_STACK 定数規範 | D-054① | 定数 SSOT は backend（直接 IPC bypass を防げるのは backend guard のみ）。command 取得案は IPC 原則違反で却下 | bindings 生成器 + 3 hook + product cmd | `test_import_products_req104_rejects_oversize_file` + sweep |
| P1-2 / REQ-104・REQ-401・REQ-202 | UI_TECH_STACK FilePicker 節 / 60-ui D14 / 63-ui D20 | D-054② | 白画面バグの再発面を一箇所へ集約。native 一本化は owner 裁定で不採用（drop 維持） | `src/components` FilePicker + 5 置換 | `FilePicker.test.tsx` + sweep |
| P8b-1 / REQ-401 | 55-ui-csv-import §224-258 / §344-365（既存契約） | — | daily-report の実配線 pattern を流用。page test の全面 mock は公開挙動を守れない | `useCsvImportFlow.test.tsx` 実配線化 | 同 test（X3〜X6 で感度実測） |

## Design Intent Audit

- Source docs で what/why が完結: 可（D-054 に却下代替案と supersede 根拠、各 doc に D 行）。
- Plan-only durable decisions: なし（起票前に昇格済み）。
- Assumptions: plugin-dialog / plugin-fs + capability は導入済み（Cargo.toml /
  package.json / PR #125 実確認済み）。bindings 生成器は自作（`export_specta_bindings`）で
  定数 export の追記が可能。
- Deferred gaps: 日報画面の FilePicker 共通化は等価 refactor に留め、工数超過時 defer 可
  （Non-scope に明記）。
- Matrix は design decision ID を引用可能。
- Absolute guarantee self-check: 「local 複製 0」の escape hatch = FilePicker 内部と
  test fixture のリテラルは sweep の許容 list で明示管理する。

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | plugin-dialog/fs は adapter、FilePicker 出力契約が app-core | UI_TECH_STACK |
| Fact check / design decision split | UI-01c-D3 / UI-03-D4 の却下理由が stale と実査で確定 → supersede | D-054 |
| Lifecycle / retry | cancel null 据え置き / 同一 file 再選択 / disabled 中の選択不可を Matrix で検査 | Matrix |
| Operator workflow | 選択ボタンが native dialog になる以外の flow 不変（drop 維持） | 視認 + L3 1 項目 |
| Replacement path | dialog plugin 置換時は FilePicker 1 箇所の修正で済む構造になる | UI_TECH_STACK |
| Data safety / evidence | 実 file 不使用、synthetic fixture / スクショのみ | Data Safety |
| Reporting / accounting semantics | not applicable（集計非接触） | — |
| Manual verification | WebView2 固有挙動 1 項目のみ L3（代表 csv-import） | Human Gate |

## Design Readiness

- Existing design docs are sufficient because: D-054 と各 doc 更新後、FilePicker 契約・
  定数供給・guard 追加は source docs で完結する。
- Source docs updated in this PR: D-054 / UI_TECH_STACK / 60-ui / 63-ui / 55-ui。
- Design gaps intentionally deferred: 日報画面の共通化 refactor（等価変換、defer 可）。
- Durable decisions promoted: D-054。

Minimum design checks:

- Layer ownership: 上限 guard は CMD 早期拒否 + BIZ `preview_import` 安全網の二重
  （UI-01c-D15）、file 読取りは FilePicker（UI）。BIZ の業務ロジック自体は不変。
- Backend function design: UI-01c-D15。
- Command / DTO / data contract: Boundary / Wire Contract 節。
- Persistence / transaction / audit impact: なし。
- Operator workflow / Japanese UI wording: FilePicker のボタン文言は既存画面の文言を維持。
- Error / empty / retry: cancel null 据え置き、上限超過は既存 Sonner トースト文言維持。
- Testability: REQ-104 / REQ-401 / REQ-202 を test 名に付与（domain 一致必須）。

## Contract Probe

- tauri-specta に定数 export の公式 API はない（Plan Review 一次 P2-1 で確認）→ 定数
  export は `export_specta_bindings` 内で specta の export **後** に手書き append する
  方式で実装する（specta が file 全体を上書きしてから append するため re-run は
  idempotent）。specta 側 API の有無に依存しない設計。
- plugin-dialog + plugin-fs の path-based 読取りは日報取込み（PR #125）で production
  実証済み — 追加 probe 不要。

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| D-054①: constants.rs SSOT → bindings 定数 export | 生成器 + `bindings.ts` | 生成 diff clean（L1）+ sweep test | — |
| D-054①: 3 hook の local 複製排除 | useCsvImportFlow / useDailyReportImportFlow / useProductImportFlow | `file-contract-no-local-duplicates.test.ts` | — |
| UI-01c-D15: 商品 import CMD の上限拒否（早期） | product cmd | `test_import_products_req104_rejects_oversize_file` | — |
| UI-01c-D15: 商品 import BIZ の上限安全網 | `product_service::preview_import` | `test_preview_import_req104_rejects_oversize_file`（BIZ unit） | — |
| UI-01c-D15 隣接: 売上/日報 CMD+BIZ の既存上限挙動不変 | csv/daily の cmd + parse service | 既存上限 test green（実在確認は Matrix） | — |
| D-054② 伝播: File 型中間 handler の signature 変更が挙動等価 | selectFile / handleReceiptFile 等 | 実配線 hook test + 各画面既存 test green | — |
| D-054②: FilePicker 出力契約 `{bytes, filename, size}` | `src/components` FilePicker | `FilePicker.test.tsx` | — |
| D-054②: cancel null 据え置き | FilePicker | 同上（X7） | — |
| D-054②: drop 経路維持 | FilePicker | 同上（X8） | — |
| D-054②: 5 箇所の置換 + plain input 排除 | 3 画面 + 再選択 2 箇所 | sweep test + 各画面既存 test green | 視認 3 画面 |
| UI-03-D20: 画像 bytes → Blob プレビュー | ReturnExchangePage | 既存 return-exchange test green + 視認 | 視認 |
| P8b-1: useCsvImportFlow 実配線公開挙動 | `useCsvImportFlow.test.tsx` | 同 test（20MB / 3 mutation / recovery / blocker / invalidation） | — |
| P8b-1 隣接: D-052 C8/C9 invalidation 契約 | 同上 | 既存 invalidation 契約 test green | — |
| WebView2 白画面回避（dialog 経由選択） | FilePicker | 自動化不能 | L3 1 項目（代表 csv-import） |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-26-file-contract-unification.md](test-matrices/2026-07-26-file-contract-unification.md)

- targeted: 上記 Ledger の各 test。negative: Matrix X1〜X8 を clean committed tree で実注入・kill。
- compatibility: 日報取込み既存挙動不変（既存 test green）、`PluExport` 等の非対象画面非接触。
- data safety: 実 file / 実店舗データ不使用。
- wiring: FilePicker が 5 箇所から実 import、bindings 定数が 3 hook から実 import（rg）。

## Boundary / Wire Contract

- producer: `constants.rs`（SSOT）→ bindings 生成器
- consumer: 3 frontend hook（生成定数 import）+ import 系 CMD（Rust 定数直参照）
- wire type: `bindings.ts` の `export const CSV_IMPORT_FILE_SIZE_LIMIT: number`（バイト数）
- internal type: Rust `usize` / TS `number`（20MB は JS safe integer 内、精度問題なし）
- round-trip path: constants.rs → 生成 → bindings.ts → hook guard。file bytes は FilePicker → `number[]` → `Vec<u8>`（既存経路不変）
- invalid input: 上限超過は UI 早期 reject + CMD validation 拒否の二重防御。cancel null は state 据え置き
- compatibility: 商品 import CMD の新規拒否は「UI が既に拒否している値」の backend 正本化で、正常系の受理範囲は不変。bindings への定数追加は additive

## Review Focus

- sweep の許容 list（FilePicker 内部・fixture）が広すぎて複製検出が骨抜きになっていないか。
- useCsvImportFlow 実配線 test の oracle 独立性（55-ui 契約からの独立転記、production
  定数 import は guard 境界値のみ許容判断を Matrix に明記）。
- 5 置換で各画面の既存 UX（disabled / accept / 上限表示 / a11y label / 文言）が
  落ちていないか。
- 日報取込みへの意図しない挙動変更。

## Spec Contract

Contract ID: SPEC-FILE-CONTRACT-2026-07-26

- file サイズ上限は constants.rs 単一 SSOT から frontend 生成定数と全 import 系 CMD に
  効く（D-054① / UI-01c-D15。Test: `test_import_products_req104_rejects_oversize_file` +
  sweep + 生成 diff）。
- file 選択は共通 FilePicker の 2 経路（dialog / drop）に一元化され、cancel null は
  state を変えない（D-054②。Test: `FilePicker.test.tsx` + sweep）。
- `useCsvImportFlow` の公開挙動（guard / parse / commit / rollback / recovery /
  blocker / invalidation）は実配線 test で検査される（P8b-1。Test:
  `useCsvImportFlow.test.tsx`）。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| P4b-2 / REQ-104 | 定数 export + guard 追加 + 複製排除 | `test_import_products_req104_rejects_oversize_file` + sweep test | 受理範囲不変 | cargo test + rg + bindings diff |
| P1-2 | FilePicker 新設 + 5 置換 | `FilePicker.test.tsx` + sweep test | UX 維持・cancel/drop | vitest + 視認 |
| P8b-1 / REQ-401 | useCsvImportFlow 実配線化 | `useCsvImportFlow.test.tsx` | oracle 独立・mutation 感度 | vitest + Matrix kill 記録 |
| REQ-202 | 画像 input 置換 + Blob プレビュー | 既存 return-exchange test + `FilePicker.test.tsx` | 保存前プレビュー維持 | vitest + 視認 |

## Data Safety

- 実店舗 CSV / レシート画像 / 実 path を commit しない。fixture・スクショは synthetic のみ。
- ローカル専用: dev での実 file 選択確認手順。

## Implementation Results

- Rust 定数を起点に bindings 生成後の idempotent append を実装し、売上・日報・商品
  import hook の上限判定を生成定数へ統一した。
- 商品 import は CMD 早期拒否と BIZ 安全網の二重 guard とし、既存 import 系と同じ
  上限契約・エラー語彙へ揃えた。
- dialog 読取りと任意 drop を持つ共通 FilePicker を導入し、Z004・商品 import・
  返品交換画像の選択／再選択を bytes 契約へ移行した。返品画像のプレビューは Blob
  URL 経由へ変更した。
- Z004 flow は実 hook + QueryClient 配線で guard、parse／commit／rollback、
  recovery、離脱 block、invalidation を検証する構成へ更新した。FilePicker と静的
  sweep の regression test、REQ domain に一致する traceability も追加した。
- synthetic file／画像のみを使い、対象 3 画面の初期表示と選択後 state を dev
  スクリーンショットで確認した。検証・mutation・視認の外部証跡は PR body に記録する。

## Review Response

- Final Review 一次の P1 / P2 / P3 を受理し、basename 抽出を共有純関数へ統合して
  dialog / drop の両経路へ適用した。5 call site の accessible name は可視ボタン文言を
  包含する形へ揃え、55-ui の stale な実装記述も現行 FilePicker 契約へ追随した。
- X10 は独立 oracle の POSIX / Windows path fixture で固定し、mutation 実測を含む
  検証証跡は PR body に記録する。
- Findings Freeze: not yet frozen; post-freeze exceptions: none.
