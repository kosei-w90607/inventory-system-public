# Plan Packet: linkify-it ReDoS (GHSA-22p9-wv53-3rq4) 解消 — D-030 逐次投入の初適用

Risk: R1

lockfile のみの transitive devDep 更新（linkify-it 5.0.0 → 5.0.1）。package.json・アプリコード不変。

## Goal

npm audit の唯一の high（linkify-it <=5.0.0 の ReDoS、markdownlint-cli2 → markdown-it → linkify-it 経由）を解消し、audit high 0 を回復する。D-030「常設ガード付き逐次投入」の初適用として、名指し更新 + ガード実動作を記録する。

## Scope

- `npm update linkify-it`（名指しの意図的更新、D-030 手順）による lockfile 更新のみ

## Non-scope

- 残る moderate/low audit 7 件（既存 backlog の別 PR 評価のまま）
- markdownlint-cli2 本体の version 更新

## Acceptance Criteria

- `npm ls linkify-it` が 5.0.1（advisory の first_patched_version）
- `npm audit --audit-level=high` が exit 0（実測: 7 vulnerabilities = 2 low + 5 moderate、high 0）
- lock diff が linkify-it の version/resolved/integrity + funding metadata のみ（package.json 不変）
- markdownlint-cli2 が新 linkify-it で実行できる（smoke: docs/Plans.md に対して lint 実行、MD013 検出 = パイプライン正常）

## D-030 ガードの実動作記録

- 更新時点の linkify-it 最新は 5.0.2（2026-07-01 publish = 4 日前）だったが、`min-release-age=7` の cooldown 窓内のため解決から除外され、**5.0.1（2026-05-23 publish = 43 日前、patched version）に自動解決**した。常設ガードが「最新の毒入りリスク version を掴まない」動作を初適用で実証
- `ignore-scripts=true` 下で update 実行（install script 実行なし）

## Test Plan

- `npm audit --audit-level=high` exit 0（実測済み）
- CI Frontend job（`npm ci --ignore-scripts` + typecheck / lint / format / build）で lockfile 整合を検証

## Review Focus

- lock diff に linkify-it 以外の変更が混入していないか
- 5.0.2 でなく 5.0.1 に解決した理由（min-release-age、意図通り）の記録が残っているか

## Implementation Results

- linkify-it 5.0.0 → 5.0.1（lockfile のみ、+13/-3 行 = version/resolved/integrity + funding block）
- `npm audit --audit-level=high` exit 0、high 0 件
- markdownlint-cli2 smoke 正常
- min-release-age=7 が 5.0.2（cooldown 窓内）を除外し 5.0.1 に解決 = ガード実動作を実証

## Review Response

Review-only skipped because: R1 transitive devDep の lockfile 更新のみ。機械 gates（audit / CI Frontend job）+ lock diff 全行レビューで担保。
