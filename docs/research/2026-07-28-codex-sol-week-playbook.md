# Codex sol 週間 playbook（Fable 温存期間の運用、2026-07-28 起草）

Fable 週次使用量が 78% に達したため、次回リセットまで（約 4〜5 日）の運用を本書に固定する。起草 = Fable（Coordinator）、
運用主体 = Codex-Coordinator。正本の workflow 契約（DEV_WORKFLOW / AGENT_OPERATING_MANUAL / D-055 / D-056）は一切変更しない —
本書は「誰がどの席に座るか」の期間限定 assignment と、席を回すための発注書雛形のみを定める。

## 1. 体制（期間限定 assignment）

| 席 | 担当 | 制約 |
|---|---|---|
| Coordinator（指揮・packet 起草・裁定・Registry/main 同期・train 管理） | **Codex-Coordinator（1 本固定）** | main への push は本席のみ。裁定の並列化は D-055 で棄却済みのため、複数 lane でも裁定は本席で直列 |
| Writer（実装） | **Codex-Writer × 最大 2**（worktree 各 1 面） | 自 lane の branch / worktree 以外に触れない。fail-closed で停止し Coordinator 裁定を待つ |
| Plan Reviewer / Final Reviewer | **Sonnet 5**（owner が `/model sonnet` セッションを lane ごとに起動） | 独立 fresh context・read-only。並列自由（トークン総量は不変、wall-clock のみ短縮） |
| 難所一次（並行性 / mutation 感度 / 大型 diff / L 級 lane — D-056 基準） | Opus 5 低制約発注（§5.4） | **今週は原則出番なし**: 難所 lane（順12 / 順14）は Fable リセット後温存の既決 |
| 緊急裁定予備 | Fable（残 22%） | 発動条件は §5。それ以外で起こさない |

- Workflow State の role field 記載例: `Coordinator: Codex（本 playbook 期間 assignment。裁定含む）` / `Writer: Codex（別 session、worktree pin）`。
  裁定者 = writer vendor の同一性は fallback 既決の受容点（Plan/Final Reviewer の独立 Sonnet で writer ≠ reviewer は維持）
- Execution Mode: `dual-vendor-no-fable`

## 2. worktree pilot（wave 2 の実装並列化）

wave 1 WER の判断材料「writer 単一 clone 直列が throughput 上限」への対策として、wave 2 は worktree 2 面で writer を並列化する。

セットアップ（owner が 1 回実行）:

```bash
cd /home/kosei/Projects/inventory-system-public
git worktree add ../inventory-worktree-lane1 <lane1-branch>
git worktree add ../inventory-worktree-lane2 <lane2-branch>
# 各 worktree で（build artifact は worktree ごとに独立させる。共有しない）
cd ../inventory-worktree-lane1 && npm ci --ignore-scripts
cd ../inventory-worktree-lane2 && npm ci --ignore-scripts
```

- cargo `target/` は各 worktree で自然に独立生成される（初回 full build のコストは受容。`CARGO_TARGET_DIR` 共有は
  並列 cargo の lock 競合で直列化されるため行わない)
- L1 evidence は HEAD SHA 付き file のため worktree 分離で契約上の問題なし
- Codex-Writer の発注書は **cwd を worktree の絶対パスに pin** する（従来の clone pin と同じ規律)
- 計測義務（worktree pilot の WER 素材）: 各 lane の段階別 wall-clock（packet 起草 / rally / 実装 / review / 検証 / train）を
  Coordinator が PR body に記録する。wave 1 は未計測だったため、3 lane 化判断はこの実測を待つ
- 撤退条件: worktree 起因の障害（build 混線・evidence 混同・relay 誤配）が 2 回発生したら単一 clone 直列へ戻す

## 3. 進行手順（Codex-Coordinator の指揮 checklist）

wave 1 の全 precedent は archive にある: packet 構造 = `docs/archive/plans/2026-07-28-oplog-query-key-factory.md` /
`2026-07-28-sql-placeholder-idiom.md`、摩擦と教訓 = `2026-07-28-wave-1-pilot-workflow-effectiveness-review.md`。

1. **lane 選定**: 残 11 単位（順10〜16・18〜21、正本 = `docs/research/audit-2026-07/report.md`）から owner と 2 lane を選定。
   S 優先、干渉 pair（順13×順14 / 順15×順18 / 順15×順21 / 順10×順18）を同居させない。順12 / 順14（難所）は選ばない
2. **scaffolding**: wave 1 と同配置 — 両 packet + Matrix + Wave Registry 登録を main 上に commit してから lane branch を分岐。
   packet link は Plans.md **項 0 に直置き**（PK4 の ### 抽出制約、WER 記載の checker ずれ）。packet は必須 field 13 点を
   初回から全記載（wave 1 round 1 P1 の教訓）
3. **Plan Gate rally**: Sonnet レビュー発注書（§4-A）を owner 経由で relay、findings を Coordinator が裁定、
   新規指摘 0 まで反復。plan-approved 遷移は evidence が揃ってから state-only commit（`docs(plans): state-only遷移 ...` 完全一致 subject）
4. **実装発注**: §4-B 雛形。**発注書起草前に対象 packet 全節 + 既存規範（test 改変禁止等）との突合 sweep を機械的に実行**
   （wave 1 で Coordinator sweep 漏れ 2 回の教訓、memory 反映済み）
