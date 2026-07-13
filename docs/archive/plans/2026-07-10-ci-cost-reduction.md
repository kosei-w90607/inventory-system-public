# Plan Packet: CI cost reduction — hosted Actions final-only 化 + local verification ladder

> Test Design Matrix: [test-matrices/2026-07-10-ci-cost-reduction.md](test-matrices/2026-07-10-ci-cost-reduction.md)

## Risk

Risk: R3

Reason:
merge gate そのものの変更であり、`docs/DEV_WORKFLOW.md` Risk Tiers が R3 例として明示する「merge gate changes」に該当する。品質ゲートの実行タイミング・実行場所・証跡の定義を変えるため、設計ミスは「テストが走らないまま merge される」という無症状の品質劣化として現れる。

## Goal

品質ゲートの検査内容を落とさずに、GitHub-hosted Actions の billed minutes 消費を約 85〜90% 削減する（見積り。達成判定は 2026-08-01 の枠 reset 後、Migration step 10 で実績検証する）。検証責務を 3 層に再配置する:

- L0: 実装中の push 増分 targeted gate（pre-push、frontend 検出 + Ready push block + bypass evidence）
- L1: PR 全差分を対象とする local full gate（新設 `scripts/local-ci.sh`、HEAD SHA 紐付き証跡）
- L2: GitHub-hosted clean-room CI（完成した HEAD に対する final-only 実行）

## 現状分析（観測事実、2026-07-10 取得）

すべて `gh api` / `gh run view` / repo 実ファイルで裏取り済み。依頼文の背景説明は以下の通り検証した。

### 外部状態の確認結果

| Claim | 検証結果 | Evidence |
|---|---|---|
| CI workflow Disable 済み | 確認。`state: disabled_manually` | `gh api repos/:owner/:repo/actions/workflows` |
| Actions cache 削除済み | 確認。`active_caches_size_in_bytes: 0` | `gh api repos/:owner/:repo/actions/cache/usage` |
| cache 10GB 上限到達 | 現在は削除済みのため直接観測不能。owner 観測を事実として採用（構造的に整合: 後述） | owner 報告 |
| fork PR workflow 無効化・retention 短縮・支払方法なし | GitHub Web UI 設定のため repo からは非観測。owner 報告を事実として採用 | owner 報告 |
| **未 Disable の workflow が残存** | `npm-security-monitor.yml` が `active` のまま **毎日 schedule 実行中**（各 run 約 20 秒 → 課金は job 単位 1 分切り上げで月約 30 分消費） | `gh run list`: 2026-07-08 / 07-09 / 07-10 に schedule 実行記録 |
| branch protection | **現プラン（Free + private repo）では設定不可**。HTTP 403 "Upgrade to GitHub Pro" | `gh api repos/:owner/:repo/branches/main/protection` |

### billed minutes の消費構造（run 28904166222 ほか実測）

GitHub の課金は job ごとに 1 分切り上げ。UI-10 の代表的 PR push run（Rust + frontend 変更を含む PR）:

| Job | 実測 wall time | billed |
|---|---|---|
| Detect changed areas | 7 秒 | 1 分 |
| Rust fmt/clippy | 2 分 47 秒 | 3 分 |
| Rust tests | 6 分 30 秒 | 7 分 |
| Rust generated drift | 6 分 37 秒 | 7 分 |
| Frontend (typecheck + lint + format + build) | 2 分 46 秒 | 3 分 |
| Design doc consistency | 63 秒 | 2 分 |
| Rust (fmt + clippy + test) aggregate | 3 秒 | 1 分 |
| **合計** | | **約 24 分 / push** |

### 月間消費の実測と削減試算

- run 回数実測: 2026-06 = 45 run、2026-07 は **10 日間で 148 run**（pull_request 90 + push 58。`gh run list` 集計）
- before 試算: 平均 12〜18 分/run（heavy 約 24 分と docs 系 4〜11 分の混合）× 148 run ≈ 1,800〜2,700 分/10 日。無料枠 2,000 分/月を月央で使い切る水準で、owner の残量観測と整合する
- after 試算: hosted final run 月 5〜10 回 × 30〜35 分（target cache 除去による cold build 増を織り込み）+ monitor weekly 約 4 分 ≈ 160〜350 分/月 → **約 85〜90% 削減見込み**

### 主要な浪費原因（金額順）

1. **PR 内の全 push で全差分再検証**: GitHub pull_request CI は PR 全差分を評価するため、Rust/frontend を含む PR では docs-only の後続 push でも毎回約 24 分。UI-10 は 2026-07-07 の 1 日だけで pull_request run 6 回 + main push run 2 回 = 推定 190 分超（無料枠 2,000 分/月の約 10% を 1 機能 1 日で消費）。
2. **main push の重複再検証**: squash merge 直後の main push run は直前の PR run とほぼ同一内容（run 28904560018、約 24 分）。
3. **docs 編集が Rust runner を起動**: `docs/function-design/*` は `rust_drift` に分類されるため、closeout の docs-only push でも Rust toolchain + cargo build を要する 7 分 job が走る（run 28904958558: docs のみで billed 約 11 分）。分類自体は traceability 品質のため正しい。hosted で毎回払うことが問題。
4. **Rust 3 job の依存準備固定費**: apt install + toolchain + cache restore を 3 runner が別々に実行（D-026 のディスク対策の代償）。
5. **`src-tauri/target/` の cache 保存**: actions/cache は branch scope のため PR branch ごとに数 GB 級 entry が作られ、10GB 上限で有用な main の cache を evict し合う。save/restore の転送時間も billed に乗る。
6. **run あたりの固定費**: Detect + aggregate で毎 run 2 分。
7. **npm-security-monitor の daily schedule**: 月約 30 分。

## Scope

