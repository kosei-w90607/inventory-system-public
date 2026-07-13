# Plan Packet: npm blanket 凍結から常設ガード付き逐次投入への移行（D-030）

Risk: R1

対象は CLAUDE.md / decision-log / Plans.md / `.npmrc` コメント / memory のみ。`.npmrc` の設定値・依存関係・lockfile は不変。

## Goal

2026-05-13 から続く npm install 系の blanket 凍結を、user 決定（2026-07-05）に基づき「常設ガード付き逐次投入」へ移行する。根拠は「攻撃が止んだ」ではなく「攻撃が続く前提で、観測されている攻撃ベクトルを常設ガードが構造的に潰している」に置く。

## Scope

1. `docs/decision-log.md`: D-030 新設 — 移行の根拠、旧解除条件（advisory withdrawn + 7 日 clean）を満たさずに移行する理由、常設ガード / 禁止事項 / 逐次投入手順
2. `CLAUDE.md`: 「重要セキュリティルール（緊急）」節を「npm 供給網防御ルール（常設）」に書き換え
3. `.npmrc`: コメントを凍結文脈から常設ガード文脈へ更新（設定値は不変）
4. `docs/Plans.md`: 進行中エントリ、monitoring backlog の目的更新（凍結解除通知 → 常設 hygiene 監視）
5. memory `feedback-npm-install-blocked-mini-shai-hulud-2026-05.md`: 凍結中 → D-030 移行済みへ status 更新 + MEMORY.md index 行更新

## Non-scope

- 依存の追加・更新（linkify-it high 対応は次の行動 1 の別 PR。本 PR は policy のみ）
- `.npmrc` 設定値の変更（`ignore-scripts=true` / `min-release-age=7` は恒久維持）
- 自動 monitoring 仕組みの実装（目的を更新して Backlog 継続）

## 移行の根拠（user 決定 2026-07-05 + 同日 web 裏取り）

- 攻撃は継続中（2026-05-14 node-ipc / 2026-05-29 dependency confusion 33 packages / 2026-06-01 Miasma @redhat-cloud-services 32 packages / 2026-06-04 binding.gyp 第 2 波 / 2026-06-17 Mastra）。「平穏だから解禁」は成立しない
- 一方、観測された全事案の主ベクトルは①install script 実行（preinstall / postinstall / binding.gyp 暗黙 node-gyp）②公開直後の毒入り version 取得、であり、①は `ignore-scripts=true`、②は `min-release-age=7`（悪性 version は通常数時間〜数日で registry から削除される）が構造的に遮断する
- 旧解除条件（GHSA-g7cv-rxg3-hmpx withdrawn + audit high 7 日 clean）は blanket 凍結の解除条件として設計されたもの。D-030 は凍結解除ではなく防御方式の移行（deny-by-default → 常設ガード + 通常運用）であり、advisory が active のままでも成立する。この差は D-030 の Why に明記する
- 凍結の実運用コスト（必要な導入の停滞、7 段 safety net の儀式、限定 install の都度承認）が、常設ガード下の残余リスク（require/import 時 runtime payload = min-release-age の検出窓でほぼ遮断、dependency confusion = 公式 registry の正確な package 名運用で回避）を上回った

## Acceptance Criteria

- `CLAUDE.md` から「凍結中」「禁止コマンド（凍結中）」の節が消え、常設ガード / 禁止（継続）/ 逐次投入手順の 3 構成になる
- `docs/decision-log.md` に D-030 があり、旧解除条件を満たさず移行する理由が Why に明記されている
- `.npmrc` の設定値が `git diff` で不変（コメント行のみ変更）
- memory の status が更新され、MEMORY.md index の「🔴緊急:npm install系凍結」行が現状を反映
- `./scripts/doc-consistency-check.sh` 全通過

## Test Plan

- 機械 gates: doc-consistency-check + CI docs-only routing
- `.npmrc` 設定値不変の確認: `npm config list` で `ignore-scripts = true` と `before` 導出（min-release-age=7）が移行前後で同一

## Review Focus

- 「凍結解除」ではなく「防御方式の移行」という位置付けが CLAUDE.md / D-030 / memory で一貫しているか
- 禁止（継続）リストの過不足: `npm audit fix --force` / 一括 `npm update` / version pin なし `npx` / `min-release-age-exclude` の無承認追加
- 旧解除条件・monitoring の後始末に宙ぶらりんの参照が残らないか

## Implementation Results

- `docs/decision-log.md`: D-030 追加（移行根拠 = 攻撃継続前提の常設ガード、旧解除条件を満たさず移行する理由、代替案 3 件の棄却理由付き）
- `CLAUDE.md`: 「重要セキュリティルール（緊急）」→「npm 供給網防御ルール（常設）」に全面書き換え（常設ガード / 禁止（継続）/ 逐次投入手順の 3 構成）。「やってはいけないこと」の凍結参照も常設ガード迂回禁止に更新
- `.npmrc`: コメントを凍結文脈から常設ガード文脈へ書き換え。設定値不変を `npm config list` で確認（`ignore-scripts = true` + `before` 導出が移行前後で同一）
- `docs/DEV_SETUP_CHECKLIST.md`: Windows L3 runbook 内の凍結参照 2 箇所を D-030 文脈に更新
- `docs/Plans.md`: 進行中エントリ追加、次の行動 1（linkify-it = D-030 逐次投入の初適用に位置付け直し）/ 2（monitoring = 常設 hygiene 監視に目的変更）、Backlog monitoring 項目の目的更新
- memory: `feedback-npm-install-blocked-mini-shai-hulud-2026-05.md` に STATUS ヘッダ（D-030 移行済み、凍結ルールは歴史記録）+ frontmatter description 更新 + MEMORY.md index 行更新
- Gates: doc-consistency 全通過、lockfile / 依存 / `.npmrc` 設定値 非接触

## Review Response

Review-only skipped because: R1 policy docs + コメントのみ（設定値・コード・依存・lockfile 不変）。機械 gates + user 決定の直接反映で担保。
