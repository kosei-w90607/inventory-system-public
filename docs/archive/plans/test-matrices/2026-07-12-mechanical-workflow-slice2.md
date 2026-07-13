# Test Design Matrix: mechanical workflow slice 2

> 親 packet: [../2026-07-12-mechanical-workflow-slice2.md](../2026-07-12-mechanical-workflow-slice2.md)
> slice 1 前例 matrix（deferred 行の引き継ぎ元）: [2026-07-10-workflow-model-neutral-redesign.md](2026-07-10-workflow-model-neutral-redesign.md)

## Risk

Risk: R3

## Contracts Under Test

- SPEC-WF-PK4: R2+ active packet の `## Workflow State` 必須化、13 phase enum、Risk-Execution Mode 整合、R3+ Findings Freeze 行必須、active packet 一意性、Plans.md リンク整合
- SPEC-WF-PK1EXT: `check_plan_packet_sections` への R2+ `## Owner Effort Budget` / R3+ `## Contract Probe` 節必須化
- SPEC-WF-PK5: `Plan Commit` SHA の ancestry 検査、original 不変、`Amendments:` 追記型 reconcile
- SPEC-WF-STATECAP: `docs(plans): state-only遷移` commit の 1 PR 3 件上限、post-implementation 相当 2 件上限、message-regex 分類、path のみ WARN 補足網
- SPEC-WF-DRIFT: `AGENTS.md` 以外の docs での canonical reading order 再掲検出
- SPEC-WF-HOOK: plan-approved 未満での実装ファイル Write/Edit deny、`docs/plans/` 系ファイル fail-open allow、scope 限定
- SPEC-WF-PROMOTE: PK5/gated amendment 定義の正本化と D-034/D-035/D-038 三重参照解消の doc-consistency

## Failure Modes

- R2+ packet に `## Workflow State` がない、または Phase が 13 phase enum 外のまま Plan Gate を通過する
- Workflow State 内 `Risk:` と `## Risk` セクションの `Risk: Rn` が食い違ったまま気付かれない
- R3 packet で Findings Freeze 行が欠落したまま independent-review が完了扱いになる
- 複数 active packet が同時存在し、resume 時に誤った packet を選ぶ（PR #159 型再発の亜種）
- Plans.md「次の行動」リンクと実際の active packet が乖離する
- Owner Effort Budget / Contract Probe 節が欠落したまま R2+/R3+ packet が Plan Gate を通過する
- Plan Commit が実装 commit の祖先でない（plan-first の建前が実際には守られていない）
- Plan Gate 後に original `Plan Commit` の値が書き換えられ、ancestry 検査の前提が壊される
- `Amendments:` 行に記載した SHA が original の descendant でないまま記録される
- state-only commit が 3 件（または post-implementation 相当が 2 件）を超えて積まれても検出されない
- `docs/plans/` 配下のみの変更で state-only prefix を持たない commit（ラベル逃れ）が無警告で通る
- path ベース WARN 補足網が `docs/archive/plans/` のような紛らわしい隣接パスを誤検出/見逃す
- canonical reading order が `AGENTS.md` 以外の docs に再度複製される
- hook の `settings.json` 統合が未検証のまま「条件付き採用」の前提が崩れ、plan-approved 前の実装 Write が deny されない
- D-034/D-035/D-038 の三重参照が本 slice で解消されず、PK5/gated amendment の定義が依然として archive 頼みになる

## Test Matrix

各行の「備考」に、slice 1 matrix（`docs/archive/plans/test-matrices/2026-07-10-workflow-model-neutral-redesign.md`）から引き継いだ行の出典を記録する。出典表記は `archive:<セクション>L<行番号>` 形式。新規（slice 1 に対応行がない）行は「新規」と明記する。

