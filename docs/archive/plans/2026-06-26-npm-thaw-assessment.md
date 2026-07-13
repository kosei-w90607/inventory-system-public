# npm / tooling thaw assessment

## Risk

Risk: R2

Reason:
依存パッケージ更新、npm install policy、audit 対応方針を扱う developer workflow / security maintenance。runtime の UI/CMD/BIZ contract、DB、Tauri command DTO、route state は変更しない。package manager 移行や install-script policy 解除まで含める場合は別 PR で再評価する。

## Goal

Mini Shai-Hulud / TanStack npm malware 対応で止めていた npm/tooling 更新を、問題のある version と install-time script 実行を避けながら再開する。npm 自体を禁止するのではなく、`ignore-scripts=true` を維持したまま、明示 version 更新・audit 確認・full gates で小さく進める。

## Scope

- 現在の `package-lock.json` と `npm audit` を確認する。
- GitHub Advisory の TanStack affected versions と lockfile の exact versions を突合する。
- `ignore-scripts=true` は維持する。
- `npm audit fix` は使わない。
- first thaw として direct package の小さい更新を行う:
  - `vite` 7.x patched line への更新
  - `happy-dom` patch 更新
  - `markdownlint-cli2` patch 更新
- `.npmrc` のコメントを現実的な解除 / 移行条件に更新する。
- `Plans.md` と `docs/decision-log.md` に policy と次 action を反映する。

## Non-scope

- `.npmrc ignore-scripts=true` の解除。
- `npm audit fix` / `npm audit fix --force`。
- npm から pnpm への移行。
- Storybook / axe / E2E / visual regression の新規導入。
- `@tauri-apps/plugin-dialog` 導入。
- major update 一括実施（Vite 8、ESLint 10、TypeScript 6）。

## Acceptance Criteria

- `npm audit --json` の current finding と direct root cause が plan に記録されている。
- TanStack malware advisory の affected ranges に、current lockfile の `@tanstack/*` exact versions が該当しないことを記録している。
- `ignore-scripts=true` が残っている。
- `package.json` / `package-lock.json` の更新が first thaw scope に限られている。
- `npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`、`npm run build` が通る。
- `bash scripts/doc-consistency-check.sh` と `bash scripts/doc-consistency-check.sh --target plan` が通る。
- 残る audit warning / vulnerability は `Implementation Results` に記録し、次 PR 候補を `Plans.md` に残す。

## Design Sources

- Requirements / spec: none
- Architecture: none
- Function / command / DTO: none
- DB: none
- Screen / UI: none
- Decision log / ADR: `docs/decision-log.md` D-019
- External primary sources:
  - GitHub Advisory `GHSA-g7cv-rxg3-hmpx`
  - GitHub Advisory `GHSA-v2wj-q39q-566r`
  - GitHub Advisory `GHSA-p9ff-h696-f583`
  - GitHub Advisory `GHSA-fx2h-pf6j-xcff`
  - npm config docs for `ignore-scripts`, `allow-scripts`, `min-release-age`
  - pnpm docs for `approve-builds` and `minimumReleaseAge`

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status: existing sufficient / updated in this PR / intentionally deferred |
|---|---|---|
| Backend function / command / repository / validation / error | none | existing sufficient |
| Command / DTO / generated binding / wire shape | none | existing sufficient |
| DB / transaction / audit / rollback / migration | none | existing sufficient |
| Screen / UI / route state / Japanese wording | none | existing sufficient |
| CSV / TSV / report / import / export format | none | existing sufficient |
| Durable decision / ADR | `docs/decision-log.md` | updated in this PR |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| SPEC-NPM-THAW | `docs/decision-log.md` D-019 | NPM-THAW-D1 | npm 禁止ではなく install-time script と compromised ranges を制御する。blanket unblock / `audit fix` 一括は rejected。 | `.npmrc`, `package.json`, `package-lock.json` | audit output, full frontend gates |

## Design Intent Audit

- Source docs can answer what is being built and why without chat history or archived Plan Packets: yes, D-019 と本 Plan Packet に policy を記録する。
- Plan-only durable decisions found and promoted to source docs / decision-log / ADR: npm を継続し、blanket script block を維持しながら小さい明示更新で thaw する判断を D-019 に昇格する。
- Assumptions and constraints: registry metadata and GitHub Advisory are current at assessment time。install-time lifecycle scripts are the main malware execution path being blocked.
- Deferred design gaps, risk, and follow-up target: package manager migration、npm `allowScripts` adoption、pnpm migration、Storybook / E2E / dialog plugin install は別 task。
- Test Design Matrix can cite design decision IDs or source doc sections: R2 のため separate matrix は作らない。

## Design Readiness

