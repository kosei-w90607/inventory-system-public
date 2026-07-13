# Plan Packet: デザインシステム構築（明文化 + ファイル再編 + 普遍化）

> 本 packet は plan rally 5 round（P1/P2 新規 0 で収束）を経た全体プラン。PR-A（docs）/ PR-B（component 抽出）/ PR-C（機械強制）の 3 段構成で、着手は PR-A から。PR-B/C は着手時に各々の Plan Packet へ展開する。

## Risk

Risk: R3

Reason:
operator-facing 設計 SSOT の責務再編（PR-A）+ 複数画面の共有 component 内部置換（PR-B）+ CI/lint merge gate 変更（PR-C）。runtime contract（generated command / DTO / route / search params）と DB schema は 3 PR とも変更しない。

## Goal

散在するデザイン規約を `docs/design-system/` に再編して単一の参照面を作り、Codex を含む誰が組んでも外さない「決まったパーツ + 決まった選択ルール」のパズル状態にする。(1) `docs/UI_TECH_STACK.md` §4 を `docs/design-system/` サブ docs 群へ分離し親に索引を残す、(2) 繰り返し 13 パターンのカタログ + 判断ルール集 DSR-01〜13 を執筆、(3) P1+P2 の 5 共通 component を TDD + 見た目不変方針で抽出して実装ブレを解消、(4) palette 外色 / primitive 直使用を eslint + doc-consistency で機械強制。

## Scope

- PR-A: `docs/design-system/` 新設（`README.md` / `00-foundations.md` / `01-decision-rules.md` / `02-component-catalog.md` / `03-philosophy.md`）+ `docs/UI_TECH_STACK.md` §4（L379-569）・§5.5.1・§6.1〜6.3 の移設とスタブ化 + `docs/SCREEN_DESIGN.md` §6 横断規約の移設 + `docs/DOC_STYLE_GUIDE.md` §0 への design-system 登録 + `scripts/doc-consistency-check.sh` M1/M3 走査対象に `docs/design-system/*.md` を追加 + 導線（`AGENTS.md` / `.agents/skills/inventory-operator-ui/SKILL.md` / `docs/DEV_WORKFLOW.md`）
- PR-B: 5 共通 component（PageHeader / FormSection / DepartmentFilter / SummaryCard / SearchBar）を `src/components/patterns/` へ抽出し、対象画面を内部置換 + `docs/function-design/52-ui-shared-layout.md` 拡張
- PR-C: eslint `no-restricted-syntax` 系ルール（palette 外色 / 生 primitive / barrel 迂回）+ doc-consistency 既定スイートへの DS チェック ID 追加 + 既存違反の先行解消（emerald/rose 6 ファイル、sort ヘッダ button 3 ファイル）

## Non-scope

- 既存画面の意図的な見た目変更（PR-B は DOM 出力不変が原則。例外 = SummaryCard retry 統一・空状態の標準UI 適合（catalog ⑥ 既知逸脱の解消、Codex R1 P2-2 起源）・PR-C の semantic 色補正、いずれも意図的差分として明記 + L3 承認）
- generated command / DTO / route / search params / DB schema の変更
- 新規 npm 依存の追加（Mini Shai-Hulud 凍結中。ast-grep / stylelint / eslint-plugin-tailwindcss は凍結解除後の将来項目として README 言及のみ）
- P3 パターン（Dialog 共有化・日付ナビ utility）の component 化
- 表示スケール再設計（DSR-13 で参照のみ）

## Acceptance Criteria

