# Plan Packet: 商品更新patchのomitted / null / value wire契約（監査是正 順13 / P4b-1、wave 3 lane 2）

## Workflow State

- Phase: implementing
- Risk: R3
- Execution Mode: dual-vendor-no-fable
- Plan Commit: dc4aa1b
- Amendments: 970e42e
- Coordinator: Codex（本thread。wave編成・packet起草・レビュー裁定・main/Registry/train管理）
- Writer: Codex（plan-approved後の別session / worktree。Coordinatorと分離）
- Plan Reviewer: Sonnet 5 fresh context（owner relay、read-only、実装非関与）
- Final Reviewer: Sonnet 5 fresh context（Plan Reviewerとは別context、owner relay、read-only）
- Reviewed Content HEAD: pending
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: wave batch Ready承認、lane merge承認（lane選定は介入1/3で完了）

Narrative（append-only）:

- 2026-07-29 kickoff -> spec-check -> design -> plan-draft: ownerがwave 3 lane 2に順13を選定（介入1/3）。CoordinatorがP4b-1、Rust DTO/serde、generated bindings、frontend builder/cast、REQ-102 source docsと既存testsをread-only監査した。
- 2026-07-29 Design Phase: `PRODUCT-PATCH-D1`を30 / 40 / 51へ昇格。通常fieldはomitted/null=no update・value=set、clear可能なsupplier/makerはomitted=no update・null=clear・value=setに確定した。本PacketとMatrixはPlan Review前のdraftであり、production実装は未着手。
- 2026-07-29 plan-draft -> plan-gate: exact baselineの隔離worktreeでstruct-level serde defaultを暫定適用し、generated deserialize / serialize shapeをend-to-end probeした。Packet / Matrix / source docsと3 lane footprint分離をCoordinatorが確認し、plan-first content commitで固定してfresh Sonnet Plan Reviewへ進む。
- 2026-07-29 formal Plan Review（Sonnet 5 fresh context、owner relay）: Verdict Approve、P1=0 / P2=0 / P3=1。Reviewerがexact plan-firstの隔離worktreeでContract Probeを独立再現し、Rust 1行とbindings 14行の期待shapeを確認した。P3の`UI_TECH_STACK.md`節番号誤引用は実装契約へ影響しないfollow-upとして記録し、P3-onlyのPlan変更・再reviewは行わない。relay 1/2。
- 2026-07-29 plan-gate -> plan-approved -> implementing（state-only compression）: 独立Plan ReviewerがP1/P2=0を報告し、plan-first `dc4aa1b`は全実装commitより前に存在する。`Plan Commit`を同SHAへ固定し、本state-only commit後にlane 2 Writer実装を許可する。
- 2026-07-29 lane 3 merge後のtrain rebase: 最新main `214b289`へconflict-free rebaseし、実装commitを`f436c35 -> e762b23`、`6cdb8c7 -> f7a9a5a`へ再配置した。rebase前後のwhole-diff patch-idは`47497efc30e0ea6a5297ca75dcf71694ae90475f`で一致。plan-first `dc4aa1b`はmain上の同一commitとして祖先に残りreplayされていないため、Plan Commit fieldを維持しRebase Mapは不要。
- 2026-07-29 Codex review-only preflight: P1=0 / P2=1 / P3=2。wire実装、serde三状態、generated型、builder/page、Scope内codeは適合。P2はtouched source `51-ui-product-form.md` §7.4が4 commandをgenerated未対応の未来形で記し、同節の現行`PRODUCT-PATCH-D1`とbindingsに矛盾すること。repo-wide drift sweepで`SCREEN_DESIGN.md`にも同じ未来形を確認したため、両live source docsの現況同期をgated Amendment 1として追加し、Writerを停止してformal Amendment Reviewへ戻す。
- 2026-07-29 owner relay budget exception: 上記gated Amendment Reviewと、その後のFormal Final Reviewを独立に完了するため、ownerがrelay上限を2回から3回へ今回限り拡張した。追加1回はsource-doc wording同期のAmendment Reviewだけに使い、実装Scopeや証跡収集の任意拡張には使わない。
- 2026-07-29 gated Amendment 1 SHA記録: `Amendments` fieldをcontent commit `970e42e`へ設定した。技術Scopeは51 / SCREEN_DESIGNのUI-01b generated command status現在形同期とlive wording sweepだけで、wire実装・UI・DB・他lane契約は変更しない。
- 2026-07-29 formal Amendment Review（同Plan Reviewer、owner relay）: exact Amendment content `970e42e`とSHA記録commitをread-only確認し、P1=0 / P2=0 / P3=0、Amendment approved、Writer再開可。51 §7.1/§7.4とSCREEN_DESIGNの4 command status、live wording sweep、Scope / Non-scope / AC / Matrix C7・F6・X8の接続を独立確認した。relay 2/3。
- 2026-07-29 lane 1 merge後のtrain rebase: 最新main `9ea0625`へconflict-free rebaseした。plan-first `dc4aa1b`はmain上の同一commitとして祖先に残り、gated Amendment 1は`Rebase Map: 970e42eef875d2eba608c35b14bf3a165f5a000e -> 3618cb0cce615f3c878d44642a918c7683deef50`（patch-id `b61853a5c8714d58994506e283f8f17f0fda06a1`一致）として再配置した。rebase前後のwhole-diff patch-idは`4f766c638b6c69399d0ea75aaa77fec61f6243ff`で一致。`Plan Commit` / `Amendments`の原SHA列は維持する。
Rebase Map: 970e42eef875d2eba608c35b14bf3a165f5a000e -> 3618cb0cce615f3c878d44642a918c7683deef50
- 2026-07-29 Amendment実装再開: 承認された狭いScopeどおり、51 §7.1/§7.4とSCREEN_DESIGNのUI-01b generated command statusだけを現在形へ同期した。wire実装、UI、DB、command登録、bindingsは変更していない。
- 2026-07-29 Amendment実装closure: archive / plans / researchを除くlive source wording sweepは旧未来形0件。X8として51の`updateProduct`を`generated 未対応`へ戻すと同guardがredになり、復元後greenを再確認した。影響familyはRust serde 2件、frontend 3 file / 20件、typecheck / lint / format、plan consistencyがgreen。

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 30分
- relay往復上限: 3（既定2から今回限り拡張。Plan Review / gated Amendment Review / Final Review）
- 現況: 介入1/3、relay 2/3