| Contract | Failure Mode | Test Type | Test Name | Would fail if... | 備考（引き継ぎ元） |
|---|---|---|---|---|---|
| SPEC-WF-PK4 | 本 packet 自身が誤って ERROR 判定される | unit（fixture: 本 packet） | `bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-07-12-mechanical-workflow-slice2.md`（自動） | `check_plan_packet_workflow_state` が正しい 13 phase enum 値（現況 `plan-gate`、遷移に応じて更新される）を持つ本 packet を false positive で ERROR にする | archive:TestMatrixL40（形式不正/enum外Phase、self-dogfood→slice2 PK4）、archive:StateLifecycleL64（initial packet） |
| SPEC-WF-PK4 | `## Workflow State` セクション自体が欠落 | unit（negative fixture packet） | `check_plan_packet_workflow_state` 節欠落 fixture test（自動） | セクション見出しがない packet を ERROR にできない | archive:NegativePathsL93（missing input → slice2 PK4でERROR） |
| SPEC-WF-PK4 | `- Phase:` が 13 phase enum 外の値（例: `review` のような非存在値） | unit（negative fixture packet） | `check_plan_packet_workflow_state` Phase enum 外 fixture test（自動） | enum 外の値を ERROR にできない | archive:TestMatrixL40（invalid Phase）、archive:NegativePathsL94（invalid input）、archive:MutationL106 |
| SPEC-WF-PK4 | Workflow State 内 `- Risk:` と `## Risk` セクションの `Risk: Rn` が不一致 | unit（negative fixture packet） | Risk 不整合 fixture test（自動） | 両者が食い違う packet を ERROR にできない | 新規（slice 1 archive には Risk-Workflow State 整合の対応行なし） |
| SPEC-WF-PK4 | R3 packet で `## Review Response` 内に `- Findings Freeze:` 行がない | unit（negative fixture packet） | Findings Freeze 行欠落 fixture test（自動） | R3 packet で Findings Freeze 行欠落を ERROR にできない | 新規（D-038 由来、slice 1 archive 時点では未導入の語彙） |
| SPEC-WF-PK4 | 複数 active packet が `docs/plans/` 直下に同時存在 | integration（fixture: `docs/plans/` に 2 ファイル配置） | 複数 active packet fixture test（自動） | 2 つ目の active packet を検出せず ERROR にしない | archive:StateLifecycleL68（resumeのpacket選択、slice2 PK4候補）、archive:TestMatrixL43 |
| SPEC-WF-PK4 | active packet と `docs/Plans.md`「次の行動」リンクが不一致・欠落 | integration（fixture: リンク不一致の Plans.md） | Plans.md リンク不整合 fixture test（自動） | リンク不一致を検出せず ERROR にしない | archive:StateLifecycleL68、archive:TestMatrixL43 |
| SPEC-WF-PK1EXT | R2+ packet で `## Owner Effort Budget` 欠落、R3+ packet で `## Contract Probe` 欠落 | unit（negative fixture packet ×2） | `check_plan_packet_sections` 配列拡張後の節欠落 fixture test（自動） | 拡張後も欠落を ERROR にできない、または既存 R2/R3 必須節の検査が壊れる（regression） | 新規（D-038 由来、slice 1 archive 時点では未定義の節） |
| SPEC-WF-PK5 | Plan Commit ancestry 不成立（plan-first が実装より後） | unit（synthetic git fixture repo: test が tmpdir に plan-first→実装 commit 列を構築） | ancestry 正例 fixture test（自動）。probe 証跡 = PR #165 実 SHA `e70ae30`（plan-first）→`dcd5f7c`（first-impl）が ancestor 成立（dangling のため automated fixture には不使用、Plan Gate R1 反映） | synthetic repo 内で ancestor 関係にある plan-first→実装列を成立と判定できない | archive:TestMatrixL42（plan-approved経ず実装開始→slice2 PK5）、archive:StateLifecycleL67、archive:TestMatrixL46（Plan Commit先行しない）、archive:MutationL107 |
| SPEC-WF-PK5 | squash merge 後の main では単一コミット化により ancestry が不成立 | unit（synthetic git fixture repo: branch を squash merge した main 相当を構築） | squash 後 ancestry 負例 fixture test（自動）。probe 証跡 = 実測で `e70ae30` は `0847f55`/`c0dd65f` に対して非 ancestor（squash merge、親コミット1個のみ`5a8d5c0`を確認済み。dangling のため automated fixture には不使用） | squash 後の main に対して誤って ancestor 判定してしまう、またはこの負例を pre-merge gate 側の想定外として扱ってしまう | 同上 + packet Contract Probe P1 の記述を実 SHA で再検証 |
| SPEC-WF-PK5 | `Plan Commit:` 行の値が Plan Gate 後に書き換えられる | unit（negative fixture: 2 revision の git 履歴） | `git log -p -- <file>` で初回確定値と現在値を比較する fixture test（自動） | 書き換えを検出せず ERROR にしない | archive:StateLifecycleL69（plan-gate→plan-approved）、archive:NegativePaths（state-only scope violation の類型） |
| SPEC-WF-PK5 | `Amendments:` 追記型の正例が誤って fail する（過剰検出） | unit（positive fixture: original不変+Amendments追記） | Amendments 追記 fixture test（自動、正例） | original `Plan Commit` を変更せず `Amendments:` 行のみ追記した正当なケースを誤って ERROR にする | 新規（PR #163 WER 由来の reconcile モデル、slice 1 archive には存在しない） |
| SPEC-WF-PK5 | `Amendments:` 行の SHA が original の descendant でない | unit（synthetic negative fixture） | 非 descendant fixture test（自動、負例。本 slice が reconcile モデルの初適用のため実例が repo 内に存在せず synthetic） | 非 descendant の amendment SHA を ERROR にしない | 新規（実例なし、synthetic fixture である旨を明記） |
| SPEC-WF-STATECAP | state-only commit 3 件を過不足なく計数 | unit（synthetic git fixture repo: prefix 付き 3 commit + content commit を構築） | 計数正例 fixture test（自動）。probe 証跡 = PR #165 実測で `37bf468`/`81f833c`/`179181b` の 3 件が prefix 一致（dangling のため automated fixture には不使用） | 3 件を正しく数えられない（過小/過大計上） | archive:TestMatrixL39 の隣接文脈（PK5と同じgit検査群）、packet AC/Contract Probe P3 |
| SPEC-WF-STATECAP | state-only commit が 4 件目で ERROR にならない | unit（synthetic fixture: 4件目のstate-only commitを追加したfixture branch） | 上限超過 fixture test（自動、負例） | 4 件目を検出せず ERROR にしない | 新規（D-038 item8由来、slice 1 archive には上限値の対応行なし） |
| SPEC-WF-STATECAP | post-implementation 相当（independent-review->human-confirm 等）が 3 件目で ERROR にならない | unit（synthetic fixture: PR#165の2件`81f833c`/`179181b`にpost-impl相当3件目を仮想追加） | post-implementation 上限超過 fixture test（自動、負例） | 3 件目を検出せず ERROR にしない | 新規（同上） |
| SPEC-WF-STATECAP | `docs/plans/` 配下のみの変更で state-only prefix を持たない commit が無警告 | unit（synthetic git fixture repo: docs/plans/ 配下 1 file のみ変更・prefix なしの commit を構築） | prefix なし plans-only WARN fixture test（自動）。probe 証跡 = 実 commit `f2eef1c`（`docs(plans): Self-Review scope境界行をNon-scope narrow化と整合`、変更ファイルは `docs/plans/2026-07-12-pr164-wer-workflow-hardening.md` のみ、prefix なし。dangling のため automated fixture には不使用） | この類型で WARN を出せない、または誤って ERROR にする（PR #163/#164 相当は WARN のみで ERROR にしないという AC の要求に反する） | 新規（今回の実 git 調査で発見。archive 時点では未確認の実例） |
| SPEC-WF-STATECAP | path ベース WARN 補足網が `docs/archive/plans/` を `docs/plans/` と取り違える | unit（synthetic git fixture repo: `docs/Plans.md` + `docs/archive/plans/` 配下に跨る commit を構築） | 境界 fixture test（自動）: 跨り commit が「`docs/plans/` 配下のみ」条件を発火させないこと。実在の証跡 = main 到達可能な `0847f55`（`docs/Plans.md` + `docs/archive/plans/` 2 files に跨る実 commit、`git show --name-only 0847f55` で確認済み）。旧記載の `4d3f5d1` は実際には両 file とも `docs/plans/` 配下で境界例に該当せず、Plan Gate R1 で事実誤りとして差し替え | パス正規表現が前方一致でなく部分一致になっており、`docs/archive/plans/` を `docs/plans/` の一部として誤って WARN 対象にする | 新規（Plan Gate R1 で fixture 選定を是正した regex 境界リスク行） |
| SPEC-WF-DRIFT | canonical reading order が `AGENTS.md` 以外の docs に再掲される | unit（negative fixture: 再掲文言を仕込んだ synthetic docs ファイル） | `scripts/tests/` 新規 drift test の負例（自動） | 再掲を検出せず pass してしまう | archive:TestMatrixL39（将来の再複製→slice2 script test）、archive:NegativePathsL98（duplicate/ambiguous input）、archive:AdjacentPatternAuditL87 |
| SPEC-WF-DRIFT | `AGENTS.md` 自身は誤検出されない | unit（positive fixture: 現行 `AGENTS.md`） | drift test の正例（自動） | `AGENTS.md` 自身を誤って drift ありと判定する（false positive） | 同上 |
| SPEC-WF-HOOK | plan-approved 未満で実装ファイル Write/Edit が deny されない | unit（Contract Probe P2 の 4 ケースの回帰実行） | hook deny ケース fixture test（自動、`.claude/hooks/` 配置後の再実行） | `src/**` `src-tauri/src/**` への Write が deny されない | 新規（D-034 Alternatives由来、slice1では大規模hook導入自体が却下済みのため対応行なし） |
| SPEC-WF-HOOK | `docs/plans/` 系ファイルが誤って deny される | unit（同上） | `docs/plans/` allow ケース fixture test（自動） | plan packet 編集まで巻き込んで deny してしまう | 同上 |
| SPEC-WF-HOOK | implementing フェーズ中でも deny されてしまう | unit（同上） | implementing allow ケース fixture test（自動） | 正当な実装フェーズ中の Write を deny してしまう | 同上 |
| SPEC-WF-HOOK | active packet 不在時に fail-closed してしまう | unit（同上） | fail-open ケース fixture test（自動） | packet 不在時に本来 allow すべき操作を deny してしまう（fail-closed 側に倒れて作業停止） | 同上 |
| SPEC-WF-HOOK | `settings.json` 統合後、実 runtime で PreToolUse イベントが発火しない | manual（Contract Audit の manual verification boundary、1 回の手動確認。L3 Eligibility（Windows native 観測）には該当しないため「L3」とは呼ばない） | `.claude/hooks/` 配置 + `settings.json` 登録後の実 Write 操作での deny 発火確認 | ロジックは automated で pass するが実際の hook 登録が機能しておらず deny が発火しない | packet Contract Probe P2「残存未検証点」/ Contract Coverage Ledger SPEC-WF-HOOK 行の manual 指定 / Impact Review Lenses「Manual verification」行 |
| SPEC-WF-PROMOTE | PK5/gated amendment 定義が `docs/DEV_WORKFLOW.md` に正本化されない、または三重参照が解消されない | docs check + review | `bash scripts/doc-consistency-check.sh --target plan`（`check_markdown_link_targets` によるリンク検証）+ `docs/decision-log.md` D-039 新設の重複ID/重複見出しなし確認（自動+手動review併用） | D-034/D-035/D-038 のいずれかが本 slice 後も PK5 定義の一次情報源であり続ける、または D-039 が既存 decision ID と重複する | 新規（slice1 archive時点ではAppendix C散在状態の解消自体が定義されていないScope） |