- PR-A: `bash scripts/doc-consistency-check.sh` が exit 0、かつ拡張後の M1 が `docs/design-system/` 配下の曖昧語を ERROR 検出できる（実装時に違反語を仮置きして fail を確認してから除去）
- PR-A: `rg -n "design-system/README.md" AGENTS.md .agents/skills/inventory-operator-ui/SKILL.md docs/DEV_WORKFLOW.md` が 3 ファイルすべてでヒット
- PR-A: catalog 13 パターンすべてに canonical 実装の file パス参照が存在（`02-component-catalog.md` 内を rg で確認）
- PR-B: `npm test` / `npm run typecheck` / `npm run lint` / `npm run format:check` / `npm run build` がすべて exit 0、DepartmentFilter のローカル実装 3 ファイルが削除済み（`fd DepartmentFilter src/features` が 0 件）
- PR-B: 既存 component test は SummaryCard 意図的差分を除き無変更で green（`git diff --stat` でテスト変更が characterization 追加と SummaryCard のみであることを確認）
- PR-C: `npm run lint` exit 0 かつ `rg -l "emerald-|rose-" src/features` が 0 件、`rg -l "<button" src/features` が 0 件
- PR-C: `bash scripts/doc-consistency-check.sh` exit 0（DS チェック ID 群を含む既定スイート）

## Design Sources

- Requirements / spec: `docs/UI_TECH_STACK.md` §4（L379-569）・§5.5.1・§6.1〜6.4、`docs/SCREEN_DESIGN.md` §6
- Architecture: `docs/ARCHITECTURE.md`（UI 層タスク定義、レイヤー原則）
- Function / command / DTO: 変更なし（PR-B は `docs/function-design/52-ui-shared-layout.md` を拡張）
- DB: 変更なし
- Screen / UI: `docs/SCREEN_DESIGN.md`、`docs/quality/review-checklist.md` カテゴリ 9
- Decision log / ADR: `docs/DOC_STYLE_GUIDE.md` §0（2 層分割規約）、memory の非 IT 利用者判断軸群

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | 触らない | existing sufficient |
| Command / DTO / generated binding / wire shape | 触らない | existing sufficient |
| DB / transaction / audit / rollback / migration | 触らない | existing sufficient |
| Screen / UI / route state / Japanese wording | `docs/design-system/` 5 docs（本 PR 群の成果物そのもの） | updated in this PR |
| CSV / TSV / report / import / export format | 触らない | existing sufficient |
| Durable decision / ADR | `docs/DOC_STYLE_GUIDE.md` §0 追記 + DSR-01〜13 | updated in this PR |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-DS-C1 | UI_TECH_STACK §4 / DOC_STYLE_GUIDE §0 | DS-D1 | §4 拡張案は分割判断 5 条件すべて該当で不採用、2 層分割を採用 | `docs/design-system/` 5 docs | DS-doc 検査（PR-C）+ doc-consistency R3 |
| SPEC-DS-C2 | UI_TECH_STACK §5.5.1 / §6.1〜6.3 | DS-D2 | 二重ソース化回避のため catalog 側を正典化、§6.4 は技術契約として残置 | 移設 + スタブ化 | doc-consistency R3 + A5 grep 全数確認 |
| SPEC-DS-C3 | scripts/doc-consistency-check.sh M1/M3 | DS-D3 | 既定走査が design-system を見ないため glob 拡張（拡張なしでは green が品質保証にならない） | script L634/L734 周辺 | 違反語仮置きで fail 確認 |
| SPEC-DS-C4 | SCREEN_DESIGN §6 ページヘッダー規約 L274-276 | DS-D4 | rule-of-three 充足済みのため component 抽出（PR-B）、HomePage/CsvImportPage は subtitle 構造差で二択判定 | `src/components/patterns/PageHeader` | 既存 page test + characterization test |
| SPEC-DS-C5 | UI_TECH_STACK §4.1 semantic token | DS-D5 | emerald/rose 直書き 6 ファイルは token 統一（hue 変化は意図的色補正、L3 承認） | PR-C C1 commit | `rg -l "emerald-\|rose-" src/features` = 0 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: PR-A 完了後、`docs/design-system/README.md` が単一入口になり、catalog / DSR / foundations で「何を・どう組むか」が完結する
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: DSR-01〜13 の判断ルール群を `01-decision-rules.md` に昇格、DOC_STYLE_GUIDE §0 に design-system 階層を登録
- Assumptions and constraints: npm install 凍結（新規 devDep 不可）、Codex 可視性（`.claude/` のみ配置禁止）、非 IT 高齢利用者前提（WCAG 1.4.1、中庸 active）
- Deferred design gaps, risk, and follow-up target: ast-grep 構造 lint と tailwind 系 plugin は凍結解除後、P3 パターン component 化は将来 PR、esquery `Literal[value]` regex の成立性は PR-C packet で公式 docs 検証
- Test Design Matrix can cite design decision IDs or source doc sections: SPEC-DS-C1〜C5 / DS-D1〜D5 を本 packet と matrix で共有