- Existing design docs are sufficient because: runtime product behavior is not touched.
- Source docs updated in this PR: `docs/decision-log.md`, `.npmrc`, `Plans.md`
- Design gaps intentionally deferred: package manager migration and new tooling families.
- Durable decisions discovered in this plan and promoted to source docs: D-019.

Minimum design checks for business-app work:

- Layer ownership (`UI -> CMD -> BIZ -> IO/MNT`): no layer code touched.
- Backend function design: no change.
- Command / DTO / data contract: no change.
- Persistence / transaction / audit impact: no change.
- Operator workflow / Japanese UI wording: no change.
- Error, empty, retry, and recovery behavior: no change.
- Testability and traceability IDs: full frontend/docs gates.

## Test Plan

- targeted tests: `npm audit --json`, exact TanStack lockfile version listing.
- negative tests: confirm `ignore-scripts=true` remains enabled; avoid `npm audit fix`.
- compatibility checks: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`.
- data safety checks: no secrets, no `.env*`, no real POS/store data.
- main wiring/integration checks: `bash scripts/doc-consistency-check.sh`, `bash scripts/doc-consistency-check.sh --target plan`.

## Boundary / Wire Contract

Not applicable. No runtime wire contract changes.

## Review Focus

- `ignore-scripts=true` が残っているか。
- update scope が direct package の小さい patch/minor 更新に収まっているか。
- TanStack affected versions を誤って install していないか。
- `npm audit fix` や major update を混ぜていないか。
- remaining vulnerabilities の扱いが明示されているか。

## Implementation Results

- Current npm: `11.11.1` in WSL Codex session. Latest npm metadata reports `11.17.0`, but npm self-update is non-scope.
- Current policy: `.npmrc ignore-scripts=true` remains enabled. The first attempted install with `--min-release-age=1440` failed on `happy-dom@20.10.6` with an npm `ETARGET` date-filter error despite the version being published on 2026-06-17. This PR records release-age as a future policy candidate, but does not depend on it for the first thaw.
- External advisory read:
  - `GHSA-g7cv-rxg3-hmpx` lists malicious TanStack packages published on 2026-05-11. Current lockfile TanStack versions do not match the listed affected exact versions checked in this PR.
  - Vite advisories affecting `vite@7.3.1` are patched on the 7.x line by `7.3.2` and `7.3.5` depending on advisory. First thaw updated to `vite@7.3.6`.
- Before update:
  - `npm audit --json`: 41 total vulnerabilities; 4 high / 25 moderate / 12 low / 0 critical.
  - direct high roots included `vite@7.3.1` and `happy-dom@20.9.0` via `ws`.
- Updated direct dev dependencies:
  - `vite`: `7.3.1` -> `7.3.6`
  - `happy-dom`: `20.9.0` -> `20.10.6`
  - `markdownlint-cli2`: `0.22.0` -> `0.22.1`
- Updated transitive evidence:
  - `ws`: `8.20.1` -> `8.21.0`
  - `smol-toml`: `1.6.0` -> `1.6.1`
  - `globby`: `16.1.1` -> `16.2.0`
- After update:
  - `npm audit --json`: 38 total vulnerability paths; 0 high / 21 moderate / 17 low / 0 critical.
  - `npm install` summary reports 7 vulnerable packages remaining.
  - Remaining moderate / low findings are mainly transitive under `eslint`, `typescript-eslint`, `markdownlint-cli2`, `@babel/core`, `@tanstack/router-plugin`, `vite` low transitive (`esbuild` / `postcss` / `tsx`), and related plugins. No high / critical remains.
- Verification run:
  - `npm run generate:routes`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run format:check`: passed.
  - `npm test`: 66 files / 420 tests passed.
  - `npm run build`: passed with existing Vite >500 kB chunk warning.
  - `bash scripts/doc-consistency-check.sh`: passed.
  - `bash scripts/doc-consistency-check.sh --target plan`: passed after WARN fix.
  - `npm audit --audit-level=high`: exit 0; no high / critical vulnerabilities remain.
- Follow-up candidates:
  - Evaluate npm `allowScripts` / `strict-allow-scripts` policy as a replacement for blanket `ignore-scripts=true`.
  - Evaluate npm `min-release-age` behavior separately before relying on it in project install commands.
  - Handle remaining moderate/low audit items in narrower follow-up PRs, grouped by owner package (`eslint` / `typescript-eslint`, `markdownlint-cli2`, `TanStack router tooling`, Vite transitive).

## Review Response

Review-only skipped because: R2 developer workflow / dependency maintenance scope。runtime contract、DB、Tauri command DTO、operator workflow は変更しない。full frontend/docs gates と audit output を evidence とする。