1. `.github/workflows/ci.yml` の trigger 再設計（final-only 化）、`concurrency` 追加、cache path 縮小
2. changed-area classifier の共有 script 化（`scripts/ci/classify-changes.sh` 新設。stdout に `key=true|false` の 9 行のみを出力し、`rust` / `rust_drift` / `frontend` / `docs` / `env` / `generated` / `traceability` / `workflow` / `unknown` を分類する。ci.yml / local-ci / pre-push が同一実装を使用し、unknown path または base/head 判定不能時は全 area true）
3. `scripts/local-ci.sh` 新設（`changed` / `full` mode、`.local/ci-evidence/` への HEAD SHA 紐付き証跡保存）
4. `scripts/pre-push.sh` への frontend 増分 fast check 追加（route tree生成 + typecheck + lint）、Ready PR への push block、固定 token の緊急 bypass evidence
5. `.github/workflows/npm-security-monitor.yml` の schedule を daily から weekly へ変更 + `workflow_dispatch` 追加
6. source docs 更新: `docs/ci.md`（全面改訂）、`docs/DEV_WORKFLOW.md`（Verification Gates / Draft PR Checkpoint / Post-Merge Closeout）、`docs/decision-log.md`（D-033 追加）、`Plans.md`、`docs/project-profile.md`、`.github/pull_request_template.md`（Validation 記載ガイド 1 行）、`docs/DEV_SETUP_CHECKLIST.md` §3.2（pre-push 説明）
7. classifier / local-ci / pre-push / workflow fixture test（`scripts/tests/classify-changes.test.sh`、`scripts/tests/local-ci.test.sh`、`scripts/tests/pre-push.test.sh`、`scripts/tests/ci-workflow.test.sh` 新設、plain bash + Ruby stdlib、新規依存なし）

## Non-scope

- Rust 3 job の再統合（D-026 のディスク実証が final-only 運用下の telemetry で反証されるまで見送り。本 packet の Follow-up に再評価条件を記録）
- self-hosted runner の導入（将来候補として D-033 に記録するのみ）
- GitHub Web UI 設定の変更（branch protection、retention、workflow Enable/Disable は owner 操作）
- 支払方法登録
- product runtime behavior / DB schema / operator UI の変更
- テスト件数の削減、CI 検査項目の削減（実行場所とタイミングだけを変える）
- 新しい npm / Rust 依存の追加（actionlint 等の局所ツールは brew 管理の任意ツールとし、repo 依存にしない）
- branch protection / required checks の設計前提化（現プランで設定不可と実測済みのため、証跡ベース設計に切替）

## Acceptance Criteria

実装 PR で以下を evidence 付きで満たす。

- `rg -n 'push:' .github/workflows/ci.yml` の trigger 定義に `branches: [main]` の push trigger が存在しない（workflow_dispatch と pull_request `types: [opened, ready_for_review]` のみ）
- pull_request は docs-only `paths-ignore`、Draft / owner-authorized R0/R1 `Hosted CI: skip` job guard を持ち、Ready 直作成は `opened` で full run、Draft push は event 不在、manual dispatch は zero-diff でも全 gate を実行する
- `rg -n 'src-tauri/target' .github/workflows/ci.yml` が actions/cache の `path:` 内で 0 hit（disk telemetry の `du -sh target` 行は残置可）
- `rg -n 'concurrency' .github/workflows/ci.yml` が group + `cancel-in-progress: true` を含む
- `bash scripts/local-ci.sh full` が exit 0 で完走し、`.local/ci-evidence/` 配下に HEAD SHA をファイル名と本文に含む log を生成する
- その evidence log に、Gate 等価性対応表の L1 列全 gateの実行記録（gate 名 + exit code）が含まれ、frontend の前に `npm ci` が成功している
- working tree が dirty な状態で `bash scripts/local-ci.sh full` を実行した場合、evidence log に `DIRTY` マーカーが記録される（clean 証跡と区別可能）
- merge evidence は PR HEAD と同じ SHA の `full` + `CLEAN` のみ。DIRTY evidence は診断用で merge 判定に使用しない
- `bash scripts/local-ci.sh changed` が merge-base（`git merge-base origin/main HEAD`）起点の PR 全差分を分類し、pre-push の push 増分とは異なる範囲を対象にすることを、実装 branch 自身の diff で確認する
- `bash scripts/tests/classify-changes.test.sh` が exit 0（docs-only / frontend-only / Rust-only / frontend test + traceability / env-only / generated / workflow / unknown root+nested / base 判定不能 / multi-commit merge-base / delete / cross-area rename/copy）
- `bash scripts/tests/pre-push.test.sh` が exit 0（frontend 実行、docs-only skip、実 push ref の Ready block、実 local object SHA 付き bypass）
- `bash scripts/tests/ci-workflow.test.sh` が exit 0（trigger、docs paths-ignore、Draft/R0/R1 全 job runner 0、aggregate guard、dispatch full、shared classifier、concurrency、cache、check名）
- frontend ファイルを含む push で `scripts/pre-push.sh` がroute tree生成後にtypecheck + lintを実行し、各command失敗を非0で伝播し、docs-only pushではskipすることをfixtureと`.local/quality-check.log`で確認する
- `rg -n 'cron' .github/workflows/npm-security-monitor.yml` が weekly 相当の cron 式のみを含む
- Cargo cache path は registry index/cache + git db のみで、`src-tauri/target/` / `~/.cargo/bin/` を含まない。同一 OS+lock key の first-writer 競合を受容し、job 別 key で三重保存しない
- `docs/ci.md` が docs-only/R0/R1、75%/90%、Actions Disabled migration、Ready 後修正、2026-08-01 再評価を規定する
- `bash scripts/doc-consistency-check.sh` と `bash scripts/doc-consistency-check.sh --target plan` が ERROR 0 で通る
- migration step 8（owner の Enable 後）: main に対する `gh workflow run` の初回 dispatch が conclusion success（これのみ merge 後の後続 evidence）

## Design Sources

- Requirements / spec: `docs/DEV_WORKFLOW.md` Risk Tiers / Verification Gates / Draft PR Checkpoint / Post-Merge Closeout
- Architecture: `docs/ci.md`（CI 運用の一次仕様書、本 PR で全面改訂）
- Function / command / DTO: 対象外（backend contract 変更なし）
- DB: 対象外
- Screen / UI: 対象外
- Decision log / ADR: `docs/decision-log.md` D-026（changed-area routing / Rust 3 job 分割）、D-030（npm 常設ガード、monitor の位置付け）、新設 D-033
- 過去 evidence: `docs/archive/plans/2026-07-01-ci-gate-optimization.md`（PR #120）、`docs/archive/plans/2026-07-08-ui10-stocktake-workflow-effectiveness-review.md`（Plan Packet 先行 commit 規律）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend function / command / repository / validation / error | 対象外（変更なし） | existing sufficient |
| Command / DTO / generated binding / wire shape | 対象外（bindings drift check は検査内容不変のまま実行場所のみ変更） | existing sufficient |
| DB / transaction / audit / rollback / migration | 対象外 | existing sufficient |
| Screen / UI / route state / Japanese wording | 対象外 | existing sufficient |
| CSV / TSV / report / import / export format | 対象外 | existing sufficient |
| Merge gate / workflow routing | `docs/ci.md` + `docs/DEV_WORKFLOW.md` CI routing 節 | updated in pre-implementation design commit |
| Durable decision / ADR | `docs/decision-log.md` D-033 | updated in pre-implementation design commit |

