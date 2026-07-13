# Plan Packet: npm policy spike — allowScripts / min-release-age / pnpm migration の裁定

Risk: R1

対象は `.npmrc` / decision-log / Plans.md / CLAUDE.md のみ（アプリコード・依存関係の変更なし）。lockfile を触らず、`npm ci --ignore-scripts` の挙動も変えない。

## Goal

Mini Shai-Hulud 凍結（2026-05-13〜）下で保留していた npm policy 3 論点（`allowScripts` / `min-release-age` / pnpm migration）を、2026-07-05 時点の一次情報で裁定し、decision-log に固定する。凍結解除条件が参照する「自動 monitoring 仕組み」の backlog drift（CLAUDE.md / memory が参照するが Plans.md に実在しない）も解消する。

## Scope

1. `.npmrc`: `min-release-age=7` を追加（npm 11.10.0+ native、手元 11.11.1 で key 認識を確認済み）。単位は日、既定 null。今後の依存更新（D-019 thaw lane）の resolution にのみ効き、lockfile 厳密の `npm ci` には影響しない
2. `docs/decision-log.md`: D-029 新設 — npm 継続 + native supply-chain hardening 採用、pnpm migration 見送り、allowScripts は npm 11.16+ / v12 で評価
3. `docs/Plans.md`: 進行中エントリ追加、次の行動更新（monitoring PR / linkify-it high 対応を昇格）、Backlog に「npm advisory 自動 monitoring 仕組み」項目を復元 + linkify-it high 項目を追加
4. `CLAUDE.md`「.npmrc による恒久防御」: min-release-age の 1 行追記

## Non-scope

- 自動 monitoring 仕組みの実装（別 PR `chore/npm-advisory-monitoring`、CLAUDE.md の当初宣言どおり分離。Backlog 項目として実在化するのが本 PR の責務）
- linkify-it high（GHSA-22p9-wv53-3rq4、markdownlint-cli2 → markdown-it → linkify-it の ReDoS）の修正。依存更新は D-019 thaw lane の別 PR
- `ignore-scripts=true` の解除・変更（凍結解除後も恒久維持推奨のまま）
- npm v12 への upgrade（リリース後に別途評価）

## 裁定根拠（2026-07-05 調査）

| 論点 | 裁定 | 根拠 |
|---|---|---|
| min-release-age | **即時採用（7 日）** | npm 11.10.0（2026-02）で native 実装、手元 11.11.1 で利用可（`npm config get min-release-age` が null = key 認識）。compromised release は通常数時間〜数日で flag されるため 24h でも大半を防げる（pnpm 11 既定は 1 日）。本プロジェクトの更新は thaw lane の意図的・低頻度更新のみで、7 日 cooldown の運用コストは実質ゼロ。緊急 patch は `min-release-age-exclude` か一時的な設定変更（user 承認下）で bypass 可能 |
| allowScripts | **npm 11.16+ / v12 で評価（現時点は blanket block 継続）** | npm 11.16.0 で `package.json` `allowScripts` field + `npm approve-scripts` / `deny-scripts` が native 実装（11 系は advisory、v12 = 2026-07 目安で deny-by-default 強制）。手元は 11.11.1 で未搭載。かつ本プロジェクトは `ignore-scripts=true` で全期間 green = install script を必要とする依存が 1 つもないため、allowScripts へ移行しても allowlist は空。v12 が deny-by-default になれば blanket block と同等の防御が公式サポートで得られる。D-019 の「必要になったら明示 allowlist policy へ」の条件は未発生 |
| pnpm migration | **見送り** | pnpm 11（2026-04-28）の minimumReleaseAge 既定 1440 分 / blockExoticSubdeps は優秀だが、npm 本体が同等機能（min-release-age / allowScripts / v12 deny-by-default）を native 実装済み・実装予定で parity 到達。migration は lockfile 再生成 = 凍結下で最もやりたくない全依存再解決を伴い、CI / DEV_SETUP_CHECKLIST / Windows native clone runbook / lefthook 手順の書き換えコストに見合う差分がない。D-019「npm 継続」の判断を維持 |

