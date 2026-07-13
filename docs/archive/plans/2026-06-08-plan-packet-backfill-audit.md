# Plan Packet 昇格漏れ棚卸し（Plan Packet → 仕様書 / decision-log）

> 起票: 2026-06-08 / 親 SSOT: `Plans.md` follow-up「Plan Packet から仕様書 / decision-log への昇格漏れ棚卸し」
> 配置: `docs/archive/plans/2026-06-08-plan-packet-backfill-audit.md`（2026-06-08 archive 移送）

## Risk

Risk: R2

Reason:
docs-only の棚卸しと最小整合性修正 + workflow visibility sync。`Plans.md` 現在地同期、`Plans.md` Backlog への 2 行転記、Plan Packet artifact 作成、`DEV_WORKFLOW.md` への Skill linkage / `Commit / PR Messages` 節、`.github/pull_request_template.md`、`CLAUDE.md` 引き継ぎ / 参照のみで、runtime 契約・DB・Tauri command DTO・route/search state・merge gate には触れない。workflow / gate の判定ルール動作も変更しない（DEV_WORKFLOW への linkage・作法明文化・PR template は既存運用の sync で gate 動作の net-new ではない）。

## Goal

`docs/plans/` と直近 `docs/archive/plans/` の Plan Packet を棚卸しし、Plan Packet にだけ残る durable 判断 / UI 仕様 / 非 scope・defer 判断 / L3 feedback が source-of-truth docs（`decision-log.md` / `UI_TECH_STACK.md` / `SCREEN_DESIGN.md` / `function-design/*.md` / `project-memory.md` / operator-UI Skill）へ昇格済みかを分類する。確定した昇格漏れ（dangling reference）を最小修正し、`Plans.md` の現在地を実態（PR #80 MERGED）へ同期する。

## Scope

- 監査対象: 当時 active 2 本（現 `docs/archive/plans/2026-05-22-tone-and-nav-fix.md` / `docs/archive/plans/2026-06-07-display-scale-readability.md`）+ 直近 archive のクラスタ A（operator-UI 視認性 3 本）/ クラスタ B（workflow retrofit 2 本）/ クラスタ C（Phase 2 UI 画面 7 本）。
- 出力: 「既に仕様書にある / 仕様書へ昇格 / decision-log へ昇格 / Plan 証跡のみで十分」の分類表（本 Plan Packet の「監査結果」節）。
- 最小 docs 更新: `Plans.md` 現在地同期（PR #80 MERGED 反映 + backfill audit 完了化）+ `Plans.md` Backlog への C-1 / C-2 転記（`58 §58.13` の dangling reference 解消）。
- workflow visibility sync（PR #82 で同梱）: `DEV_WORKFLOW.md` への昇格済み Skill linkage + `CLAUDE.md` セッション復旧・引き継ぎ節。
- PR 作法整備（PR #82 で同梱）: `DEV_WORKFLOW.md` `Commit / PR Messages` 節 + `.github/pull_request_template.md` 新規 + `CLAUDE.md` からの参照。

## Non-scope

- workflow / gate の判定ルール動作の変更（Risk Tier 定義 / Plan Packet 必須セクション / verification gate の動作は変えない。`DEV_WORKFLOW.md` への Skill linkage・`Commit / PR Messages` 節・PR template は既存運用の sync + 作法明文化であり gate 動作の net-new ではない）。
- コード編集（`.tsx` / `.rs` / bindings / DB schema / Tauri command DTO は触らない）。
- display-scale option の decision-log 独立エントリ追加（UI_TECH_STACK が SSOT として昇格済みのため見送り。根拠は「監査結果」節参照）。
- 完了済み active plan 2 本（2026-05-22 / 2026-06-07）の archive 移送（mechanical cleanup でレビュー観点が異なるため別作業に分離）。
- 完了済み Phase 2 画面の関数設計再記述（既に function-design 53〜58 + SCREEN_DESIGN に昇格済み）。