## 採用案と却下案（指定 15 論点の裁定）

| # | 案 | 裁定 | 根拠 |
|---|---|---|---|
| 1 | `push: main` trigger 削除 | **採用** | squash merge 直後の main run は直前 PR run とほぼ同一（実測 24 分の重複）。単独開発 + squash merge のため merge 時の semantic 差分リスクは低く、R3/R4 は「main 取込み後の HEAD で final run」を運用要件にして代替する。merge 後に必要なら workflow_dispatch で main を再検証できる |
| 2 | 各 push での pull_request CI 停止 | **採用** | 浪費原因 1 位（push ごと約 24 分）。Draft 中の push では一切走らせない |
| 3 | `workflow_dispatch` 追加 | **採用** | ref 指定で PR branch / main の双方を検証する。dispatch は classifier の diff に依存せず全 area true とし、zero-diff main でも初回 runtime 検証になる |
| 4 | Draft では走らせず Ready 化 / 手動でだけ走らせる | **採用**（`pull_request: types: [opened, ready_for_review]` + workflow_dispatch） | Ready 化 = final CI 依頼。`opened` は Ready 直作成を補完し、Draft は job guard、docs-only は paths-ignore、R0/R1 は PR 本文 `Hosted CI: skip` で runner 0 にする |
| 5 | Ready 化後の修正での stale green 防止 | **採用**（機械 block + exact-HEAD 証跡） | branch protection は不可だが、pre-push が GitHub PR state を read-only 確認して Ready push を非0で拒否する。修正は Draft へ戻して push → local full → Ready を強制。merge 前は run headSha == PR HEAD を突合し、raw `--no-verify` ではなく記録付き固定-token bypass のみ許可する |
| 6 | `concurrency` + `cancel-in-progress` | **採用** | dispatch 連打や re-ready の重複 run を自動 cancel。group は PR number / ref 単位 |
| 7 | `src-tauri/target/` を cache から外す | **採用** | branch scope の数 GB entry が 10GB 上限を圧迫し合う。Cargo registry index/cache と git db のみ残し、依存取得でない `~/.cargo/bin/` も外す。同一 key の Rust 3 job は first writer の save 競合を受容し、job 別 key による三重保存はしない |
| 8 | PR 固有 cache の再利用性 | **低いと裁定** | cache key は Cargo.lock hash で PR 固有ではないが、entry は branch scope のため他 PR から参照できず、target の増分価値は branch をまたぐと薄い。7 の除去判断を支持する事実として記録 |
| 9 | docs-only closeout の batch 化 | **実質採用（自動解決）** | push trigger 削除により closeout push は hosted CI を一切起動しなくなる。closeout の品質は既存の local `doc-consistency-check.sh` 実行（DEV_WORKFLOW Post-Merge Closeout 記載済み）で担保。batch 化自体は既存の「Dashboard-only merge baseline sync は次の docs cleanup に同乗可」の運用を継続 |
| 10 | warn-only `npm audit` を hot path から外す | **却下（現状維持）** | frontend job 内の 1 step であり追加 runner を持たない。billed minutes への寄与は秒単位で、外しても節約にならない。final-only run に含まれる形で維持 |
| 11 | changed-area / docs / aggregate 専用 runner の固定費 | **維持と裁定** | 毎 run 固定 2〜4 分だが final-only 化で run 頻度自体が激減するため許容。aggregate job は branch protection 不在で check 名互換の必然性が消えており、廃止は blast radius を抑えるため今回見送り、telemetry 再評価時の候補として D-033 に記録 |
| 12 | Rust 3 job 再統合 | **今回 scope 外** | D-026 の却下理由（PR #119 の hosted runner disk pressure 実証）を覆す新しい実証がまだない。target cache 除去 + final-only 化でディスク条件が変わるため、既存の disk telemetry を final run で収集した後に再評価する（Follow-up 記録） |
| 13 | self-hosted runner | **今回 scope 外** | 緊急止血に不要。常時稼働マシンの管理コストとセキュリティ境界の設計が必要なため、2026-08-01 以降の再評価対象として D-033 に記録 |
| 14 | branch protection / required checks との整合 | **現状は前提外、互換名は維持** | Free + private では設定不可を実測。既存 job/check 名は維持する。将来 public / Pro 化時は docs-only 0 run、skip token、final-only event と required context の整合を導入前に再設計する |
| 15 | Disable 状態からの安全な有効化・初回検証手順 | **採用** | Migration 節に 10 step で明文化。workflow 自身の初回検証は「owner Enable 後の main への dispatch 1 回」を検証イベントとして設計する |

## Gate 等価性対応表（hosted ↔ local ladder）

hosted で自動実行されなくなる各 gate の担当層を固定する。review では本表と実装を突合する。

