# Plan Packet: CMD-11 settings service 境界の正本化（監査是正 順12 design-first）

## Workflow State

- Phase: human-confirm
- Risk: R3
- Execution Mode: fable-window
- Plan Commit: 2114c722e2a75bcc0fc61975e2f11e86940a04d8
- Amendments: none
- Coordinator: Claude (Fable 5, main session)
- Writer: Claude (Fable 5, main session)
- Plan Reviewer: independent Claude subagent (Sonnet 5)
- Final Reviewer: independent Claude subagent (Sonnet 5)
- Reviewed Content HEAD: 65f12f29a31df6d3f9a2869454b53a9ba2f0f568
- Final Exact-HEAD Evidence: PR body
- Hosted CI Requirement: required
- Human Gate: pending items = hosted workflow_dispatch 指示（docs-only のため event filter 対象外）+ merge approval。L3 なし

## Owner Effort Budget

- 介入回数上限: 3
- 実働時間上限: 15分
- relay 往復上限: 0

既定値と超過時の Coordinator 責務は `docs/DEV_WORKFLOW.md` `Owner Effort Budget` 参照。
承認依頼フォーマット: `この change での介入 N 回目 / 予算 M 回` + `承認すると利用者から見て何が完了するか1文`。

## Consultation Relay

§5.5を使わないchangeは両方`none`のままにする。

- Review Order Artifact: none
- Review Order Ref: none

## Risk

Risk: R3

Reason:
docs-only だが、data-safety 正本（71 §71.7 MNT-01-D1/D4/D5）に隣接する層境界契約の正本改訂であり、正本間整合を壊すと以後の実装 PR が誤った規範を模倣する。監査 report（P2-1）が「独立した設計付き変更」を明示指定。design-first の先例（順1+2 = PR #14、順3 = PR #19）と同じ tier。

## Goal

Goal Invariant: CMD-11 の層境界が `ARCHITECTURE.md` / `43-cmd-settings-log.md` / `71-mnt-backup.md` の間で無矛盾に定義され、実装 follow-up PR が新たな設計判断なしに着手できる。

### 最小完了条件

- ARCHITECTURE.md の呼び出し原則と 43-cmd-settings-log.md の処理記述が矛盾なく読める（現状: 前者が「CMD は BIZ 呼び出しのみ」、後者が IO/MNT 直呼び・CMD 内 validation を明記する正面矛盾 — 監査 P2-1）
- 実装 PR の scope（新設 service の関数境界・validation 所有・test 義務）が本 packet と改訂後正本から一意に決まる

### 失敗定義

- 正本間矛盾が残る、または新たな矛盾を作る
- restore の既存 data-safety 契約（MNT-01-D1/D4/D5、71 §71.7）の意味論を変えてしまう

### 非目的

- restore orchestration の再設計（71 §71.7 の contract は Codex 8 round を経た確定形。動かさない）
- CmdError.kind の enum 化（監査是正 順14 の scope）
- コードの先行変更

Priority: `Goal Invariant > Acceptance Criteria > supporting evidence`。

## Scope