## Design Readiness

- Existing design docs are sufficient because: UI_TECH_STACK §4 にトークン層と SegmentedControl 仕様が確立済み、SCREEN_DESIGN にページヘッダー規約と画面判断が存在し、移設 + 汎化 + 新規執筆（カタログ・DSR）で完結する
- Source docs updated in this PR: `docs/design-system/` 5 docs 新設、UI_TECH_STACK / SCREEN_DESIGN / DOC_STYLE_GUIDE / review-checklist / AGENTS.md / SKILL.md / DEV_WORKFLOW.md
- Design gaps intentionally deferred: Non-scope 参照（ast-grep、P3 パターン、表示スケール）
- Durable decisions discovered in this plan and promoted to source docs: DSR-01〜13、design-system 階層規約

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): UI 層内のみの変更、層間呼び出し変更なし
- Backend function design: 変更なし
- Command / DTO / data contract: 変更なし
- Persistence / transaction / audit impact: なし
- Operator workflow / Japanese UI wording: 文言は既存画面から不変（PR-B は内部置換）
- Error, empty, retry, and recovery behavior: catalog ⑥（空状態・エラー）と SummaryCard retry 統一で標準化
- Testability and traceability IDs: SPEC-DS-C1〜C5 / DSR-NN / DS-D1〜D5

## Test Plan

Test Design Matrix: `test-matrices/2026-06-12-design-system-codification.md`

- targeted tests: PR-A = doc-consistency 全 suite + M1 拡張の fail 実証。PR-B = 5 component の新規 unit test + 既存 page/component test 不変 green。PR-C = lint 違反ゼロ + DS チェック green
- negative tests: M1 違反語仮置き fail / characterization test が置換前実装で green・壊した実装で fail することの確認 / lint ルールに対する違反サンプルでの fail 確認
- compatibility checks: 既存 docs の §4 / §6 参照が全数張替済み（A5 の両系統 grep + root 導線ファイル）
- data safety checks: 合成データのみ、実 POS CSV / 実 DB / backups / secrets を commit しない
- main wiring/integration checks: AGENTS.md / SKILL.md / DEV_WORKFLOW.md の導線から README.md に到達できる（rg で参照行を確認）

## Boundary / Wire Contract

- producer: 変更なし
- consumer: 変更なし
- wire type: 変更なし（JSON API / CSV / DTO / bindings / DB に非接触）
- internal type: PR-B の component props は UI 層内部契約で wire 非該当
- precision/range: 該当なし
- round-trip path: 該当なし
- invalid input: 該当なし
- compatibility: docs 参照の張替は A5 で全数 grep、R3 リンク検査で機械確認

## Review Focus

- 移設の同値性: §4 / §5.5.1 / §6.1〜6.3 の本文が欠落なく design-system 側へ移り、元がスタブ + リンクに正規化されているか（L379-569 の終端取りこぼしに注意）
- DSR-01〜13 が実装と矛盾しないか（特に DSR-08 semantic 色と既存 6 ファイルの違反解消順序）
- PR-B の安全網二分（既存 test あり = 不変条件 / なし = characterization 先行）が守られているか
- PR-C の lint が誤検出（`src/components/ui/**`、コメント内の色名言及）を出さないか

## Spec Contract

Contract ID: SPEC-DS-2026-06-12