| 現行 hosted gate | 検査コマンド | final-only 後の担当層 |
|---|---|---|
| Rust fmt/clippy | `cargo fmt --check` / `cargo clippy --all-targets --all-features -- -D warnings` | L0 pre-push（Rust 増分時、現行①）+ L1 changed/full + L2 final |
| Rust tests | `cargo test` | L0 pre-push（Rust 増分時、現行①）+ L1 changed/full + L2 final |
| design compliance | `cargo test --test design_compliance_test`（`cargo test` に包含） | L0/L1/L2 の Rust tests に包含 |
| bindings drift | `cargo run --bin generate_bindings` + `git diff --exit-code src/lib/bindings.ts` | L1 changed（rust_drift 分類時）/ full + L2 final |
| traceability | `cargo run --bin generate_traceability -- --check` | L0 pre-push（対象増分時、現行④）+ L1 changed/full + L2 final |
| Design doc consistency | `bash scripts/doc-consistency-check.sh` | L0 pre-push（設計書増分時、現行②）+ L1 毎回 + L2 final |
| Env safety | `bash scripts/check-env-safety.sh` | L0 pre-push（env 増分時、現行③）+ L1 changed（env 分類時）/ full + L2 final |
| Frontend route generation | `npm run generate:routes` | L0 / L1 の FE gate 前段 + L2 final |
| Frontend typecheck / lint | `npm run typecheck` / `npm run lint` | L0 pre-push（FE 増分時、本 PR 新設）+ L1 changed/full + L2 final |
| Frontend format / test / build | `npm run format:check` / `npm test` / `npm run build` | L1 changed（frontend 分類時）/ full + L2 final |
| npm audit warn-only | `npm audit --audit-level=high` | L1 full（warn-only）+ L2 final の frontend job 内 |
| 生成物残置チェック | `git diff --exit-code` | L1 の最終 step（本 PR 新設） |
| Ready-state push guard | `gh pr view/list` による read-only PR state 検査 | L0 pre-push。Ready なら push 前に非0、固定 token bypass は log へ記録 |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-WF-CI2-01 | docs/ci.md Hosted Trigger Model | WF-CI2-D1 | hosted を final-only 化（Ready opened / ready_for_review + full dispatch、push:main 削除）。docs-only paths-ignore、Draft / R0/R1 skip guard を併用 | `.github/workflows/ci.yml` on: 節 + changes job guard | Draft push 無増加 / docs-only 0 / Ready 直作成 / Ready 化 / zero-diff dispatch |
| SPEC-WF-CI2-02 | DEV_WORKFLOW Post-Merge Closeout | WF-CI2-D2 | stale green 防止は証跡ベース（run headSha と PR HEAD の突合）。却下: required checks（Free + private で設定不可を実測） | docs/ci.md 手順 + PR template Validation ガイド | closeout 前チェック手順の review |
| SPEC-WF-CI2-03 | docs/ci.md cache 方針 | WF-CI2-D3 | cache から `src-tauri/target/` を除去し依存取得 cache のみ残す。却下: target 継続保存（10GB 上限到達の主犯で branch scope により再利用性低）、全 cache 廃止（registry 再取得の時間損失が大きい） | ci.yml actions/cache path | `rg 'src-tauri/target'` 0 hit + final run の disk telemetry |
| SPEC-WF-CI2-04 | docs/ci.md Classifier Contract | WF-CI2-D4 | classifier を共有 script 化し、generated / traceability を個別化する。unknown path または base/head 不明は全 area true | `scripts/ci/classify-changes.sh` | `scripts/tests/classify-changes.test.sh` |
| SPEC-WF-CI2-05 | DEV_WORKFLOW Verification Gates | WF-CI2-D5 | `local-ci.sh` は merge-base 起点の PR 全差分を対象にし、証跡を HEAD SHA でキー付けして旧 SHA green の流用を防ぐ。却下: pre-push の push 増分を最終証拠とする（既存 branch への push では PR 全差分を見ない） | `scripts/local-ci.sh` + `.local/ci-evidence/` | evidence log の SHA / DIRTY マーカー検証 |
| SPEC-WF-CI2-06 | docs/ci.md Pre-push Contract | WF-CI2-D6 | pre-push は高速増分 feedback に限定し frontend は route tree生成後にtypecheck + lint。Ready push は機械 blockし、緊急 bypass は固定 token を log に残す | `scripts/pre-push.sh` | frontend command順/docs routing + Ready block + bypass fixture |
| SPEC-WF-CI2-07 | D-030（npm 常設ガード） | WF-CI2-D7 | npm-security-monitor は weekly + dispatch に削減（月 30 分 → 約 4 分）。却下: 完全停止（supply-chain 監視の空白）、daily 維持（final-only 方針との不整合） | `.github/workflows/npm-security-monitor.yml` | cron 式の static check |
| SPEC-WF-CI2-08 | D-026 | WF-CI2-D8 | Rust 3 job 構成 / changed-area routing / aggregate check 名 / disk telemetry は維持（D-026 の実証を尊重）。再統合は telemetry 再収集後の再評価 | ci.yml job 構成（不変部分） | 既存構成の diff review |
| SPEC-WF-CI2-09 | docs/ci.md Disabled Migration / Budget Pressure | WF-CI2-D9 | Disable 状態からは「merge → owner Enable → main full dispatch 1 回」。75% / 90% と 2026-08-01 再評価を固定 | Migration 手順 + docs/ci.md | static docs review + 初回 dispatch conclusion success |

## Failure Mode 分析

| # | Failure mode | 影響 | 対策（本設計内） |
|---|---|---|---|
| FM-1 | Ready 化後の追い push が未検証のまま merge（stale green） | 壊れた main | pre-push が Ready PR への push を block。Draft に戻して push → local full → Ready。merge 前は run headSha == PR HEAD を突合 |
| FM-2 | ci.yml と local-ci の分類 drift | local green だが hosted で別 gate が走る/走らない | classifier を単一 script に共有化 + fixture test で固定 |
| FM-3 | workflow 構文 / event / job graph エラーを merge 後まで検出できない | 初回 Enable 時に CI 不能、skip guard から aggregate だけ起動 | Ruby YAML / Prettier + repo-owned ci-workflow fixture（全 always job guard含む）+ 初回 dispatch。利用可能なら actionlintも追加 |
| FM-4 | dispatch event に `github.event.before` がない / main では merge-base = HEAD | zero-diff の軽量 green | workflow_dispatch は classifier diff に依存せず全 area true。local changed の multi-commit merge-base は fixture で別途固定 |
| FM-5 | local evidence の dirty tree / SHA 不一致 | 検証していない tree の green 流用 | HEAD SHA + CLEAN/DIRTYを記録し、merge evidence は exact HEAD の full+CLEAN のみ。DIRTYは診断用 |
| FM-6 | push:main 削除により、merge 時の semantic conflict が未検証で main に入る | main の潜在破壊 | R3/R4 は最新 main を branch に取り込んだ completed HEAD で final run。R0-R2 は単独開発 + squash merge の残存リスクを受容し、必要時は main dispatch |
| FM-7 | target cache 除去で Rust job 時間増（cold build） | final run が約 24 分 → 30〜35 分 | final-only 化による run 回数削減（月次で約 90% 減）が job 単価増を大きく上回る。disk telemetry は維持済みで実測を継続 |
| FM-8 | 無料枠が 2026-08-01 前に枯渇し hosted final run 不能 | R3/R4 の clean-room 証跡欠落 | local-ci full evidence + review-only を暫定最終証跡とし、hosted final run を枠 reset 後に繰り延べる例外手順を docs/ci.md に定義。例外適用は PR 本文に記録 |
| FM-9 | monitor weekly 化で advisory 検知が最大 7 日遅延 | 依存の悪性 version 検知遅れ | `min-release-age=7` + `ignore-scripts=true`（D-030 常設ガード）が実行面を防いでいるため検知遅延の実害は限定的。dispatch でいつでも手動実行可能 |
| FM-10 | Draft を経ず Ready で直接作成した PR が `ready_for_review` を発火しない | 検証 0 件の merge | pull_request `opened` + non-draft guard で full run。Draft open は runner 0 |
| FM-11 | hosted で走らなくなった gate が L0/L1 のどこにも割り当てられない | 検査内容の実質削減 | Gate 等価性対応表で全 gate の担当層を固定し、review で表と実装を突合する |
| FM-12 | npm-security-monitor の cadence 変更漏れ | daily 消費の継続（月約 30 分） | cron 式の static check を Acceptance Criteria に含める |
| FM-13 | unknown root / nested path が全分類 false | 危険な変更を skip | unknown=true を出し、1 件でも unknown なら全 area true。root / nested fixture を追加 |
| FM-14 | raw `--no-verify` で Ready block / L0 gate が無証拠 bypass | stale green と gate 欠落が観測不能 | sanctioned bypass は固定 reason token を hook に渡し `BYPASS` log。raw `--no-verify` は運用違反 |
| FM-15 | Rust 3 job が job 別 key で同じ依存 cache を三重保存 | 10GB 再到達 | OS+Cargo.lock の同一 immutable keyを維持し first-writer save競合を受容。target/bin は除外 |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: 改訂後の `docs/ci.md`（trigger model / ladder / cache / 例外手順）と D-033 で自足する
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: final-only trigger model、証跡ベース stale-green 防止、target cache 除去、classifier 共有化 → すべて D-033 と docs/ci.md へ昇格
- Assumptions and constraints: Free plan（2,000 分/月）、private repo、branch protection 設定不可、単独開発 + squash merge、owner のみが Web UI 操作可能
- Deferred design gaps, risk, and follow-up target: Rust 3 job 再統合（telemetry 再評価）、aggregate job 廃止、self-hosted runner、2026-08-01 以降の実績再評価 → Plans.md Backlog へ
- Test Design Matrix can cite design decision IDs or source doc sections: WF-CI2-D1〜D9 を引用