- `docs/ARCHITECTURE.md` 呼び出し原則の改訂（D-060: CMD→MNT 正規経路の限定明文化 + CMD→IO 直呼び禁止の明文化）
- `docs/ARCHITECTURE.md` §2 task table の整合（Plan Review round 1 P2-1）: BIZ 層 table へ BIZ-09（システム設定・操作ログロジック = biz::system_service、実装は順12 実装 PR）行を新設し、CMD-11 行の呼び出す BIZ を `BIZ-09, BIZ-02, MNT-01, MNT-02` へ更新（BIZ-02 は画像 validation の returns domain 所有分）
- `docs/ARCHITECTURE.md` §5-9「タスク仕様（詳細）」mapping table の BIZ 層行を `BIZ-01〜BIZ-09` へ更新（Plan Review round 2 P2）
- `docs/architecture/biz-task-specs.md` へ `### BIZ-09` task 仕様節を新設（責務・対応 command・validation 所有・「関数 level 契約は 38 doc = 実装 PR」注記。Plan Review round 2 P2 派生）
- `docs/architecture/cmd-task-specs.md` CMD-11 節の改訂（round 2 self-audit 発見）: 「許可済み例外」paragraph（`architecture_test.rs` allowlist 根拠の system_repo 直呼び正当化、baseline 4 hit）を D-060 経路の記述へ全面書き換え、command table の「IO-01経由（許可済み例外）」3 行を `BIZ-09` へ更新
- `docs/function-design/43-cmd-settings-log.md` 全面改訂: 設定・操作ログ系 4 command を `biz::system_service` 経由の処理ステップへ、§43.5 の CMD 内 validation アルゴリズム所有記述と `system_repo::` 直呼び処理記述の削除（BIZ へ移動）、§43.2 SaveImageRequest 注意書きの「CMD/IO の最終 validation」表現を BIZ 所有 + IO 防御へ統一（Plan Review round 1 P2-2）、backup/restore 5 command 節の 71 §71.7 normative 参照化（重複記述の解消）、画像保存節の boundary 再定義（base64 decode = CMD wire 変換残留、拡張子 validation = BIZ 所有）
- `docs/function-design/31-biz-inventory-service.md` へ領収書画像 validation 所有の設計判断を prose で追記（fn シグネチャのコードブロックは追加しない — Contract Probe 参照）
- `docs/decision-log.md` に D-060 追加
- `Plans.md` の active packet link 追加（PK4）
- 実装 follow-up PR への義務の凍結（Spec Contract SPEC-CMD11-D5）: `38-biz-system-service.md` 新設 + `build_doc_to_modules_map()` 登録 + settings_cmd test の production CMD test 規範（順5）化

## Non-scope

- Rust / TypeScript コードの変更一切（実装 follow-up PR = Codex 発注、直列消化）
- `38-biz-system-service.md` の file 新設（design_compliance_test の未登録 doc gate により docs-only PR では不可能 — Contract Probe 実証済み。契約内容は本 packet で凍結し実装 PR で転記）
- `71-mnt-backup.md` 本文変更（無変更を独立レビューで機械確認する）
- `28-io-image-manager.md` 変更（IO 層の拡張子防御 check は DB CHECK 制約と同型の防御として現状維持）
- 監査是正 順14（有限 IPC 値の enum 化）。実装干渉（`settings_cmd.rs` の error 生成箇所・`bindings.ts` 生成物）があるため実装 PR は直列とする

## Acceptance Criteria

- `rg -c "^## D-060" docs/decision-log.md` → `1`
- `rg -c "接続所有権の交換を要する保守 orchestration" docs/ARCHITECTURE.md` → `1`（D-060 経路文の存在）
- `rg -c "CMD が IO 層を直接呼ぶことは禁止" docs/ARCHITECTURE.md` → `1`
- `rg -c "まずASCII strict" docs/function-design/43-cmd-settings-log.md` → `0`（§43.5 の CMD validation アルゴリズム所有記述の消滅。改訂前 baseline = 1 を実測済み。空集合 oracle のため次項の非空 oracle と対にする）
- `rg -c "system_repo::" docs/function-design/43-cmd-settings-log.md` → `0`（CMD の IO 直呼び処理記述の消滅。改訂前 baseline = 4 を実測済み）
- `rg -c "biz::system_service" docs/function-design/43-cmd-settings-log.md` → 4 以上（4 command の処理ステップが新経路で記述されている）
- `rg -c "BIZ-01〜BIZ-09" docs/ARCHITECTURE.md` → `1`（§5-9 mapping 更新）
- `rg -c "許可済み例外" docs/architecture/cmd-task-specs.md` → `0`（改訂前 baseline = 4 を実測済み。空集合 oracle のため `rg -c "BIZ-09" docs/architecture/cmd-task-specs.md` ≥ 1 と対にする）
- `rg -c "^### BIZ-09" docs/architecture/biz-task-specs.md` → `1`
- `bash scripts/doc-consistency-check.sh --target plan` exit 0
- `cargo test --test design_compliance_test`（src-tauri）pass — 43 改訂後も cmd fn 抽出と module 対応が成立
- `bash scripts/local-ci.sh full` pass