## Acceptance Criteria

- 3 クラスタ（A operator-UI / B workflow / C Phase 2 画面）の監査分類表が本 Plan Packet に存在する。
- 確定 gap が「C-1 pagination UI backlog / C-2 DepartmentFilter 共通化 backlog」の 2 件として記録され、いずれも `58 §58.13` が参照する `Plans.md` Backlog 転記先の空（dangling reference）であることが裏取り済み。
- `Plans.md` の selection-tone follow-up が PR #80 MERGED として `[x]` 化され、「次の行動」から「PR #80 の merge 判断」が除去されている。
- `Plans.md` Backlog に C-1 / C-2 の 2 行が転記され、`58 §58.13` の参照先が埋まる。
- `bash scripts/doc-consistency-check.sh --target plan` が exit 0。
- `bash scripts/doc-consistency-check.sh` が既知の `per_page` WARN 1 件以外に新規 ERROR / WARN を増やさない。

## Test Plan

- targeted tests: なし（docs-only、コード/テスト変更なし）。
- negative tests: `Plans.md` Backlog 転記後に `58 §58.13` が参照する文言（pagination UI / DepartmentFilter 共通化）が `Plans.md` 内に rg で 1 件以上ヒットすること。
- compatibility checks: route/search schema・DB schema・Tauri DTO・generated bindings・POS CSV/PLU 契約に変更がないこと（本 Plan Packet は触らない）。
- data safety checks: 実 POS/店舗 artifact・DB file・backup・log・receipt image・secret を読まない / commit しない。合成データすら扱わない。
- main wiring/integration checks: `doc-consistency-check.sh --target plan`（PK1/PK2/PK3）+ full docs check の差分のみ。

## Review Focus

- C-1 / C-2 の「dangling reference」判定が実証されているか（`58 §58.13` の参照と `Plans.md` Backlog の不在の両方を rg で確認したか）。
- display-scale を decision-log に昇格しない判断が「分業（decision-log = 不可逆判断索引 / UI 機能仕様 = 各 spec doc が SSOT）」として妥当か。
- `Plans.md` 現在地同期で「進行中→完了」の status keyword 取り残しが無いか（memory `feedback-status-sync-pr-keyword-grep-comprehensive`）。
- `DEV_WORKFLOW.md` の Skill linkage / `Commit / PR Messages` 節 / `CLAUDE.md` handoff / `.github/pull_request_template.md` が、新 workflow ルールの net-new ではなく既存資産への sync + 作法明文化に留まっているか（PR #82 commit `dd2e940` / `d42d42b` で同梱）。

## 監査結果（分類表）

### クラスタ A: operator-UI / 視認性 — gap 0 件

durable 12 項目（色のみ符号化禁止 / StockStatusBadge 契約 / 状態列 colSpan=6 / StatusChips 中庸 stone tone / 在庫数セル red・amber の二次シグナル化 / L3 視認性は機能欠陥扱い / 非IT高齢 operator 前提の読みやすさ機能要件化 / 表示サイズは横断別設計 / 既存 visual language 継承 / review-checklist category 9 / window size 1280x800 / 汎用 UI Skill の negative routing）はすべて `SCREEN_DESIGN.md` / `UI_TECH_STACK.md` / `quality/review-checklist.md` / `function-design/58-ui-stock-inquiry.md` / `inventory-operator-ui` Skill に分散昇格済み。survey 経緯 2 項目は plan-evidence-only で十分。

### クラスタ B: workflow / process retrofit — gap 0 件

durable 15 項目（workflow entrypoint Skill / R2+ Plan Packet 構造 / R3 review-only default / artifact 配置 / PK1-3 graft / spec・ADR は index のみ / research ADR 非移動 / Plans.md は dashboard 専用 / AGENTS.md frontend gate に npm test / 色のみ符号化禁止 / status は既存 shadcn+Badge / review-checklist category 9 / operator-ui negative routing / 汎用 UI Skill 削除 / visual language 継承）はすべて `DEV_WORKFLOW.md` / `AGENTS.md` / `spec/README.md` / `adr/README.md` / `project-profile.md` / `quality/review-checklist.md` / 各 Skill に昇格済み。ブランチ運用・negative fixture 検証は plan-evidence-only。

