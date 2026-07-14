# CI

この文書は CI / merge evidence の source of truth。判断理由は `docs/decision-log.md` D-026 / D-033 / D-043、PR ごとの証跡は Plan Packet と PR 本文に置く。

## 移行状態

- 2026-07-10 に PR #160（merge SHA `25e945b9a32243d6cff6b49f6188d68f4b14c09e`）を merge 後、owner が GitHub Web UI 上の `CI` workflow を Enable 済み。
- 初回の `main` manual dispatch は run 29091831468 (private archive Actions evidence 29091831468) として実行され、head SHA `25e945b9a32243d6cff6b49f6188d68f4b14c09e` で success になった。これにより Disable 状態からの workflow runtime 検証を完了した。
- PR #160 自体では、Disable 状態のため hosted PR run は発生していない。Draft push / Ready event の実運用は、最初のR3 dogfoodで確認する。
- GitHub settings、branch protection、retention、cache 削除、支払方法は repository から変更しない。

このcloseout自体はdocs-onlyのR1変更なので、PR本文に `Risk: R1` と `Hosted CI: skip` を記載し、hosted runは0件とする。

## Verification Ladder

| 層 | 目的 | 対象範囲 | 証跡 |
|---|---|---|---|
| L0 local changed | push 前の高速 feedback | push 増分 | `.local/quality-check.log` |
| L1 local full | merge 候補 HEAD の全 gate | `origin/main` との PR 全差分、`full` は全 gate | `.local/ci-evidence/` の HEAD SHA 付き log |
| L2 hosted final | GitHub-hosted clean-room 最終確認 | completed HEAD、原則 1 change 1 run | Actions run URL + `headSha` |

L0 green は PR 全差分 green を意味しない。merge evidence は L1 `full` と、hosted 対象 change では L2 final の組み合わせで判定する。

## Hosted Trigger Model

`CI` workflow は次だけを trigger とする。

- `pull_request` の `opened`、`ready_for_review`、`synchronize`
- `workflow_dispatch`

`push: main` は使用しない。`synchronize` は public repository で Ready PR の更新後 HEAD に current check を作るために使用する。Draft PR の `synchronize` は event 対象だが、job-level guard により runner job を開始しない。通常の修正経路は引き続き `Draftへ戻す -> push -> local full -> Ready` とし、Ready のままの通常 push は pre-push が拒否する。

`npm security monitor` は product/merge CI とは別の standing security workflow で、weekly schedule + manual dispatch を維持する。daily schedule には戻さない。

`opened` は Ready 状態で直接作成された PR の取りこぼし防止に使う。Draft で開かれた場合は job-level guard で runner を起動しない。`docs/**` と root Markdown の docs-only change は `paths-ignore` で自動 event の対象外にする。ただし hosted-required の workflow / release contract docs-only PR は下表どおり owner Ready 後に `workflow_dispatch` で 1 run する。Actions 利用不能時に限り、後述の閉じた 2 経路へ完全一致する変更は dispatch の代わりに指定の compensating evidence と owner disposition を使う。`.github/pull_request_template.md` は merge gate契約なので除外せず、classifier で workflow change に昇格させる。

PR 本文の `Hosted CI: skip` は R0/R1 で hosted runner を不要とする明示 token。workflow が skip を受理するのは、本文に `Risk: R0` または `Risk: R1` があり、repository owner 自身が Ready event を発生させた場合だけである。token 単独、owner 以外の Ready 化、R2+ の Risk 表記では CI を実行する。R2+、workflow、release、DB、CMD/wire、migration、backup/restore、operator workflow では使用しない。`workflow_dispatch` は分類結果に関係なく全 area を `true` として full gate を実行する。Risk の正当性は owner review の責務であり、path だけから業務 risk tier を推測しない。

## Risk Routing

| Risk / change | Local gate | Hosted final |
|---|---|---|
| pure docs-only / R0/R1（workflow / release contract 非接触） | docs check | 0 run |
| non-doc R1 | targeted + relevant local gate | 原則不要。PR 本文を `Hosted CI: skip` にする |
| R2 | `local-ci.sh full` | merge evidenceとしてはsource contract、workflow、release影響がある場合だけ必須。`not-required`はReady eventを抑止しないため、non-doc R2のReadyでincidental finalが走る場合はその結果を記録する |
| R3 / R4 | `local-ci.sh full` + review-only | 原則 1 run。Ready 化または明示 dispatch。後述の閉じた Actions-unavailable 経路だけ `not-required` |
| workflow / release | `local-ci.sh full` + review-only | 原則 1 run。後述の閉じた Actions-unavailable 経路だけ `not-required` |

`Hosted CI Requirement: not-required`は成功runをmerge evidenceとして要求しないだけで、Ready eventや失敗シグナルを無視するtokenではない。incidental runがproduct/test/gate failureを返した場合はDraftへ戻して原因を修正し、新HEADでlocal/full/reviewを再実行する。infrastructure failureまたはcancelだけは、routeが`not-required`ならL1 evidenceを維持したままownerが残存リスクとして受理できる。結果・分類・owner dispositionをPR bodyへ記録する。`required` routeは原因分類にかかわらずsuccessful exact-HEAD runがmerge条件である。