## Design Sources

- Requirements / spec: `docs/research/audit-2026-07/report.md` 順12 / `findings/p2-layer-boundaries.md` P2-1
- Architecture: `docs/ARCHITECTURE.md`（レイヤー分割方針、CMD層の責務ルール、ARCH-VAL-D1、レイヤー間の呼び出し原則）
- Function / command / DTO: `docs/function-design/43-cmd-settings-log.md`、`31-biz-inventory-service.md`、`28-io-image-manager.md`、`42-cmd-sales-stocktake.md`（順5 の validation 一本化前例）
- Task specs: `docs/architecture/cmd-task-specs.md`（CMD-11 節、「許可済み例外」paragraph）、`docs/architecture/biz-task-specs.md`
- 機械 enforcement: `src-tauri/tests/architecture_test.rs`（`LAYER_EXCEPTIONS` allowlist = settings_cmd の db/io 直呼び 2 entry。実装 PR で削除し layer test を D-060 (b) の恒久 gate にする）
- DB: 変更なし
- Screen / UI: 変更なし（`68-ui-backup-restore.md` §68.7 の kind 契約は参照のみ）
- Decision log / ADR: D-051〜D-059（既存）、D-060（本 PR で新設）、MNT-01-D1/D4/D5（71 §71.7、不変）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | `38-biz-system-service.md`（biz::system_service 関数契約） | intentionally deferred — design_compliance_test の未登録 doc gate により実装 PR で新設。契約は本 packet Spec Contract SPEC-CMD11-D2 で凍結 |
| Command / DTO / generated binding / wire shape | `43-cmd-settings-log.md` | updated in this PR（wire shape 自体は不変 — Boundary / Wire Contract 参照） |
| DB / transaction / audit / rollback / migration | 変更なし | existing sufficient |
| Screen / UI / route state / Japanese wording | 変更なし | existing sufficient |
| CSV / TSV / report / import / export format | 変更なし | existing sufficient |
| Durable decision / ADR | `docs/decision-log.md` D-060 | updated in this PR |

## Registration / Generation Obligations

該当なし（本 PR は新規 command / route / 画面 / function-design file を追加しない）。実装 follow-up PR には次の義務を転記する（SPEC-CMD11-D5）: `38-biz-system-service.md` 新設時の `build_doc_to_modules_map()` 登録 + 必須セクション充足。

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| 監査 P2-1（層境界） | ARCHITECTURE.md 呼び出し原則 | D-060 (a) | CMD→MNT を「接続所有権交換を要する保守 orchestration 限定」の正規経路として明文化。AppState.db Mutex は CMD 層の所有物であり接続交換は CMD にしか実行できない。BIZ wrapper 案は BizError に restore variant がなく `&mut conn` 形とも非適合な pure pass-through になるため棄却 | ARCHITECTURE.md | Matrix M2 |
| 監査 P2-1（IO 直呼び） | ARCHITECTURE.md 呼び出し原則 + §2 task table / 43 §43.3-43.5 | D-060 (b) | settings/log 系は `biz::system_service`（task ID: BIZ-09 新設）経由へ復帰。標準経路（`From<BizError>` 一元変換）に戻し `db_err` 独自 helper を廃止。現状維持案は監査 P2-1 の模倣混乱を放置するため棄却 | ARCHITECTURE.md / 43 | Matrix M3, M5, M12 |
| ARCH-VAL-D1 残存例外 | 43 §43.5（日付 validation） | D-060 (c) | log 日付 validation（ASCII strict YYYY-MM-DD + chrono 実在暦日 + start>end 拒否）を BIZ へ移動。条件・文言・field は不変で移動のみ | 43（記述削除）+ SPEC-CMD11-D2 | Matrix M4+M5 |
| ARCH-VAL-D1 残存例外 | 43 §43.2 + §43.10 / 28-io-image-manager.md | D-060 (c) | 拡張子 validation の所有を BIZ（inventory_service returns domain — receipt_image_path は返品記録の要素）へ。base64 decode は wire 型変換として CMD 残留（ARCHITECTURE.md 既存規定に整合）。IO 防御 check は DB CHECK 同型として維持（ARCH-VAL-D1 は CMD/BIZ 間の二重判定禁止であり IO 防御は対象外）。§43.2 注意書きの「CMD/IO の最終 validation」表現も同時に統一（P2-2） | 31 + 43 §43.2 + SPEC-CMD11-D3 | Matrix M7, M10 |
| MNT-01-D1/D4/D5 | 71 §71.7 / 43 §43.9 | D-060 (d) | 43 §43.9 の restore 記述を 71 §71.7 への normative 参照に置換し重複記述を解消。restore の意味論・CMD 呼び出しパターン・kind 3 値は不変 | 43 | Matrix M6, M9 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 改訂後は ARCHITECTURE.md（経路規範）+ 43（CMD 処理）+ 71（restore 正本）+ decision-log D-060（判断根拠）で完結する
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: D-060 として decision-log へ昇格。SPEC-CMD11-D2 の関数契約は実装 PR の 38 doc へ昇格（それまでは本 packet が凍結を担う一時状態であることを D-060 に明記）
- Assumptions and constraints: design_compliance_test は `docs/function-design/*.md` を read_dir で走査し未登録 doc を fail させる（`design_compliance_test.rs:562`）。抽出はコードブロック内 `fn name(` のみ（同 :346-358）
- Deferred design gaps, risk, and follow-up target: 38 doc の file 新設と test 規範化は実装 PR。凍結内容との drift は実装 PR の Plan Review で本 packet と突合して防ぐ
- Test Design Matrix can cite design decision IDs or source doc sections: D-060 (a)-(d) / SPEC-CMD11-D1〜D5 を引用
- Absolute guarantee / escape hatch self-check completed: 本 PR は絶対保証を新設しない。restore 系の条件付き保証（best-effort log 等）は 71 §71.7 のまま不変