## Risk

Risk: R3

Tauri command DTOのdeserialize shapeとgenerated bindingを変更する。runtimeの既存patch意味論は維持するが、cross-language optionalityを誤ると意図しないfield更新またはclearへ繋がるためR3。

Rollbackはlane implementation commitのrevert。DB schema/migration、保存済みdata、command名/responseは不変。

## Goal

Goal Invariant: Rust serdeの実際のpatch意味論とgenerated TypeScript command入力型を一致させ、frontendが手書き`Partial`やcastなしでchanged-field-only payloadを構築する。商品更新のBIZ挙動、画面、error、DBは変えない。

### 最小完了条件

- `ProductUpdateRequest_Deserialize`の全propertyがoptional
- 通常fieldはomitted/null=no update・value=set
- `supplier_id` / `maker_code`はomitted=no update・null=clear・value=set
- builderがgenerated `_Deserialize`を直接返し、保存時castがない
- `src/lib/bindings.ts`だけを本waveのgenerated artifactとして更新

### 失敗定義

- omittedをnullへ正規化してunchanged fieldを送る
- clear可能fieldのomittedとnullを同一視する
- `_Serialize`、手書き`Partial`、型assertionでcommand入力を代用する
- command signature、BIZ update、DB/price history/PLU挙動を変更する

### 非目的

- 商品更新fieldの追加、validation/画面/UI文言の変更
- 順14の`CmdError` enum化
- specta/serde dependency更新、generator改修

## Scope

- source docs: `docs/function-design/{30-biz-product-service,40-cmd-product,51-ui-product-form}.md`
- source wording sync: `docs/SCREEN_DESIGN.md`（UI-01b generated command statusの現在形同期だけ）
- Rust DTO/test: `src-tauri/src/biz/product_service.rs`
- generated: `src/lib/bindings.ts`（wave 3唯一のgenerated artifact lane）
- frontend: `src/features/products/lib/product-form-request.ts`、`src/features/products/ProductFormPage.tsx`
- tests: `src/features/products/lib/product-form-request.test.ts`、`src/features/products/ProductFormPage.test.tsx`、必要なら同directoryの専用contract test 1file
- packet / Matrix（Workflow StateはCoordinator管理）

既存testはassert追加と型契約強化だけを許可し、削除・skip・期待緩和は禁止。

## Non-scope

- `src-tauri/src/cmd/product_cmd.rs`、BIZ update本体、repository/DB/schema/migration
- command名/引数名/response/`CmdError`
- create product、route、query invalidation、UI layout/style/L3
- `docs/SCREEN_DESIGN.md`は上記generated command statusのwording同期以外
- binding generator、Cargo/npm dependency/lockfile
- `docs/function-design/90-traceability.md`（既存UI-01b tokenを使い再生成不要）
- 順14と`Plans.md`

## Acceptance Criteria