## Impact Review Lenses

外部ツール（GitHub Actions の課金・trigger 挙動）の観測から始まる変更のため記入する。

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Adapter / core boundary | 非該当（POS adapter 変更なし） | なし |
| Fact check / design decision split | 事実: 課金は job 単位 1 分切り上げ / branch protection 403 / cache branch scope。判断: final-only 化・証跡ベース防止はこの事実の上の設計 | 本 packet 現状分析節 |
| Lifecycle / retry | run の再実行は dispatch で任意回。cancel-in-progress で古い run を回収 | docs/ci.md 運用手順 |
| Operator workflow | owner の操作は Enable + 初回 dispatch + 以後の Ready 化判断のみ。gh CLI 手順を docs/ci.md に記載 | docs/ci.md |
| Replacement path | self-hosted runner へ将来移行しても L0/L1 の local ladder と証跡形式は不変。L2 の実行基盤だけ差し替え可能 | D-033 Alternatives |
| Data safety / evidence | 証跡は `.local/ci-evidence/`（gitignore 済み）。real data 不使用 | Data Safety 節 |
| Reporting / accounting semantics | 非該当 | なし |
| Manual verification | 初回 Enable 後の main dispatch 1 回は owner または gh CLI での手動検証イベント | Migration step 8 |

## Design Readiness

- Existing design docs are sufficient because: CI の一次仕様書 `docs/ci.md` と DEV_WORKFLOW の CI routing 節が既に存在し、本 PR での改訂対象が明確
- Source docs updated in this PR: docs/ci.md、DEV_WORKFLOW.md、decision-log.md（D-033）、project-profile.md、Plans.md、pull_request_template.md、DEV_SETUP_CHECKLIST.md
- Design gaps intentionally deferred: Rust job 再統合 / aggregate 廃止 / self-hosted（いずれも telemetry または枠 reset 後の実績が前提）
- Durable decisions discovered in this plan and promoted to source docs: D-033（下記 draft）

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): 非該当（workflow / scripts のみ）
- Backend function design: 非該当
- Command / DTO / data contract: 非該当（bindings drift 検査は内容不変）
- Persistence / transaction / audit impact: `.local/ci-evidence/` は gitignore 済み local 証跡で DB 影響なし
- Operator workflow / Japanese UI wording: 非該当（operator 向け画面変更なし）
- Error, empty, retry, and recovery behavior: FM-3 / FM-4 / FM-8 で網羅
- Testability and traceability IDs: SPEC-WF-CI2-01〜09 / WF-CI2-D1〜D9

## D-033 source decision trace

- Canonical source: `docs/decision-log.md` D-033（本 packet と同じ pre-implementation design commit で確定）
- Decision: GitHub-hosted CI を completed-HEAD final-only 実行（Ready `opened` / `ready_for_review` + full `workflow_dispatch`、`push: main` 廃止、concurrency cancel）に変え、検証責務を L0 pre-push / L1 `scripts/local-ci.sh` / L2 hosted clean-room へ再配置する。docs-only は paths-ignore、R0/R1 は `Hosted CI: skip`、Ready push は pre-push block。cache は Cargo dependency-only、monitor は weekly + dispatch。
- Status: accepted
- Why: 2026-08-01 までの Actions 無料枠が逼迫（owner が workflow Disable / cache 削除を実施済み）。実測で PR push 1 回約 24 billed 分、UI-10 の 1 日で推定 190 分超を消費。branch protection は Free + private で設定不可（403 実測）のため、required checks 前提の設計ではなく証跡ベース（run headSha と merge HEAD の突合）で stale green を防ぐ。
- Impact: hosted CI は R3/R4・operator-facing UI・DB・CMD/wire・migration・backup/restore・workflow・release の完成 HEAD に原則 1 change 1 回。docs-only / closeout / Plans 同期 / R0/R1 は local gate で完結。classifier は generated / traceability / unknown を含む shared script とし、unknown は full fallback。
- Relation to D-026: **部分維持 + 部分 supersede**。changed-area routing、Rust fmt/clippy / tests / generated drift の 3 job 分割、aggregate check 名、disk telemetry は維持（補足）。「pull_request 各 push + main push での hosted 実行」と「`src-tauri/target/` の cache 保存」は本決定が supersede する。D-026 の履歴と却下理由（disk pressure 実証）は有効なまま残す。
- Budget / revisit: 75% で R2 local-full 既定、90% で release/R4 以外の hosted を一時停止。2026-08-01 以降に実績再評価。

## Documentation 更新方針

