Plan レビューラリーを実行する。ExitPlanMode 前に Plan agent を独立 context で起動して plan 本体を critique させ、新規指摘 0 まで反復する。

引数: $ARGUMENTS (例: `--rounds 3 --agent plan --converge new-findings-zero`)

## 設計原理

memory `feedback-claude-self-bias-blind-spot.md` + `feedback-plan-rally-required-before-exit.md`:

- Claude 自主判断は信頼しない、ユーザー指摘待ちでは仕組みが回らない
- 機械的強制 (hook deny / slash command の強制呼出) でしか質担保できない
- 独立 context の subagent でしか自己 bias に気付けない

`.claude/hooks/check-plan-on-exit.sh` D-1 check は「直近 30 分以内に Plan/general-purpose subagent の plan critique log」を必須化、本 skill 起動で agent log 残留 → hook pass 経路。

## 引数仕様

| 引数 | 既定値 | 説明 |
|---|---|---|
| `--rounds N` | 2 | 最大反復回数 |
| `--agent {plan\|general-purpose}` | plan | 起動する subagent type |
| `--converge {new-findings-zero\|max-rounds}` | new-findings-zero | 終了条件 (新規指摘 0 / 最大ラウンド到達) |

## 実行フロー

1. **直近 plan ファイル特定**

   ```bash
   # find ベース (fd は WSL に未 install のため、依存最小化、Codex PR #56 P3-1 反映)
   # xargs -r で no-input 時の ls -t fallback (cwd 列挙) を抑止 (Codex PR #56 Round 2 P2 反映)
   PLAN_DOCS=$(find /home/kosei/Projects/inventory-system-public/docs/plans -name '*.md' -type f -mmin -120 2>/dev/null | xargs -r ls -t 2>/dev/null | head -1)
   PLAN_TMP=$(find /home/kosei/.claude/plans -name '*.md' -type f -mmin -60 2>/dev/null | xargs -r ls -t 2>/dev/null | head -1)
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

## 想定落とし穴 (Backlog 第 2 段階で本格化)

| 落とし穴 | 対策 (本 skill) | 対策 (案 C 第 2 段階) |
|---|---|---|
| hook timeout 超過 (subagent 60s 超え) | prompt scope を最小限に絞る | `maxTurns: 3` + 指摘 5 件上限 |
| 収束ループ無限化 (修正放棄) | `--rounds` で上限設定 | `max-plan-review-rounds: 3` config |
| critic agent 自身の bias | 7 観点を prompt で明示指定 | 7 観点 JSON schema 型注入 |
| false positive | severity 区分 + 軽微は無視判断 | "reject only if fundamentally flawed" + warn-only mode |
| token cost 蓄積 | 各 round で同 plan 全文渡さず差分 critique | round budget config |

## 参照

- `.claude/hooks/check-plan-on-exit.sh` — D-1 check 実装 (find -L + grep `(subagent_type|attributionAgent)` + KEYWORD)
- memory `feedback-self-review-mechanical-addition-anti-pattern.md` — Self-Review 機械的見出し追加の reject
- memory `feedback-plan-mode-recursive-refinement.md` — 多発失敗 / 違和感時は再ラリー
- memory `feedback-claude-self-bias-blind-spot.md` — Claude 自己 bias の盲点
- memory `feedback-plan-rally-required-before-exit.md` — ExitPlanMode 前ラリー強制
- Plans.md Backlog 「Plan レビューラリー仕組み化 第 2 段階 (案 C 自動 loop)」