## State Lifecycle Matrix

対象は「本 packet 自身の Workflow State」（PK4 が機械強制する対象そのもの）。UI/データ状態ではなく workflow-state の lifecycle を dogfood する。

| State / subject | Initial | Pending | Success | Invalidate | Refetch | Revisit | Restart | Failure | Retry | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| 本 packet の Workflow State | Phase: plan-draft（起草時点の初期値）, Plan Commit: pending, Writer/Plan Reviewer/Final Reviewer: 未定 | plan-gate 到達済み・Plan Gate ラリー中、plan-approved 到達待ち（Human Gate: pending） | plan-approved 到達 + Plan Commit SHA 確定 | Plan Gate 後の修正は original 書き換え禁止、`Amendments:` 追記のみ | resume 時は Plans.md リンクから本 packet を再取得（PK4 リンク整合検査） | 複数 session 跨ぎの再開時、複数 active packet があれば停止（PK4 一意性検査） | active packet 不在時 hook は fail-open、checker は該当なし扱い | Findings Freeze 行欠落・Phase enum 外・Risk 不整合はいずれも Plan Gate ブロッカー | 修正後は同一 packet ファイル内で再検査、新規 packet の作成は不要 | `bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-07-12-mechanical-workflow-slice2.md` 出力 |

For workflow-state changes, add explicit rows per template:

