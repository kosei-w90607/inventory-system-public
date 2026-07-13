# Plan rally 仕組み global 化 draft (Phase 2 遺残 task)

> **作成日**: 2026-05-17
> **背景**: Phase 2 で hooks 3 本汎用化を完了扱いにしたが、(1) `check-plan-on-exit.sh` L181 に inventory-system hard-code 残存 (2) `/plan-rally` slash command の global 化が Phase 2 計画に含まれていなかった、の 2 点が gkmas-ocr-pipeline 着手時に発覚。Phase 2-D 相当の遺残 task として本 draft で対応
> **配置先**: ~/.claude/ 配下 (HARD BLOCK 確定なので user 手作業 cp / Edit 必須、Phase 2 と同パターン)
> **検証**: gkmas-ocr-pipeline 側 claude で `/plan-rally` 起動 + Plan mode → ExitPlanMode で hook D-1 check 通過確認

---

## 1. `/plan-rally` slash command 汎用版

**配置先**: `~/.claude/commands/plan-rally.md` (新規作成、project local の `inventory-system/.claude/commands/plan-rally.md` を汎用化したもの)

**汎用化の修正点**:
- L30 の `/home/kosei/Projects/inventory-system/docs/plans` を git project root 動的取得に変更
- L70-75 の参照リンクのうち project memory への直接参照は global skill 経由に切替 (memory は project-specific のため別 project で読めない)

**全文** (このまま `~/.claude/commands/plan-rally.md` に cp):

```markdown
Plan レビューラリーを実行する。ExitPlanMode 前に Plan agent を独立 context で起動して plan 本体を critique させ、新規指摘 0 まで反復する。

引数: $ARGUMENTS (例: `--rounds 3 --agent plan --converge new-findings-zero`)

## 設計原理

global skill `plan-mode-discipline` + `engineering-judgment-axioms` と整合:

- Claude 自主判断は信頼しない、ユーザー指摘待ちでは仕組みが回らない
- 機械的強制 (hook deny / slash command の強制呼出) でしか質担保できない
- 独立 context の subagent でしか自己 bias に気付けない

global `~/.claude/hooks/check-plan-on-exit.sh` D-1 check は「直近 30 分以内に Plan/general-purpose subagent の plan critique log」を必須化、本 skill 起動で agent log 残留 → hook pass 経路。

## 引数仕様

| 引数 | 既定値 | 説明 |
|---|---|---|
| `--rounds N` | 2 | 最大反復回数 |
| `--agent {plan\|general-purpose}` | plan | 起動する subagent type |
| `--converge {new-findings-zero\|max-rounds}` | new-findings-zero | 終了条件 (新規指摘 0 / 最大ラウンド到達) |

## 実行フロー

1. **直近 plan ファイル特定**

   ```bash
   # project root を動的取得 (project agnostic)
   PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
   # find ベース (fd は WSL 環境に未 install のため依存最小化)
   # xargs -r で no-input 時の ls -t fallback (cwd 列挙) を抑止
   PLAN_DOCS=$(find "$PROJECT_ROOT/docs/plans" -name '*.md' -type f -mmin -120 2>/dev/null | xargs -r ls -t 2>/dev/null | head -1)
   PLAN_TMP=$(find "$HOME/.claude/plans" -name '*.md' -type f -mmin -60 2>/dev/null | xargs -r ls -t 2>/dev/null | head -1)
   echo "対象: docs=$PLAN_DOCS / tmp=$PLAN_TMP"
   ```

   両方ある場合は user に確認、または直近に編集された方を優先。

2. **Plan agent 起動** (Agent tool)

   - `subagent_type`: `Plan` (default、`--agent` で override 可)
   - `description`: `Plan rally critique round N`
   - `prompt`: 必ず以下 keyword のいずれかを含める (D-1 hook KEYWORD_MATCH 通過用): `plan critique` / `plan review` / `再点検` / `整合性` / `連動更新` / `drift`
   - critique scope: 7 観点 (技術的前提 / スクリプト詳細 / ドキュメント修正 / 検証計画 / 後処理 / 実行制約 / コミット分割)
   - 出力形式: 新規指摘 (前回ラリーで未報告の論点) を JSON list で、致命的 / 重要 / 軽微で severity 区分、致命的な漏れは `path + old_string/new_string` ペアで Edit 提案
   - tools: read-only (Read / Grep / Glob / Bash)、Write/Edit 一切不可

3. **結果整理 + main Claude が plan 修正**

   - 新規指摘 **致命的 0 + 重要 0** → 収束、ExitPlanMode へ進める
   - 致命的 / 重要が 1 件以上 → main Claude が plan ファイルを Edit で修正 → step 2 戻る (next round)
   - `--rounds N` 上限到達 → `--converge` 指定に従い終了
     - `new-findings-zero`: 収束失敗、ユーザーに報告して判断仰ぐ
     - `max-rounds`: round N で終了、未解消指摘を残す形で ExitPlanMode 試行

4. **反復終了後**

   ExitPlanMode 試行 → hook の D-1 check が直近 agent log を見て pass / deny 判定。deny なら `--rounds` を増やすか手動で Plan agent 追加起動。

## 想定落とし穴

| 落とし穴 | 対策 (本 skill) |
|---|---|
| hook timeout 超過 (subagent 60s 超え) | prompt scope を最小限に絞る |
| 収束ループ無限化 (修正放棄) | `--rounds` で上限設定 |
| critic agent 自身の bias | 7 観点を prompt で明示指定 |
| false positive | severity 区分 + 軽微は無視判断 |
| token cost 蓄積 | 各 round で同 plan 全文渡さず差分 critique |

## 参照

- global hook `~/.claude/hooks/check-plan-on-exit.sh` — D-1 check 実装 (find -L + grep `(subagent_type|attributionAgent)` + KEYWORD)
- global skill `plan-mode-discipline` — Self-Review 7 観点 + Plan rally 規律
- global skill `engineering-judgment-axioms` — 自己 bias / subagent retry 検証 / 機械強制設計原則
- global skill `claude-codex-review-loop` — Codex review 反復スタイル
```