## Impact Review Lenses

not applicable — 監査起源の docs-only 設計 PR であり、実地調査・実機確認・外部ツール挙動起源ではない。data-safety 隣接（restore 正本の参照化）は Review Focus と Matrix M9（71 無変更の機械確認）で担保する。

## Design Readiness

- Existing design docs are sufficient because: 71 §71.7（restore 正本）と 28（IO 画像）は現状で十分。矛盾解消の対象は ARCHITECTURE.md と 43 のみ
- Source docs updated in this PR: ARCHITECTURE.md / 43 / 31 / decision-log
- Design gaps intentionally deferred: 38 doc file 新設（gate 制約。凍結済み契約の転記のみで実装 PR に設計判断は残さない）
- Durable decisions discovered in this plan and promoted to source docs: D-060 (a)-(d)

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): 本 PR の主題。D-060 で経路正本を確定
- Backend function design: SPEC-CMD11-D2 で凍結、実装 PR で 38 doc 化
- Command / DTO / data contract: wire 不変（Boundary / Wire Contract 参照）
- Persistence / transaction / audit impact: なし（docs-only、実装 PR でも DB 変更なし）
- Operator workflow / Japanese UI wording: 不変（error 文言・kind 分類は既存のまま移動）
- Error, empty, retry, and recovery behavior: restore 復旧契約は 71 §71.7 のまま不変。validation error は所有層移動のみで観測可能挙動不変
- Testability and traceability IDs: 実装 PR で REQ 番号付き test を BIZ へ追加（SPEC-CMD11-D5）

## Contract Probe

- design_compliance_test の未登録 doc 挙動: `rg -n "未登録" src-tauri/tests/design_compliance_test.rs` → :562 で「モジュールマッピングに未登録の設計書が N 件」を fail させることを確認 → 38 doc 新設は実装 PR へ deferred
- 設計書からの関数抽出範囲: `design_compliance_test.rs:346-358` — コードブロック内の `fn name(` パターンのみ抽出。prose での `biz::system_service` 言及は抽出対象外 → 31/43 への prose 追記は安全。fn シグネチャのコードブロックは書かない（Matrix M10 で機械確認）
- 43 改訂後の design_compliance_test 実走: implementing phase で `cargo test --test design_compliance_test` を実行し pass を確認する（既存 cmd fn の抽出が 43 改訂後も成立することの実証）

