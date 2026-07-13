# Phase 2 8-1 UI-00 commit 4-5 — 再開ガイド (Plan agent 四重再点検反映版 + Step 0a-1 完了、外出し版)

> 本ファイルは `~/.claude/plans/phase-2-immutable-adleman.md` (Plan mode 一時 plan) の外出し版。memory `feedback-active-plan-in-docs.md` (active plan は docs/plans/) 準拠。実プラン本体は `docs/plans/2026-05-09-phase-2-ui-00-commit-4-5.md` (Step 1-11 + Self-Review 7 観点記載済)。本ファイルは Plan agent 4 段ラリー再点検結果による親プラン補正 + Step 0a/0b/0c (Self-Review hook 強化 + Plan レビューラリー仕組み化) 追加 + Self-Review §1〜7 の連動更新を記録する。

## 外出し時点 (2026-05-09) の進捗状況

**完了済み (前セッション)**:
- Plan agent 4 段ラリー (`aa1f2cd32bb596613` → `aee470711f0415c29` → `aca578f0f9e1ce167` → `a35f4c603a47ee799`) で B-1〜B-10 + Self-Review 反映漏れ + D 拡張連動 + 二次 drift 計 35 件発見・反映
- 外部調査 (`a2a2eac9c9841b0a2`) で Anthropic 公式 docs 評価 → 段階導入確定 (第 1 段階 = D-1 hook + D-2 `/plan-rally` skill / 第 2 段階 = 案 C 自動 loop は Backlog)
- **commit `e0c5365`** `chore(hooks): enforce Self-Review content depth + Plan rally requirement before ExitPlanMode` — `.claude/hooks/check-plan-on-exit.sh` +109/-2、A 内容深さ検証 + D-1 直近 agent log check 実装
- **Pre-Flight Test pass**: 本プラン自身で hook 直接実行 → 4 段全通過 (整合 / Self-Review 見出し / 内容深さ / ラリー要件) 確認済
- **Plans.md Backlog 追加**: 「Plan レビューラリー仕組み化 第 2 段階 (案 C 自動 loop)」を Backlog セクションに追加

**残作業 (次セッションで Auto mode 実行)**: Step 0a-2 → 0a-3 → 0c → 2 → 2.5 → 3 → 4 → 5 → 5.5 → 6 → 7 → 8 → 9 → 10 → 11

**次セッション開始時のオペレーション**:
1. `/clear` 後、Plan mode で本ファイル (`docs/plans/2026-05-09-phase-2-ui-00-rally-and-resume.md`) を入口として参照
2. ExitPlanMode 経由で再 approve (新 hook の D-1 ラリー要件 check は本セッションの 4 段 agent log が 30 分超で expire してる可能性あり → 必要なら次セッションで Plan agent 1 段だけ追加実行で再点検 = `/plan-rally` 仕組み化の予定動作の実証)
3. Auto mode で Step 0a-2 から実行開始

**context 警戒**: 本セッション >300k で外出し (memory `context-size-quality-threshold.md`)、次セッションでは clear 状態から再開するため再レビュー前提。

## Context

前セッションで commit 0-3 (specta 化 4 commands + 53-ui-home.md 関数設計 + query-keys.ts + Step 0 hook 改修) と Step 1 (Windows native 環境構築 + 日本語 IME インライン入力動作確認) 完走。HEAD `7770a20` clean。今セッションで **Step 0a → Step 11** を実行し UI-00 ホーム画面を完成させる。Phase 2 (毎日使う 5 画面) の最初のフェーズ。

本セッションでは Plan agent を 4 段階で投入:
- **第 1 段** (`aa1f2cd32bb596613`): 親プラン本体を再点検し B-1〜B-10 の 10 件補正抽出
- **第 2 段** (`aee470711f0415c29`): Self-Review §1〜7 の Step 0a/0b/0c 反映を点検し「7 観点中 4 完全欠落・3 不足」を発見 → 改善案 B + sandbox 制約事前確認 C + 最小追記 D を取得
- **第 3 段** (`aca578f0f9e1ce167`): D 拡張 (`/plan-rally` skill + D-1 hook deny + 案 C Backlog) 連動更新漏れ 10 観点・完全欠落 3 / 不足 7 発見、12 Edit ペア提案
- **第 4 段** (`a35f4c603a47ee799`): 12 ペア反映後の二次 drift 機械的再点検、収束判定 (needs revision = 機械的訂正 6 ペア、第 5 段不要)

四者を反映して本ファイル全面書き直し。pre-flight 失敗 (= D 拡張連動 drift) で第 3 段ラリーが発動した経緯は §「Step 0b」#3 の趣旨そのもの。

## Plan agent 第 1 段で確定した親プラン補正事項 (B-1〜B-10)

| ID | 補正内容 | 反映 Step |
|---|---|---|
| **B-1** | **pre-push hook は条件付き個別実行**: `scripts/pre-push.sh:39,80,95,108` で ① fmt/clippy/test = `src-tauri/.*\.rs\|Cargo` 変更時のみ / ② doc-consistency = `docs/function-design/.*\.md\|FUNCTION_DESIGN.md` 変更時のみ / ③ typedinvoke = `src/.*\.(ts\|tsx)\|typedinvoke-baseline.txt` 変更時のみ / ④ env-safety = `\.env\|\.gitignore` 変更時のみ。本セッション commit 4-5 は ts/tsx 変更のみ → ③ + 53-ui-home.md 更新で ② が走る。Rust 検証 (① 相当) は Step 5 で **先に** 通す必要 | Step 5 / Step 8 |
| **B-2** | **test 数の baseline 不確定**: 親プラン `L215` の 561 は古い。直近 commit (`7770a20` / `5a5f2fa` 等) で増えた可能性 (Plan agent 推定 599)。Step 5 最初に `cd src-tauri && cargo test 2>&1 \| tail -3` で実測確定 | Step 5 冒頭 |
| **B-3** | **Step 2.5 を独立**: `VITE_MOCK_MODE` 確認を Step 2 末尾の前倒しから Step 2.5 に格上げ。`src/lib/env.ts:13` で `isMockMode` 定数のみ存在、hook 内分岐コード未実装が確認済 → Step 6 fallback は **Plan B (DB 一時 rename)** ロック | Step 2.5 新設 |
| **B-4** | **Step 5.5 中間 push 追加**: Windows 側で `git pull` するため Step 6 着手前に branch を remote に同期する必要。Step 5 自動検証緑後・Step 6 着手前に `git push origin feat/ui-00-home` を Step 5.5 として明記 (PR open はしない、`-u` 不要、force なし) | Step 5.5 新設 |
| **B-5** | **rebase 判定手順具体化**: `git fetch origin && git log --oneline HEAD..origin/main && git log --oneline origin/main..HEAD` の 3 コマンドセット。main 進行があれば `git rebase origin/main`、conflict は resolve → continue。Step 5.5 と Step 8 双方で実施 | Step 0c / Step 5.5 / Step 8 |
| **B-6** | **LSP getDiagnostics の uri 指定形式**: `mcp__ide__getDiagnostics` は uri 省略時 WorkspaceDiagnostics、ファイル単位は `file:///home/kosei/inventory-system/src/features/home/<path>` 形式で指定。Write 前 baseline = uri 未指定、Write 後 = ファイル URI 指定で差分検証 | Step 3 / Step 4 |
| **B-7** | **Step 6 部分障害シミュレーションは Plan B 一本化**: `move %APPDATA%\com.kosei.inventory\inventory.db inventory.db.bak` で `getDailySales` 等を失敗させ、4 useQuery が独立して error 表示することを目視確認。**Chrome DevTools Network throttle は Tauri webview の IPC 経路に効かない** (Plan agent が確認)。検証後復旧 | Step 6 |
| **B-8** | query-keys.ts と bindings.ts の specta 整合 **OK** (`src/lib/query-keys.ts:15-16` の `(page, perPage)` と `bindings.ts:26` で確認済)。追加対応不要 | — |
| **B-9** | **引き継ぎ 8 残課題のスコープ分類**: 本セッション内で対処 = `VITE_MOCK_MODE` 確認 (B-3) / Windows native 解消 (Step 1 完了済) / bindings drift 確認 (Step 5)。Step 11 memory 監査までデファー = PowerShell 表示 / VS 2022 path / vswhere / Node 整合 / autocrlf / Windows seed `--db` / package-lock libc / Plan モード再入り | Step 11 |
| **B-10** | **navigation.ts の正しいパスは `src/config/navigation.ts`** (前 plan で `src/lib/navigation.ts` と誤記)。`ActionButton.tsx` の import は `import { navigation } from "@/config/navigation"` | Step 3 |