---

## 2. `check-plan-on-exit.sh` L181 hard-code 修正

**配置先**: `~/.claude/hooks/check-plan-on-exit.sh` (既存 Edit、L181 のみ 1 行修正)

**修正前** (L181):
```bash
  AGENT_LOG_DIR="/tmp/claude-1000/-home-kosei-Projects-inventory-system"
```

**修正後** (L181):
```bash
  AGENT_LOG_DIR="/tmp/claude-$(id -u)/$(echo "$CWD" | sed 's|/|-|g')"
```

**汎用化のロジック**:
- `1000` (UID hard-code) → `$(id -u)` で動的取得 (multi-user 環境対応)
- `-home-kosei-Projects-inventory-system` (project hard-code) → `$(echo "$CWD" | sed 's|/|-|g')` で動的計算
  - `$CWD` は L9 で `HOOK_INPUT` から jq で取得済 (`.cwd` field、Claude Code session の cwd)
  - `sed 's|/|-|g'` で `/home/kosei/Projects/inventory-system` → `-home-kosei-Projects-inventory-system` 変換 (Claude Code の sanitize 形式と一致)

**変更しない箇所**:
- L9 (`CWD` 取得) / L10 (`cd "$CWD"`) はそのまま
- L183-184 (`AGENT_LOG_DIR` を使って find する箇所) はそのまま

---

## 3. 配置手順 (user 手作業)

### Step 1: `~/.claude/commands/plan-rally.md` 新規作成

```bash
# 既存の global commands directory にファイル新規作成
# 本 draft §1 のコードブロック内全文をエディタで保存
vim ~/.claude/commands/plan-rally.md
# (本 draft §1 の ```markdown ... ``` 内容を cp)
```

または:

```bash
# project local からの簡易 cp (ただし path hard-code 残存版なので非推奨)
# cp ~/Projects/inventory-system/.claude/commands/plan-rally.md ~/.claude/commands/plan-rally.md
# その後 vim で L30 を本 draft §1 の汎用版 (PROJECT_ROOT 動的取得) に書き換え

# 推奨: 本 draft §1 の汎用版を直接エディタで貼り付け
```