5. **Final Review**: §4-C 雛形（read-only、git object 経由）。mutation kill 主張は Coordinator が clean tree 実注入で独立再実測
   （wave 1 X2 survivor の教訓 — 特に空集合期待 oracle の衝突を疑う）。組合せ oracle に非空期待が最低 1 case あるか確認
6. **Human Gate**: batch Ready 承認依頼は「介入 N/M + 承認で何が完了するか 1 文」を lane ごとに束ね、train 順序既定案
   （human-confirm 到達順）を添える
7. **train**: 先頭のみ ready-hosted-final → L1 full → body 更新 → Ready → hosted green 三点一致 → owner merge →
   後続 rebase（§4-D 雛形、patch-id 2 層証明。whole-diff の after は **Rebase Map 追記 commit 前の tip** で取る — wave 1 の注意点）
8. **closeout**: merge 済み lane を個別 archive → Registry 同期 → 全 lane 完了で wave WER

## 4. 発注書雛形

### 4-A. Sonnet レビュー発注書（plan rally / Final Review 共通骨格）

```markdown
あなたは inventory-system-public repo（cwd: /home/kosei/Projects/inventory-system-public、HEAD <SHA>）の
独立 <Plan|Final> Reviewer（fresh context）である。plan 作成にも実装にも関与していない。read-only で作業し、
file 変更・git 操作・subagent 生成は禁止。<Final Review 時のみ: working tree に触れず
`git show <ref>:<path>` / `git diff A...B` / `gh pr view/diff` のみで参照する>

対象: <packet / Matrix / PR の path・番号>
必読順: docs/DEV_WORKFLOW.md の Workflow State / Wave Operation / Review Rules（+ R3 は Contract Audit）→
一次 finding <audit findings path> → 対象全文 → 引用実コード

観点（全て実施）: (1) 遷移要件の実質充足 (2) 事実主張の file:line 実地突合（rg / 実読で独立再確認）
(3) Matrix の mutation 感度設計と oracle 独立性（期待値の production 導出禁止・空集合期待のみの組合せ禁止）
(4) scope 境界と干渉 pair (5) 既存規範との矛盾（test 改変禁止・生成物義務・Workflow State field 13 点）
(6) `bash scripts/doc-consistency-check.sh --target plan` PASS 確認

報告: Verdict / Findings（P1/P2/P3、各 `番号/分類/file:line/主張/根拠(実測)/修正案`、修正案必須）/
実施検証一覧（各 1 行）。上限 12 件。全文 dump 禁止
```

### 4-B. Codex-Writer 実装発注書（骨格）

```markdown
# 実装発注: <是正単位>（wave N lane N）
## 起動条件
- cwd: <worktree 絶対パス> に pin。git fetch && git checkout <branch> && git pull、HEAD <SHA> を確認
## 正本
- Plan Packet / Matrix（契約）。AGENTS.md Session Start の canonical order。Phase = implementing / Plan Commit 記入済み
## 品質 gate
- <FE: npm 5 点 / Rust: fmt+clippy(-D warnings)+test> → local-ci.sh changed → full（CLEAN）。mutation 実測は
  commit 済み clean tree で注入→red→復元→green、各回 git status clean。徹底検証してよい（Codex 予算無制限）
## 禁止
- Scope 外 file / 既存 test 改変・削除・skip / Plans.md・他 lane file / Workflow State の変更（state 遷移は Coordinator 管理）
- git add -A（明示パス add）
## 完了と停止点
- commit・push 後 Draft PR open（body: Risk / packet link / Plan Commit / gate 結果 / mutation 記録 / L1 SHA）
- **次の停止点は「Draft PR open 完了」のみ。中間報告不要**
- fail-closed: packet と実コードの矛盾・Scope 外変更の必要が判明したら停止して報告
```

### 4-C. Final Review は 4-A の Final 変種を使用（kill 主張は「Coordinator 再実測待ち claims」と明記させる）

### 4-D. rebase train 発注書（骨格）

```markdown
# train rebase: <lane>（D-055）
- rebase 直前に現 origin/main 基準の whole-diff patch-id を取得 → git rebase origin/main（conflict 1 つでも即中止・報告）
- per-commit: Amendments 行の各 SHA → 新 SHA の patch-id 同値確認（plan-first が main 上なら不変と注記）
- whole-diff: rebase 後（Rebase Map 追記 commit の**前**の tip）で再取得し同値確認
- packet Narrative に Rebase Map 追記（独立 commit）→ check-workflow-git.sh PASS → gate 再実行 → L1 full →
  force-with-lease push → ls-remote 一致確認 → PR body 更新。停止点 = push + body 更新完了のみ
```

## 5. Fable 予備の発動条件（これ以外で起こさない）

1. P1 findings の裁定で Codex-Coordinator と Sonnet reviewer の見解が相互修正案 2 往復で収束しない
2. workflow gate change 級の判断が必要になった（DEV_WORKFLOW / checker / D 系 decision の改訂）
3. 事故復旧（transcript 破損、state 矛盾で fail-closed が解けない、merge 事故）
4. wave 2 完了時の WER 最終裁定（軽量。worktree pilot の 3 lane 化判断材料の確定）

## 6. 今週やらないこと

- 難所 lane（順12 / 順14）への着手 — Fable リセット後
- checker 是正 2 件（PK4 ### 抽出 / Workflow State field 検査）— workflow gate change のため Fable 復帰後
- 代役ドラフト解凍の類（D-056 revisit 条件は恒久喪失のみ。週次リセット待ちは該当しない）