## Contract Coverage Ledger

| Design contract / decision ID | Implementation target | Automated test | L3 or non-scope |
|---|---|---|---|
| D-060 (a) CMD→MNT 正規経路の限定明文化（normative pattern は 71 §71.7 所有、CMD は実行のみ） | ARCHITECTURE.md 呼び出し原則 | Matrix M2（token） | non-scope（コード変更なし） |
| D-060 (b) CMD→IO 直呼び禁止 + settings/log 系の biz::system_service 経由化 | ARCHITECTURE.md / 43 | Matrix M3, M5, M12（token） | 実装は follow-up PR |
| D-060 (b) 派生: ARCHITECTURE.md §2 task table 整合（BIZ-09 行新設 + CMD-11 行更新。Plan Review round 1 P2-1） | ARCHITECTURE.md §2 | Matrix M13（token） | 実装は follow-up PR |
| D-060 (b) 派生: ARCHITECTURE.md §5-9 mapping 範囲 + biz-task-specs.md BIZ-09 節新設（Plan Review round 2 P2） | ARCHITECTURE.md §5-9 / biz-task-specs.md | Matrix M14, M16（token） | 実装は follow-up PR |
| D-060 (b) 派生: cmd-task-specs.md CMD-11「許可済み例外」廃止 + 実装 PR での `LAYER_EXCEPTIONS` 削除義務（round 2 self-audit） | cmd-task-specs.md / SPEC-CMD11-D5 (vi) | Matrix M15（token、baseline 4 実測）+ 実装 PR で architecture_test | 実装は follow-up PR |
| D-060 (c) 業務 validation の BIZ 一本化を CMD-11 に適用（log 日付 / 画像拡張子） | 43 / 31 | Matrix M4+M5, M7, M10 | 実装は follow-up PR |
| D-060 (c) 派生: 43 §43.2 SaveImageRequest 注意書きの所有表現統一（Plan Review round 1 P2-2） | 43 §43.2 | Matrix M11（レビュー）+ M4 系 token の対象外のため独立レビューで確認 | 実装は follow-up PR |
| D-060 (c) 派生: 43 §43.5「エラーハンドリング（追加分、UI-11c-D2/D3）」小節の扱い（Plan Review round 2 P3）: kind/message の wire contract 記述としては存続させ、validation 所有の表現を「BIZ 所有 → `From<BizError>` 変換」へ書き換える（削除ではない。M4 anchor の対象外のため M11 独立レビューへ明示委譲） | 43 §43.5 | Matrix M11（レビュー） | 実装は follow-up PR |
| D-060 (d) 43 §43.9 の 71 §71.7 参照化（restore 意味論不変） | 43 | Matrix M6, M9 | non-scope（71 無変更） |
| SPEC-CMD11-D2 biz::system_service 関数契約（凍結） | 本 packet → 実装 PR で 38 doc | 実装 PR の test 義務として転記 | 実装 PR |
| SPEC-CMD11-D3 画像保存境界（base64 = CMD wire 変換、拡張子 = BIZ、IO 防御維持） | 31 / 43 | Matrix M7, M10 | 実装 PR |
| SPEC-CMD11-D5 実装 PR 義務（38 doc + map 登録 + production CMD test 化） | 本 packet | 実装 PR の Plan Gate で突合 | 実装 PR |
| 隣接 contract sweep: 43 §43.1〜§43.12 全節を走査し、上記以外の契約は次のとおり扱う — §43.6-43.8 の backup 系処理ステップと §43.8.1 の薄い wrapper 記述は「CMD→MNT 正規経路の実行」として D-060 (a) に包含、§43.11 invoke_handler 登録は不変、§43.12 テスト方針は SPEC-CMD11-D5 (iii)（production CMD test 規範化）と整合するよう改訂対象に含める。除外契約なし | 43 §43.12 含む | 独立レビューで再確認 | — |

## Test Plan