### Step 2: `~/.claude/hooks/check-plan-on-exit.sh` L181 Edit

```bash
# vim で L181 のみ書き換え
vim ~/.claude/hooks/check-plan-on-exit.sh
# :181 で L181 にジャンプ
# 修正前: AGENT_LOG_DIR="/tmp/claude-1000/-home-kosei-Projects-inventory-system"
# 修正後: AGENT_LOG_DIR="/tmp/claude-$(id -u)/$(echo "$CWD" | sed 's|/|-|g')"
```

または sed で 1 発:

```bash
sed -i 's|AGENT_LOG_DIR="/tmp/claude-1000/-home-kosei-Projects-inventory-system"|AGENT_LOG_DIR="/tmp/claude-$(id -u)/$(echo "$CWD" | sed '\''s\|/\|-\|g'\'')"|' ~/.claude/hooks/check-plan-on-exit.sh
```

(`sed -i` の中に `sed` 再呼び出しがあるためエスケープが複雑、vim 推奨)

### Step 3: 動作確認

```bash
# 1. file 存在 + 実行権限確認
ls -la ~/.claude/commands/plan-rally.md ~/.claude/hooks/check-plan-on-exit.sh

# 2. hook 内 L181 修正反映確認
grep -n "AGENT_LOG_DIR" ~/.claude/hooks/check-plan-on-exit.sh

# 3. gkmas-ocr-pipeline 側 claude セッションで動作テスト
#    cd ~/Projects/gkmas-ocr-pipeline && claude
#    Plan mode 入る → 適当な plan 作る → /plan-rally 起動 →
#    Plan agent が動く確認 → ExitPlanMode で hook D-1 check 通過 (deny されない) 確認
```

---

## 4. 想定リスク

| リスク | 軽減策 |
|---|---|
| HARD BLOCK で Edit 失敗 (再現性) | Phase 2/3 と同パターン、user 手作業必須 |
| `$CWD` 変数が hook 内で展開されない (quote 問題) | hook 内では既に L9 で取得済、L181 で展開される |
| `sed 's\|/\|-\|g'` の `\|` エスケープ | bash の sed 構文として valid、awk / tr で代替も可 |
| Claude Code sanitize 形式の将来変更 | 現状 `-home-kosei-Projects-{project}` で固定、変更時は本 hook の sed も追従必要 |
| `/tmp/claude-{uid}/` 自体が cleanup された場合 | hook L183 で `[ -d ... ]` check してから find するので OK |

---

## 5. Self-Review (適用除外)

本 draft は **method (How-To) 文書** で複数 step プランではなく、user 手作業の指示書。`plan-self-review-before-implementation.md` の 7 観点 (技術的前提 / スクリプト詳細 / ドキュメント修正 / 検証計画 / 後処理 / 実行制約 / コミット分割) は本 draft の構成に内包済み (§3 配置手順 = スクリプト詳細 / §4 リスク = 実行制約)。本 draft 自体の Self-Review は **適用除外**。

Self-Review: 適用除外

---

## 6. 完了基準

- `~/.claude/commands/plan-rally.md` 新規配置済 (汎用版)
- `~/.claude/hooks/check-plan-on-exit.sh` L181 修正済 (project agnostic 化)
- gkmas-ocr-pipeline 側 claude で `/plan-rally` 起動 → Plan agent 動作確認
- gkmas-ocr-pipeline 側 claude で ExitPlanMode 試行 → hook D-1 check 通過 (or 適切に deny)
- inventory-system 側 `.claude/commands/plan-rally.md` は project local として残置可 (global と内容差分: path hard-code、本 project でも問題なく動く)

---

## 7. archive 条件

gkmas-ocr-pipeline 側で実動作確認できた時点で `docs/archive/plans/2026-05-17-plan-rally-globalization.md` に移送 (memory `plan-archive-discipline.md` + `feedback-archive-relative-path-conversion.md` 遵守)。