| 遷移 | 期待 | 検査 |
|---|---|---|
| content candidate -> L1 / independent review -> state-only human-confirm commit | `81f833c` 型の state-only commit が Reviewed Content HEAD を確定し、tracked current SHA を書かない | STATECAP 計数（probe 証跡 `81f833c` を post-implementation 相当としてカウント、automated は synthetic fixture repo）+ PK5 ancestry 検査 |
| owner authorization -> Draft state-only Ready commit -> exact-HEAD L1 -> PR body -> Ready/dispatch -> merge with no later tracked commit | `179181b` 型の Ready commit 後、追加の tracked commit なしに squash merge（`c0dd65f`）へ到達 | STATECAP 計数（probe 証跡 `179181b` を post-implementation 相当としてカウント、automated は synthetic fixture repo）+ PK5 squash 後 ancestry 不成立の確認が「マージ後は個々のトラッキング対象外」という前提と矛盾しないことのレビュー |
| state-only violation: inspect both the file allowlist and `git diff --unified=0` hunks | `f2eef1c` のような実際は content 修正（Self-Review 節の文言修正）である commit を、state-only prefix の有無だけで自動判定せず、hunk レベルでは content commit として扱う | STATECAP WARN（probe 証跡 `f2eef1c`、automated は synthetic fixture repo）+ PK5 「state-only 行以外の hunk が混入していないか」の review 手順（本 slice では自動化対象外、review Focus (b) 参照） |
| hosted-not-required incidental failure: product/gate failure returns to implementing; only infrastructure/cancel may receive recorded owner disposition | 本 slice は Hosted CI Requirement: required（Human Gate 参照）のため該当なし。ただし PK5/STATECAP チェック自体が CI `docs` job（shallow clone、not-required 対象外）でなく pre-push/local-ci 側にあることが、hosted-not-required の対象外区分と矛盾しないことを Contract Probe P1 で確認済み | Contract Probe P1（`.github/workflows/ci.yml` fetch-depth 分布の確認） |

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| PK1-PK3 の line-regex/awk 検査機構（`check_plan_packet_sections` 等） | `scripts/doc-consistency-check.sh` L897 `check_plan_packet_sections`、L951 `check_plan_packet_substance`、L987 `check_plan_packet_heuristic_warnings` を確認 | PK4（`check_plan_packet_workflow_state` 新設）と PK1 拡張（`base_sections`/`r3_sections` 配列拡張）は同じ line-regex/awk 機構を再利用 | 新規 YAML パーサや構造化パーサの導入は D-034 Alternatives で既に却下済みのため対象外 | drift fixture packet + `bash -n scripts/doc-consistency-check.sh` の構文チェック |
| `--target plan` モードのファイル選択機構（L1503-1522、デフォルトは `docs/plans/` 直下のみ、archive/test-matrices は対象外） | 同ファイル L1503 以降を確認 | PK4/PK1 拡張は既存の `PLAN_FILES` 選択ロジックにそのまま乗る（新規ファイル選択ロジックは追加しない） | 対象外ファイル（archive/test-matrices）まで scope を広げる変更は本 slice の Scope 外 | `--target plan` 実行時に `docs/plans/test-matrices/` 配下が対象に含まれないことの確認（`--target plan` の対象出力行） |
| PR #160 型「plan-first commit → 実装 PR の分離」パターン | PR #165 の実 commit 列（`e70ae30`→`dcd5f7c`→`37bf468`→...→`179181b`）を確認 | PK5 の ancestry 検査はこのパターンをそのまま機械検査化する | なし（本 slice の主契約そのもの） | PK5 ancestry fixture（本 Test Matrix 上記） |