## Plan agent 第 2 段で確定した sandbox 制約事前確認 (C 結論)

| 項目 | 結果 |
|---|---|
| `/home/kosei/.claude/hooks/check-plan-on-exit.sh` の存在 | **不在** (`/home/kosei/.claude/hooks/` ディレクトリ自体が存在しない) |
| 実体 path | **`/home/kosei/inventory-system/.claude/hooks/check-plan-on-exit.sh`** (project-relative) |
| `~/.claude/settings.json` 編集可否 | **不可** (sandbox writable 外) → 編集必要なら user 操作 |
| project `.claude/settings.json` 編集可否 | **可** (cwd 配下 = sandbox writable)、`L46-51` で ExitPlanMode hook 登録、`L60-65` で PostToolUse:Write\|Edit\|MultiEdit |
| project `.claude/hooks/*.sh` 編集可否 | **可** |
| 現行 hook 欠陥箇所 | `.claude/hooks/check-plan-on-exit.sh:60-61` の `^##\s+(Self-Review\|セルフレビュー)` grep -cE — **見出し存在のみ検証** が確定 |

**結論**: Step 0a は **project 側 `.claude/hooks/` + project `.claude/settings.json` のみ編集で完結可能**。global は触らない。

## 実行ステップ (補正版 + Step 0a/0b/0c 追加)

実プランは `docs/plans/2026-05-09-phase-2-ui-00-commit-4-5.md` 参照。本ファイルは補正点を反映した上書き手順。

### Step 0a — Self-Review hook 強化 + Plan レビューラリー仕組み化 (新規、user 判断「今先に対処」+「ラリー仕組み化」反映)

**根本問題認識** (user 指摘 turn 6: 「俺が指摘してやっと気づいたんや君は。まずいわれなれなきゃ気づくことすらなく」):
- Claude は自己 bias に気付けない、ユーザー指摘待ちでは仕組み回らない
- memory ルール load されても私の bias で迂回しうる (今 session で 2 度発生)
- **設計原理**: Claude 自主判断は信頼しない、機械的強制でしか質担保できない
- 既存 PreToolUse:ExitPlanMode hook (`check-plan-on-exit.sh:60-61`) は見出し検証のみで Self-Review 内容空虚を許す欠陥
- → Codex PR レビュー往復のプラン版「Plan レビューラリー」を仕組みとして導入、ExitPlanMode 前に subagent 投入を**機械的に強制**する

memory `feedback-memory-rule-needs-hook-enforcement.md` (hook で deny block する設計に倒す) の趣旨を、Self-Review hook 自体に再帰適用 + ラリー仕組み化で外殻を覆う二重防御。

実装内容 (A 内容深さ検証 + C diff 監視 + **D Plan レビューラリー強制** 採用、user 判断):

1. **現行 check-plan-on-exit.sh 読み込み + 拡張案確定**
   - **対象 path** (Plan agent C 確認): `/home/kosei/inventory-system/.claude/hooks/check-plan-on-exit.sh` (project-relative、global 配下には存在しない)
   - **欠陥箇所**: `:60-61` の `^##\s+(Self-Review|セルフレビュー)` grep -cE で見出し存在のみ判定、`HAS_SELF_REVIEW=0 && HAS_EXEMPTION=0` で deny (`:65`)
   - **拡張ロジック設計**:
     - **A: 内容深さ検証** = Self-Review セクション内の各観点 (1-7) で次のいずれかを必須化:
       - `>` blockquote (本文引用)
       - 行番号参照パターン (`LNNN` / `:NN-NN` / `§NN.N`)
       - memory ファイル名参照 (`` memory `....md` ``)
       - + 最低 100 文字以上の本文
     - 違反は deny block + メッセージ「Self-Review 観点 X に具体引用 / 行番号 / memory 参照が不足、機械的見出し追加の疑い」
     - **C: diff 監視** = `PostToolUse:Edit` で plan ファイル変更検出時に `git diff --unified=0` 解析。`+` 行が `## Self-Review` 配下のみで他セクション無変更なら additionalContext で warning (block ではない、ヒント注入)

2. **hook 拡張実装** (Bash script 編集、project 側完結)
   - `.claude/hooks/check-plan-on-exit.sh` 拡張: 既存 `:60-65` の見出し検出直後に、本文 depth 検証ブロックを追加
     - section 抽出: `awk '/^## (Self-Review|セルフレビュー)/{flag=1;next}/^## /{flag=0}flag' "$PLAN_FILE"`
     - 各観点ヘッダ分割: `### [1-7]\.` or `### \d+\. `
     - 各観点で `grep -E '^>|L[0-9]+|§[0-9]|memory \`.*\.md\`'` のいずれか **AND** `wc -m` ≥ 100
   - 必要なら `.claude/hooks/post-edit-plan-monitor.sh` 新規 (C 用)、project `.claude/settings.json:60-65` の既存 PostToolUse hook 配列に追加 (現状 `audit-trigger-plan.sh` 1 件のみ)
   - **`~/.claude/settings.json` は触らない** (sandbox writable 外、project hook 登録で十分)
   - LSP/Skills Policy hook (memory `feedback-lsp-skills-policy-hook.md`): shell script (.sh) は明文化されてないが code 扱いで baseline diagnostics → Edit → URI diagnostics の 3 ステップ適用