## Budget Pressure

月次 Actions 予算の使用率は owner が GitHub Billing で確認する。

- 75% 未満: 通常の final-only 運用。
- 75% 以上 90% 未満: 1 change 1 hosted run を厳守。失敗原因を local で修正してから 1 回だけ再実行する。R2 は local full を既定とする。
- 90% 以上、または Actions 利用不能: release / R4 の緊急 gate を除き hosted を停止する。`local-ci.sh full` + review-only を暫定 evidence とし、PR 本文に例外、HEAD SHA、未実行 hosted gate を記録する。枠 reset 後に必要な HEAD / main を dispatch で backfill する。

pure docs-only（workflow / release contract 非接触）は予算状態にかかわらず 0 hosted run とする。workflow / release contract の docs-only change は原則として owner Ready 後に explicit dispatch を 1 run するが、Actions 利用不能かつ次の閉じた経路へ完全一致する場合だけ `not-required` にできる。

Actions 利用不能時の `Hosted CI Requirement` 例外は次の閉じた 2 経路だけとする。

1. **non-release R2/R3 Budget Pressure**: migration design doc を含むが、実際の R4 mutation や release を行わない変更は `not-required` にできる。exact-HEAD `local-ci.sh full`、risk-tier の独立 review、PR body の未実行 hosted gate/availability 理由、owner residual-risk disposition をすべて要求し、利用可能になった後に必要な HEAD/main を backfill する。
2. **public repository Phase B bootstrap R4**: active control PR の source Actions allocation が利用不能で、かつ destination Actions を安全上 push 前から無効にする Phase B に限り `not-required` にできる。固定 final-root fresh clone の local full、privacy/public-surface gate、R4 Double Audit/closure、PR body の例外、owner disposition を compensating evidence とする。destination Actions は後続の CI 再設計 R3 まで有効化しない。

上記以外の release、R4、workflow executable change は `required` のまま。`not-required` でも観測済み product/test/gate failure は blocker であり、infrastructure/cancel/availability 以外を owner disposition してはならない。この例外の追加自体を行う PR は workflow gate change として Double Audit を必須とし、owner disposition が得られなければ merge しない。

## Local Commands

```bash
bash scripts/local-ci.sh changed
bash scripts/local-ci.sh full
```

`changed` は `git merge-base origin/main HEAD` を基準に PR 全差分を分類する。`origin/main` が利用できない場合は local `main` を試し、それも判定不能なら全 gate へ倒す。push 増分だけを見る pre-push とは範囲が異なる。

`full` は Rust、generated bindings、traceability、frontend、env safety、docs、workflow script test をすべて実行する。frontend gate は hosted と同じく `npm ci` で lockfile からの clean installability を先に確認する。実行 command と exit code を表示し、失敗は非 0 で返す。warn-only の `npm audit` は非 0 を明示記録するが hosted と同じく final result を失敗にしない。

evidence は `.local/ci-evidence/` に保存し、ファイル名と本文へ full HEAD SHA を含める。開始時と全 gate 終了時の HEAD / working tree 状態を記録し、開始時 CLEAN から HEAD 変更または DIRTY 化した run は失敗させる。`DIRTY` evidence は診断用で merge evidence には使えない。merge evidence として使えるのは、開始・終了とも PR HEAD と同じ SHA かつ `full` + `CLEAN` の evidence だけである。`.local/` は gitignore 対象で、evidence を commit しない。

## Classifier Contract

`scripts/ci/classify-changes.sh` は CI、local CI、pre-push が共有する。出力は `key=true|false` のみで、次を分類する。

- `rust`
- `rust_drift`（generated または traceability の互換 aggregate）
- `frontend`
- `docs`
- `env`
- `generated`
- `traceability`
- `workflow`
- `unknown`

1 path が複数分類に属してよい。1 件でも unknown path がある場合、または base/head を判定できない場合は、全 area を `true` にして full gate へ倒す。workflow / CI script 自体の変更も全 gate を要求する。

git diff は追加・変更・削除を含め、rename / copy では旧パスと新パスを両方分類する。copy は未変更のsourceも検出する。たとえば `src/**` から `docs/**` への rename / copy は frontend と docs の双方を実行対象にする。

## Pre-push Contract

pre-push は push 増分に対する L0 gate で、Rust、設計書、env、traceability に加えて frontend の route tree生成 + typecheck + lint を実行する。`.npmrc` の `ignore-scripts=true` は `pretypecheck` / `prelint` lifecycleを抑止するため、route tree生成はtypecheckより前に明示実行する。frontend 対象は `src/**`、`public/**`、package/lock、TypeScript/Vite/Vitest/ESLint/Prettier/Tailwind 等の config を含む。

Ready 状態の PR への push は stale green を作るため pre-push が拒否する。hook は現在 checkout 中の branch ではなく、pre-push stdin で通知された実際の各 `remote_ref` を `gh` で確認する。修正時は PR を Draft に戻してから pushし、同じ HEAD で local full を再実行して Ready 化する。`gh` によるPR状態確認またはshared classifier実行が失敗した場合も安全側に block し、classifier failureをevidenceへ残す。