- SPEC-DS-C1: `docs/design-system/` は README 親索引 + 4 サブ docs の 2 層構造を持ち、catalog 13 パターンと DSR-01〜13 を収録する
- SPEC-DS-C2: 移設された規約の正典は design-system 側 1 箇所のみ。移設元（UI_TECH_STACK §4・§5.5.1・§6.1〜6.3、SCREEN_DESIGN §6 横断分）はスタブ + リンク
- SPEC-DS-C3: `scripts/doc-consistency-check.sh` の M1/M3 は `docs/design-system/*.md` を走査する
- SPEC-DS-C4: 5 共通 component は `src/components/patterns/` に置かれ、置換後に重複実装（DepartmentFilter×3 等）が残らない
- SPEC-DS-C5: `src/features/**` に palette 外色 class と生 `<button>` が存在せず、lint がそれを恒久強制する

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-DS-C1 | A1-A4 | doc-consistency R3 + DS-doc 検査（PR-C で機械化） | catalog 完備・DSR 孤立なし | `bash scripts/doc-consistency-check.sh` exit 0 |
| SPEC-DS-C2 | A2, A5 | A5 両系統 grep + R3 | 移設同値性・二重ソース化なし | `rg -n "UI_TECH_STACK\|SCREEN_DESIGN" docs/ src/ AGENTS.md CLAUDE.md` 張替後 0 件の旧参照 |
| SPEC-DS-C3 | A7 | 違反語仮置き fail 実証 | M1/M3 glob 拡張の実効性 | 仮置き時 ERROR / 除去後 exit 0 |
| SPEC-DS-C4 | B1-B6 | 新規 component test + 既存 test 不変 green | 安全網二分の遵守 | `npm test` exit 0 + `fd DepartmentFilter src/features` 0 件 |
| SPEC-DS-C5 | C1-C4 | lint 違反サンプル fail 確認 | 誤検出なし・抜け道封じ | `npm run lint` exit 0 + `rg -l "emerald-\|rose-" src/features` 0 件 |

## Data Safety

- 実 POS CSV（Z004 等）・実店舗 DB・backups・secrets を commit しない
- catalog の例示はすべて合成データ（架空の商品名・コード）で書く
- PR-A/B/C とも `images/` や `.local/` 配下のローカル成果物に非接触

## PR-A 詳細（着手対象）

- 新設: `docs/design-system/README.md` / `00-foundations.md`（§4.1〜4.4 移設）/ `01-decision-rules.md`（DSR-01〜13）/ `02-component-catalog.md`（13 パターン、各: 使いどころ / JSX skeleton / 使用トークン / 全状態 / a11y / Do-Don't / canonical file 参照）/ `03-philosophy.md`（§4.6 移設）
- DSR-01〜13: 主動線 1 画面 1 primary / Tabs vs SegmentedControl 判定フロー / Toast vs Alert 基準 / 状態列 vs セル内 badge / read-only vs disabled / 必須表示 / 確認ダイアログ境界 / semantic 色のみ / Form セクション分割 / filter 候補ソース / 空状態・Tooltip 基準 / truncate・密度 / 表示スケール
- catalog 13: ①ページヘッダ ②サマリカード ③テーブル ④フォームセクション ⑤SegmentedControl ⑥空状態・エラー・ローディング ⑦Toast ⑧Dialog/確認 ⑨検索+フィルタ ⑩ページネーション ⑪日付・月ナビ ⑫行インライン展開 ⑬ステータスバッジ
- commit 分割: A1 骨格 + DOC_STYLE_GUIDE §0 登録 → A2 foundations + §5.5.1/§6.1〜6.3 移設 + スタブ化（§4 は L379-569 全体）→ A3 カタログ → A4 DSR → A5 参照張替（`rg -n "UI_TECH_STACK|SCREEN_DESIGN" docs/ src/ AGENTS.md CLAUDE.md`。既知の §6 直接参照 = `docs/Plans.md` L133 / `51-ui-product-form.md` L24 / `50-ui-product-list.md` L26 / `58-ui-stock-inquiry.md` L486 / `DEV_SETUP_CHECKLIST.md` L419。root `Plans.md` は symlink のため docs/ 走査でカバー）→ A6 導線 → A7 M1/M3 glob 拡張 + green 化

## PR-B 詳細（着手時に独立 packet 化）