一次情報: npm docs v11 config（min-release-age = 日単位・既定 null・`min-release-age-exclude` minimatch 対応）、GitHub Changelog 2026-06-09（npm v12 breaking changes: allowScripts deny-by-default / allow-git none / allow-remote none、2026-07 目安）、pnpm 11.0 release blog（2026-04-28）。

## Acceptance Criteria

- `.npmrc` に `min-release-age=7` がコメント付きで追加され、`npm config list` の project config に導出された `before = <now − 7日>` が出る（実測 2026-07-05: `before = "2026-06-28T10:44:01.440Z"`。npm 11.11.1 は min-release-age を内部で `before` date pin に変換して実装。`npm config get min-release-age` は null を返す表示上の quirk があるため、検証は `npm config list` の before 導出で行う。min-release-age を外す対照実験で before が消えることも確認済み）
- `npm ci --ignore-scripts` 相当の検証として `npm run typecheck` / `npm run lint` / `npm run build` が既存 node_modules で green（lockfile 非接触の確認は `git status` で `package-lock.json` 無変更）
- `docs/decision-log.md` に D-029 が追加され、`./scripts/doc-consistency-check.sh` が全通過
- `docs/Plans.md` Backlog に「npm advisory 自動 monitoring」項目が実在し、CLAUDE.md 解除条件の参照 drift が解消
- linkify-it high が Backlog に記録され、次の行動に monitoring PR と併せて昇格

## Test Plan

- 機械 gates: `./scripts/doc-consistency-check.sh`（PK1 R1 = Risk 行）+ CI docs-only routing（Rust / Frontend / Env safety の skip 挙動は .npmrc 変更でどう routing されるか CI 実行で確認）
- `npm config get min-release-age` の実出力で設定反映を確認
- 依存解決を伴うコマンドは実行しない（凍結中、lockfile 非接触）

## Review Focus

- min-release-age=7 の値の妥当性（1 日 vs 7 日 vs 14 日）
- pnpm 見送り根拠に漏れがないか（SQLite store 等の性能面は本プロジェクト規模では無視できる前提）
- CLAUDE.md 解除条件と Plans.md Backlog の参照整合

## Implementation Results

- `.npmrc`: `min-release-age=7` 追加。`npm config list` で `before = "2026-06-28T10:44:01.440Z"`（= now − 7日）の導出を確認、外すと消える対照実験で有効性を実証
- `docs/decision-log.md`: D-029 追加（min-release-age 即時 / allowScripts は 11.16+/v12 / pnpm 見送り、代替案 4 件の棄却理由付き）
- `CLAUDE.md`: 恒久防御節に min-release-age の 1 行追記（凍結解除後も恒久維持）
- `docs/Plans.md`: 次の行動を再構成(1. 本 spike PR / 2. linkify-it high thaw / 3. monitoring PR / 4. レジ実機)、Backlog に monitoring 項目復元（drift 解消）+ linkify-it high 記録
- 発見事項: ①npm audit に新規 high 1 件（linkify-it <=5.0.0 ReDoS、GHSA-22p9-wv53-3rq4、markdownlint-cli2 経由、fixAvailable）— 凍結解除条件「7 日連続 clean」を block 中 ②GHSA-g7cv-rxg3-hmpx は withdrawn_at: null のまま active（2026-06-08 更新）③min-release-age の内部実装は `before` date pin 導出（npm config get は null を返す quirk あり）
- Gates: doc-consistency 全通過、lockfile / node_modules 非接触

## Review Response

Review-only skipped because: R1 config + docs のみ（アプリコード・依存・lockfile 不変）。機械 gates + PR 上の根拠一次情報リンクで担保。