Test Design Matrix: [test-matrices/2026-07-31-settings-service-boundary-design.md](test-matrices/2026-07-31-settings-service-boundary-design.md)

- targeted tests: Matrix M1〜M10（機械 token 検査 + gate 回帰）
- negative tests: M4（空集合 oracle）は M5（非空 oracle）と対で運用。M10 は diff に対する負条件
- compatibility checks: M9（71-mnt-backup.md が `git diff --stat` に現れないこと）
- data safety checks: docs-only。実 DB / POS artifact / secret の commit なし
- main wiring/integration checks: `design_compliance_test` + `doc-consistency-check.sh --target plan` + `local-ci.sh full`

## Boundary / Wire Contract

本 PR は wire に触れない。実装 follow-up PR においても wire 不変を契約とする:

- producer: settings_cmd（不変）
- consumer: frontend `bindings.ts` 生成物（不変 — command シグネチャ・DTO・kind/message/field 文言は変更しない）
- wire type: 既存のまま（`CmdError.kind` の enum 化は順14 の scope で、本系列では行わない）
- internal type: BIZ 移動後も `BizError::ValidationFailed`（field 付き）→ `From<BizError>` で従来と同一の kind/field/文言に変換される
- precision/range: 変更なし
- round-trip path: 変更なし
- invalid input: 日付 validation・拡張子 validation の条件と文言は移動のみで不変
- compatibility: `bindings.ts` の再生成 diff がゼロであることを実装 PR の AC とする

## Review Focus

- D-060 (a) の経路正本化が 71 §71.7 の「CMD層での呼び出しパターン」（mem::replace / no-create 復旧 / kind 3 値）と矛盾しないか
- 43 の改訂が「実装 PR 追随予定」の future-state 注記なしに現行コードと矛盾する記述を作っていないか（順1+2 の 71 改訂と同じ扱い）
- validation 移動の記述が条件・文言・field の不変を明示しているか（観測可能挙動の変更を含意しない）
- 隣接 contract sweep の漏れ（43 全節、ARCHITECTURE.md の CMD-11 タスク行 = MNT-01/MNT-02 参照との整合）
- D-060 の Rejected alternatives が実装時に再燃しない程度に根拠を持つか

## Spec Contract

Contract ID: SPEC-CMD11-D1〜D5