3. **D: Plan レビューラリー仕組み化** (新規、user turn 6 「ラリー仕組み化」要請反映)

   **目的**: ExitPlanMode 前に subagent 投入を機械的に強制し、Claude 自主判断 (= 言われないと気付かない bias) を仕組みで補う

   **3-1. スラッシュコマンド `/plan-rally`** (A 案、project 版)
   - 配置: `.claude/commands/plan-rally.md` (project 配下、本リポジトリで版管理、user global `~/.claude/commands/` は sandbox writable 外で不可)
   - 内容: frontmatter + prompt
     - 引数: `--rounds N` (default: 2)、`--agent {plan|general-purpose}` (default: plan)、`--converge {new-findings-zero|max-rounds}` (default: new-findings-zero)
     - 実行フロー: (a) 直近 plan ファイル特定 (find + stat -c %Y で `~/.claude/plans/` and `docs/plans/` 走査) → (b) Plan agent 起動 (read-only) → (c) 結果整理 (新規指摘 / 既知指摘の差分) → (d) Claude が plan 修正 → (e) 新規指摘 0 まで戻る or max rounds 到達で終了
   - 利用想定: ユーザーまたは Claude が ExitPlanMode 前に明示呼出。`/plan-rally` 実行で 1 ラウンド以上のラリー completion log が生成 → D-1 hook check が pass する

   **3-2. PreToolUse:ExitPlanMode hook で「ラリー未実施なら deny」** (B 案)
   - 既存 `check-plan-on-exit.sh:60-65` の拡張 (A 内容深さ検証の後) に **D-1 check** 追加:
     - 直近 30 分以内 (調整可) の `/tmp/claude-1000/<session>/tasks/*.output` を `find -mmin -30` で取得
     - 各 output の先頭 metadata から `subagent_type` フィールド抽出 (jq or grep)
     - `subagent_type` が `Plan` or `general-purpose` and prompt に「plan critique」「plan review」「再点検」「整合性」のいずれか keyword 含むものが 1 件以上ある？
     - 0 件なら deny + メッセージ: 「Plan レビューラリー未実施です。`/plan-rally` を実行するか、Plan/general-purpose agent で plan 本体を critique させてから ExitPlanMode 再呼出してください」
   - ダミー agent 起動の穴対策: prompt keyword 検査で「plan 本体を読んだ critique」と判定可能な内容のみ pass

   **3-3. 検証** (Step 0b への追加項目)
   - test dummy plan で D-1 check も deny block されることを確認 (recent agent log なし状態を作る or temp env で hook 単体実行)
   - 本ファイル `phase-2-immutable-adleman.md` では Plan agent 第 1〜4 段 (`aa1f2cd32bb596613` / `aee470711f0415c29` / `aca578f0f9e1ce167` / `a35f4c603a47ee799`) の log が存在 → pass 想定

   **3-4. 外部調査結果反映** (claude-code-guide subagent `a2a2eac9c9841b0a2` 完了)

   公式 docs ベースで確定した事項:
   - **Agent Teams** ([code.claude.com/docs/en/agent-teams](https://code.claude.com/docs/en/agent-teams)) は実装後 PR review 向け、Plan mode に直接適用不可
   - **PreToolUse:ExitPlanMode hook で deny は可能** ([code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks))。`permissionDecision: "deny"` + `permissionDecisionReason` で誘導可能
   - **hook 内から subagent 起動は不可** (Bash script では agent tool 呼出 CLI のみ) → D-1 は「直近 agent log の存在確認 → deny」方式が正解 (私の当初案と一致)
   - **slash command は `.claude/skills/<name>/SKILL.md`** が公式 (legacy `.claude/commands/` も対応)。**自動反復不可**、1 invocation = 1 round、ユーザー手動再呼出が現実的
   - **claude-code-harness** ([github.com/Chachamaru127/claude-code-harness](https://github.com/Chachamaru127/claude-code-harness)) は "separating doer from judge" pattern を実装、ただし **plan 自体の multi-round review なし** (Plan → Work → Review cycle で plan は固定)

   外部調査の 3 案評価:
   - **案 A** (低コスト、Claude/user 自主判断依存高) = PreToolUse hook deny + `/plan-rally` slash command。**= 私の D-1 + D-2 と一致**
   - **案 B** (高コスト、experimental) = Agent Teams lead + 3 critic teammates、`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` 必須、token 3× → **却下** (本番不向き)
   - **案 C** (中コスト、自動強制力高、推奨) = `plan-critic` subagent (read-only) + ExitPlanMode hook で JSON parse → 指摘件数 > 0 で deny → 収束まで loop。`.claude/agents/plan-critic.md` + `.claude/hooks/validate-plan-on-exit.sh` 新規。Agent Teams experimental 不要、既存 hook/subagent 機構の組合せ

   **段階導入方針** (本プラン採用):
   - **第 1 段階** (本 PR Step 0a 内): D-1 (hook deny で agent log 確認) + D-2 (`/plan-rally` skill 形式) を実装。低コスト + 即時、ユーザー/Claude が `/plan-rally` 呼出 → Plan agent 起動 → critique → 本人修正 → ExitPlanMode 再呼出のフロー
   - **第 2 段階** (別 PR Backlog 化): 案 C `plan-critic` subagent + JSON parse 自動 loop。本 PR スコープ外、Plans.md Backlog に追加 (本ファイル §「次セッション・継続時の memory 保存候補」末尾参照)

   **slash command 配置場所訂正** (3-1 修正): `.claude/skills/plan-rally/SKILL.md` 形式が公式推奨 (legacy `.claude/commands/plan-rally.md` も動く)。本プロジェクトで `.claude/skills/` 既存運用 (claude-code-harness skill 群) があれば skill 形式に統一、なければ user 判断。Step 0a 着手時に project の skill 配置慣習を確認

   **想定落とし穴と対策** (claude-code-guide §E):
   - hook timeout 超過 (subagent 60s 超え) → `maxTurns: 3` + 指摘 5 件上限
   - 収束ループ無限化 (ユーザーが修正放棄) → deny message に「修正して ExitPlanMode 再実行」明示
   - critic agent 自身の bias → 7 観点枠組みを JSON schema で型注入
   - false positive → "reject only if fundamentally flawed" + warn-only mode オプション
   - token cost 蓄積 → `max-plan-review-rounds: 3` config 化

4. **memory 保存** (Step 0a 内で即時実施、ExitPlanMode 通過直後)
   - `feedback-self-review-mechanical-addition-anti-pattern.md` 新規 (Critical エリア): 「Self-Review hook の見出し追加だけ通過は即 reject 対象」。Why: hook が見出し存在のみ検証で内容空虚な通過を許す欠陥が露呈、本セッション turn 1 で私 (Claude) が機械的 7 観点見出し追加で通過 → user reject (「プランの見直しした？」) → Plan agent 投入で 7 観点中 4 完全欠落発見の再現。How to apply: ExitPlanMode 前に Self-Review 各観点を `>` blockquote / 行番号 / memory 参照のいずれか + 100 字以上で書く、形式的見出しのみは即座に内省して再生成、本文追加が発生したら Self-Review §連動更新、独立 context の subagent (Plan or general-purpose) 委託で bias 排除
   - `feedback-plan-mode-recursive-refinement.md` 新規 (Critical エリア): 多発失敗 / context 大 / hook 通過に違和感ある時は Plan agent で plan 本体を再点検する習慣。Why: 今セッション Plan agent 第 1 段で B-1〜B-10 の 10 件、第 2 段で Self-Review 反映漏れ 7 件を発見した実績、私の bias で見落としていた重大事項を独立 context が拾った。How to apply: Plan mode 中に hook 通過に違和感を感じたら Plan/general-purpose agent で本体再点検 → 結果反映 → ExitPlanMode、再点検なしの ExitPlanMode 即試行は前回失敗の再現
   - `feedback-claude-self-bias-blind-spot.md` 新規 (Critical エリア、user turn 6 反映): Claude は自己 bias に気付けない、ユーザー指摘待ちでは仕組みが回らない。Why: 本セッションで 2 度「気付け」と言われてようやく対応した事実、memory ルール load されても bias で迂回した実例。How to apply: 設計原理として「Claude 自主判断は信頼しない、機械的強制 (hook deny / slash command の強制呼出 / pre-condition gate) でしか質担保できない」を前提に仕組み設計、運用依存の運用は採らない、reminder では足りない
   - `feedback-plan-rally-required-before-exit.md` 新規 (Critical エリア): Codex PR レビュー往復のプラン版、ExitPlanMode 前に Plan agent ラリーを機械的に強制。Why: 「自主判断 + reminder」では今 session のように Plan agent 投入のタイミングを Claude が誤る、user 指摘で初めて回る non-自律仕組み。How to apply: hook で「直近 N 分以内に Plan/general-purpose agent の plan critique log がない場合 deny」を実装、`/plan-rally` スラッシュコマンドで標準フロー定義、収束 (新規指摘 0) まで反復
   - `MEMORY.md` 索引更新 (Critical エリアに 4 行追記)

commit 分割 (Plan agent 第 2 段 §7 + D 拡張反映 + 本セッション第 5/6 段ラリーで 0a-1b 追加 / 0a-3 skip 判定):
- commit 0a-1 (hook 拡張): `chore(hooks): enforce Self-Review content depth + Plan rally requirement before ExitPlanMode`、対象 = `.claude/hooks/check-plan-on-exit.sh` (A + D-1) + (C 採用なら) `.claude/hooks/post-edit-plan-monitor.sh` 新規 + `.claude/settings.json` (project 側のみ)
- **commit 0a-1b** (本セッション追加、E-1 + E-2 統合修正): `chore(hooks): fix D-1 to follow symlinks and match attributionAgent log format`、対象 = `.claude/hooks/check-plan-on-exit.sh` 計 2 行 (L165 find -L 追加 + L172 grep pattern `(subagent_type|attributionAgent)` 両対応)。Plan agent 第 5 段 `af3abd4dd5cd7b00a` で E-1 (grep pattern が attributionAgent と不一致 = 旧 grep 0 件マッチで deny 確定) + 第 6 段 `a1e6db6d0ec5e40d8` で E-2 (find -type f が POSIX 仕様で symlink 除外、Claude Code task output は symlink で本ラリー log を拾えない) 発見、第 7 段 `addb545fc80c009a6` で収束、本セッション pre-flight 3 条件直接単体検証 全 pass (find -L 候補 5 / AGENT 27 / KEYWORD 9)
- commit 0a-2 (slash command 新規): `chore(commands): add /plan-rally for Plan review rally before ExitPlanMode`、対象 = `.claude/skills/plan-rally/SKILL.md` 新規 (公式仕様で skills 形式が legacy commands より推奨、本プロジェクト既存 skill 慣習 `inventory-code-review` と同形式)。skills-decision.json は **更新しない** (Skill tool 使用時のみ更新、本 commit は SKILL.md Write のみ、memory `feedback-lsp-skills-policy-hook.md` 準拠)
- ~~commit 0a-3 (memory 保存)~~ **skip 判定** (本セッション Plan agent 第 5 段補足): memory 4 件 + MEMORY.md 索引 4 行追加は前セッションで完了済 (mtime 5/9 16:25-28)、本セッションでは重複 commit 不要、Step 10 Plans.md 同期 commit でこの skip を明記
- 順序: commit 0a-1 → Step 0b 検証 → **commit 0a-1b (本セッション追加)** → commit 0a-2 → ~~commit 0a-3~~ skip → Step 0c → ...

### Step 0b — hook 強化検証 (新規、Plan agent 第 2 段 D-2 で項目追加)

1. test 用 dummy plan ファイル `~/.claude/plans/test-self-review-hook.md` を一時作成 (機械的見出し 7 観点のみ、本文空)
2. hook 直接実行: `bash .claude/hooks/check-plan-on-exit.sh < <(jq -n --arg cwd "$PWD" '{cwd:$cwd}')` で deny block 確認
3. **本ファイル `phase-2-immutable-adleman.md` を同 hook で実行 → pass 確認** (現 Self-Review §1-7 が新ルール充足するか pre-flight test)
4. **親プラン本体 `docs/plans/2026-05-09-phase-2-ui-00-commit-4-5.md` で同 hook が pass することを確認** (D-2 追加)
5. **後方互換: 既存 plan ファイル (例 `docs/archive/plans/` 配下、archive 済プラン) で hook が拡張前と同じ判定を返すことを確認** (D-2 追加)
6. test 用 dummy ファイル削除 (working tree 汚染なし、`~/.claude/plans/` 配下なので safe)

検証緑後に Step 0a-2 (`/plan-rally` skill 新規 commit) → ~~Step 0a-3 (memory 4 件保存 commit)~~ skip (本セッション、前述 commit 分割 §) → Step 0c へ進む。

### Step 0a-3 skip 判定 (本セッション Plan rally 第 5 段補足)

memory 4 件 (`feedback-self-review-mechanical-addition-anti-pattern.md` / `feedback-plan-mode-recursive-refinement.md` / `feedback-claude-self-bias-blind-spot.md` / `feedback-plan-rally-required-before-exit.md`) と MEMORY.md 索引 4 行追加は **前セッションで完了済** (mtime 5/9 16:25-28、§「Step 0a」#4 + §「次セッション・継続時の memory 保存候補」L450-455 の ✅ マークと一致)。本セッションで重複保存しないため Step 0a-3 commit は skip、Step 10 Plans.md 同期 commit でこの skip を明記して trace 確保。

### Step 0c — 着手前 read-only 5 項目チェック

1. `rg -n "from \"@/components/ui/alert\"" src/` → **0 件**
2. `npm ls @radix-ui/react-alert-dialog` → 既存 alert-dialog package 確認 (Alert は別 package で衝突なし想定)
3. `cd src-tauri && cargo test 2>&1 | tail -3` → **実 test 数を確定** (Step 5 baseline、`L215` 561 を実測値で上書き対象として記録)
4. `git fetch origin && git log --oneline HEAD..origin/main` → 0 件 (rebase 不要判定、B-5)
5. `rg -n "isMockMode|VITE_MOCK_MODE" src/` → `src/lib/env.ts:13` の定数定義のみ確認

すべて期待値なら Step 2 着手 OK。test 数差異は Step 10 で親プラン `L215` 修正対象として記録。

### Step 2 — commit 3.5 shadcn Alert (WSL2)

1. `npx shadcn@latest add alert` → `src/components/ui/alert.tsx` 生成 (`components.json` は `new-york` style 既設定、変更なし想定)
2. `git diff` で生成内容確認、`package.json` への dep 追加なら `npm install` 完了確認
3. commit `chore(ui): add shadcn Alert component` (1 commit)

### Step 2.5 — VITE_MOCK_MODE 実装方針確定 (B-3)

`rg -n "isMockMode|VITE_MOCK_MODE" src/` で hook 内分岐ゼロを再確認 → Step 6 fallback を **Plan B (DB 一時 rename)** にロック。本 Step は code 編集なし、判断のみ。Step 3 着手前 gate。

### Step 3 — commit 4: hooks + 純関数 + presentational 11 ファイル (WSL2)

実装対象 (53-ui-home.md §53.1 ファイル責務表 + Plan agent 再点検 B-10 反映):

| パス | 責務 | 設計判断 |
|---|---|---|
| `src/features/home/types.ts` | `HomeSummaryState` 等ローカル型 | — |
| `src/features/home/hooks/useHomeSummary.ts` | 4 useQuery 独立束ね、派生値計算 | D-3 部分障害許容 |
| `src/features/home/hooks/useYesterdayDate.ts` | JST 昨日 + Visibility API listener | P2-A 24:00 またぎ再計算 (53-ui-home.md L127-153) |
| `src/features/home/lib/count-stock-status.ts` | 純関数 `ProductWithRelations[]` → `{outOfStock, lowStock}` | P2-B 仕様コードブロック明記 |
| `src/features/home/components/PluNotificationBar.tsx` | 黄色バー、`pluDirtyCount >= 1 && !isLoading` | UI-08 遷移 pending disabled |
| `src/features/home/components/SummaryCards.tsx` | 3 カード束ね | sales / outOfStock / lowStock |
| `src/features/home/components/SummaryCard.tsx` | 単一カード loading/error/data | error は `<Alert variant="destructive">` (Step 2 で導入) |
| `src/features/home/components/QuickActionGrid.tsx` | 2×2 daily 機能 | Q-1 採用: 商品管理 pending |
| `src/features/home/components/InventoryActionGrid.tsx` | 2×2 入出庫機能 (全 pending) | — |
| `src/features/home/components/MiscActionRow.tsx` | 3 ボタン (棚卸し/バックアップ/設定、全 pending) | — |
| `src/features/home/components/ActionButton.tsx` | 共通、引数 `navItemId` のみ | D-2 SSOT、`import { navigation } from "@/config/navigation"` (B-10) |

LSP/Skills Policy hook 制約 (memory `feedback-lsp-skills-policy-hook.md`):
- Write 前 baseline: `mcp__ide__getDiagnostics` (uri 未指定) で WorkspaceDiagnostics 取得
- Write 後検証: `mcp__ide__getDiagnostics(uri="file:///home/kosei/inventory-system/src/features/home/<path>")` でファイル単位差分検証 (B-6)
- 11 ファイル順序: types → 純関数 → hooks → presentational components → ActionButton (依存順)

commit prefix `feat(ui): UI-00 hooks + presentational components` (1 commit、memory `ui-design-impl-bundled-pr.md` + `frontend-function-design-granularity.md`、pre-push hook 中間状態回避)。

### Step 4 — commit 5: HomePage + route 接続 (WSL2)

- `src/features/home/HomePage.tsx` 新規 (4 useQuery 束ね呼び出し + 3 セクション組み立て)
- `src/routes/index.tsx` を search_products demo (93 行) → `<HomePage />` (3 行) 差替
- LSP 検証は B-6 と同じ手順
- 53-ui-home.md `L199` 更新履歴追記 (Step 5 で doc-consistency 走らせる契機)

commit prefix `feat(ui): UI-00 home page wiring`。

### Step 5 — 自動検証フル (WSL2)

冒頭で **B-2 test 数実測**: `cd src-tauri && cargo test 2>&1 | tail -3` → 実値を Step 10 Plans.md 同期で `docs/plans/2026-05-09-phase-2-ui-00-commit-4-5.md:215` 修正対象として記録。

3 グループ：
- **グループ A (Rust)**: `cargo fmt --check` → `cargo clippy -- -D warnings` → `cargo test` (実測本数維持) ※ B-1 で commit 4-5 自体は ① fmt/clippy/test 走らないので **ここで先に通す**
- **グループ B (Frontend)**: `npm run typecheck` → `npm run lint` → `npm run test`
- **グループ C (Scripts)**:
  - `./scripts/doc-consistency-check.sh` (R3 link 実在検証含む 19 項目)
  - `./scripts/check-typedinvoke-count.sh` (baseline 両方向、memory `feedback-baseline-monotonic-ci-both-directions.md`)
  - `./scripts/check-env-safety.sh` (今回 .env 系変更なしなので緑想定)
  - `cargo run --bin generate_bindings && git diff --exit-code src/lib/bindings.ts` (drift check)

グループ間並列実行可、グループ内順次。`cargo test` / `cargo clippy` は `run_in_background: true` 候補 (Plan agent 推定 60-120s / 30-60s)。

### Step 5.5 — 中間 push (B-4 新設)

Step 5 緑後、Step 6 Windows pull 用に：
1. `git fetch origin && git log --oneline HEAD..origin/main` で main 進行 0 件確認 (B-5)
2. main 進行があれば `git rebase origin/main` → conflict resolve → グループ A/B/C 再走
3. `git push origin feat/ui-00-home` (PR open はしない、`-u` 不要、force なし)
4. pre-push hook ② doc-consistency + ③ typedinvoke が走る (B-1)、緑確認

### Step 6 — Windows 手動検証 (Windows native、user 主体 + Claude チェックリスト提示)

Windows 側で：
1. `git pull origin feat/ui-00-home`
2. `npm install` (Linux/Windows 間の package-lock libc メタデータ drift は **revert**、引き継ぎ資料記載)
3. `npm run tauri dev` 起動

検証 6 項目：
1. **日本語 IME インライン入力**: 商品検索 placeholder 等 (Step 1 で動作確認済、再確認)
2. **4 useQuery 部分障害シミュレーション** (B-7 Plan B 一本化):
   - app data dir で `move %APPDATA%\com.kosei.inventory\inventory.db inventory.db.bak`
   - 4 useQuery が独立して error 表示することを目視
   - 各カードの再試行ボタンで refetch
   - 検証後 `move inventory.db.bak inventory.db`
3. **PLU 通知バー**: pluDirty 商品ありで表示、なしで非表示
4. **ウィンドウタイトル動的更新**: `<アプリ名> - ホーム`
5. **pending disabled の hover tooltip**: 入出庫系ボタン
6. **目視レイアウト**: レスポンシブ不要だが破綻なし (memory `desktop-app-ui-constraints.md`)

### Step 7 — inventory-code-review skill (WSL2)

`Skill` tool で `inventory-code-review` 起動 (skills-decision.json 更新必須)。P1/P2 ゼロ達成まで反復。

### Step 8 — PR open (WSL2、user gate なし、Claude 実行可)

1. rebase 判定 (B-5 同手順)
2. `gh pr create --title "feat(ui): UI-00 ホーム画面" --body "<HEREDOC>"`
3. PR description に commit 一覧 + Self-Review pass + Plan agent 二重再点検 反映済を明記
4. `gh pr checks <N> --watch` (memory `feedback-ci-polling-use-gh-watch.md`)

pre-push hook はすでに Step 5.5 で通過済。push されない (commit はもう積んだ)、PR open のみ。

### Step 9 — Codex Round 1〜3 対応 (WSL2、user 経由 Codex 投入 + Claude 対応)

- 各 Round の指摘は repo 全体 grep で一括修正 (memory `feedback-codex-drift-fix-grep-all-locations.md`)
- 軽量 (~10 min) + PR スコープ内 + 3 round 以内なら同 PR で潰す (memory `codex-non-blocker-incorporation.md`)
- commit prefix `fix(ui): apply Codex review (Round N)` (round 1 commit)

### Step 10 — Plans.md + 親プラン同期 (WSL2、boundary milestone 1 commit)

- Plans.md の Phase 2 8-1 を completed に
- `docs/plans/2026-05-09-phase-2-ui-00-commit-4-5.md:215` の test 数を Step 5 実測値に修正 (B-2)
- 親プラン pre-push hook 説明文を B-1 正に修正 (条件付き個別実行)
- specta 化 commands リスト更新 (引き継ぎ資料記載 P3-D)
- 親プランに **Step 0a/0b/0c (Self-Review hook 強化) は本ファイル独自 Step として追加した**旨を注記 (Plan agent 第 2 段 D-3)
- memory `feedback-status-sync-pr-keyword-grep-comprehensive.md`: future-tense / progress-tense keyword 群を一括 grep 全置換
- commit `docs(plans): sync Phase 2 8-1 progress`

### Step 11 — PR merge + archive + memory 監査 (user merge + Claude archive)

- user 操作: `gh pr merge --delete-branch`
- Claude: 3 ファイル archive 移動 (本ファイル含む) + 相対パス変換 `../` → `../../` (memory `feedback-archive-relative-path-conversion.md`)
- doc-consistency-check.sh R3 で link 実在再検証
- memory 監査スコープ: 引き継ぎ 8 残課題から保存判定 (B-9、本ファイル前述)
  - **Step 0a-3 で先行保存済の 4 件** (`feedback-self-review-mechanical-addition-anti-pattern.md` / `feedback-plan-mode-recursive-refinement.md` / `feedback-claude-self-bias-blind-spot.md` / `feedback-plan-rally-required-before-exit.md`) **は監査対象外** (Plan agent 第 2 段 §5 + 第 3 段 D 拡張)
- `touch /home/kosei/.claude/projects/-home-kosei-inventory-system/memory/.last_audit`
- MEMORY.md 索引追記 (Step 0a-3 で先行保存した 4 行 + 引き継ぎ 8 残課題から保存判定された分を含めた整合性確認)
- main 直接 push (引き継ぎ資料 P3-E)

## subagent 採否表 (Plan agent 第 1 段 C + 第 2 段 D-5 結論)

| Step | 判定 | 根拠 |
|---|---|---|
| Step 0a-1 | 主 Claude | hook script 拡張 (`.sh` の A 内容深さ + D-1 agent log check) + project `.claude/settings.json` 編集、ロジック妥当性は私が責任を持つ |
| Step 0a-2 | 主 Claude | `/plan-rally` slash command 新規 (`.claude/skills/plan-rally/SKILL.md`)、frontmatter + prompt 設計対話的 |
| Step 0a-3 | 主 Claude | memory 4 件 Write + MEMORY.md 索引 4 行追記、内容は本セッション固有で対話判断必要 |
| Step 0b | 主 Claude | dummy plan 作成 → hook 実行 → 結果判定の検証フロー、対話的 |
| Step 0c | 主 Claude | read-only 5 項目、10 秒 |
| Step 2 | 主 Claude | 1 ファイル + 1 commit |
| Step 2.5 | 主 Claude | rg 1 回 + 判断 |
| Step 3 | **主 Claude** (subagent 候補だが採用せず) | 4 SSOT (53-ui-home.md / navigation.ts / bindings.ts / query-keys.ts) 整合判断 + ドメイン判断 + LSP hook 11 ファイル分対話的検証で context 引渡コスト > 並列メリット |
| Step 4 | 主 Claude | 2 ファイル + 設計書更新履歴 |
| Step 5 | 主 Claude (sequential)、`cargo test` / `cargo clippy` のみ `run_in_background: true` 候補 | グループ間 cargo/npm 競合リスクで並列発火避ける |
| Step 5.5 | 主 Claude | rebase 判定 + push、対話的 |
| Step 6 | 主 Claude (user 主導) | チェックリスト提示 + 結果判定 |
| Step 7 | 主 Claude (Skill tool) | inventory-code-review skill |
| Step 8 | 主 Claude | PR description 文言調整対話 |
| Step 9 | 主 Claude | Codex 投入 → 対応の対話判断頻発 |
| Step 10 | 主 Claude | 慎重な keyword 全置換 (subagent は誤置換リスク) |
| Step 11 | 主 Claude | rename + 相対パス変換 + memory 監査の対話判断 |

## 制約・運用

- LSP/Skills Policy hook 強制: code 編集前 baseline diagnostics、Write 後 URI 指定検証 (memory `feedback-lsp-skills-policy-hook.md`)、shell script (.sh) も code 扱い
- `~/.claude/settings.json` 編集が必要な分岐に至ったら user 操作に切替 (sandbox writable 外、Plan agent 第 2 段 D-3)
- merge / force push / Codex review request は user 操作
- 中間 push は Step 5.5 のみ、Step 8 は PR open のみ (push は Step 5.5 で済)
- Codex drift 系指摘は repo 全体 grep で一括修正
- archive 時の相対パス変換 `../` → `../../`、doc-consistency R3 失敗回避
- **hook 拡張で本プラン自身が deny されないことを Step 0b (3) で pre-flight 確認** (Plan agent 第 2 段 D-3)
- **E-1 / E-2 = Step 0a-1b で grep pattern (attributionAgent 両対応) + find -L (symlink follow) の 2 行修正で fix** (本セッション Plan rally 第 5/6 段で発見、第 7 段収束、commit `9e43518`、pre-flight 3 条件直接単体検証 全 pass)

## 重要参照ファイル (パス検証済、Plan agent 第 2 段 C で絶対 path 確定)

- `docs/plans/2026-05-09-phase-2-ui-00-commit-4-5.md` — 実プラン本体 (Step 1-11 + Self-Review)
- `docs/function-design/53-ui-home.md` — UI 関数設計 (11 ファイル責務 §53.1 / 部分障害許容 §53.5 / Visibility API L127-153)
- `docs/architecture/ui-task-specs.md` — UI-00 タスク仕様
- `docs/SCREEN_DESIGN.md` — 毎日使う 5 画面の画面要件
- `src/config/navigation.ts` — UI-12 SSOT (B-10 訂正、`src/lib/navigation.ts` ではない)
- `src/lib/query-keys.ts` — PR #52 導入済 (`(page, perPage)`)
- `src/lib/invoke.ts` / `src/lib/invoke-fallback.ts` — PR #48 ADR-004 typedInvoke wrapper
- `src/lib/bindings.ts` — specta 自動生成 (drift check 対象、Plan agent が L26 で `(page, perPage)` 整合確認済)
- `src/components/ui/alert.tsx` — Step 2 で生成 (現在未存在)
- `src/components/ui/alert-dialog.tsx` — 既存 (Alert と別 package、衝突なし想定)
- `scripts/pre-push.sh` — 個別実行モデル (B-1)、`L39,80,95,108`
- `/home/kosei/inventory-system/.claude/hooks/check-plan-on-exit.sh` — 拡張対象 (Step 0a)、欠陥箇所 `:60-61`
- `/home/kosei/inventory-system/.claude/settings.json` — project hook 登録、`L46-51` ExitPlanMode、`L60-65` PostToolUse:Write\|Edit\|MultiEdit

## Self-Review (memory `plan-self-review-before-implementation.md` 7 観点、Plan agent 第 2 段 B 案全反映)

> 本セクションは Plan agent 第 2 段 (`aee470711f0415c29`) の点検結果「7 観点中 4 完全欠落・3 不足」+ 第 3 段 (`aca578f0f9e1ce167`) の D 拡張連動 12 Edit ペア + 第 4 段 (`a35f4c603a47ee799`) の二次 drift 修正 6 ペアを全反映して書き直したもの。memory `feedback-self-review-mechanical-addition-anti-pattern.md` (Step 0a 先行保存) の趣旨を実体化。

### 1. 技術的前提

- **hook 拡張対象 path** (Plan agent 第 2 段 C): `.claude/hooks/check-plan-on-exit.sh` は project-relative、実体は `/home/kosei/inventory-system/.claude/hooks/check-plan-on-exit.sh` (sandbox writable scope `.` 内、Edit 可)。`/home/kosei/.claude/hooks/` は **存在しない** (audit 済) — 本ファイル §「Plan agent 第 2 段で確定した sandbox 制約事前確認」表 + §「Step 0a」#1
- **`~/.claude/settings.json` の sandbox 制約**: Plan agent 第 2 段 C で writable 外と確認 → 編集 user 操作必須。本プランでは **project 側 `.claude/settings.json:46-51` (ExitPlanMode hook) + `:60-65` (PostToolUse) のみ編集** で完結 — 本ファイル §「Step 0a」#2 + §「制約・運用」
- **LSP/Skills Policy hook の shell script 適用境界**: memory `feedback-lsp-skills-policy-hook.md` で「code 編集に適用、docs (.md) 編集は適用外」、`.sh` は明文化されてないが LSP が syntactic 扱いできる以上 code 扱いで baseline → Edit → URI 検証の 3 ステップ — 本ファイル §「Step 0a」#2 末尾
- **rebase 判定**: `B-5` で `git fetch origin && git log --oneline HEAD..origin/main` 3 コマンドセット確定。Step 0c / Step 5.5 / Step 8 で実施 — 本ファイル §「Plan agent 第 1 段 補正事項表」B-5 + §「Step 0c」#4 + §「Step 5.5」#1 + §「Step 8」#1
- **commit prefix**: Step 0a-1 = `chore(hooks)` (hook 拡張) / Step 0a-2 = `chore(commands)` (`/plan-rally` skill 新規) / Step 0a-3 = `docs(memory)` (memory 4 件) / Step 2 = `chore(ui)` / Step 3-4 = `feat(ui)` / Step 9 = `fix(ui)` / Step 10 = `docs(plans)` / Step 11 archive = main 直接 push (引き継ぎ資料 P3-E) — 本ファイル §「Step 0a」末 + §「Step 7」コミット分割
- **claude-code-guide subagent 完了** (`a2a2eac9c9841b0a2`): 公式 docs ベースで案 A/B/C 評価 + 落とし穴 5 件確定。Agent Teams 不採用、案 A (D-1 + D-2) 第 1 段階 / 案 C 第 2 段階 Backlog の段階導入確定 — 本ファイル §「Step 0a」#3-4
- **branch**: `feat/ui-00-home` 継続、削除は user `gh pr merge --delete-branch` — 本ファイル §「Step 11」#1

### 2. スクリプト詳細

- **現行 `check-plan-on-exit.sh` ロジック** (Plan agent 第 2 段 §2): (a) `:26` で `doc-consistency-check.sh --target plan` 実行、(b) `:45-51` で直近 mtime plan 1 件選定 (find + stat -c %Y で `~/.claude/plans` も走査)、(c) `:60-61` で `^##\s+(Self-Review|セルフレビュー)` を grep -cE、(d) `:65` で `HAS_SELF_REVIEW=0 && HAS_EXEMPTION=0` のとき deny — **「見出し存在のみ検証」の欠陥はまさに `:60-61`** — 本ファイル §「Step 0a」#1 欠陥箇所行
- **A 検証パターン正規表現**: section 抽出 = `awk '/^## (Self-Review|セルフレビュー)/{flag=1;next}/^## /{flag=0}flag' "$PLAN_FILE"` で本文取得、各観点ヘッダ (`### [1-7]\.`) で分割、`grep -E '^>|L[0-9]+|§[0-9]|memory \`.*\.md\`'` のいずれか **AND** `wc -m` ≥ 100 文字 — 本ファイル §「Step 0a」#2 1 行目
- **C diff 監視 hook 経路**: project 側 `.claude/settings.json:60-65` の既存 `PostToolUse:Write|Edit|MultiEdit` 配列に `.claude/hooks/post-edit-plan-monitor.sh` を追加 (現状 `audit-trigger-plan.sh` 1 件のみ)。`git diff --unified=0 -- "$PLAN_FILE"` で `+` 行が `## Self-Review` 配下のみなら additionalContext で warning — 本ファイル §「Step 0a」#2 後段
- **test dummy plan 作成 → 削除** (Step 0b): `~/.claude/plans/test-self-review-hook.md` を機械的見出し 7 観点のみで一時作成 → hook 実行で deny block 確認 → 削除。working tree 汚染なし (`~/.claude/plans/` は git 管理外) — 本ファイル §「Step 0b」#1 + #6
- **`/plan-rally` slash command 配置場所** (Step 0a 3-1 訂正): `.claude/skills/plan-rally/SKILL.md` 形式が公式推奨 (claude-code-guide subagent 確定、legacy `.claude/commands/plan-rally.md` も動く)。本プロジェクト `.claude/skills/` 既存運用 (claude-code-harness skill 群) に統一。frontmatter + prompt で引数 `--rounds N` (default: 2) / `--agent {plan|general-purpose}` / `--converge {new-findings-zero|max-rounds}`、実行フロー (a) 直近 plan ファイル特定 → (b) Plan agent 起動 (read-only) → (c) 結果整理 → (d) Claude が plan 修正 → (e) 新規指摘 0 まで反復 — 本ファイル §「Step 0a」3-1
- **D-1 hook check ロジック** (Step 0a 3-2): `find /tmp/claude-1000/<session>/tasks/*.output -mmin -30` で直近 30 分 agent log 取得、各 output の metadata から `subagent_type` (jq/grep) 抽出、`subagent_type ∈ {Plan, general-purpose}` AND prompt に「plan critique / plan review / 再点検 / 整合性」keyword 含む log が 1 件以上で pass、0 件で deny + メッセージ「`/plan-rally` を実行するか Plan/general-purpose agent で plan 本体を critique させてから再呼出」。ダミー agent 起動の穴対策で keyword 検査必須 — 本ファイル §「Step 0a」3-2
- **案 C 落とし穴対策** (Backlog 第 2 段階で適用): `maxTurns: 3` (timeout) / 指摘 5 件上限 (token) / `max-plan-review-rounds: 3` config (収束無限化) / 7 観点 JSON schema 型注入 (critic agent bias) / "reject only if fundamentally flawed" + warn-only mode (false positive)。本 PR スコープ外、Backlog 別 PR で実装 — 本ファイル §「Step 0a」3-4 想定落とし穴対策
- **`npx shadcn@latest add alert` 副作用**: `components.json` 変更なし想定 (Plan agent 第 1 段 A-3 で `new-york` style 既設定確認済)。Step 0c #2 (`npm ls @radix-ui/react-alert-dialog`) で既存 alert-dialog package との衝突再確認 — 本ファイル §「Step 2」#1 + §「Step 0c」#2
- **`./scripts/doc-consistency-check.sh` R3** (Markdown link 実在): Step 5 グループ C と Step 11 archive 後再検証で 2 回走る — 本ファイル §「Step 5」グループ C + §「Step 11」#3
- **`./scripts/check-typedinvoke-count.sh`**: baseline 両方向 (memory `feedback-baseline-monotonic-ci-both-directions.md`)。Step 5 で specta 化 4 commands 追加分の baseline 更新有無を Step 10 で判定 — 本ファイル §「Step 5」グループ C + §「Step 10」P3-D
- **`cargo run --bin generate_bindings`**: `src-tauri/src/bin/generate_bindings.rs` の存在を Plan agent 第 1 段 A-3 で確認済 — 本ファイル §「Step 5」グループ C 末

### 3. ドキュメント修正

- **53-ui-home.md** は前 commit `abc89d0` で更新済、Step 4 で更新履歴行 `L199` 追記 (Step 5 で doc-consistency 走らせる契機) — 本ファイル §「Step 4」#4
- **親プラン `L215`** の test 数 561 は `B-2` で実測上書き必要、Step 10 で修正 commit — 本ファイル §「Plan agent 第 1 段 補正事項表」B-2 + §「Step 10」#2
- **親プラン pre-push hook 説明文 `L261-265`** は `B-1` で誤、Step 10 で正に修正 — 本ファイル §「Step 10」#3
- **親プランへの Step 0a/0b/0c + D 拡張 (ラリー仕組み化) 追加注記** (Plan agent 第 2 段 D-3 + 第 3 段): 親プラン本体には Step 0a/0b/0c も D 拡張も無い → Step 10 同期で「Step 0a/0b/0c + D 拡張 (Plan レビューラリー仕組み化、`/plan-rally` skill + D-1 hook check) は本ファイル独自」明記 — 本ファイル §「Step 10」#5
- **memory 4 件新規 + MEMORY.md 索引 4 行追記** (Plan agent 第 2 段 §3 + 第 3 段 D 拡張): Step 0a 内で `feedback-self-review-mechanical-addition-anti-pattern.md` + `feedback-plan-mode-recursive-refinement.md` + `feedback-claude-self-bias-blind-spot.md` (新規、user turn 6 反映) + `feedback-plan-rally-required-before-exit.md` (新規、ラリー仕組み化) を Write、MEMORY.md 索引 Critical エリアに 4 行追記 — 本ファイル §「Step 0a」#4
- **archive 移動**: 本ファイル §「Step 11」で 3 ファイル (本ファイル + 親プラン + `phase-2-ui-00.md` の存続判定要) 移動、相対パス変換 `../` → `../../` (memory `feedback-archive-relative-path-conversion.md`) — 本ファイル §「Step 11」#2
- **link 影響範囲**: doc-consistency R3 で Step 11 後検証 — 本ファイル §「Step 11」#3
- **Plans.md Active Tasks** には Step 0a/0b/0c 反映不要 (Plan agent 第 2 段 §3): hook 拡張は Phase 2 8-1 のサブ作業ではなく meta tooling 改善、Plans.md は phase 単位

### 4. 検証計画

- **ローカル test 数**: `B-2` で実測確定 (561 → 実測値)、Step 5 冒頭で baseline 取得 — 本ファイル §「Step 5」冒頭
- **グループ A/B/C** は Step 5 内で並列、グループ内順次 — 本ファイル §「Step 5」末
- **pre-push hook**: `B-1` 個別実行モデル、本セッション commit は ② doc-consistency + ③ typedinvoke のみ走る → Rust 検証は Step 5 グループ A で先に通す — 本ファイル §「Step 5」グループ A 末注 + §「Plan agent 第 1 段 補正事項表」B-1
- **Step 0b hook 強化検証** (Plan agent 第 2 段 §4 + D-2 + 第 3 段 D-1): (a) test dummy で deny block 確認 (#1-#2)、(b) **本ファイル `phase-2-immutable-adleman.md` で hook が pass することを確認** (現 Self-Review §1-7 が新ルール充足する pre-flight test、第 1〜4 段 agent log 存在で D-1 check も pass 想定、#3)、(c) **親プラン本体でも pass 確認** (#4)、(d) **後方互換: 既存 archive 済プランで拡張前と同じ判定** (#5)、(e) **D-1 check 単体検証**: `find /tmp/claude-1000/<session>/tasks -mmin -30` で 0 件状態を一時的に作る (or temp env で hook 単体実行) → deny block + メッセージ確認 (#3 内に併設) — 本ファイル §「Step 0b」#1-#6
- **後方互換性** (Plan agent 第 2 段 §4): 既存 hook の deny 経路 (`:29` 整合チェック失敗 / `:65` Self-Review 欠落 / `:97` 両方 pass) の 3 経路が hook 拡張後も保持されること — 本ファイル §「Step 0b」#5
- **pre-push hook と ExitPlanMode hook の干渉なし** (Plan agent 第 2 段 §4): ExitPlanMode hook は session 内 plan mode 出口、pre-push は git push 時、両者は別経路で干渉しない — 本ファイル §「制約・運用」中段
- **Windows 手動 (Step 6)**: `B-7` Plan B (DB 一時 rename) で 4 useQuery 部分障害シミュレーション — 本ファイル §「Step 6」検証 #2
- **bindings.ts drift**: `cargo run --bin generate_bindings && git diff --exit-code src/lib/bindings.ts` — 本ファイル §「Step 5」グループ C 末
- **gh pr checks --watch**: memory `feedback-ci-polling-use-gh-watch.md` — 本ファイル §「Step 8」#4

### 5. 後処理

- **Step 0a 内 memory 4 件即時保存** (Plan agent 第 2 段 §5 + 第 3 段 D 拡張): `feedback-self-review-mechanical-addition-anti-pattern.md` + `feedback-plan-mode-recursive-refinement.md` + `feedback-claude-self-bias-blind-spot.md` + `feedback-plan-rally-required-before-exit.md` の 4 件を **commit 0a-3** で先行保存。**Step 11 監査スコープから 4 件除外** (監査ではなく追記のため、本ファイル末尾「次セッション保存候補」も 4 件先行保存に対応して修正必須) — 本ファイル §「Step 0a」#4 + §「Step 11」memory 監査スコープ
- **案 C Backlog 化** (第 3 段 D 拡張): Step 10 Plans.md 同期で Backlog セクションに「`plan-critic` subagent + JSON parse 自動 loop hook (案 C、`maxTurns:3` / 指摘 5 件上限 / `max-plan-review-rounds:3` config)」を追加。本 PR スコープ外、別 PR で実装 — 本ファイル §「Step 10」追加項目
- **MEMORY.md 索引追記タイミング** (Plan agent 第 2 段 §5): Step 0a 内即時、Step 11 で先行保存分含めた整合性確認 — 本ファイル §「Step 0a」#3 + §「Step 11」#7
- **memory 監査 (Step 11)**: `B-9` で引き継ぎ 8 残課題から保存判定 — 本ファイル §「Step 11」memory 監査スコープ
- **sentinel 更新**: `touch ~/.claude/projects/-home-kosei-inventory-system/memory/.last_audit` は Step 11 のみ (監査完了マーク、Step 0a の追記には touch しない) — 本ファイル §「Step 11」#6
- **archive**: 本ファイル §「Step 11」#2 + memory `feedback-archive-relative-path-conversion.md`

### 6. 実行制約

- **`~/.claude/settings.json` 編集は sandbox 拒否** (Plan agent 第 2 段 §6): writable 外 → project 側 `.claude/settings.json:46-51` のみ編集、global は触らない。**`~/.claude/settings.json` 編集が必要な分岐に至ったら user 操作に切替** — 本ファイル §「制約・運用」2 行目 + §「Step 0a」#2 末尾
- **pre-flight test 必須** (Plan agent 第 2 段 §6): hook 拡張後、本ファイル自身が新ルール下で deny されないことを Step 0b (3) で確認してから初めて Step 2 着手。pre-flight 失敗時は §1-7 を再強化してから retry — 本ファイル §「Step 0b」#3 + §「制約・運用」末尾
- **hook deny 誤検知時の fallback 不可** (Plan agent 第 2 段 §6): 本ファイル `L79` 既存 hook の「Self-Review: 適用除外」マーカーは使わない (Phase 2 8-1 は 11 ファイル + 5 commit で軽微タスク条件 = `1-3 ファイル / 10 分以内` (memory `plan-self-review-before-implementation.md` L29) を満たさない)
- **案 C は本 PR スコープ外** (第 3 段 D 拡張): `plan-critic` subagent + JSON parse 自動 loop は別 PR Backlog 化、本 PR は D-1 (hook deny) + D-2 (`/plan-rally` skill) の第 1 段階のみ実装 — 本ファイル §「Step 0a」3-4 段階導入方針
- **`/plan-rally` 呼出忘れ対策** (第 3 段、claude-code-guide 確定): 公式仕様で「slash command は 1 invocation = 1 round、自動反復不可」 → D-1 hook deny で「呼出されていない」状態を機械的に強制 block するのが唯一の保険、reminder では足りない — 本ファイル §「Step 0a」3-4
- **Step 0b pre-flight に D-1 check 含む** (第 3 段): 本ファイル自身が新 hook (A 内容深さ + D-1 ラリー要件) 双方で pass することを Step 0b (3) + (e) で確認 — 本ファイル §「Step 0b」#3 + #6
- **merge は user 操作**: 本ファイル §「Step 11」#1 (`gh pr merge --delete-branch`)
- **force push 禁止**: 本ファイル §「制約・運用」3 行目
- **Codex review request は user 操作**: 本ファイル §「Step 9」冒頭
- **Co-Authored-By 禁止**: グローバル CLAUDE.md
- **`--no-verify` 禁止**: pre-push 失敗は新 commit (memory `review-convergence-pattern.md`)
- **`git config` 変更禁止**: グローバル CLAUDE.md

### 7. コミット分割

- **commit 0a-1** (Step 0a hook 拡張): `chore(hooks): enforce Self-Review content depth + Plan rally requirement before ExitPlanMode`、対象 = `.claude/hooks/check-plan-on-exit.sh` (A 内容深さ検証 + D-1 直近 agent log check) + (C 採用なら) `.claude/hooks/post-edit-plan-monitor.sh` 新規 + `.claude/settings.json` (project 側のみ) — 本ファイル §「Step 0a」末 commit 分割
- **commit 0a-2** (Step 0a slash command 新規、第 3 段 D 拡張): `chore(commands): add /plan-rally for Plan review rally before ExitPlanMode`、対象 = `.claude/skills/plan-rally/SKILL.md` 新規 (legacy `.claude/commands/plan-rally.md` でも可、project の skill 配置慣習に合わせる) — 本ファイル §「Step 0a」3-1
- **commit 0a-3** (Step 0a memory 4 件保存): `docs(memory): add self-review-mechanical / plan-mode-recursive / claude-self-bias / plan-rally-required`、memory 4 件 + MEMORY.md 索引 4 行追記。**hook / slash command / memory の 3 commit 分離** で pre-push hook (B-1) ② doc-consistency が memory commit 単独で走り検証スコープ明確 — 本ファイル §「Step 0a」#4
- **Step 0b 検証は code 変更なし → no commit** — 本ファイル §「Step 0b」末
- **commit 3.5** (Step 2): `chore(ui): add shadcn Alert component`、shadcn add の generated diff を本体 commit 4 から分離 (親プラン `L15`) — 本ファイル §「Step 2」#3
- **commit 4** (Step 3): `feat(ui): UI-00 hooks + presentational components`、11 ファイル不分割 = `memory/ui-design-impl-bundled-pr.md` + `frontend-function-design-granularity.md` + pre-push 中間状態回避 (親プラン `L14`) — 本ファイル §「Step 3」末
- **commit 5** (Step 4): `feat(ui): UI-00 home page wiring`、route 接続を commit 4 から分離して PR review 時の差分追跡を容易に — 本ファイル §「Step 4」末
- **commit 9-N** (Step 9): `fix(ui): apply Codex review (Round N)`、round per 1 commit (親プラン `L279`) — 本ファイル §「Step 9」末
- **commit 10** (Step 10): `docs(plans): sync Phase 2 8-1 progress`、boundary milestone 1 commit (memory `feedback-plans-sync-commit-milestone-only.md`) — 本ファイル §「Step 10」末
- **commit 11** (Step 11): archive commit、main 直接 push (引き継ぎ資料 P3-E) — 本ファイル §「Step 11」末
- **順序**: 0a-1 → 0b (検証 no commit) → 0a-2 → 0a-3 → 0c → 2 → 2.5 → 3 → 4 → 5 → 5.5 → 6 → 7 → 8 → 9 → 10 → 11。pre-push hook (B-1 個別実行) の判定: 0a-1 (`.sh` 変更) → ② doc-consistency も無関係 (`docs/function-design/` 外) → グループ走らず / 0a-2 (`.claude/skills/*.md`) → ② 走らず / 0a-3 (memory `.md`) → ② 走らず → 全 3 commit pre-push hook はほぼ no-op、Step 5 で初めてフル検証

## 次セッション・継続時の memory 保存候補 (Step 0a-3 先行保存 4 件に対応して修正)

引き継ぎ資料の残課題 8 項目は Step 11 監査スコープ。本セッションで発生した 4 件は **Step 0a-3 で先行保存** (Plan agent 第 2 段 §5 + 第 3 段 D 拡張):

- ✅ **`feedback-self-review-mechanical-addition-anti-pattern.md`** (commit 0a-3): Self-Review hook の見出し追加だけ通過は機械的ハック、本文に plan 本体の具体行参照を含めて書く
- ✅ **`feedback-plan-mode-recursive-refinement.md`** (commit 0a-3): 多発失敗 / context 大 / hook 通過に違和感ある時は Plan agent で plan 本体を再点検する習慣
- ✅ **`feedback-claude-self-bias-blind-spot.md`** (commit 0a-3、user turn 6 反映): Claude は自己 bias に気付けない、機械的強制 (hook deny / slash command) でしか質担保できない
- ✅ **`feedback-plan-rally-required-before-exit.md`** (commit 0a-3): ExitPlanMode 前に Plan agent ラリーを機械的に強制、`/plan-rally` slash command + hook deny で運用

**Backlog 移送候補** (案 C、第 3 段 D 拡張で本 PR スコープ外確定): `plan-critic` subagent (read-only) + ExitPlanMode hook で JSON parse 自動 loop。`.claude/agents/plan-critic.md` + `.claude/hooks/validate-plan-on-exit.sh` 新規。`maxTurns: 3` / 指摘 5 件上限 / `max-plan-review-rounds: 3` config。Step 10 で Plans.md Backlog セクションに追記タスクとして移送。

最終判定は Step 11 で実施 (Step 0a-3 先行保存 4 件は監査対象外、引き継ぎ 8 残課題のみ判定)。