緊急 bypass は raw `git push --no-verify` を使わず、許可された固定 reason token を環境変数で渡して hook 自体を実行する。hook は実際に push する local object SHA と remote ref とともに `BYPASS` を `.local/quality-check.log` に記録する。reason に自由文、secret、店舗情報を入れない。

```bash
INVENTORY_PRE_PUSH_BYPASS_REASON=owner-approved git push
```

許可 token は `owner-approved`、`tooling-unavailable`、`incident-response` のみ。

## Stale Green Prevention

通常経路は次の順序に固定する。

1. Draft で実装・pushする。
2. completed HEAD で `bash scripts/local-ci.sh full` を実行する。
3. Ready 化し、hosted final を 1 回実行する。
4. merge 前に PR HEAD、local full evidence SHA、successful hosted run `headSha` の一致を確認する。

Ready 後に修正が必要なら Draft へ戻す。Ready のまま push する経路は pre-push が block する。bypass が使われた場合、旧 run は新 HEAD の evidence にならないため必ず再検証する。

確認例:

```bash
HEAD_SHA="$(git rev-parse HEAD)"
gh run list --workflow ci.yml --commit "$HEAD_SHA" --status success
```

Ready 直作成は `opened` event で、Draft からの Ready 化は `ready_for_review` event で検出する。Ready PR の head 更新は `synchronize` event で検出するが、通常経路では先に Draft へ戻す。Ready PRをclose後にreopenしても`reopened` eventでは自動実行しないため、HEADに対応するfinal runがなければ`workflow_dispatch`を使う。自動 run が存在しない、失敗した、cancel された場合も同様とする。

## Cache Policy

- actions/cache は `~/.cargo/registry/index/`、`~/.cargo/registry/cache/`、`~/.cargo/git/db/` の依存取得 cache だけを保存する。
- `src-tauri/target/` と `~/.cargo/bin/` は保存しない。
- key は OS + `src-tauri/Cargo.lock` hash、restore key は OS prefix を維持する。
- Rust 3 job は同じ immutable key を使う。cold miss 時は first writer が保存し、他 job の同一 key save 競合は warning として受容する。job 別 key に分けて同じ依存 cache を三重保存しない。
- npm は既存 `actions/setup-node` の `cache: npm` を維持し、`node_modules/` は保存しない。
- 10GB 上限再到達時は cache usage と key 数を確認し、target 等の build output を再追加しない。

## Required Check Impact

job 名と aggregate `Rust (fmt + clippy + test)` は D-026 互換のため維持する。2026-07-10 の read-only 確認では Free private repository の branch protection / ruleset は利用できず、required check は設定されていない。

public 化後も branch protection / ruleset は未設定である。required checks を導入する前に、pure docs-only R0/R1の0 run、`Hosted CI: skip`、hosted-required workflow/release docs-onlyのexplicit dispatch、Actions-unavailable closed route、final-only event と required context の整合を再設計する。GitHub公式仕様では path filter で workflow 自体が skip されると required check が Pending のままになるため、現行 `paths-ignore` を残したまま required context を有効化してはならない。本変更の `synchronize` 復旧はその前提整備だが、required-check設計の完了ではない。

## Disabled Migration

1. repository 実装を Draft PR で review し、local full、workflow YAML 静的検証、review-only を記録する。
2. owner が PR を review し merge する。bootstrap PR は hosted evidence なしの例外である。
3. owner が GitHub Web UI の Actions から `CI` workflow を Enable する。
4. `main` を選んで `Run workflow` を 1 回実行する。dispatch は常に full routing なので zero-diff main でも全 gate を検証する。
5. successful run の URL / headSha を記録する。失敗時は workflow を再び Disable せず、原因を local で直した Draft fix PR を作る。
6. 次の R3 PR で `opened` / `ready_for_review` event を dogfood する。

workflow syntax / event / job graph は Ruby YAML parser、Prettier、repo-owned `scripts/tests/ci-workflow.test.sh` で必須確認する。test は Draft/R0/R1 で aggregate を含む全 job が runner 0、dispatch full、shared classifier、cache、check 名を検査する。`actionlint` が既に利用可能な環境では追加実行するが repo dependency にはしない。

## 2026-08-01 Re-evaluation

- 月間 billed minutes と 1 change あたり run 数
- final run の wall time と Rust 3 job の disk telemetry
- cache entry 数 / 合計容量 / eviction の有無
- Rust 3 job 再統合の可否
- aggregate job 維持の必要性
- self-hosted runner の費用・security boundary
- weekly npm monitor の検知遅延と手動 dispatch 回数
- Ready push block / HEAD SHA 突合の bypass・誤検知・運用漏れ
- public / Pro 化による required checks 再設計要否

## Related Records

- Workflow index: `docs/DEV_WORKFLOW.md`
- Decisions: `docs/decision-log.md` D-026 / D-030 / D-033 / D-043
- Previous CI evidence: `docs/archive/plans/2026-07-01-ci-gate-optimization.md`