- SPEC-CMD11-D1（層経路正本）: レイヤー間呼び出し原則に次を明文化する — (i) 標準経路は UI → CMD → BIZ → IO/MNT の一方向。(ii) CMD → MNT の直接呼び出しは、DB 接続所有権の交換を要する保守 orchestration（MNT-01 バックアップ/復元系）に限り正規経路とする。復旧規則・分類の正本は 71 §71.7 が所有し、CMD は同 § の呼び出しパターンを実行するのみで独自の規則を定義しない。(iii) CMD が IO 層を直接呼ぶことは禁止。(iv) ARCHITECTURE.md §2 task table を新経路と整合させる: BIZ 層 table へ BIZ-09（システム設定・操作ログロジック、実装は順12 実装 PR の注記付き）を新設し、CMD-11 行の呼び出す BIZ を `BIZ-09, BIZ-02, MNT-01, MNT-02` とする。(v) 同 §5-9 mapping table の BIZ 層行を `BIZ-01〜BIZ-09` へ、`biz-task-specs.md` へ BIZ-09 task 仕様節を、`cmd-task-specs.md` CMD-11 節の「許可済み例外」記述を D-060 経路へ、それぞれ整合させる（task 範囲不整合を design PR 内で残さない）
- SPEC-CMD11-D2（biz::system_service 契約 = task ID BIZ-09、実装 PR で 38 doc へ転記）: 対応 command は get_settings / update_setting / list_logs / list_log_operation_types の 4 系。service は (i) 設定一覧取得・設定 upsert・操作ログ検索・operation_type 一覧を `system_repo` 経由で提供、(ii) 操作ログ検索の日付 validation（ASCII strict YYYY-MM-DD + chrono 実在暦日 + start>end 早期拒否。43 §43.5 の現行条件・文言・field を維持）を所有、(iii) error は `BizError::ValidationFailed`（field 付き）/ `BizError::DatabaseError` で返し、CMD は `From<BizError>` の一元変換に復帰する。settings_cmd の独自 helper `db_err` / `validate_log_date_range` は廃止
- SPEC-CMD11-D3（画像保存境界）: base64 decode は wire 型変換として CMD 残留（ARCHITECTURE.md「wire型変換の失敗…はCMD境界で拒否してよい」に整合）。拡張子 validation は biz::inventory_service（returns domain）が所有し `BizError::ValidationFailed` で返す。`io::image_manager` の拡張子防御 check は DB CHECK 制約と同型の防御として現状維持（正常系で到達しない）
- SPEC-CMD11-D4（backup/restore 現状維持）: backup/restore 5 command（create_backup / check_auto_backup / get_effective_backup_dir / list_backups / restore_backup）は D-060 (a) の CMD→MNT 正規経路。`get_backup_dir` helper（AppHandle からの app_data_dir 解決）は環境解決として CMD 残留、実効 backup dir の決定規則は従来どおり `mnt::backup::resolve_backup_dir` 所有。restore の Mutex 所有権交換・`?` 早期 return 禁止・no-create 復旧・kind 3 値は 71 §71.7 の normative pattern のまま実装・文言とも不変
- SPEC-CMD11-D5（実装 follow-up PR 義務）: (i) `38-biz-system-service.md` 新設 + `build_doc_to_modules_map()` 登録 + checker 必須セクション充足、(ii) `31-biz-inventory-service.md` へ save_receipt_image の関数契約（シグネチャ含む）追記、(iii) settings_cmd test の production CMD test 規範（順5: mock_builder + AppState + 実 command 関数呼び出し）化と BIZ test 新設、(iv) `bindings.ts` 再生成 diff ゼロの確認、(v) 本 packet の凍結契約との突合を実装 PR Plan Review の必須観点とする、(vi) `src-tauri/tests/architecture_test.rs` の `LAYER_EXCEPTIONS` から settings_cmd の 2 entry（`("cmd/settings_cmd.rs", "db")` / `("cmd/settings_cmd.rs", "io")`）を削除し、CMD→IO 直呼び禁止を機械 gate へ復帰させる（既存の layer 依存 test が D-060 (b) を恒久 enforce する）

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-CMD11-D1 | ARCHITECTURE.md 呼び出し原則改訂 + §2 task table 整合 | Matrix M2, M3, M13 | 71 §71.7 との無矛盾 | rg token + 独立レビュー |
| SPEC-CMD11-D2 | 43 改訂（設定・ログ 4 command）+ D-060 記載 | Matrix M4, M5, M12 | 条件・文言・field 不変の明示 | rg token |
| SPEC-CMD11-D3 | 43 §43.10 相当改訂 + 31 追記 | Matrix M7, M10 | IO 防御維持の整理が ARCH-VAL-D1 と整合 | rg token + diff 負条件 |
| SPEC-CMD11-D4 | 43 §43.9 相当の 71 参照化 | Matrix M6, M9 | restore 意味論不変 | rg token + git diff --stat |
| SPEC-CMD11-D5 | packet 凍結（本 §） | 実装 PR Plan Gate | 凍結内容の転記漏れ | 実装 PR packet |

## Data Safety

- 実 POS / 店舗 artifact、DB file、backup、log、receipt image、secret は commit しない（docs-only で該当物なし）
- local-only paths: なし
- synthetic-only paths: なし（本 PR にテストデータなし）

## Implementation Results

（実装後に記入）

## Review Response

- Findings Freeze: frozen after Broad Audit; post-freeze exceptions: none.

### Plan Review round 1（independent Claude subagent, Sonnet 5）

