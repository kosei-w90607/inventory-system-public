# 3 PR 順次マージ実装プラン (β-1 → β-2 (Option C: 889b6db 引き取り) → PR #60 rebase clean)

> **作成**: 2026-05-15 (再構築版、外部レビュー P1/P1/P2/P2/P2 指摘反映)
> **作成 session**: feat/ui-07-csv-import セッション中、ClaudeDesktop 統合 + 実機 CSV 検証協議の派生
> **最終保存先**: `docs/plans/2026-05-15-3-pr-progression.md` (ExitPlanMode 後に移送、memory `feedback-active-plan-in-docs.md` 準拠)
> **親 plan**: なし (本 plan が 3 PR 進行の SSOT、PR #60 active plan は `docs/plans/2026-05-13-phase-2-ui-07.md` で別管理)
> **再構築事由**: 旧 plan は Pre-T hot fix `889b6db` で `docs/Plans.md` を `feat/ui-07-csv-import` に commit した事実を取り込めず、β-2 が「symlink だけ持って実体が無い」状態になる帰属破綻が判明。外部レビュー P1/P2 を全件反映し、`889b6db` を β-2 経由で main に取り込む Option C で再設計。

---

## Context

ClaudeDesktop 導入に伴い docs/ 配下のみ権限付与する運用に切り替えた結果、ルート `Plans.md` (SSOT) が ClaudeDesktop から read できなくなる課題が発生した。symlink で両アクセス保証する解決策と並行して、実機 Casio SR-S4000 CSV 4 ファイル + レシート画像が `docs/research/real-csv/` に配置可能になり (gitignore 整備済)、Phase 2 8-2 UI-07 CSV 取込み画面 (PR #60) の検証戦略を再確認する必要が生じた。さらに過去 WSL repo path を `/home/kosei/inventory-system` から `/home/kosei/Projects/inventory-system` に移設した追従更新 17 ファイルが未 commit のまま残っていた。

これら **(1) WSL path 追従、(2) ClaudeDesktop 統合 + 実 CSV 検証環境、(3) UI-07 検証再開** の 3 つを独立 PR で順次マージする。3 つの scope が完全分離していて、Codex review を並行進行できるよう順序を最適化する。

### 関連 memory

- `feedback-active-plan-in-docs.md` — plan は `docs/plans/` 配置、Plan mode default は `~/.claude/plans/` だが後で移送
- `feedback-archive-relative-path-conversion.md` — archive 時の相対パス変換 (doc-consistency R3 fail 防止)
- `feedback-plans-next-session-entry-temporary.md` — Plans.md L70-95 一時メモは作業完了後に明示削除
- `feedback-plans-sync-commit-milestone-only.md` — Plans.md 更新タイミング (節目のみ)
- `feedback-pos-vendor-independence.md` — POS レジ特有仕様を IO 層に閉じ込め (R130/R138)
- `casio-sr-s4000-z-prefix-reference.md` — Z00X 対応表、Z004 売上日報 vs PLU 設定書出しの二態
- `feedback-codex-drift-fix-grep-all-locations.md` — Codex drift 系指摘は repo 全体 grep で一括修正
- `feedback-codex-p1-empirical-defense.md` — Codex P1 は実証ベースで反証 / 採用判断
- `feedback-self-trace-expression-breaks-sync-loop.md` — PR の HEAD/chain 表記を docs sync と分離

---

## Pre-T: Hot fix (完了済、Option C で β-2 に commit 移管予定)

### 完了状態 (実証)

- commit `889b6db` を `feat/ui-07-csv-import` に push 済 (`git log --oneline -2` で確認可能)
- `git show 889b6db --name-status` → `A docs/Plans.md` のみ (266 行 add)
- `889b6db^` (parent) = `fedc762` (PR #60 内、Mini Shai-Hulud 対応)
- 実施内容: `docs/Plans.md` 新規 add (Plans.md からの実体移送) + 内部 link 補正 (sed コマンドで `]<paren-open>docs/` パターンを `]<paren-open>` に置換、26 件 + 手動 drift 3 件)
- verify (実証済): `bash scripts/doc-consistency-check.sh` 19 項目全 pass、ERROR 0 件、ExitPlanMode hook block 解消

### Option C 採用による帰属の再定義 (P1-A / P1-B / P2-A 指摘の根本解決)

旧 plan は `889b6db` を「PR #60 内 commit 8 として squash 吸収」する前提だったが、これだと:

- β-2 を `main` (= `452fe0a`、`889b6db` を含まない) から切ると `docs/Plans.md` 実体が存在しない
- β-2 commit で `Plans.md → docs/Plans.md` symlink 化しても、symlink の指す先が存在しない不整合
- 旧 plan T0 の `git stash -u` は **未 commit 変更のみ** stash 対象、`889b6db` (既に commit 済) は stash されない
- 結果: 「β-2 で symlink だけ commit、`docs/Plans.md` 実体は PR #60 にしかない」二重またがり状態が確定発生

**Option C 解決**: `889b6db` を β-2 に **cherry-pick で移管**、β-2 で symlink + docs/Plans.md 実体 + .gitignore + .gitkeep + README を 1 PR に集約する。PR #60 ブランチは β-2 マージ後の rebase で `889b6db` (commit hash) を main 経由で吸収、PR #60 作業ツリーからは自動消失する。

`889b6db` cherry-pick の安全性 (実証済):

- `889b6db` は `docs/Plans.md` を **新規 add** (`A` フラグ)、parent state に依存しない
- main には `docs/Plans.md` は存在しない (`git ls-tree origin/main -- docs/Plans.md` で no output)
- cherry-pick で β-2 ブランチに `docs/Plans.md` を add する操作になり、path 衝突ゼロ、自動成功想定
- cherry-pick によって commit hash は変わる (parent + author + date 決定論的、parent が変わるため hash 必ず変わる) → PR #60 の rebase 戦略で考慮 (R10 参照)

### Pre-T 実行時の追加処理 (本 plan の β-2 内で対応)

- `docs/research/real-csv/.gitkeep` (untracked、0 byte、`ls -la` で確認済) → β-2 commit 4 で `git add`
- `docs/research/real-csv/README.md` (実在しない) → β-2 commit 5 で **新規作成** (P2-B 対応、5-10 行)
- `Plans.md` typechange (symlink、index 上 mode 変更検出待ち、`git status` で `typechange` 表示) → β-2 commit 3 で `git add`
- `.gitignore` working tree edit (real-csv ignore + negation +8 行、未 commit) → β-2 commit 2 で `git add`
- `docs/plans/2026-05-13-phase-2-ui-07.md` working tree edit (path rename のみ、検証戦略変更は未着手) → β-1 範囲 (path rename) + 段階 A commit 8 (検証戦略追記、P2-C 対応)

---

## 0. 起点状態 (Phase 1 探索 + 再構築追加調査で確定)

- **現ブランチ**: `feat/ui-07-csv-import` (PR #60 用、main から 8 commit 先 `9cba3fa..889b6db`)
- **main HEAD**: `452fe0a` (PR #58 squash merge、ショートカット一覧ダイアログ)
- **PR #60 chain (8 commit)**: `9cba3fa..889b6db` (旧 plan 7 commit + Pre-T hot fix `889b6db` = 8 commit)
- **working tree** (`git status` 実証):
  - β-1 候補: 17 files (path rename 機械置換、`.claude/` `.codex/` `AGENTS.md` `CLAUDE.md` `docs/DEV_SETUP_CHECKLIST.md` `docs/TOOLING_SKILL_COMMANDS.md`)
  - β-2 候補: `.gitignore` modified + `Plans.md` typechange + `docs/research/real-csv/.gitkeep` untracked
  - PR #60 関連: `docs/plans/2026-05-13-phase-2-ui-07.md` modified (path rename のみ、これは β-1 範囲だが PR #60 内 file)
- **実機 CSV**: `docs/research/real-csv/` 配下に 5 ファイル + `.gitkeep` 配置済 (CSV 4 + 画像 1 は ignore で隔離、`.gitkeep` のみ tracked 候補)
  - `Z001_260313.CSV` (1.1k、日計サマリ)
  - `Z002_260313.CSV` (1.6k、取引キー = 決済方法別)
  - `Z004_260311PLU(商品).CSV` (250k、**PLU 設定書出し** = 商品マスタ snapshot、売上日報ではない)
  - `Z005_260313.CSV` (831b、部門別)
  - `1000020643.jpg` (4.2M、レジツール画面写真)
- **PR #60 の本物 Z004 売上日報は取得不能**: user 店舗で PLU 未登録のため Z004 売上日報を書き出しても 4231 行全空テンプレ、運用上 user がスキップ済。実機売上日報は Phase 4 UI-08 (PLU 書出し) 完成 → レジへ PLU 一括登録 → 1 日運用後の翌日に初取得可能。
- **`docs/plans/2026-05-13-phase-2-ui-07.md` working tree edit** (`git diff` 実証): path rename のみ (L67 / L276-284、`/home/kosei/inventory-system` → `/home/kosei/Projects/inventory-system`)。検証戦略変更は未着手で本 plan 段階 A commit 8 で初追加。

### 制約

- **Mini Shai-Hulud worm 緊急対応**: npm install 系凍結中 (`npm ci --ignore-scripts` のみ許容)、PR #60 commit `fedc762` で導入済の `.npmrc` `ignore-scripts=true` 維持
- **LSP/Skills Policy**: code 編集前に LSP tool 使用 + `skills-decision.json` 更新を機械強制 (本 plan の Rust/TS 編集予定は PR #60 段階 A commit 9 の条件付き fix のみ)
- **check-plan-on-exit.sh hook**: ExitPlanMode 前に Self-Review section + DISTINCT_TOKENS ≥ 25 + placeholder hits < 2 + 直近 30 分以内の subagent log 必須 (本セッションで Explore + Plan agent 2 回動かし済で D-1 充足)
- **doc-consistency-check.sh --target plan**: 9 項目 pass (markdown link 実在、観点深さ、placeholder 検出、etc.)

---

## 1. PR 順序 (β 採用、Option C 反映)

```
時系列:
  T0: stash 退避 (working tree 三方向分離、889b6db は既に commit 済で stash 対象外)
  T1: main から β-1 ブランチ作成 + commit + push + PR open
  T2: PR #60 ブランチで段階 A commit 8 (検証戦略 docs 反映、β-2 マージ待たず実施可能)
  T3: β-1 マージ
  T4: main から β-2 ブランチ作成 + cherry-pick 889b6db + commit chain + push + PR open
  T5: β-2 マージ (889b6db が main に取り込まれる)
  T6: PR #60 ブランチで main rebase (889b6db は patch-id 同一で自動 skip 想定)
  T7: PR #60 残検証 8/10 + Codex review + squash merge

並行性:
  T2-T4: PR #60 段階 A commit 8 と β-2 PR open は並行可能 (scope 完全分離)
  T5-T7: PR #60 段階 B と β-2 review は並行不可 (β-2 マージ後に PR #60 rebase)
```

---

## 2. β-1 詳細 (path rename、mechanical、1 commit)

### branch
- 命名: `chore/path-rename-projects-prefix`
- base: `main` (`452fe0a`)

### 変更内訳 (17 files、全部 `/home/kosei/inventory-system` → `/home/kosei/Projects/inventory-system` 置換)

| カテゴリ | ファイル | 置換行数 |
|---|---|---|
| .claude/hooks/ | `audit-safety-net.sh` | 2 |
| | `audit-trigger-phase.sh` | 1 |
| | `audit-trigger-plan.sh` | 1 |
| | `check-plan-on-exit.sh` | 1 (`AGENT_LOG_DIR`) |
| | `memory-capture-feedback.sh` | 1 |
| | `memory-precompact-scan.sh` | 1 |
| .claude/commands/ | `plan-rally.md` | 1 |
| .codex/ | `README.md` | 5 |
| | `bin/list-safe-files.sh` | 1 |
| | `bin/read-safe-file.sh` | 1 |
| | `bin/search-safe-files.sh` | 1 |
| | `execpolicy.rules` | 20 |
| | `rules/default.rules` | 20 |
| root | `AGENTS.md` | 2 |
| | `CLAUDE.md` | 1 |
| docs | `DEV_SETUP_CHECKLIST.md` | 4 |
| | `TOOLING_SKILL_COMMANDS.md` | 1 |

合計 17 files / 64 lines。

### commit 構成 (1 commit)

```
chore(env): WSL repo path を /home/kosei/Projects/inventory-system に統一

WSL 上のリポジトリ実体を /home/kosei/inventory-system から
/home/kosei/Projects/inventory-system に移設したことに伴う
追従更新。実体側 / 設定側の 17 ファイル全てを置換。

検証:
- rg "kosei/inventory-system" . | rg -v "kosei/Projects/" で 0 件
- pre-push hook 4 段 pass (Rust 変更なしで cargo 系 skip)
- ~/.claude/projects/-home-kosei-Projects-inventory-system/ 実在確認
```

### Verification

- `rg "kosei/inventory-system" . | rg -v "kosei/Projects/inventory-system" || true` (`rg` は no-match で exit 1 を返す仕様、過去の hook 系バグと同じ罠を避けるため `|| true` で exit code 抑制、結果は目視 or `wc -l` で確認) で 0 件 (PR #60 active plan 内 path 参照は PR #60 で対応、stash 退避中なので grep にもかからない)
- `bash .git/hooks/pre-push` 4 段 pass (cargo fmt / clippy / test は src-tauri 変更検出で skip、doc-consistency 19 + plan 9 + typedinvoke baseline 0 + env-safety 全 pass)
- `ls ~/.claude/projects/-home-kosei-Projects-inventory-system/memory/` で MEMORY.md + 個別 memory 全 実在

### Risks
- pre-push hook の SENTINEL path 不整合で audit-safety-net 警告誤発火: 全 hook を同期更新するので影響なし
- `.claude/settings.local.json` (gitignored、個人 override) と main の path mismatch: 各開発者が個別 update 必要、`AGENTS.md` / `DEV_SETUP_CHECKLIST §3.3` 明文化済
- rollback: `git revert <squash-hash>` で 17 files 一括 revert 可能

### マージ後
- archive 不要 (chore PR、active plan 無し)
- Plans.md 更新不要 (memory `feedback-plans-sync-commit-milestone-only.md` 準拠、節目には該当しない)

---

## 3. β-2 詳細 (Option C: 889b6db 引き取り + ClaudeDesktop 統合 + 実 CSV 検証環境、5 commit chain)

### branch
- 命名: `chore/claude-desktop-integration-real-csv`
- base: `main` (β-1 マージ後の main、ただし `889b6db` を含まない main = 直系の `origin/main`)

### 設計思想 (Option C)

`889b6db` (Pre-T hot fix、PR #60 内 commit) を **cherry-pick で β-2 に移管** し、`docs/Plans.md` 実体 + symlink + .gitignore + .gitkeep + README を **同一 PR に閉じる**。これにより:

- β-2 単独で「ClaudeDesktop が docs/ 配下を読める実体 + ルートも引き続き読める symlink + 実 CSV 検証ディレクトリ」が完結
- PR #60 は β-2 マージ後 main 経由で `889b6db` を吸収、PR #60 作業ツリーから自動消失
- P1-A (帰属破綻) / P1-B (二重またがり) / P2-A (stash 不可) / P2-B (README 不在) を一括解消

### commit chain (5 commits、squash 想定だが Codex review 時に各 commit が独立検証可能な粒度)

#### commit 1: `chore(plans): docs/Plans.md 実体追加 (cherry-pick 889b6db、Plans.md → docs/Plans.md 移送 + 内部 link 補正)`

- 操作: `git cherry-pick 889b6db`
- touch: `docs/Plans.md` (new file、266 行) — `889b6db` の patch を main 直系 base 上に再適用
- cherry-pick の挙動 (実証ベース根拠):
  - `889b6db` は `A docs/Plans.md` のみ (parent 状態に非依存)
  - main には `docs/Plans.md` が無い (`git ls-tree origin/main` で no output)
  - 結果: path 衝突ゼロで成功想定、conflict 発生確率は実質ゼロ
- commit message (cherry-pick 自動生成された原 message を `git commit --amend` で全文書き直し、外部レビュー P3 対応):
  - **元 commit message 内の「後続 PR (β-2 commit 2)」記載**: 当時 (Pre-T 実施時) の plan version では symlink 化が β-2 commit 2 だったが、再構築 plan では β-2 commit 3 に変わってる。amend で「**後続 commit (β-2 commit 3)**」または「**後続 commit**」とぼかして整合させる (古い commit 番号が残ると reviewer ノイズ)
  - amend 後の commit message 構造:
    ```
    fix(plans): docs/Plans.md 新規追加 + 内部 link 補正 (ClaudeDesktop 統合準備)

    [元 message 本文の内容、ただし「後続 PR (β-2 commit 2)」を
    「後続 commit (β-2 commit 3)」または「後続 commit」に書き換え]

    (cherry picked from commit 889b6dbee2efa1118eeb41418879ec2e877e792c)

    Note: β-2 PR boundary 適正化のため feat/ui-07-csv-import から
    cherry-pick で移管。原 commit は PR #60 内で作成されたが、symlink 化
    (commit 3) と実体追加が同一 PR にあるべきという外部レビュー指摘
    (P1-A/P1-B) を受け、本 β-2 PR に集約。PR #60 は β-2 マージ後 main rebase
    で本 commit を main 経由として吸収する。
    ```
- verify:
  - `git log --oneline -1` で cherry-pick 後の新 hash 確認 (元 hash `889b6db` と異なる、parent 変更のため)
  - `git show HEAD --stat` で `docs/Plans.md` 266 行 add のみ
  - `bash scripts/doc-consistency-check.sh` 19 項目 pass (`docs/Plans.md` link 全実在)

#### commit 2: `chore(env): .gitignore に docs/research/real-csv/ ignore + negation 追加`

- touch: `.gitignore` (+8 行、working tree の現 diff そのまま)
- 内容:
  ```
  # 2026-05-15 追加: 実 CSV 検証データ (Phase 2 UI-07 検証フェーズ)
  # user 運用で docs/research/real-csv/ を実機 CSV 配置場所として採用。
  # 経営情報 (売価/原価/取引明細) を含むため git 管理外。
  # .gitkeep / README.md のみ管理して構造を保証する。
  docs/research/real-csv/*
  !docs/research/real-csv/.gitkeep
  !docs/research/real-csv/README.md
  ```
- verify:
  - `git check-ignore -v docs/research/real-csv/Z001_260313.CSV` で `.gitignore:86` ヒット (ignored)
  - `git check-ignore -v docs/research/real-csv/.gitkeep` で `.gitignore:87:!` negation
  - `git check-ignore -v docs/research/real-csv/README.md` で `.gitignore:88:!` negation (commit 5 で実体追加されるが、commit 2 時点で negation rule 先行 OK)

#### commit 3: `chore(docs): Plans.md ルートを docs/Plans.md への symlink 化 (ClaudeDesktop docs/ 権限対応)`

- touch: `Plans.md` (typechange 100644 → 120000)
- 前提: commit 1 で `docs/Plans.md` 実体が存在するため、symlink 先が解決される
- git 操作: `git add Plans.md` (working tree 既に symlink 状態、`git status` で `typechange` 検出済) → typechange を index に書く
- verify:
  - `readlink Plans.md` → `docs/Plans.md`
  - `git ls-files --stage Plans.md` → mode `120000` blob `docs/Plans.md`
  - `head -3 Plans.md` で実体内容 (symlink follow OK、ルート Plans.md 経由 read 成立)
  - `git ls-files --stage docs/Plans.md` → mode `100644` (commit 1 で確定済)

#### commit 4: `docs(research): docs/research/real-csv/.gitkeep 配置 (実機 CSV 検証用ディレクトリ確保)`

- touch: `docs/research/real-csv/.gitkeep` (new 0 byte、working tree 既に存在)
- 前提: commit 2 で `.gitkeep` negation rule 先行済
- verify:
  - `git ls-tree HEAD docs/research/real-csv/` で `.gitkeep` 表示 (この時点では README.md 未追加なので `.gitkeep` のみ)
  - `git check-ignore -v docs/research/real-csv/Z001_260313.CSV` で ignored 維持

#### commit 5: `docs(research): docs/research/real-csv/README.md 追加 (実機 CSV 検証用ディレクトリ説明)`

- touch: `docs/research/real-csv/README.md` (new、5-10 行) — **P2-B 対応で新規作成**
- 前提: commit 2 で `README.md` negation rule 先行済
- 内容 (短く保つ):
  ```markdown
  # 実機 Casio SR-S4000 CSV 検証用ディレクトリ

  本ディレクトリには Phase 2 UI-07 CSV 取込み画面の検証で使う
  実機 Casio SR-S4000 出力 CSV (Z001/Z002/Z004/Z005) を配置する。

  - CSV 実体は経営情報 (売価/原価/取引明細) を含むため `.gitignore` で
    git 管理外、`.gitkeep` と本 README のみ tracked。
  - ファイル配置は user ローカルでのみ実施 (CI / 他開発者環境では空)。
  - Z004 売上日報の本物実機データは Phase 4 UI-08 (PLU 書出し) 完成後の
    1 日運用 → 翌日取得が前提 (memory `casio-sr-s4000-z-prefix-reference.md`)。
  ```
- verify:
  - `git ls-tree HEAD docs/research/real-csv/` で `.gitkeep` + `README.md` の 2 件のみ表示
  - `git check-ignore -v docs/research/real-csv/Z001_260313.CSV` で ignored 維持 (CSV 実体は依然 ignore)
  - `wc -l docs/research/real-csv/README.md` で 5-10 行

### 5 commit にする vs 1 commit に集約する判断

**5 commit 維持を推奨**。理由:
1. squash merge 前提なので main HEAD は 1 commit に集約され、本数差は最終履歴に出ない
2. Codex review の観点で各 commit が独立検証可能 (cherry-pick / .gitignore / symlink / .gitkeep / README は別レイヤー)
3. cherry-pick commit (commit 1) は trailer で由来明示が必須、他 commit と統合すると混在 message になる
4. もし Codex から「chain が長い」と指摘されたら、commit 3-5 (symlink + .gitkeep + README) を 1 つに統合する余地あり、その時点で対応可能

### 観察ノート同梱判断

`docs/research/2026-05-15-real-csv-observation.md` は同梱しない (Phase 4 UI-08 完成後の実機検証で初読まれる文書、現時点では未確定)。β-2 PR description の「## 関連」セクションで memory 3 件 (`casio-sr-s4000-z-prefix-reference`, `feedback-pos-vendor-independence`, `feedback-plans-next-session-entry-temporary`) を参照記載。

### Verification

- commit 1: `bash scripts/doc-consistency-check.sh` 19 項目 pass (273 link 全実在、`889b6db` の link 補正成果が β-2 base 上でも維持)
- commit 2: `git check-ignore -v` 3 ケース (CSV ignored / `.gitkeep` negation / README.md negation)
- commit 3: `readlink Plans.md` = `docs/Plans.md` + `git ls-files --stage Plans.md` mode `120000` + symlink 経由 read 成立
- commit 4: `git ls-tree HEAD docs/research/real-csv/` で `.gitkeep` 表示
- commit 5: `git ls-tree HEAD docs/research/real-csv/` で `.gitkeep` + `README.md` 2 件
- pre-push hook 4 段 pass (Rust 変更ゼロで cargo 系 skip、doc-consistency 19 + plan 9 + typedinvoke baseline 0 + env-safety 全 pass)
- ClaudeDesktop wrapper 経由 `docs/Plans.md` read (user 環境で確認、`## Test plan` チェックボックス未チェックで残置)

### Risks (β-2 固有、R1-R10 は §7 で総合管理)

- cherry-pick 失敗の可能性: 実証ベースで確率ゼロ想定 (path 衝突なし)、ただし R9 で緩和策明示
- symlink Windows native 不動作 (`core.symlinks=true` 必要): WSL 運用前提、Windows clone 時は `DEV_SETUP_CHECKLIST §3.3` 追記 (次 PR で対応)
- `doc-consistency-check.sh` Plans.md path hardcode: Phase 1 で grep 0 件確認済、影響なし
- rollback: `git revert <squash-hash>` で 5 commit chain 一括 revert (squash 後は単一 hash)

### マージ後

- archive 不要 (chore PR、active plan 無し)
- Plans.md (実体 = docs/Plans.md) 更新不要 (節目に該当せず、memory `feedback-plans-sync-commit-milestone-only.md` 準拠)

---

## 4. PR #60 詳細 (UI-07 CSV 取込み画面、2 段階、commit 10 削除)

### 段階 A: β-2 マージ前の準備 (現ブランチ `feat/ui-07-csv-import`)

β-1 マージ後に main rebase してから、以下 commit を追加。**commit 10 (Plans.md 編集 docs/Plans.md 移植) は削除** — β-2 マージ後の rebase で main の `docs/Plans.md` にアクセス可能になるので、Plans.md 編集 port は rebase 時に行えば足りる (段階 B B3 に統合)。

#### commit 8: `docs(ui-07): 検証戦略を 合成 fixture 主 + 実 PLU 設定書出し 副 に変更 (active plan + function-design 両方反映)`

- touch:
  - `docs/plans/2026-05-13-phase-2-ui-07.md` (PR #60 active plan の検証セクション全面書き換え)
  - `docs/function-design/55-ui-csv-import.md` (§55.10 テスト方針セクションに検証戦略追記、P2-C 対応)
- 内容 1 (active plan §7.3): Windows native cargo tauri dev 手動 10 項目シナリオ書き換え
  - **合成 fixture 主**: 正常系 6 項目 (3/10 PreviewStep / 4/10 件数 / 5/10 OK commit / 6/10 進捗 / 7/10 SuccessStep / 10/10 ホーム invalidation) は要求仕様書 SP-401-02 + R122 構造から逆算で合成 Z004 売上日報 fixture を作成
  - **実 PLU 設定書出し 副**: 8/10 ErrorStep 検証は手元の実 `Z004_260311PLU(商品).CSV` (PLU 設定書出し = 4231 行全空テンプレ、要求仕様書 R128 異形式エラー扱い、R119 未登録枠除外フロー) で実証
  - **9/10 useBlocker 単独**: 実機データ不要、UI 単独で進行中 navigation block 動作確認
  - **本物 Z004 売上日報での最終確認は Phase 4 UI-08 完了後に持ち越し** (memory `casio-sr-s4000-z-prefix-reference.md` 二態区分通り、PLU 一括登録 → レジ反映 → 1 日運用 → 翌日取得が必要)
- 内容 2 (function-design §55.10): 「Windows native cargo tauri dev での手動 10 項目シナリオ」セクション末尾に小節 `#### 検証データ戦略 (2026-05-15 確定)` を新設、合成 fixture 主 + 実 PLU 設定書出し 副の戦略を 5-10 行で記述、実機 Z004 売上日報持ち越し方針も同小節で明示
- verify:
  - `bash scripts/doc-consistency-check.sh --target plan docs/plans/2026-05-13-phase-2-ui-07.md` 9 項目 pass
  - `bash scripts/doc-consistency-check.sh` 19 項目 pass (link 全実在)

#### commit 9 (条件付き): `feat(ui): 残検証 8/10 で発覚した <X> の修正` or `fix(ui-07): ...`

- 条件: Windows native cargo tauri dev で 8 項目走らせて issue 発覚時のみ
- 失敗 3 件以上なら commit 9a / 9b に分割、5 件以上なら別 PR に切り出し (R3 緩和策)
- LSP/Skills Policy hook 適用 (code 編集前に LSP tool 使用 + `skills-decision.json` update)

#### 旧 plan commit 10 削除の正当化

旧 plan commit 10 は「Plans.md 編集を docs/Plans.md に移植 + next-session-entry 削除」だったが、新設計では:

- β-2 マージ後の rebase 時点で main に `docs/Plans.md` 存在 (β-2 commit 1 = cherry-pick 889b6db 経由)
- PR #60 内の Plans.md 編集 (`007f3a6` / `fedc762` commit に含まれる、Plans.md ルートに edit) は β-2 マージ後の rebase で `Plans.md` が **symlink** に変わってる main と衝突
- 衝突解決方針: rebase 時に Plans.md ルートへの edit を **`docs/Plans.md` 側に port + Plans.md ルートは symlink 状態維持** (実体側に移送するアプローチ)
- 旧 plan commit 10 を独立 commit にする必要性は薄く、rebase conflict resolve の文脈で同時処理する方が手数少ない
- 結果: 段階 A は commit 8 + 条件付き commit 9 までで止め、Plans.md → docs/Plans.md 移植は段階 B B3 で rebase conflict resolve として処理

### 段階 B: β-2 マージ後の rebase + Codex review

| 順 | アクション |
|---|---|
| B1 | β-2 が main にマージされたら `git fetch origin && git rebase origin/main` |
| B2 | rebase 時 PR #60 内 `889b6db` (旧 hash) が main から来た cherry-pick 版と patch 同一 → git は patch-id 比較で自動 skip 想定 (R10 緩和) |
| B3 | rebase 中 PR #60 内 commit `007f3a6` / `fedc762` の Plans.md edit が main の symlink と衝突 (`modify/typechange`) → 解決: 各衝突 commit 内の Plans.md edit を `docs/Plans.md` に port、ルート Plans.md は main 側 symlink を維持: `git checkout --ours Plans.md` (rebase 中の `--ours` は適用先 = main、PR #60 内編集を破棄して main の symlink を残す) → `git add Plans.md docs/Plans.md` → `git rebase --continue`。代替 (symlink が壊れる場合): `ln -sf docs/Plans.md Plans.md && git add Plans.md docs/Plans.md` で WSL 上から symlink 作り直し。**`git rm Plans.md` は禁止** (main の Plans.md symlink まで削除する方向に staging される、PR #60 マージで ClaudeDesktop 統合根本が壊れる、外部レビュー指摘) |
| B4 | memory `feedback-plans-next-session-entry-temporary.md` 適用で L70-95 next-session-entry 削除 + L33 「実機 Z004 売上日報ファイル取得待ち」文言を「Phase 4 UI-08 完成後の実機検証に持ち越し、Phase 2 完了 gate は合成 fixture + 実 PLU 設定書出しの組合せで割り切る」に汎用化 — これは B3 の port と同時に処理 |
| B5 | `git push --force-with-lease origin feat/ui-07-csv-import` |
| B6 | PR #60 description 更新 (`889b6db` が main 経由で吸収されて作業ツリーから消えた旨注記) |
| B7 | Codex review Round 1-3 で close、Round 4+ なら `/plan-rally` 再起動 (memory `feedback-codex-non-blocker-incorporation`, `feedback-codex-drift-fix-grep-all-locations` 適用) |
| B8 | squash merge → main 直 push で post-merge sync (`git mv docs/plans/2026-05-13-phase-2-ui-07.md docs/archive/plans/2026-05-13-phase-2-ui-07.md` + `git mv docs/plans/2026-05-15-pr62-round5.md docs/archive/plans/2026-05-15-pr62-round5.md` 相対パス再リンク + docs/Plans.md sync + memory 軽量監査 + **新規 memory `feedback-github-contents-api-utf8-transcoding.md` 追加**: GitHub `/contents/` API は text file の bytes を UTF-8 transcoding して返す、真の raw blob は `/git/blobs/{sha}` 経由。Codex / 他 review agent が `/contents/` で encoding 判定すると誤判定する罠、PR #62 Round 3-4 で実証) → **2026-05-16 完了**: squash merge `b8db619`、本 plan も同 post-merge sync で `docs/archive/plans/2026-05-15-3-pr-progression.md` へ移送、README L86 cargo run path 誤記 fix + sqlite3 CLI Windows 前提条件補足 + WSL2 `/mnt/c/...` 代替案を併せて同梱 (PR #62 PowerShell 実走で発覚した README bug、scope 内 fix)、memory `feedback-github-contents-api-utf8-transcoding.md` 実体追加完了 |

### Risks (PR #60 固有、R1-R10 は §7 で総合管理)

- B3 Plans.md edit port の漏れ → main HEAD の docs/Plans.md と PR #60 内 Plans.md edit の差分が散逸: 緩和は `git log -p origin/main..HEAD -- Plans.md` で PR #60 内 Plans.md edit 全件 trace + B3 内で全行 port 確認
- 実機 PLU 設定書出しでの異形式検証で parser bug 発覚: 検証用途なので最小 fix 1-2 commit で吸収

### commit 1-7 本文の Plans.md ルート path 参照

**放置** (user 確認済)。squash で最終 1 commit に集約されるため main HEAD では見えない、Codex review は squash 候補を見るので noise にならない。PR description に「旧 Plans.md path 参照は squash で消える」と注記して足りる。

---

## 5. git 操作詳細 (Option C 用、stash 戦略全面書き直し)

### 5.1 推奨アプローチ: stash 退避 + 個別 checkout + cherry-pick

`889b6db` は既に commit 済なので stash 対象外、stash は未 commit 変更のみを対象とする。

#### T0: stash 退避

```sh
git status
# 期待: feat/ui-07-csv-import + 18 modified + 1 typechange + 1 untracked

git stash push -u -m "wip-mixed-beta1-beta2-pr60-2026-05-15"
# stash 対象: β-1 17 files + β-2 4 items (.gitignore + Plans.md typechange + .gitkeep) + PR #60 1 file
# stash 非対象: 889b6db で commit 済の docs/Plans.md (HEAD に既に在る)
```

#### T1: β-1 ブランチ作成 + commit + push

```sh
git fetch origin
git checkout -b chore/path-rename-projects-prefix origin/main

git checkout stash@{0} -- \
    .claude/commands/plan-rally.md \
    .claude/hooks/audit-safety-net.sh \
    .claude/hooks/audit-trigger-phase.sh \
    .claude/hooks/audit-trigger-plan.sh \
    .claude/hooks/check-plan-on-exit.sh \
    .claude/hooks/memory-capture-feedback.sh \
    .claude/hooks/memory-precompact-scan.sh \
    .codex/README.md \
    .codex/bin/list-safe-files.sh \
    .codex/bin/read-safe-file.sh \
    .codex/bin/search-safe-files.sh \
    .codex/execpolicy.rules \
    .codex/rules/default.rules \
    AGENTS.md \
    CLAUDE.md \
    docs/DEV_SETUP_CHECKLIST.md \
    docs/TOOLING_SKILL_COMMANDS.md

git status
rg "kosei/inventory-system" . | rg -v "kosei/Projects/inventory-system"
# 期待: 残 path 0 件

git add -A
git commit -m "chore(env): WSL repo path を /home/kosei/Projects/inventory-system に統一"
git push -u origin chore/path-rename-projects-prefix
gh pr create --title "..." --body "$(cat ...)"
```

#### T2: β-1 マージ前の PR #60 段階 A commit 8 (検証戦略 docs 反映)

β-1 PR がまだマージ前でも、PR #60 段階 A commit 8 は **`feat/ui-07-csv-import` ブランチ上で独立に進められる**:

```sh
git checkout feat/ui-07-csv-import
# HEAD = 889b6db

# stash から docs/plans/2026-05-13-phase-2-ui-07.md の path rename hunk を復元
# (path rename は β-1 と論理的に同種だが main に存在しない file なので β-1 PR には含まない、
#  PR #60 範囲として commit 8 に同梱する必要がある、外部レビュー P2 指摘)
git checkout stash@{0} -- docs/plans/2026-05-13-phase-2-ui-07.md

# docs/plans/2026-05-13-phase-2-ui-07.md §7.3 検証戦略書き換え (path rename + 検証戦略を同 commit で)
# docs/function-design/55-ui-csv-import.md §55.10 検証戦略小節追記 (新規 touch、P2-C 対応)
# (LSP/Skills Policy hook は docs のみで該当外)

git add docs/plans/2026-05-13-phase-2-ui-07.md docs/function-design/55-ui-csv-import.md
git commit -m "docs(ui-07): 検証戦略を 合成 fixture 主 + 実 PLU 設定書出し 副 に変更 + path rename 追従 (active plan + function-design 両方反映)"
git push origin feat/ui-07-csv-import
```

#### T3: β-1 マージ

```sh
git checkout main
git pull origin main
```

#### T4: β-2 ブランチ作成 + cherry-pick 889b6db + commit chain + push

```sh
git checkout -b chore/claude-desktop-integration-real-csv

# (1) cherry-pick で 889b6db を引き取り (commit 1)
git cherry-pick 889b6db
# 期待: clean apply、conflict なし

# commit message に trailer 追加 (Option C 帰属明示)
git commit --amend -m "$(git log -1 --pretty=%B)

Note: β-2 PR boundary 適正化のため feat/ui-07-csv-import から
cherry-pick で移管。原 commit (889b6db) は PR #60 内で作成されたが、
symlink 化 (commit 3) と実体追加が同一 PR にあるべきという外部
レビュー指摘 (P1-A/P1-B) を受け、本 β-2 PR に集約。PR #60 は β-2
マージ後 main rebase で本 commit を main 経由として吸収する。

(cherry picked from commit 889b6dbee2efa1118eeb41418879ec2e877e792c)"

# (2) stash から β-2 用 .gitignore / Plans.md typechange / .gitkeep checkout
git checkout stash@{0} -- .gitignore Plans.md docs/research/real-csv/.gitkeep

# (3) commit 2: .gitignore
git add .gitignore
git commit -m "chore(env): .gitignore に docs/research/real-csv/ ignore + negation 追加"

# (4) commit 3: Plans.md symlink
git add Plans.md
git commit -m "chore(docs): Plans.md ルートを docs/Plans.md への symlink 化 (ClaudeDesktop docs/ 権限対応)"

# (5) commit 4: .gitkeep
git add docs/research/real-csv/.gitkeep
git commit -m "docs(research): docs/research/real-csv/.gitkeep 配置 (実機 CSV 検証用ディレクトリ確保)"

# (6) commit 5: README.md (新規作成、stash 非対象、editor で作成)
# text editor で docs/research/real-csv/README.md を 5-10 行で作成
git add docs/research/real-csv/README.md
git commit -m "docs(research): docs/research/real-csv/README.md 追加 (実機 CSV 検証用ディレクトリ説明)"

# (7) verify
git log --oneline -6
bash scripts/doc-consistency-check.sh

# (8) push + PR open
git push -u origin chore/claude-desktop-integration-real-csv
gh pr create --title "chore: ClaudeDesktop 統合 + 実機 CSV 検証環境整備" --body "$(cat ...)"
```

#### T5: β-2 マージ

```sh
git checkout main
git pull origin main
```

#### T6: PR #60 段階 B rebase

```sh
git checkout feat/ui-07-csv-import
git fetch origin
git rebase origin/main

# rebase 中の挙動想定:
# 1. PR #60 内 commit 889b6db (旧 hash) と β-2 cherry-pick 版 (新 hash) は patch 同一
#    → git rebase は patch-id 比較で自動 skip 想定 (R10 緩和)
#    → 万一 skip されない場合: git rebase --skip で手動 drop
# 2. PR #60 内 commit 007f3a6 / fedc762 の Plans.md edit が main の symlink と衝突
#    → 各 conflict commit で:
#      a. 該当 edit 内容を docs/Plans.md に port
#      b. ルート Plans.md は main 側 symlink を維持:
#         git checkout --ours Plans.md
#         (rebase 中の --ours は適用先 = main、main の Plans.md symlink を残す)
#      c. git add Plans.md docs/Plans.md
#      d. git rebase --continue
#      ※ git rm Plans.md は禁止 (main の symlink まで削除方向に staging される、
#        ClaudeDesktop 統合根本破壊リスク、外部レビュー P1 指摘)
#      ※ 代替 (symlink 壊れた時): ln -sf docs/Plans.md Plans.md && git add Plans.md docs/Plans.md

# 旧 plan commit 10 相当の処理を rebase 内で完結:
# - L70-95 next-session-entry 削除
# - L33 文言汎用化
# - 上記 2 件を最後の conflict resolve 内で docs/Plans.md に反映

git push --force-with-lease origin feat/ui-07-csv-import
```

### 5.2 stash 代替案: worktree

別 worktree で β-1 / β-2 を独立進行する選択肢もある (`git worktree add ../inventory-system-beta1 main`)。本 plan は stash 案を採用 (cherry-pick との組合せで操作回数最小)。

### 5.3 却下案

- `feat/ui-07-csv-import` ブランチで β-1 ファイル混在 commit: scope 混在を branch level で許容、却下
- β-2 を `feat/ui-07-csv-import` から派生: `889b6db` 以外の PR #60 commit も混入、却下

---

## 6. PR description テンプレ

PR template は repo に存在しないため raw 記述。各 PR description 共通構造:

1. `## Summary` (Context + Changes summary)
2. `## Commit chain` (squash 想定の chain list)
3. `## 変更内訳` (ファイル別 touch 詳細)
4. `## Verification` (動作確認手順 + チェックリスト)
5. `## Risks` (副作用 + rollback)
6. `## 関連` (前後 PR + memory 参照)

### β-1 PR description

- `rg` grep 0 件結果を明示、`.claude/settings.local.json` (gitignored) の対応注記

### β-2 PR description (Option C 明示で大幅修正)

- `## Summary` で **`889b6db` cherry-pick 引き取り明示** ("Original commit `889b6db` from `feat/ui-07-csv-import` cherry-picked here as commit 1 to consolidate symlink + docs/Plans.md entity + .gitignore + .gitkeep + README into a single PR boundary, per external review recommendation P1-A/P1-B")
- `## Commit chain` で 5 commit 個別記述 (cherry-pick / .gitignore / symlink / .gitkeep / README)
- `## 変更内訳` で commit 1 の origin trail (889b6db hash) + commit 5 の **README 新規同梱明示** (5-10 行、negation rule との整合説明)
- `## Verification` で `git check-ignore -v` 3 ケース実証 (CSV ignored / .gitkeep negation / README.md negation) + symlink mode verify + ClaudeDesktop wrapper 経由 read 確認チェックボックス未チェック残置
- `## Risks` で R9 (cherry-pick 失敗) / R10 (PR #60 rebase 時の重複検出) 緩和策明示
- `## 関連` で memory 3 件 + 後続 PR #60 への影響注記

### PR #60 description (検証戦略 docs 反映 + 889b6db 吸収注記で修正)

- `## Summary` で **検証戦略 docs 反映先 (active plan §7.3 + function-design §55.10) 明示** (P2-C 対応)
- `## Commit chain` で `889b6db` が β-2 マージ後 main rebase で吸収されて PR #60 作業ツリーから消える旨注記
- `## 変更内訳` で実機 PLU 設定書出しでの異形式検証ロジック (要求仕様書 R128 + R119 引用)
- `## Verification` で 10/10 シナリオ + 検証データ戦略 (合成 fixture 主 + 実 PLU 副) 明示
- `## Risks` で B3 Plans.md edit port 漏れ緩和策明示
- `## 関連` で β-1 / β-2 マージ後の post-merge sync 内訳 + memory 参照

---

## 7. リスクとフォールバック (R9 / R10 追加)

| # | リスク | 確率 | impact | 緩和策 / フォールバック |
|---|---|---|---|---|
| R1 | symlink Windows native 不動作 | 低 | 中 | WSL 運用前提、`core.symlinks=true` 注記を `DEV_SETUP_CHECKLIST §3.3` に追加 (次 PR) |
| R2 | 段階 B B3 Plans.md edit port 漏れ → docs/Plans.md と PR #60 内 edit の差分散逸 | 中 | 高 | `git log -p origin/main..HEAD -- Plans.md` で PR #60 内 edit 全件 trace、B3 内で全行 port 確認 |
| R3 | 残検証 8/10 で 3 件以上 fail | 中 | 高 | commit 9 を 9a / 9b に分割、5 件以上で別 PR 切り出し |
| R4 | Codex review Round 4+ で blocker 反復 | 低 | 中 | `/plan-rally` 再起動、memory `feedback-codex-non-blocker-incorporation` で軽量対応判定 |
| R5 | β-1 マージ前に他 task block | 確実 | 低 | β-1 は 1 day マージ期待、stash 中は別作業可能 |
| R6 | `git stash pop` で conflict | 中 | 低 | 個別 checkout 戦略でリスク最小化、stash は drop 時のみ pop しない |
| R7 | `doc-consistency-check.sh` の Plans.md hardcode | 低 | 高 | Phase 1 で grep 0 件確認済 |
| R8 | `check-plan-on-exit.sh` D-1 hook で本 plan fail | 確実 | 高 | 本セッションで Explore + Plan agent 動かし済、subagent log で D-1 充足 |
| **R9** | **β-2 commit 1 で `git cherry-pick 889b6db` 失敗** | **低 (実証ベース)** | **高** | 緩和策 1: 失敗時 `git cherry-pick --abort` → `git show 889b6db:docs/Plans.md > docs/Plans.md` で working tree 直書き → `git add docs/Plans.md && git commit -m "..."` で依存ファイル無しに取り込み。緩和策 2: 実証ベース確率ゼロ (`889b6db` は `A docs/Plans.md` のみ、main に未存在) |
| **R10** | **PR #60 段階 B rebase 時の `889b6db` 重複検出失敗** | **低-中** | **中** | 緩和策 1: 重複 commit が残ったら `git rebase --skip` で手動 drop。緩和策 2: 複雑化時、**新ブランチを `origin/main` から作る** (例: `feat/ui-07-csv-import-rescue`) + 既存 PR #60 commit を個別 `cherry-pick` で reapply + PR #60 を新ブランチに force-push (`--force-with-lease` 必須、user 明示承認後のみ)。緩和策 3: 同ブランチ上の `git reset --hard origin/main` は **destructive のため user が対象ブランチ名を明示承認した場合のみ実施** (CLAUDE.md 安全ルール準拠、外部レビュー P2 指摘で格下げ)。緩和策 4: 最悪 PR #60 を close → 新ブランチで再 open |

### Codex review fail 対応戦略

memory `feedback-codex-drift-fix-grep-all-locations` 適用: drift 指摘は repo 全体 grep で同種箇所一括修正。Round 1-3 で全 close 目指す。Round 4+ は `/plan-rally` 再起動。各 PR の Round 上限想定:

- β-1: Round 2 (mechanical PR)
- β-2: Round 2-3 (cherry-pick + symlink + ignore negation 順序が指摘候補、README 同梱で 1 件減る可能性)
- PR #60: Round 3-4 (UI 複雑、検証戦略 docs 反映で 1 件減る可能性)

### Rollback 手順

- β-1: `git revert <squash-hash>` で 17 files 一括 revert
- β-2: `git revert <squash-hash>` で 5 commit chain 一括 revert (squash 後は単一 hash)
- PR #60: `git revert <squash-hash>` で UI-07 機能撤退

---

## 8. Critical Files

実装で touch する重要ファイル (絶対パス):

- `/home/kosei/Projects/inventory-system/docs/Plans.md` (β-2 commit 1 cherry-pick で main に取り込み、段階 B B3 で PR #60 内 Plans.md edit を port)
- `/home/kosei/Projects/inventory-system/Plans.md` (β-2 commit 3 で symlink 化、PR #60 段階 B B3 で main 側 symlink を維持 = `git checkout --ours Plans.md`、**`git rm Plans.md` は禁止** — main の symlink 削除に staging されるため)
- `/home/kosei/Projects/inventory-system/.gitignore` (β-2 commit 2、+8 行)
- `/home/kosei/Projects/inventory-system/docs/research/real-csv/README.md` (β-2 commit 5、**新規追加、P2-B 対応で本 plan で初追加**)
- `/home/kosei/Projects/inventory-system/docs/plans/2026-05-13-phase-2-ui-07.md` (PR #60 active plan、段階 A commit 8 で §7.3 検証戦略 rewrite)
- `/home/kosei/Projects/inventory-system/docs/function-design/55-ui-csv-import.md` (PR #60 段階 A commit 8 で §55.10 検証戦略小節追記、**P2-C 対応で新規 touch**)

---

## Self-Review

各観点 100 字以上 + blockquote / 行番号 / memory 参照 必須 (memory `feedback-self-review-mechanical-addition-anti-pattern.md` 準拠)、placeholder hits < 2、DISTINCT_TOKENS ≥ 25。

### 1. Prerequisites

> active な実装プラン（設計合意書 / 実装プラン問わず）は repo 内 `docs/plans/` に置く

memory `feedback-active-plan-in-docs.md` 準拠で本 plan の最終保存先は `docs/plans/2026-05-15-3-pr-progression.md` (ExitPlanMode 後に user が `~/.claude/plans/plan-bright-crescent.md` から移送)。前提依存 (Option C 反映): β-1 マージ後に β-2 着手、β-2 で `889b6db` を cherry-pick 移管、β-2 マージで `docs/Plans.md` + symlink + .gitignore + .gitkeep + README が main に同時取り込まれる、PR #60 は β-2 マージ後 main rebase で `889b6db` を main 経由として吸収、各 PR Codex Round 1-3 close 目標。現セッション起点は `feat/ui-07-csv-import` ブランチ (HEAD = `889b6db`、`git rev-parse HEAD` 実証)、main HEAD `452fe0a` (PR #58 squash、`git rev-parse origin/main` 実証)、PR #60 chain 8 commit `9cba3fa..889b6db`、working tree に β-1 17 files + β-2 3 items (.gitignore / Plans.md typechange / .gitkeep) + PR #60 docs edit (path rename のみ) が混在。本 plan の Plan agent ラリー (Phase 2、再構築 1 round 含む計 2 round) は確定、subagent log `/tmp/claude-1000/-home-kosei-Projects-inventory-system/.../tasks/*.output` に出力されることで D-1 hook 要件充足。関連 memory: `feedback-plans-next-session-entry-temporary`, `feedback-codex-drift-fix-grep-all-locations`, `casio-sr-s4000-z-prefix-reference`, `feedback-pos-vendor-independence`, `feedback-codex-p1-empirical-defense`, `feedback-self-trace-expression-breaks-sync-loop`, `feedback-archive-relative-path-conversion`, `feedback-plans-sync-commit-milestone-only`, `feedback-active-plan-in-docs` の 9 件が本 plan の判断ベースに直接適用される。

### 2. Scripts

> pre-push hook 4 段: cargo fmt --check / cargo clippy -- -D warnings / cargo test / doc-consistency-check 19 + plan 9 + check-typedinvoke-count baseline 0 + check-env-safety

各 PR で `bash scripts/doc-consistency-check.sh` 19 項目 + `--target plan <plan-file>` 9 項目 + `scripts/check-typedinvoke-count.sh` baseline 0 + `scripts/check-env-safety.sh` 全 pass を verify gate に置く。`.git/hooks/pre-push` は src-tauri 変更検出 (`grep 'src-tauri/.*\.rs$\|src-tauri/Cargo'`) で cargo skip 判定するため β-1 / β-2 は Rust 変更ゼロで cargo 系全 skip 期待。PR #60 は段階 A commit 9 (条件付き fix) で Rust touch なら cargo 3 段走る、`npm ci --ignore-scripts` 以外の install 系は禁止 (CLAUDE.md 重要セキュリティルール)、specta 化追加は段階 A commit 9 で発生する可能性あるが現時点では予想なし。LSP/Skills Policy hook は段階 A commit 9 の code 編集前に LSP tool 使用 + `skills-decision.json` update を機械強制、`check-plan-on-exit.sh` hook は本 plan 自体の ExitPlanMode 通過に直結する。β-2 commit 1 の cherry-pick は git 標準操作のみ、追加 hook なし。

### 3. Verification

各 PR の動作確認は §2 / §3 / §4 で commit-by-commit に明示。β-1: `rg "kosei/inventory-system" . | rg -v "kosei/Projects/"` で 0 件 + pre-push 4 段 pass + `ls ~/.claude/projects/-home-kosei-Projects-inventory-system/memory/` で MEMORY.md 実在。β-2 (5 commit 別 verify): commit 1 cherry-pick 後 `bash scripts/doc-consistency-check.sh` 19 項目 pass + commit 2 後 `git check-ignore -v` 3 ケース (CSV / .gitkeep / README.md negation) + commit 3 後 `readlink Plans.md` = `docs/Plans.md` + `git ls-files --stage Plans.md` mode `120000` + commit 4 後 `git ls-tree HEAD docs/research/real-csv/` で `.gitkeep` 表示 + commit 5 後 `wc -l docs/research/real-csv/README.md` で 5-10 行 + user 環境で ClaudeDesktop wrapper 経由 docs/Plans.md read。PR #60: Windows native cargo tauri dev で **合成 fixture (要求仕様書 SP-401-02 + R122 構造逆算) で正常系 6 項目 + 実 PLU 設定書出し (`Z004_260311PLU(商品).CSV`、要求仕様書 R128 異形式 + R119 未登録枠除外フロー) で異常系 1 項目 + UI 単独で useBlocker 1 項目 = 8/10 検証**、残 2/10 (1/10 ファイル選択 + 2/10 SJIS/UTF-8 読み込み) は drag&drop 経由で再現済、本物 Z004 売上日報での最終検証は Phase 4 UI-08 完成後に持ち越し (memory `casio-sr-s4000-z-prefix-reference.md` 二態区分通り、user 店舗で PLU 未登録のため Z004 売上日報は全空テンプレで取り込み価値ゼロ)。

### 4. Post-processing (Option C 帰属事実明示で P1/P2 整合性最終確認)

> プラン archive: docs/plans/<name>.md → docs/archive/plans/<name>.md (memory feedback-archive-relative-path-conversion 適用)

各 PR マージ後の post-merge sync 内訳: (i) docs/Plans.md (β-2 マージ後は main にあり、symlink 経由でルート Plans.md からも read) の Active Tasks 該当 entry を `[x]` 化 + squash merge hash 記録 (ii) Next Session Entry Point を memory `feedback-plans-next-session-entry-temporary.md` 準拠で一時メモ削除 + 汎用化された判断軸のみ残す (iii) active plan archive 移送 (PR #60 (UI-07) は 2 本 = `2026-05-13-phase-2-ui-07.md` + `2026-05-15-pr62-round5.md` (Round 5 対応 plan)、β-1 / β-2 は active plan 持たない chore PR): `git mv docs/plans/<name>.md docs/archive/plans/<name>.md` + 相対パス再リンク (memory `feedback-archive-relative-path-conversion.md` 適用で `../../research/...` 形式に変換、doc-consistency R3 fail 回避) (iv) memory 軽量監査 (`.last_audit` touch、30 日閾値 reset) + **新規 memory `feedback-github-contents-api-utf8-transcoding.md` 追加** (GitHub `/contents/` API の text auto-transcoding 罠、PR #62 Round 3-4 で実証、本 PR Track 3 で memory 化)。本 plan 自体は PR #60 マージと同時に `docs/plans/2026-05-15-3-pr-progression.md` から `docs/archive/plans/2026-05-15-3-pr-progression.md` へ移送。**`889b6db` の帰属事実 (P1-A/P1-B 解決)**: 本 commit は `feat/ui-07-csv-import` で 2026-05-15 19:19 に作成された Pre-T hot fix であり、β-2 で cherry-pick によって main 経由で吸収される。PR #60 段階 B rebase 時に `889b6db` (旧 hash) は patch-id 比較で main 上の cherry-pick 版 (新 hash) と同一判定され、自動 skip 想定。これにより PR #60 作業ツリーから `docs/Plans.md` 新規 add commit は消え、PR #60 内 Plans.md edit (`007f3a6` / `fedc762` 内) は段階 B B3 で `docs/Plans.md` 側に port + Plans.md ルートは symlink (β-2 commit 3 由来) accept する形で rebase clean 達成。

### 5. Constraints (cherry-pick hash 変更を P1/P2 修正要件と整合させた明示)

> CLAUDE.md 重要セキュリティルール（緊急、2026-05-13〜）: npm install / npm i / npx <package> / shadcn add 禁止

Mini Shai-Hulud worm 緊急対応 (PR #60 commit `fedc762` で導入) により npm install 系凍結中、本 plan の全 verify 手順で `npm ci --ignore-scripts` 以外の install 系は使わない (現状必要なし、Rust 側 / docs 側 / 設定側のみ touch)。LSP/Skills Policy hook は code 編集前 (PR #60 段階 A commit 9 のみ該当) に LSP tool 使用 + `skills-decision.json` update を機械強制、本 plan の Plan mode 中は read-only なので適用外、ExitPlanMode 後の実装フェーズで該当 commit で適用。本セッションで使用した skill は `/plan-rally` (D-1 hook 要件、本 Plan agent log で satisfies)。hook 制約: `check-plan-on-exit.sh` は本 plan に対して doc-consistency-check --target plan 9 項目 + Self-Review 見出し + 観点深さ 100 字 + placeholder < 2 + DISTINCT_TOKENS ≥ 25 + D-1 ラリー要件を機械検証、fail 時は permissionDecision deny で block。**cherry-pick による commit hash 変更 (P1/P2 修正の構造的根拠)**: git の commit hash は (tree + parent + author + author date + committer + committer date + message) を SHA-1 化して決定論的に生成される。`889b6db` の parent は `fedc762` (PR #60 内)、β-2 cherry-pick 版の parent は β-1 squash commit (main 上) または β-2 commit chain 内の前 commit、つまり parent が異なるため hash は必ず変わる。一方 git rebase は patch-id (commit の diff content の SHA-1) で重複検出するため、hash が異なっても patch 同一なら自動 skip 可能 (R10 緩和策 1 の根拠)。この仕組み理解が R9 (cherry-pick 失敗時 `git show 889b6db:docs/Plans.md > docs/Plans.md` 代替) と R10 (rebase 重複検出) 両方の設計根拠。

### 6. Commit Split

> β-1: 1 commit / β-2: 5 commit chain (cherry-pick + .gitignore + symlink + .gitkeep + README) / PR #60: 既存 8 + 段階 A 1-2 commit + 段階 B 0-N commit

各 PR の commit 粒度は §2 / §3 / §4 で確定。β-1 は 1 commit (`chore(env):` prefix、17 files 全部 mechanical、squash 想定なので 1 commit でも chain でも main HEAD では 1 commit)。β-2 は 5 commit chain (`chore(plans): cherry-pick 889b6db` / `chore(env): .gitignore` / `chore(docs): Plans.md symlink` / `docs(research): .gitkeep` / `docs(research): README.md`) で Codex review 観点で cherry-pick origin + symlink 操作 + ignore ルール + 構造保証 + 説明文書を独立検証可能。PR #60 は既存 8 commit (`docs(ui-07):` / `feat(cmd):` / `feat(ui):` × 3 / `chore(ui-07):` / `chore(security):` / `fix(plans):` 889b6db) + 段階 A `docs(ui-07):` 検証戦略 (active plan + function-design 両方反映) + 条件付き `fix(ui-07):` + 段階 B rebase 後の Plans.md port (commit ではなく rebase 内処理)。message prefix は過去 PR #56-#59 (`chore(codex) + docs(dev-setup) + fix(codex)` 等) と整合、kebab-case branch 命名と組合せで commit message scope を明示。全 PR squash merge 前提、コミット chain は最終 1 commit に集約され rebase 中の中間 commit log は失われるが PR description に chain trace を残す (memory `feedback-self-trace-expression-breaks-sync-loop` 準拠で docs sync ループ回避のため最新機能修正 commit と docs sync を分離表記)。

### 7. Risk / Fallback (R9 / R10 追加で P1/P2 修正対応)

> R9 cherry-pick 失敗 / R10 PR #60 rebase 重複検出: 共に Option C 採用に伴う新規リスク、§7 で確率 / impact / 緩和策明示

§7 で R1-R10 リスク 10 件を確率 / impact / 緩和策 / フォールバックで明示。最重要 R2 (B3 Plans.md edit port 漏れで rebase 後散逸、緩和: `git log -p origin/main..HEAD -- Plans.md` 全件 trace + B3 全行 port 確認)、R3 (実機 PLU 設定書出し検証 3 件以上 fail で commit 9 肥大化、緩和: 9a / 9b 分割 / 5 件以上は別 PR 切り出し)、R8 (本 plan の D-1 hook fail、緩和: 本セッションで Explore + Plan agent ラリー 2 round 実行済で subagent log 充足)。**R9 / R10 (P1/P2 修正に伴う新規)**: R9 は β-2 commit 1 cherry-pick 失敗時のフォールバックとして `git cherry-pick --abort` + `git show 889b6db:docs/Plans.md > docs/Plans.md` で working tree 直書きを採用、依存ファイル無しで取り込める (`889b6db` が `A docs/Plans.md` のみで実体だけ抜き出せば等価)。R10 は PR #60 rebase 時 cherry-pick で hash が変わるが patch-id は同一、通常 git は patch-id 比較で自動 skip するが万一 skip されない場合 `git rebase --skip` で手動 drop、複雑化時は **新ブランチを `origin/main` から作成** (例: `feat/ui-07-csv-import-rescue`) + 既存 PR #60 commit を個別 cherry-pick で reapply + PR #60 を新ブランチに force-push (`--force-with-lease` 必須、user 明示承認後のみ)。同ブランチ上の `git reset --hard origin/main` は destructive のため user が対象ブランチ名を明示承認した場合のみ実施 (CLAUDE.md 安全ルール準拠)。Codex review Round 上限想定: β-1 Round 2 / β-2 Round 2-3 (README 同梱で P2-B 1 件減る可能性) / PR #60 Round 3-4 (検証戦略 docs 反映で P2-C 1 件減る可能性)、Round 4+ なら `/plan-rally` 再起動。

### 外部レビュー P1/P2 指摘 5 件への対応最終確認

| 指摘 | 内容 | 修正箇所 | 確認 |
|---|---|---|---|
| **P1-A** | β-2 で docs/Plans.md が無い状態でも symlink 化する帰属破綻 | §3 β-2 commit 1 で `889b6db` を cherry-pick 移管、docs/Plans.md 実体を β-2 同 PR に取り込み | ○ commit 1 で実体 + commit 3 で symlink、同 PR 内整合 |
| **P1-B** | Plans.md symlink 化が PR #60 と β-2 に二重またがり | §3 β-2 で symlink + 実体 + .gitignore + .gitkeep + README を 1 PR 集約、PR #60 から `889b6db` は rebase で main 経由吸収 | ○ §4 段階 B B1-B3 で吸収プロセス明示 |
| **P2-A** | stash 手順が commit 済 `889b6db` を扱えない | §5 T0 で stash 対象が未 commit 変更のみと明示、T4 で cherry-pick による移管手順を採用 | ○ §5 T4 操作で cherry-pick が stash 経路と独立、§5.1 T0 で stash 非対象を明記 |
| **P2-B** | .gitignore README.md negation の存在/非存在不整合 | §3 β-2 commit 5 で README.md (5-10 行) を新規追加、negation rule (commit 2) と整合 | ○ §3 commit 5 で実体追加、§8 Critical Files に追加 |
| **P2-C** | 検証戦略の docs 反映不足 (active plan + function-design 両方) | §4 段階 A commit 8 で active plan §7.3 + function-design §55.10 両方更新 | ○ §4 commit 8 で active plan + function-design 両 file touch、§8 Critical Files に function-design 55 追加 |

5 件全て修正対応完了、本 plan で整合性破綻なし。