| Doc | 変更内容 |
|---|---|
| `docs/ci.md` | 全面改訂: final-only trigger model、L0/L1/L2 責務表、`local-ci.sh` の mode と evidence 形式、dispatch 手順（gh CLI 例）、stale-green 突合手順、cache 方針、risk tier 別の hosted 実行基準、枠枯渇時の例外手順、monitor cadence |
| `docs/DEV_WORKFLOW.md` | Verification Gates に L0/L1/L2 ladder と `local-ci.sh` を追記。Draft PR Checkpoint に「Ready 化 = final CI 依頼」の意味付けを追記。Post-Merge Closeout の「Confirm CI/checks are green」を「final run の headSha 突合 + local evidence 確認」に書換 |
| `docs/decision-log.md` | pre-implementation design commit で D-033 を追加し、D-026 / D-030 に部分 supersede 関係を追記 |
| `Plans.md` | 本タスクを進行中に追加、Backlog の Workflow / CI 行に「Rust job 再統合の telemetry 再評価」「aggregate 廃止候補」「self-hosted 検討」「2026-08-01 実績再評価」「headSha 突合手順の hook 機械強制検討（2026-07-08 WER follow-up と合流）」を追記 |
| `docs/project-profile.md` | Source of Truth 表と Workflow Notes の CI 記述を final-only model に更新 |
| `.github/pull_request_template.md` | Validation 節に記載ガイド 1 行追加（local-ci evidence の HEAD SHA + hosted final run URL） |
| `docs/DEV_SETUP_CHECKLIST.md` | §3.2 pre-push の説明に frontend fast check を追記 |

## Migration（Disable 状態からの安全な移行手順）

1. 実装 branch で repository 内変更を実装（Scope 1〜7。workflow は Disable のままなので PR 中に走らない）
2. ローカル静的検証: `bash -n`、classifier/pre-push/ci-workflow fixtures、Ruby YAML parser、Prettier。ci-workflow fixture が Actions event/job graphを検査し、actionlint は既存環境で追加実行
3. `bash scripts/local-ci.sh full` を実装 branch で実行し、初の HEAD SHA 紐付き evidence を生成（dogfood）
4. R3 review-only sub-agent を実行（DEV_WORKFLOW Review Rules の既定）
5. Draft PR 作成。PR 本文に残存リスクを明記: 「hosted workflow 自身の実行時検証は owner Enable 後の初回 dispatch まで持ち越し」
6. owner review 後に merge（本セッションでは merge しない）。hosted CI 証跡なしを明示的に受容し、代替証跡 = local-ci full + review-only + fixtures + Ruby YAML/Prettier（利用可能なら actionlint）。本 PR は exact-head hosted 証跡の bootstrap 例外
7. owner が GitHub Web UI で CI workflow を Enable（owner 操作）
8. main に対して `gh workflow run ci.yml --ref main` で初回 dispatch を 1 回実行する。dispatch は無条件 full routing のため zero-diff main でも全 gateを検証する。失敗時は Draft workflow fix PR を同手順で回す
9. 成功後、final-only 運用を開始（docs/ci.md の運用表が正）
10. 2026-08-01 の枠 reset 後、billed minutes 実績と disk telemetry を確認し、Rust job 再統合 / aggregate 廃止 / self-hosted / monitor cadence を再評価（Plans.md Backlog）

## 実装順序（Codex 向け）

1. `scripts/tests/classify-changes.test.sh` に required cases を RED で追加し、`scripts/ci/classify-changes.sh` を実装（入力 = base/head、stdin paths、または `--all`、出力 = 9 boolean、unknown/base failure は全 true）
2. `scripts/tests/local-ci.test.sh` を RED で追加後、`scripts/local-ci.sh` を実装（changed / full、exact-SHA CLEAN/DIRTY evidence、command/exit code）
3. `scripts/tests/pre-push.test.sh` を RED で追加し、`scripts/pre-push.sh` に frontend fast check、Ready push block、記録付き bypass を実装
4. `scripts/tests/ci-workflow.test.sh` を RED で追加後、`.github/workflows/ci.yml` を改訂（opened/ready_for_review + docs paths-ignore + Draft/R0/R1 全job guard、aggregate always guard、concurrency、共有 classifier、dispatch `--all`、cache path 縮小）
5. `.github/workflows/npm-security-monitor.yml` cadence 変更
6. docs 一式更新（Documentation 更新方針の表の通り）
7. 全体を local-ci full で検証 → review-only → Draft PR

## Test Plan

Test Design Matrix: [test-matrices/2026-07-10-ci-cost-reduction.md](test-matrices/2026-07-10-ci-cost-reduction.md)

- targeted tests: classifier fixture、local-ci exact-SHA CLEAN/DIRTY、pre-push routing/shared-classifier/Ready block/bypass、ci-workflow event/job graph fixture
- negative tests: merge-base 不在 fallback、dirty tree、Disable 中の dispatch 失敗の扱い、zero-diff
- compatibility checks: 既存 check 名・job 構成の維持（D-026 部分）、`.local/quality-check.log` 形式の互換
- data safety checks: `.local/` の gitignore 維持、evidence への秘匿情報混入なし
- main wiring/integration checks: ci.yml が共有 classifier を実際に呼ぶこと、owner Enable 後の初回 dispatch green

## Boundary / Wire Contract

- producer: `scripts/ci/classify-changes.sh`（9 booleans: rust / rust_drift / frontend / docs / env / generated / traceability / workflow / unknown）
- consumer: ci.yml の job-level `if:`（GITHUB_OUTPUT）、`scripts/local-ci.sh`、`scripts/pre-push.sh`
- wire type: `key=true|false` 行（GITHUB_OUTPUT 互換の plain text）
- 出力境界: 共有 script は stdout のみに書く。`GITHUB_OUTPUT` / `GITHUB_STEP_SUMMARY` へのリダイレクトは呼び出し側の ci.yml step が担い、local 実行で未定義変数エラーを起こさない
- internal type: bash 変数（文字列 true / false）
- precision/range: boolean のみ、数値なし
- round-trip path: 同一 fixture diff を両 consumer に与えて同一 boolean 集合になることを fixture test で固定
- invalid input: base 不能または unknown path は全 area true の安全側 fallback
- compatibility: 現行6 keyを維持し、generated / traceability / unknown を追加。`rust_drift = generated || traceability` の互換 aggregate

## Review Focus