`DEV_WORKFLOW.md`「Workflow Skills」行の評価: 昇格済み 4 Skill（`inventory-workflow-start` / `inventory-implementation` / `inventory-code-review` / `inventory-operator-ui`）への index linkage 補完。`DEV_WORKFLOW.md` は PR #72 以降未更新で後発 Skill が index に未接続だった取り残し。新規 workflow ルールの追加ではない。PR #82 commit `dd2e940`（linkage + `CLAUDE.md` 引き継ぎ）/ `d42d42b`（`Commit / PR Messages` 節 + `.github/pull_request_template.md`）で workflow visibility sync として同梱済み。

### クラスタ C: Phase 2 UI 画面 7 本 — gap 2 件（いずれも minor / dangling reference）

already-in-spec 多数（契約 H 色分け / 契約 I 検索駆動 / StockInquiryListResult 正規化 / 2 useQuery 部分障害許容 / DTO 不在 UI 派生回避 / IME composition 除外 / useBlocker / effectiveUnitPrice 派生 / prev_month_comparison 派生 / Phase 2 defer 群）はすべて function-design 53〜58 + `UI_TECH_STACK.md §7.2` + decision-log D-013〜D-017 に昇格済み。

| # | durable 項目 | 種別 | 現在の所在 | 分類 | 根拠 |
|---|---|---|---|---|---|
| C-1 | UI-06a pagination UI（「すべて」50 件超、Phase 4 で再評価） | defer | `58 §58.13` L533 + plan のみ | promote-to-spec: `Plans.md` Backlog | `58 §58.13` が「Phase 4 で再評価（Plans.md Backlog）」と参照するが `Plans.md` Backlog・dashboard に該当行が rg 0 件 = dangling reference |
| C-2 | DepartmentFilter / DepartmentOption の feature 間共通化 | design | `58 §58.13` L534 + plan のみ | promote-to-spec: `Plans.md` Backlog | `58 §58.13` が「`src/components/...` への抽出（Plans.md Backlog）」と参照するが `Plans.md` Backlog に該当行が rg 0 件 |

### active 2 本

- `2026-05-22-tone-and-nav-fix.md`（PR #80）: selection-tone 統一 + SegmentedControl 仕様は `UI_TECH_STACK.md §4.1` / `§4.1.1` + `function-design/52,57,58` に昇格済み（commit `9f4af2a` / `19da5e0`）。gap 0。PR #80 は MERGED のため archive 候補。
- `2026-06-07-display-scale-readability.md`（PR #77）: 3 段階 display-scale / localStorage key / WebView zoom は `UI_TECH_STACK.md`（L496/498）+ `function-design/52,56,58` に昇格済み。decision-log 独立エントリは不要（UI 機能仕様は spec doc が SSOT、`D-014` が H-6 follow-up を追跡済み）。gap 0。PR #77 は MERGED のため archive 候補。

## 最小 docs 更新案

1. `Plans.md` 現在地同期（必須・事実同期）: selection-tone follow-up（PR #80）を `[x]` MERGED 化、「現在のフェーズ」「残作業分類」「次の行動」から PR #80 merge 判断を除去、backfill audit タスクを完了化し本 Plan Packet を参照、最近の archive に PR #80 / 本 Plan Packet を追加。
2. `Plans.md` Backlog に C-1 / C-2 を転記（dangling reference 解消）: `58 §58.13` が参照する「pagination UI（Phase 4 再評価）」「DepartmentFilter / DepartmentOption 共通化」の 2 行を Backlog 参照先に追加。
3. （PR #82 で実施済み）workflow visibility sync: `DEV_WORKFLOW.md` Skill linkage + `Commit / PR Messages` 節 + `.github/pull_request_template.md` + `CLAUDE.md` 引き継ぎ / 参照を commit `dd2e940` / `d42d42b` で同梱。
4. （見送り）display-scale decision-log エントリ: UI_TECH_STACK が SSOT、重複追加しない。