- props 契約: `PageHeader{title, actions?}`（HomePage/CsvImportPage は h1+副題構造のため「除外 + 理由記録」or「subtitle? 追加で 7 画面統合」を packet で二択判定）/ `FormSection{title, description?, children}`（ProductForm ローカル helper の昇格）/ `DepartmentFilter{options, selected, onChange, disabled?, allLabel?, widthClass?, idPrefix?}` / `SummaryCard{title, isLoading, isError, onRetry, loadingSkeleton?, children}`（retry 必須化 = 意図的差分。daily/monthly の retry 不在を grep で機械実証してから着手）/ `SearchBar{value, onSearchChange, label?, placeholder?}`（命名統一方針と test の import 影響を packet で明記）
- 安全網: 既存 test あり（FormSection / SearchBar 系）= 不変条件。なし（SummaryCard 系・一部 PageHeader 画面）= characterization test 先行作成
- 空状態の標準UI 適合（Codex R1 P2-2 起源）: catalog ⑥ の既知逸脱（`ProductListPage.tsx` の単一文言空状態 vs 標準UI = アイコン + 見出し + 説明 + アクション）を意図的差分として解消する。EmptyState を 6 つ目の共通 component にするか対象画面の局所修正にするかは PR-B packet 展開時に判定（タスク 7-8b 横断 UI 標準化と連動）
- commit 分割: B1 PageHeader → B2 FormSection → B3 DepartmentFilter → B4 SummaryCard → B5 SearchBar → B6 設計書 + catalog canonical 更新

## PR-C 詳細（着手時に独立 packet 化）

- C-lint-1 palette 外色: 第一候補 esquery `Literal[value=/.../]` regex、不成立なら bash grep gate。公式 docs（typescript-eslint / esquery）引用検証を packet で実施。先行 commit で emerald/rose 6 ファイルを token 移行（hue 変化は意図的色補正、L3 承認、`fix(ui)` prefix）
- C-lint-2 生 primitive: 初期 scope `<button>` 限定（違反 3 ファイル先行対応）。`<input>/<select>` raw 6 ファイルは棚卸しの上で段階拡大判断
- C-lint-3 barrel 迂回封じ: prior art `c5f3786` の `ExportNamedDeclaration[source.value=...]` が直接該当
- DS-doc 検査: doc-consistency 既定スイートに新チェック ID として統合（catalog canonical 実在 / 参照先 component 実在 / DSR 孤立 / review-checklist 対応 / STYLE 準拠）。`--target` 新設はしない
- commit 分割: C1 色 token 移行 → C2 button 対応 → C3 lint ルール → C4 DS 検査統合 → C5 将来項目 README 注記

## 実行体制

- orchestrator: packet 管理・subagent 委譲・検証・commit/PR 操作
- PR-A 執筆: カタログ・DSR 本文は Opus subagent、移設の機械的部分は Sonnet subagent
- PR-B/C: 各 packet 承認後に Sonnet 実装

## Self-Review