- **検査内容の等価性**: hosted で走らなくなった各 gate が L0/L1 のどこかで必ず走るか。特に traceability（docs/function-design 変更）と env safety の担当層の抜け
- **stale green の穴**: 証跡ベース防止（headSha 突合）の手順が Post-Merge Closeout に確実に組み込まれているか。「Ready 化 → 追い push → merge」の経路、checkout branch と push remote ref が異なる経路、gate 中に HEAD/tree が変化する経路で検証漏れが起きないか
- **classifier 共有化の忠実性**: 抽出後の script が現行 ci.yml のインライン分類と 1 パターンも違わないか（`.npmrc` / `.prettierrc*` / nested `.env*` の既往 P2、delete、rename 旧パスが退行しやすい）
- **fallback の安全方向**: merge-base 不能・zero SHA・dirty tree のすべてで「gate が減る」方向に壊れないか
- **migration の順序性**: Disable 中に merge する手順で、workflow 実行時検証の空白期間が PR 本文と docs に明示されているか
- **D-026 との整合**: 維持部分と supersede 部分の切り分けが decision-log 上で一意に読めるか

## Spec Contract

Contract ID: SPEC-WF-CI2-01

- hosted CI は Draft PR の push では起動せず、Ready PR の opened / ready_for_review と workflow_dispatch でのみ起動する
- docs-only は paths-ignore で 0 hosted run、R0/R1 は `Hosted CI: skip` guard、workflow_dispatch は zero-diff でも full routing
- 1 つの change につき hosted final run は原則 1 回で、その run の headSha は merge される HEAD と一致する

Contract ID: SPEC-WF-CI2-02

- `scripts/local-ci.sh changed` は merge-base 起点の PR 全差分を分類対象にし、push 増分ではない
- `scripts/local-ci.sh full` の evidence は HEAD SHA をファイル名と本文に含み、dirty tree では DIRTY マーカーが付く
- merge evidence として有効なのは exact HEAD の full + CLEAN のみ
- 開始時 CLEAN から gate 中に HEAD/tree が変化した run は FAIL で、merge evidence にならない

Contract ID: SPEC-WF-CI2-03

- actions/cache の path に `src-tauri/target/` / `~/.cargo/bin/` を含まず、Cargo registry index/cache / git db のみ含む
- Rust 3 job は同一 OS+Cargo.lock key の first-writer 競合を受容し、job 別 key で依存 cache を三重保存しない

Contract ID: SPEC-WF-CI2-04

- ci.yml / local-ci / pre-push は同一 classifier を使う。generated / traceability を個別出力し、rust_drift は互換 aggregate
- unknown path または base/head 判定不能は unknown=true + 全 area true

Contract ID: SPEC-WF-CI2-05

- local-ci changed は origin/main merge-base の PR 全差分、full は全 gateを実行する
- evidence は full HEAD SHA、mode、DIRTY/CLEAN、各 command と exit codeを含み、失敗時は非0

Contract ID: SPEC-WF-CI2-06

- pre-push は push 増分の frontend route tree生成 + typecheck + lintを含むfast gateで、各command失敗を即時伝播する。local fullの代替ではない
- Ready PR への push は非0で拒否する。sanctioned bypass は固定 reason token と BYPASS evidenceを残す

Contract ID: SPEC-WF-CI2-07

- npm security monitor は weekly + workflow_dispatch。D-030 の npm supply-chain guards は変更しない

Contract ID: SPEC-WF-CI2-08

- D-026 の Rust 3 job、aggregate check 名、disk telemetryを維持し、大規模再統合しない

Contract ID: SPEC-WF-CI2-09

- Disabled migration は Draft review → owner merge/Enable → main full dispatch 1回
- 75% / 90% budget mode と 2026-08-01 再評価条件を source docsに固定する

## Trace Matrix

| Spec ID | Plan Step | Test | Review Focus | Evidence |
|---|---|---|---|---|
| SPEC-WF-CI2-01 | 実装順序 4 | YAML/static review: opened/ready_for_review、Draft/R0/R1 guard、docs paths-ignore、dispatch full | stale green / 0 hosted | workflow diff + YAML parse |
| SPEC-WF-CI2-01 | Migration step 8 | main zero-diff dispatch の全 job success、次のR3でReady event dogfood | migration | dispatch run URL/headSha |
| SPEC-WF-CI2-02 | 実装順序 2（local-ci 新設） | `bash scripts/local-ci.sh full` exit 0 + evidence log 検査 | 検査内容の等価性 | `.local/ci-evidence/` の log |
| SPEC-WF-CI2-02 | 実装順序 2 | dirty tree での DIRTY マーカー確認 | fallback の安全方向 | evidence log 行 |
| SPEC-WF-CI2-03 | 実装順序 4 | cache path/key/restore-key review、target/bin 0 hit | cache競合 | rg + diff |
| SPEC-WF-CI2-04 | 実装順序 1（classifier 抽出） | `bash scripts/tests/classify-changes.test.sh` exit 0 | classifier 共有化の忠実性 | test 出力 |
| SPEC-WF-CI2-05 | 実装順序 2 | changed/full、SHA、DIRTY、invalid mode、fallback | evidence | command/log |
| SPEC-WF-CI2-06 | 実装順序 3 | `bash scripts/tests/pre-push.test.sh` | Ready block / bypass | test + quality log |
| SPEC-WF-CI2-07 | 実装順序 5 | weekly cron static check | monitor cadence | rg |
| SPEC-WF-CI2-08 | 実装順序 4 | Rust job/check name/telemetry diff review | D-026 compatibility | diff |
| SPEC-WF-CI2-09 | docs + Migration | docs consistency + owner Enable後 main dispatch | migration/budget | docs output + run URL |

## Data Safety

- コミット禁止: `.local/` 配下の evidence / log（`.gitignore` 87 行目で除外済みであることを実装 PR で維持確認）
- local-only paths: `.local/ci-evidence/`、`.local/quality-check.log`、`src-tauri/target/`、`node_modules/`、`dist/`
- synthetic-only paths: classifier fixture test はパス文字列のみを使い、実ファイル内容・実データ・real POS ファイルを使わない
- secrets: workflow / scripts は新しい secret を読まず、`.env*` の検査は既存 `check-env-safety.sh` の呼び出しに限定

## Owner が最後に行う GitHub 操作

1. 実装 PR merge 後、GitHub Web UI → Actions → CI workflow を Enable
2. 初回 dispatch の実行（Web UI の Run workflow ボタン、または当方が `gh workflow run` で代行し owner は結果確認のみ）
3. 以後、PR の Ready 化 = final CI 依頼として運用（Draft PR Checkpoint の既存運用のまま）
4. 2026-08-01 以降、Settings → Billing の Actions 使用実績を確認し再評価の判断材料を提供