## Negative Paths

- missing input: R2+ packet の `## Workflow State` セクション欠落、R3+ packet の `## Contract Probe` / Findings Freeze 行欠落 → いずれも ERROR（PK4/PK1EXT fixture）
- invalid input: Phase enum 外の値、Risk-Workflow State 不整合、Execution Mode enum 外の値 → ERROR（PK4 fixture）
- duplicate/ambiguous input: 複数 active packet の同時存在、canonical reading order の再掲 → ERROR（PK4 fixture、DRIFT fixture）
- unknown reference: Plans.md「次の行動」リンクが存在しない packet を指す → ERROR（PK4 fixture）
- dependency missing: active plan なしで R2+ 実装 diff → この check は現状 WARN としても未実装であり、本 slice では**導入自体を行わず全体を次 slice へ deferred**（Scope item 6。archive:NegativePathsL100 の deferred 行は再繰り越し。Double Audit pass 2 で「WARN のまま維持」という旧表現が事実誤認と判明し訂正）
- permission/write failure: hook が plan-approved 未満で実装ファイル Write を deny（SPEC-WF-HOOK の主契約そのもの）
- dry-run side effect: 該当なし（本 slice の新規スクリプトはいずれも読み取り専用の git/grep 検査であり、書き込み側の dry-run 概念を持たない）