1. **技術的前提**: main は PR #95 merge 後 `b381c27` で clean、rebase 不要。PR-A は .md + script 1 本で LSP Policy は docs 非適用（memory feedback-lsp-skills-policy-hook）。commit prefix は PR-A=`docs(design-system):`（script 変更 commit のみ `chore(scripts):`）、PR-B=`feat(ui-patterns):`、PR-C=`chore(lint):`+`fix(ui):`。npm 凍結制約は PR-C 設計に織込み済（新規 devDep 不使用）。
2. **スクリプト詳細**: 新規 script は書かず `scripts/doc-consistency-check.sh` の拡張のみ — PR-A で M1/M3 の target glob に `docs/design-system/*.md` を追加（L634/L734 が現状の default 定義、rally R2 P1-1 で実証）、PR-C で既定スイートに DS チェック ID を追加（`--target` 新設はしない。rally R1 P2-1 / R2 P2-4 で確定）。eslint は PR #48 prior art `c5f3786` を git log から復元参照（source.value 系は C-lint-3 のみ直接該当、rally R3 P3-4）。
3. **ドキュメント修正**: 移設は「UI_TECH_STACK §4 L379-569（L566 reviewed コメントで切ると §4.6.4 末尾を落とす、rally R3 P3-3）+ §5.5.1 + §6.1〜6.3」「SCREEN_DESIGN §6 横断規約」の 2 系統。R3 リンク影響は §4 参照 + §6 参照の両系統 grep を A5 に内包（root 導線 AGENTS.md 含む、rally R3 P2-1 / R2 P2-3）。archive 済み plan 内の旧参照は歴史的記述として不変。
4. **検証計画**: PR-A は M1/M3 走査拡張を自 PR に含めて gate 実効化（rally R2 P1-1）。PR-B は「既存 test あり = 不変 / なし = characterization 先行」の二分（rally R2 P1-3）。PR-C は違反ゼロ化先行で CI 赤回避。rally は 5 round で P1/P2 新規 0 収束。公式 docs 検証（esquery 詳細）は PR-C packet 段階に割当（PR-A は外部仕様依存なし）。
5. **後処理**: 各 PR merge 後に Plans.md status 同期 + 完了 packet を `docs/archive/plans/` へ即移動（相対パス変換）。本 packet は承認と同時に実体化済み（commit-0 を defer しない）。Plans.md の「次の行動」を本タスクへ更新する。
6. **実行制約**: PR-B/C 着手は各 packet 承認後。npm install 系は実行しない。既存テストの削除・skip 禁止（SummaryCard の意図的差分のみ test 更新可、PR body 明記）。`.claude/` のみへの成果物配置禁止（Codex 可視性）。
7. **コミット分割**: A1〜A7 / B1〜B6 / C1〜C5 を本文に明記。依存は A→B→C の直列（B は catalog の canonical 参照更新が A に依存、C は B の patterns/ 配置を lint 対象にするため B が先行）。Plans.md は PR-A open 時に `[ ]` 追加、merge で `[x]`。

## Rally ログ（収束済み）

- Round 1（Opus）: P1×3 / P2×4 / P3×3 → palette 外色数の訂正、C-lint-2 button 限定化、esquery 二段構え、`--target design` 誤り訂正、§6 両系統 grep
- Round 2（Opus）: P1×3 / P2×4 / P3×3 → M1/M3 走査範囲の事実誤認是正（glob 拡張を PR-A に追加）、PageHeader 7 ファイル実測と初回 5 画面確定、characterization test 二分、§5.5.1/§6.1〜6.3 の二重ソース化回避、色補正 framing、DOC_STYLE_GUIDE §0 登録、input/select 6 ファイル訂正
- Round 3（Opus）: P1×0 / P2×1 / P3×4 → root 導線 grep 追加（Plans.md symlink は実証済み）、rule-of-three 表現、subtitle 二択、§4 範囲 L379-569、esquery prior art 区別
- Round 4（Opus）: P1×0 / P2×1 / P3×1 → PK1 bare Risk 行 + R3 必須セクションの実体化チェックリスト、retry 実証 grep
- Round 5（Opus）: P1×0 / P2×0 → **収束**。P3×3（line 参照精度 / mkdir 不要 / SearchBar 命名）反映済み

## Implementation Results

PR-A 実装完了（2026-06-12、commit 一覧は `git log --oneline docs/design-system-pr-a` 参照）:

- A1 `c24e863`: design-system 骨格 5 ファイル + DOC_STYLE_GUIDE §0 登録（`0x`=デザイン基盤）
- A2 `6cdbbc9`: UI_TECH_STACK §4 / §5.5.1 / §6.1〜6.3 を verbatim 移設、元をスタブ化（§6.4 は残置）
- 追補 `b13f2aa`: A2 で §4.5（4色エリアモデル）本文が移設先未指定で消失 → orchestrator 検収で検出し git 履歴から foundations へ復元（test matrix の Failure Mode「移設時の本文欠落」が実際に発生・捕捉された実例）
- A3 `140a471`: catalog 13 パターン執筆（canonical 全 Read、pagination は component + 呼び出し側の責務分担を実装準拠で記載）
- A4 `c5642b1`: DSR-01〜13 執筆（全 13 が review-checklist カテゴリ 9 対応を明記）
- A5 `881a0e4`: SCREEN_DESIGN §6 横断規約（業務ステータス視認性 / デスクトップ制約 / URL 設計）を foundations へ移設、§6 参照 5 箇所を文脈判断で張替 3 / 維持 2、review-checklist に DSR ID 付記
- A6 `9681952`: AGENTS.md / `.agents/skills/inventory-operator-ui/SKILL.md`（canonical）/ DEV_WORKFLOW Source Index に導線追加
- A7 `2dae2a2`: doc-consistency M1/M3 走査対象に `docs/design-system/*.md` を追加。negative test で違反語仮置き → M1 検出 → 除去 → 全チェック通過を実証