## Implementation Handoff（Codex 発注要約）

- 目的: 本 packet の Scope 1〜7 を実装順序 1〜7 の通りに実装する。workflow は Disable 中のため PR 中に hosted 実行は発生しない
- 契約: Spec Contract SPEC-WF-CI2-01〜09 と Acceptance Criteria を満たす。既存分類を維持しつつ generated / traceability / unknown を追加し、安全側 fallbackを強化する
- 品質 gate: `bash -n`、Ruby YAML + Prettier + ci-workflow fixture（利用可能なら actionlint）、classifier/local-ci/pre-push fixtures、`local-ci.sh changed/full`、docs checks、review-only sub-agent
- 禁止: 新規 npm / Rust / GitHub Actions の依存追加（actions のバージョンも現行 pin を維持）、テスト・検査項目の削減、branch protection 前提の記述
- 報告: 変更ファイル一覧 + Acceptance Criteria ごとの evidence + 残存リスク（hosted 実行時検証の持ち越し）

## Implementation Results

- Plan/Matrix/source docs は実装前の独立 commit `f94d00d` で確定し、clean tree を確認してから実装を開始した。
- `scripts/ci/classify-changes.sh` を共有分類器として追加した。merge-base / explicit refs / stdin / all mode、9 boolean contract、unknown/base failure full fallback、delete、rename/copy の旧新pathを実装した。
- `scripts/local-ci.sh` に `changed` / `full` を追加した。full は hosted 相当の Rust / generated / traceability / env / docs / frontend（`npm ci` 含む）/ workflow fixtureを実行し、開始・終了HEAD/tree、command、exit code、merge evidence validityを`.local/ci-evidence/`へ記録する。
- `scripts/pre-push.sh` は実push ref単位のReady guard、push増分のshared classification、frontend route tree生成 + typecheck/lint、固定token bypass evidence、classifier failureのfail-closedを実装した。`.npmrc` がlifecycle hookを抑止するためroute生成は明示的に先行させる。
- `ci.yml` は`push: main` / synchronizeを廃止し、Ready `opened` / `ready_for_review` + full dispatch、concurrency cancel、owner-authorized R0/R1 skip、全job `needs: changes` guardへ変更した。docs/root Markdownはevent除外し、merge-gateであるPR templateは除外しない。
- Cargo cacheから`src-tauri/target/` / `~/.cargo/bin/`を除去し、registry index/cache + git dbだけを同一OS+lock keyで維持した。setup-node npm cacheは変更していない。npm monitorはweekly + dispatchへ変更した。
- RED→GREEN fixture: classifier、local-ci、pre-push、workflow graph/cache/event。追加回帰はgate失敗exit code、delete/rename/copy、実push ref、gate後dirty、classifier process failure、template opt-in、template event filter、全shell file構文検査。
- targeted gate、Ruby YAML parse、docs/active Plan consistency、git diff checkは通過。DIRTY診断の`local-ci changed/full`も通過し、Rust 665 unit tests + auxiliary suites、frontend 94 files / 600 tests、bindings drift、traceability ERROR/WARN 0、buildを確認した。clean `npm ci`後の`npm audit`は既知7件（2 low / 5 moderate）でhigh threshold exit 0。
- product runtime `src/` / `src-tauri/`の変更は0。新規依存、テスト削減、GitHub settings変更は0。
- final CLEAN exact-HEAD evidenceは実装commit後に生成し、commit SHAとevidence pathをPR本文へ記録する。Actions runtimeはowner Enable後のmain dispatchへ持ち越す。

## Post-Merge Closeout（2026-07-10）

- PR #160 was squash-merged to `main` as `25e945b9a32243d6cff6b49f6188d68f4b14c09e`.
- The owner enabled the `CI` workflow after merge. The first `main` `workflow_dispatch` run 29091831468 (private archive Actions evidence 29091831468) completed successfully with the exact merge SHA.
- PR #160 had no hosted PR run while the workflow was disabled. Draft push suppression and Ready-event execution remain unproven until the first R3 dogfood change.
- The Plan Packet and Test Design Matrix are complete and archived. The 2026-08-01 budget/cache/telemetry review remains an unfinished follow-up.
- WER is scheduled after the first R3 dogfood, because the initial zero-diff `main` dispatch proves workflow runtime but cannot prove Draft push suppression, Ready transition count, stale-green prevention, or owner operating steps.

## Review Response

- fresh review-onlyをread-only sandboxで複数round実行した。sub-agentは編集せず、source docs / Plan / Matrix / workflows / scripts / testsを直接突合した。
- accepted/fixed: pre-pushがcheckout branchを見ていた問題（実push remote ref/local_oidへ修正）、local-ci start-only CLEAN問題（end HEAD/tree検証）、rename old-side欠落、workflow testのunguarded job見逃し。
- accepted/fixed: owner/Risk authorizationなしskip、copy old-side未検出、local fullの`npm ci`欠落、default PR templateの暗黙skip token、PR templateがbroad Markdown ignoreでevent除外される問題、pre-push classifier failureのall-false SKIP、`bash -n file1 file2`による2件目以降の構文未検査。
- 各findingは実ファイルと回帰testで独立検証し、いずれもREDを確認後に修正してGREENを再確認した。最終fresh passのP1は0、最後のP2 1件（全shell file構文検査）はaccept/fix済み。未解決P1/P2は0。
- PR #160 Claude reviewのP2（pre-push frontend gateが`generate:routes`を明示実行せずstale route treeを検査し得る）はacceptした。command順を固定するfixtureをREDで確認し、route生成をtypecheck/lintより前へ追加した。
- 同reviewのP3は、reopen時のmanual dispatch明記とgh不在/nonzero時のfail-closed fixtureを同PRで追加した。skip tokenと変更分類のlocal突合はowner review責務を超えてpre-pushへrisk判定を持ち込むため、D-033の受容済み運用を維持しfollow-up候補とした。
- fix後のfresh review-onlyで、Bashの`(...) || fail_gate`により内側の`set -e`が無効化され、先行command失敗を後続成功が隠すP1を検出した。frontend/Rust/traceabilityの各必須commandへ明示的なexit伝播を追加し、frontend/Rustの各失敗位置をfixtureで固定した。
- residual: Actions expression/event deliveryはworkflow Disabled中のため未実証。owner Enable後のmain full dispatchと次のR3 PRのReady event dogfoodが必要。branch protection/required checksはFree private repoで利用不可のため、exact-HEAD照合はowner手順として残る。raw `--no-verify`はpolicy違反として技術的には残る。