## Boundary Checks

- threshold: state-only commit 3 件（3件目まで許容、4件目でERROR）、post-implementation 相当 2 件（2件目まで許容、3件目でERROR）
- null/default: `Plan Commit: pending`（未確定値）は ancestry 検査の対象外として扱われること（plan-draft/plan-gate フェーズでは PK5 は non-applicable）
- empty/non-empty: `## Workflow State` セクションの空セクション（見出しのみで `- Phase:` 行がない）は「欠落」と同じ ERROR 扱い
- min/max: state-only commit 0 件（PR #163/#164 相当）はERRORにならないこと、3件（PR #165）はERRORにならないこと、4件はERRORになること
- status/policy enum: Phase 13 値（kickoff, spec-check, design, plan-draft, plan-gate, plan-approved, implementing, local-verified, independent-review, human-confirm, ready-hosted-final, merge, archive）、Risk 3 値（R2/R3/R4、R1以下はWorkflow State非対象）、Execution Mode 3 値（fable-window/dual-vendor-no-fable/codex-only）
- wire type: 該当なし（JSON/DTO非接触）
- internal type: 該当なし
- producer/consumer: 該当なし
- round-trip token: 該当なし
- precision/range: 該当なし
- cross-language parse: 該当なし
- path prefix boundary: `docs/plans/` の前方一致条件が `docs/archive/plans/` を誤って含まないこと（synthetic 境界 fixture で検証。実在証跡 = main 到達可能な `0847f55`。旧記載 `4d3f5d1` は両 file とも `docs/plans/` 配下で境界例でなく、Plan Gate R1 で差し替え）