- `cargo test product_update_request`が通常fieldとclear可能fieldのomitted/null/value表を独立期待値で検証
- bindings再生成後、`ProductUpdateRequest_Deserialize`全propertyがoptionalで `_Serialize` は意図せずcommand入力に使われない
- frontend builderの型がgenerated `_Deserialize`に一致し、unchanged `{}`、通常value、supplier/maker clear/valueのexact payload testがgreen
- `Partial<ProductUpdateRequest_Deserialize>` と `as ProductUpdateRequest_Deserialize` のlive hitが0
- `cd src-tauri && cargo run --bin generate_bindings` 後のgenerated diffが `src/lib/bindings.ts`だけ
- Rust format/clippy/test、frontend typecheck/lint/format/test/buildをPASS。frontend gateとbindings生成は逐次実行
- `cargo run --bin generate_traceability -- --check`、`bash scripts/doc-consistency-check.sh --target plan`、`bash scripts/local-ci.sh full` PASS
- archive / researchを除くlive source docsで、UI-01bの`createProduct` / `updateProduct` / `toggleDiscontinue` / `listSuppliers`をgenerated未対応または将来追加と記すwordingが0件
- Matrix baseline mutation全量をtargeted `cargo test` / `npm test` / `npm run typecheck`でCoordinatorが独立再実測し、各red、復元後green、survivor 0

## Design Sources

- Requirements: `docs/spec/requirements.md` REQ-102、`docs/spec/requirements-coverage.md` REQ-102
- BIZ/CMD/UI: 30 §4.4、40 §5.4 update、51 §7.1/§7.4/§7.5/§7.8（`PRODUCT-PATCH-D1`）
- Generated SSOT: `docs/UI_TECH_STACK.md` §2.5
- Audit: `docs/research/audit-2026-07/findings/p4-type-contracts.md` P4b-1、adjudication裁定注記2

## Required Design Artifacts

| Area | Required artifact | Status |
|---|---|---|
| BIZ patch semantics | 30 §4.4 `PRODUCT-PATCH-D1` | updated plan-first |
| CMD JSON boundary | 40 §5.4 `PRODUCT-PATCH-D1` | updated plan-first |
| UI generated input/payload | 51 §7.1/§7.4/§7.5/§7.8 | updated plan-first |
| DB / transaction / error | existing docs | behavior不変 |

## Registration / Generation Obligations

`src/lib/bindings.ts`はRust DTOから再生成してcommitする。本laneだけがbindingsを生成し、順14と同waveに置かない。新規command/route/requirementなし。追加FE testには既存`UI-01b` / `REQ-102` tokenを付け、traceabilityは`--check`のみ。

## Design Intent Trace

| Spec | Source / decision | Why | Implementation | Test |
|---|---|---|---|---|
| REQ-102 | 30/40 `PRODUCT-PATCH-D1` | serde実態とgenerated入力を一致 | Rust DTO + bindings | serde table + binding/typecheck |
| REQ-102 | 51 `PRODUCT-PATCH-D1` | `Partial`/castはdriftを隠すため不採用 | builder + page | type/source contract |
| REQ-102 / UI-01b-D5 | 51 §7.5 | changed fieldsだけ送信、read-only不送信 | builder | exact payload regression |

## Design Intent Audit

- Durable decisionは30/40/51へ昇格済み。Plan-only decisionなし。
- 通常`Option<T>`とnested `Option<Option<T>>`のnull意味を分離した。
- 隣接契約はvalidation、price history、`plu_dirty`、read-only field、error/response不変。
- generatorが期待shapeを出さない場合はmanual binding/castへ逃げずDesign Phaseへ戻る。

## Contract Probe

Coordinatorがexact baseline `818352f`の隔離worktreeで`ProductUpdateRequest`へstruct-level `#[serde(default)]`だけを暫定追加し、`cargo run --bin generate_bindings`を実行した。生成差分はRust DTOの1行と`src/lib/bindings.ts`の14行のみで、`ProductUpdateRequest_Deserialize`の全9 propertyがoptionalになり、`ProductUpdateRequest_Serialize`は全9 property必須のまま維持された。したがって本方式を採用する。Writerは同じ生成結果を実装worktreeで再現し、期待外ならmanual binding/castへ逃げず実装停止・Design Phaseへ戻す。

## Contract Coverage Ledger