**Acceptance Criteria からの逸脱（記録）**: 「M1 が ERROR 検出」と書いたが、M1 の severity は既存設計で **WARN**（exit code に影響しない）。違反の機械可視化は達成済みで、glob 拡張時に catalog 内の `など、` 8 箇所が実際に浮上し修正された。exit code を止める gate は R 系 / PK 系が担う既存構造のまま。

検証: `bash scripts/doc-consistency-check.sh` exit 0 / 禁止語 rg 0 件 / 導線 3 ファイル rg ヒット確認済み。

## Review Response

### Codex Round 1（2026-06-12、P1: 0 / P2: 2 / P3: 0）

- **P2-1（旧 §4.x 参照の張替漏れ）= 採用**: 指摘 3 箇所に加え repo 全体 grep で同 class を全数洗い出し、live 参照 12 箇所を design-system 正典へ張替（UI_TECH_STACK 決定サマリ 6 行 + §4 表参照 2 + §4.6 / SCREEN_DESIGN 3 / 52-ui-shared-layout 2 / 53-ui-home 2 / 56-ui-daily-sales 1 / architecture/ui-task-specs 1 / globals.css 3 / SidebarArea.tsx 1 / Plans.md §4.1.1 1）。維持 = §6.4（残置が意図）/ §6.5.4 / §6.6（節が現存）/ archive / 本 packet 内の作業記述。追加発見: foundations 責務行・UI_TECH_STACK スタブ表・design-system README の 3 箇所が「SegmentedControl 仕様 = foundations」と記載していたが実体は catalog ⑤ のため同時修正
- **P2-2（catalog ⑥ canonical と標準UIの矛盾）= 採用（選択肢 1）**: 現 canonical を既知の逸脱として catalog ⑥ に明記し、PR-B の意図的差分（Non-scope 例外 + PR-B 詳細）に登録。標準UI側を弱めない理由 = 「次の一手」要求は非IT利用者向け機能要件（DSR-11 / 00-foundations 業務ステータスの視認性）で、PR-A は docs-only（src 差分なしが検証項目）のため実装変更は PR-B/7-8b に乗せる
- **検証ツールの想定外発見**: linuxbrew ripgrep 15.1.0 はネガティブ `--glob '!...'` を否定でなくリテラル解釈し全マッチ 0 件を返す（`--debug` で実証）。「grep 0 件 = 張替完了」の偽シグナル源。`scripts/doc-consistency-check.sh` `test_token_exists()`（L883）も同パターンで常に空振り（PK3 偽 WARN 側、exit code 影響なし）→ 修正は merge gate 拡張を避け follow-up 扱い。memory `ripgrep-15-negative-glob-broken.md` に記録

### Codex Round 2（2026-06-12、重大 findings なし = 収束）

- R1 P2 2 件とも解消確認（comment (private archive PR #97)）。P2-1 = active 範囲をネガティブ glob なしで再検索し残存なし、SegmentedControl 所在 drift も閉鎖確認。P2-2 = 「分岐構造 canonical」と「空状態の標準UI」の分離 + PR-B 意図的差分への接続を妥当と判定
- reviewer 検証: doc-consistency / lint / typecheck / format:check / `npm test`（48 files / 286 tests）/ `npm run build` / `git diff --check` すべて pass、head `383043b` の CI 3 jobs success 確認済み
- 残リスク整理: `test_token_exists()` 負 glob は follow-up 妥当（Plans.md Backlog 登録済み）、EmptyState 実装適合は PR-B scope で妥当 → **PR-A merge 可能判定**