## Implementation Results

実施済み（2026-06-08）:

- 棚卸し: active 2 本 + 直近 archive を 3 クラスタ（A operator-UI 3 本 / B workflow 2 本 / C Phase 2 画面 7 本）で監査。クラスタ A gap 0 / B gap 0 / C gap 2（C-1 / C-2）。確定 gap は本 Plan Packet「監査結果」節の通り、いずれも `function-design/58-ui-stock-inquiry.md §58.13` が「Plans.md Backlog」を参照するのに転記先が空（dangling reference）であることを rg で裏取り済み。
- `Plans.md` 現在地同期: 「現在の基準」に PR #80 squash merge `67fa62a`（+ ローカル `main` ref が未 fetch で stale な点）を反映。「Phase 2 実装証跡」に selection-tone follow-up 行を追加。「残作業分類」follow-up 行を PR #80 merged + backfill audit 実施へ更新。selection-tone follow-up タスクと backfill audit タスクを `[x]` 化。「次の行動」から「PR #80 の merge 判断」を除去し再番号付け。「最近の archive」に PR #80 + 本 Plan Packet を追加。
- C-1 / C-2 転記: `Plans.md`「後回し Backlog の参照先」に UI-06a 58 §58.13 defer 転記の 1 bullet を追加（pagination UI / DepartmentFilter / DepartmentOption 共通化、`58 §58.13` 参照先を埋める）。
- 検証: `bash scripts/doc-consistency-check.sh --target plan` → exit 0（PK1/PK2/PK3 OK、R3 リンク 329 件実在）。`bash scripts/doc-consistency-check.sh` → exit 0、WARN 1 件（既知の `per_page` ページング上限未定義のみ、新規 ERROR/WARN なし）。
- workflow visibility sync 同梱（PR #82）: `DEV_WORKFLOW.md` Skill linkage + `Commit / PR Messages` 節 + `.github/pull_request_template.md` + `CLAUDE.md` 引き継ぎ節 / 参照を commit `dd2e940` / `d42d42b` で同梱。`docs/plan-packet-backfill-audit` ブランチ（`origin/main` `67fa62a` 起点）で PR #82 として open（commit 一覧は `git log origin/main..HEAD`、PR diff は docs-only。self-trace ループ回避のため commit 数 / files 数の literal はここに記載しない）。
- 後続実施（別作業）: 完了済み active plan 3 本（2026-05-22 / 2026-06-07 / 2026-06-08）の archive 移送は 2026-06-08 workflow cleanup で完了。

## Review Response

Codex diff review（quota 節約方針、Claude が実作業）。

- P1: なし。
- P2: 1 件 accepted/fixed。Plan Packet の Non-scope / Review Focus / 監査結果 B / 最小 docs 更新案 / Implementation Results が「未コミット DEV_WORKFLOW を触らない / 判断保留」のままで、実 4 commit scope（`DEV_WORKFLOW.md` linkage + `Commit / PR Messages` 節 + `.github/pull_request_template.md` + `CLAUDE.md` handoff を同梱）と矛盾する drift。Plan Packet が PR の contract / review input であるため、Scope / Non-scope / Review Focus / 監査結果 B / 最小 docs 更新案 / Implementation Results / Risk Reason を実 scope に整合させ、archive 移送のみを Non-scope に残した。
- P3: なし。
- Merge / Split: 分割不要、P2 修正で merge 可能判定。

判断根拠は本 Plan Packet「監査結果」「最小 docs 更新案」節および各 commit に残す。