| Design contract | Implementation target | Automated test | L3 / non-scope |
|---|---|---|---|
| D1-A 通常field omitted/null=no update、value=set | Rust DTO | serde table test | BIZ更新ロジック不変 |
| D1-B supplier/maker omitted/no update、null/clear、value/set | DTO custom deserializer | serde table test | DB値はsynthetic |
| D1-C generated deserialize全property optional | DTO metadata + bindings | binding contract + typecheck | `_Serialize`は入力non-scope |
| D1-D generated型へ直接接続、Partial/castなし | builder/page | type/source contract | UI表示不変 |
| UI-01b-D5 changed-only/read-only不送信 | builder | exact payload tests | L3なし |
| BIZ-01 §4.4 update副作用不変 | existing BIZ path | existing product tests | DB/schema変更なし |
| CMD-01 error/response不変 | generated command call | existing page/command regression | cmd source非変更 |
| UI-01b generated command status | 51 §7.1/§7.4 + `SCREEN_DESIGN.md` UI-01b | live wording sweep + bindings presence | command登録・生成自体は不変 |

## Test Plan

- Matrix: [test-matrices/2026-07-29-product-update-patch-wire-contract.md](test-matrices/2026-07-29-product-update-patch-wire-contract.md)
- RED first: generated型をbuilderへ直接指定すると現状required fieldでtypecheck red
- GREEN: serde default -> bindings生成 -> typecheck、payload/serde tests
- negative: default/custom deserializer/optional marker/direct type接続/cast/omit-clearを個別mutation
- compatibility: existing product BIZ/frontend suitesとfull gate

## Boundary / Wire Contract

- producer: `buildUpdateProductRequest` -> generated `commands.updateProduct`
- boundary: JSON -> serde `ProductUpdateRequest` -> BIZ
- 通常field: omitted/null -> `None` -> no update、value -> `Some(value)` -> set
- clear可能field: omitted -> `None` -> no update、null -> `Some(None)` -> clear、value -> `Some(Some(value))` -> set
- command入力型: `ProductUpdateRequest_Deserialize`。response/error/DB round-trip不変
- compatibility: 従来のrequired nullable payloadも受理し、新たにomittedを型安全に表現する

## Review Focus

- generated artifactを手編集せずRust metadataから再生成したか
- ordinary / clearableのnull意味をtestが混同していないか
- frontend test期待値がproduction builderから導出されていないか
- live `Partial`/castをrepo-wide sweepしたか
- UI-01bのgenerated command statusが51とSCREEN_DESIGNで現在形にそろい、旧未来形がlive treeに残らないか
- bindingsを使うfrontend commandを並列生成/検証して偽陽性を作っていないか
- Evidence Stop Condition: `exact-HEAD L1 + baseline全量mutation + P1/P2 closure`が揃った後は、runtime failure、Scope変更、または未closureのP1/P2がない限り追加の全量証跡収集を開始しない。証跡はGoal Invariantの判定手段であり、独立した成果として扱わない。

## Spec Contract

Contract ID: REQ-102 / PRODUCT-PATCH-D1

商品更新patchは通常fieldとclear可能fieldのomitted/null/valueを上記wire表どおり扱い、generated deserialize型からBIZまで意味を維持する。

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| REQ-102 / D1-A | 通常field optionality生成 | Rust serde + generated contract | omitted/null=no update | cargo test + binding diff |
| REQ-102 / D1-B | nested nullable維持 | Rust serde + payload unit | omitted/null/valueの弁別 | cargo/npm test |
| REQ-102 / D1-C/D | builderをgenerated型へ直結 | type/source contract | Partial/cast不在 | typecheck + rg |
| REQ-102 / UI-01b-D5 | changed-only payload維持 | builder/page regression | read-only/unchanged不送信 | npm test |

## Data Safety

synthetic product/JSONだけを使う。実店舗DB、価格/原価data、log、backup、secretをcommitしない。migration/永続data変換なし。

## Implementation Results

- `ProductUpdateRequest`のstruct-level serde defaultからgenerated deserialize型の全9propertyをoptional化し、通常fieldとclear可能fieldのomitted / null / value意味論をRust testで固定した。
- frontend builderはgenerated `ProductUpdateRequest_Deserialize`を直接返し、手書き`Partial`と保存時castを除去した。changed-field-only payloadとsupplier / makerのclear/valueを既存・専用testで固定した。
- gated Amendment 1に従い、51 §7.1/§7.4とSCREEN_DESIGNのUI-01b command statusを現行generated bindingへ同期した。command登録、UI表示、DB、BIZ更新挙動は不変。
- Amendment実装後の影響family検証とX8 mutationを完了し、旧未来形のlive source hitは0件。

## Review Response

- Findings Freeze: formal Final Reviewのinitial broad audit完了時に発効予定
- Plan Review: Approve（P1=0 / P2=0 / P3=1）
- Gated Amendment 1: Approve（P1=0 / P2=0 / P3=0、Writer再開可）
- Final Review: pending