- P1-1（M4 が vacuous oracle）: **accept**。anchor `validate_log_date_range` は改訂前 43 に 0 hit（コード上の関数名を doc anchor に流用した誤り）。実在 literal `まずASCII strict`（baseline 1 実測）へ差し替え、`system_repo::`（baseline 4 実測）の消滅 oracle M12 を追加。AC / Matrix 双方修正済み
- P2-1（ARCHITECTURE.md §2 task table の未整合）: **accept**。BIZ-09 行新設 + CMD-11 行更新を Scope / SPEC-CMD11-D1 (iv) / Ledger / Matrix M13 に追加
- P2-2（43 §43.2 注意書きの矛盾残存）: **accept**。§43.2 の所有表現統一を Scope / Design Intent Trace / Ledger に追加
- 適用 commit: plan-gate 中の packet 修正（plan-approved 前のため Amendments 対象外）

### Plan Review round 2（independent Claude subagent, Sonnet 5, fresh context）

- round 1 是正の検証: M4/M12/M13 の baseline 実測一致、packet 内波及の取り残しなしを確認済み
- P2（ARCHITECTURE.md §5-9 mapping table の `BIZ-01〜BIZ-08` 未整合）: **accept**。§5-9 更新 + biz-task-specs.md BIZ-09 節新設を Scope / SPEC-CMD11-D1 (v) / Ledger / AC / Matrix M14, M16 に追加
- P3（43 §43.5 エラーハンドリング小節の扱い不明記）: **accept**。「wire contract として存続 + 所有表現書き換え（削除ではない）、M11 委譲」を Ledger に明記
- round 2 self-audit（Writer 側の同型 premise 全体 sweep で発見、P1 相当）: `cmd-task-specs.md` CMD-11 節が `architecture_test.rs` の `LAYER_EXCEPTIONS` allowlist を根拠に system_repo/image_manager 直呼びを「許可済み例外」として正本化していた（baseline 4 hit）。D-060 (b) と正面矛盾するため cmd-task-specs.md 改訂を Scope へ、allowlist 2 entry 削除を SPEC-CMD11-D5 (vi) へ追加。機械 enforcement の存在は設計にとって好材料（実装 PR 完了後は layer test が D-060 (b) を恒久保証する）

### Plan Review round 3（independent Claude subagent, Sonnet 5, fresh context）

- round 2 是正 + self-audit 反映を全項目実測で確認（M14/M15/M16 baseline 一致、LAYER_EXCEPTIONS 2 entry の文字列表記一致、packet 内数値不一致なし）
- 同型矛盾の横断走査: io/mnt/ui task-specs と FUNCTION_DESIGN.md 索引に同型記述なし（0 hit）。`LAYER_RULES` の cmd→mnt 無制限は Ledger の D-060 (a) non-scope 宣言と整合（機械 enforcement 拡張は本 change の主張に含まれない）。90-traceability.md は task-specs を入力に含まず再生成不要を実証
- 新規 P1/P2 = 0。**plan-approved 進行可の判定**
- P3（Plans.md の `0-2.` 番号が repo 前例なし）: **accept**。リナンバーの参照波及を避け、項目 0 内の継続段落へ統合する形で解消

### Final Review（independent Claude subagent, Sonnet 5, fresh context, audited content = 65f12f2）

- Matrix M1〜M7, M9, M10, M12〜M16 を Reviewer が再実行し全 oracle 一致（実行タイミング規定の Reviewer 分）
- 契約突合: SPEC-CMD11-D1〜D5 と改訂後 doc に drift なし。43 §43.9 の 71 参照化は restore 意味論を再規定せず正しく委譲。BIZ-09/BIZ-02 責務は ARCHITECTURE §2 / cmd-task-specs / biz-task-specs / 43 / 31 §12.9 間で一貫
- **P1/P2 = 0**（merge 前修正なし）
- P3-1（ARCHITECTURE §2 CMD-11 行の MNT-02 記載と呼び出し原則の字面緊張）: **accept-as-backlog**。実 import は MNT-01 のみ・cmd-task-specs に MNT-02 mapping なし・CMD-09 行と同型の既存集約表記慣習で、D-060 起因の新規矛盾ではない（pre-existing）。closeout で backlog へ転記し、将来クリーンアップ時に MNT-02 削除または注記化を判断する。post-freeze の content 変更は行わない（Reviewed Content HEAD = 65f12f2 を維持）