## Compatibility Checks

- old schema/input: `## Workflow State` を持たない archived packet（PK4 導入前の形式）は `--target plan` のデフォルト対象（`docs/plans/` 直下のみ）から外れるため非接触。ただし明示パス指定で archive packet を渡した場合に誤って ERROR にしないことを compatibility 観点で確認
- new schema/input: 本 packet 自身が新形式（Owner Effort Budget / Contract Probe 節必須化後）の初例として ERROR 0 であること
- output order: 該当なし
- optional field behavior: R0/R1 は Workflow State 自体が不要（既存ルール継続、本 slice で変更なし）。`Amendments:` 行は無ければ「original のみ、修正なし」として扱い ERROR にしない

## Data Safety Checks

- source-derived data: 非接触（新規スクリプトは repo 内の git メタデータと Markdown ファイルのみ読み書き）
- generated outputs: 非接触
- secrets: 非接触（commit subject/SHA は匿名化不要な開発メタデータ）
- local-only files: 非接触
- synthetic sample boundaries: negative/synthetic fixture packet は `docs/plans/test-matrices/` 配下の合成ファイルとして作成し、実店舗データを含まない。PK5「非 descendant負例」と STATECAP「4件目」「post-impl 3件目」は実 repo 履歴に存在しないため synthetic fixture branch で再現し、本番 `docs/plans/` や `main` branch を汚染しない

## Main Wiring / Integration Checks

- helper connected to main path: `check_plan_packet_workflow_state`（PK4）が `--target plan` モードの呼び出し列（L1548 付近）に実際に組み込まれていること
- output reaches manifest/report: PK5/STATECAP の新規関数が `scripts/pre-push.sh` と `scripts/local-ci.sh` の両方から呼ばれ、`bash scripts/local-ci.sh full` の CLEAN/ERROR 判定に反映されること
- effective config reaches runtime: hook の `settings.json` 登録が実際に PreToolUse イベントの発火経路に乗ること（L3 手動確認、SPEC-WF-HOOK 参照）
- CLI arg reaches implementation: `--target plan <file>` 引数が `check_plan_packet_workflow_state` の対象ファイル決定にそのまま渡ること（既存 `PLAN_FILES` 配列経由、regression 確認）
- new test file registered: 新規 drift test ファイルが `scripts/local-ci.sh` の test-suite 呼び出し列（L201-204 の `run_required *-tests` 群）に追加登録され、`bash scripts/local-ci.sh full` で実際に実行されること（Plan Gate R1 反映）
- no-active-plan check の非導入確認（negative space）: 「active plan なしで R2+ 相当 diff」の check（WARN 含む）を本 slice で新設していないこと（packet Scope 6 の deferred 裁定の確認。Double Audit pass 2 で旧「WARN 維持 regression」表現が事実誤認と判明し訂正）

## Mutation-style Adequacy Questions

- If a mock value is changed so it differs from the design-doc expected value, which assertion proves the implementation used the correct source and not the mock's accidental constant?: PK5/STATECAP の automated fixture は synthetic git fixture repo を test 自身が構築するため、commit 列の構築手順と assert が同一 test 内で対になり、mock 定数の取り違えが構造的に起きない。実 SHA 群（`e70ae30`/`dcd5f7c`/`37bf468`/`81f833c`/`179181b`/`f2eef1c`/`0847f55`）は Contract Probe の一次証跡として対比参照のみに使う（dangling SHA を automated fixture に使わない — Plan Gate R1 反映）
- If invalidate/refetch changes the value before versus after the operation, which test proves the lifecycle order and preserved snapshot are correct?: Plan Commit 書き換え検出 fixture が `git log -p -- <file>` で初回値と現在値を比較するため、書き換え前後のスナップショムが両方保持されていることを証明する
- If a key branch is inverted, which test fails?: ancestor/非ancestor 判定が反転していれば PK5 の正例（`e70ae30`→`dcd5f7c`成立）と負例（squash後main不成立）が両方揃って矛盾を検出する
- If a threshold comparison changes, which test fails?: state-only 3件境界の min/max fixture（3件でERRORにならない、4件でERRORになる）が閾値のオフバイワンを検出する
- If a guard is removed, which test fails?: hook の 4 ケース fixture のうち deny ケースが、guard 除去で allow に転じることを検出する
- If an output field is omitted, which test fails?: Findings Freeze 行欠落 fixture、Owner Effort Budget/Contract Probe 節欠落 fixture がそれぞれ該当
- If tracked Workflow State stores the current PR HEAD, does a state commit make it stale immediately?: 本 slice は Reviewed Content HEAD / Final Exact-HEAD Evidence: PR body の既存規則を変更しないため非該当。ただし PK5 が `Plan Commit`（固定値、current HEAD ではない）のみを ancestry 対象にしていることを Design Intent Trace で再確認
- If a hosted URL/headSha is committed after the run, does the merge three-point check fail because PR HEAD changed?: 本 slice の変更対象外（既存 three-point check は不変）。PK5/STATECAP は pre-merge gate であり three-point check とは独立
- If a state-only commit edits Scope/AC in the same packet file, does hunk-level review reject it even though the filename is allowlisted?: `f2eef1c` の STATECAP WARN fixture がこの懸念の実例であり、hunk-level review（自動化対象外、備考参照）が引き続き必要であることを Negative Paths / State Lifecycle Matrix で明記した
- If output order changes, which test fails?: 該当なし（順序依存の出力なし）
- If dry-run performs a side effect, which test fails?: 該当なし（dry-run概念を持たない）
- If a JSON number crosses JavaScript safe integer range, which test fails?: 該当なし
- If a state token is round-tripped through browser/client code, which test fails?: 該当なし

## Residual Test Gaps

- SPEC-WF-HOOK の `settings.json` 統合 interception は本 slice の automated test では再現できず、L3 手動確認 1 回のみが AC。実装後に統合検証で問題が出た場合、Scope item 7 の記述どおり follow-up PR へ降格する運用が必要
- PK5/STATECAP の automated 行は全て synthetic git fixture repo 方式に統一した（Plan Gate R1 B-P1-1: PR #165 実 SHA 群は squash merge 後 dangling で CI・新規 clone から到達不能のため。実 SHA は Contract Probe の一次証跡としてのみ保持し、再検証は `git fetch origin '+refs/pull/165/head:refs/probe/pr165'` で行う）。将来 PR で実際に境界を踏む到達可能な実例が出た場合、synthetic fixture を実例で補強して再検証することが望ましい
- archive:NegativePathsL100（dependency missing: active plan なしの WARN→ERROR 段階昇格）は本 slice でも Non-scope のまま維持され、消化されていない。次 slice の候補として `docs/decision-log.md` D-039 に記録済み（packet Scope item 6 / Non-scope 参照）
- Evidence Ownership（テスト件数等 volatile evidence の tracked docs 転記検出）の機械検査は本 slice でも N/A 裁定のまま。次 slice 候補として D-039 に記録のみ（packet Non-scope 参照）
- STATECAP の計数は squash merge 後の main では個々の commit が消えるため、pre-merge（feature branch 上、`git merge-base origin/main HEAD..HEAD`）でのみ有効という前提が Contract Coverage Ledger / Test Plan に明記されているか、実装後に再確認が必要（本 matrix 作成時点の git 調査で `c0dd65f` が単一親コミットの squash merge であることを実測済み）
