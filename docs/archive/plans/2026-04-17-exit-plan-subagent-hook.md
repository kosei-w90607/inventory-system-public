# ExitPlanMode hook 拡張: Subagent 半自動化 (brief)

> このファイルは前セッション (memory-migration T04/T05 サブプラン) の後継。新セッションで実装するための brief。
>
> **運用前提**:
> - Step 0 (brief コピー) は **現セッション (Plan mode 抜けた直後)** に実行済みの想定
> - 次セッションは Step 1 から開始 (`docs/plans/exit-plan-subagent-hook.md` を Read)

## Context

公式ブログ https://claude.com/blog/using-claude-code-session-management-and-1m-context が「new task = new session」を推奨している。
前セッションで「ExitPlanMode → 自動 /clear → クリーンコンテキスト」を試したい話になったが、技術調査で **Claude Code の hook API では会話セッション再起動制御は不可能** と判明した。

**代替案**: ExitPlanMode 時に hook が「このプランは Subagent (general-purpose, run_in_background: true) で実行することを検討せよ」と additionalContext を注入する。メイン Claude が判断 → subagent 起動 → クリーンコンテキストで実装。

これは公式ブログの「subagent for chunked output」推奨パターンと整合する。完全自動の /clear ではないが、subagent 起動でクリーンコンテキストを得るという**より良い方向性**。

## Critical Files (新セッションで読むべきファイル)

| ファイル | 役割 |
|---------|------|
| `/home/kosei/inventory-system/.claude/hooks/check-plan-on-exit.sh` | 既存 ExitPlanMode hook。実装パターン参考、職責分離するため**変更しない** |
| `/home/kosei/inventory-system/.claude/hooks/audit-trigger-plan.sh` | PostToolUse Write hook。JSON in/out のパターン参考 |
| `/home/kosei/inventory-system/.claude/hooks/memory-capture-feedback.sh` | UserPromptSubmit hook。エラー時サイレントフォールバックの参考 |
| `/home/kosei/.claude/settings.json` | グローバル。`hooks.PreToolUse[matcher=ExitPlanMode]` に既存 check-plan-on-exit.sh が登録済み |
| `/home/kosei/inventory-system/.claude/settings.json` | プロジェクト。新規 hook の登録先 |

## 実施手順

### Step 0: brief コピー (★現セッション中に実行、次セッション前)

```bash
cp ~/.claude/plans/generic-sniffing-mochi.md /home/kosei/inventory-system/docs/plans/exit-plan-subagent-hook.md
```

理由: brief を git 管理下に永続化、次セッションで確実に Read できるようにする。`~/.claude/plans/` は machine-local なので次セッションで消失する可能性がある。

**コピー後の運用**: 次セッションでは `docs/plans/exit-plan-subagent-hook.md` をマスターとして参照。差分編集が発生したらそちらのみ更新する。

### Step 1: 新規 hook ファイル作成

パス: `/home/kosei/inventory-system/.claude/hooks/suggest-subagent-for-plan.sh`

**責務**: ExitPlanMode 時に「subagent 適用を検討せよ」というリマインダを additionalContext で注入する。判定自体はメイン Claude に委ねる (CLAUDE.md 規約で補完)。
**既存 check-plan-on-exit.sh とは職責分離** (整合性チェック ≠ subagent 推奨)。

**設計変更点 (前版からの修正)**:
- 既存 check-plan-on-exit.sh の実装を確認した結果、**hook 側でプラン本文を完全に取得するのは困難** と判明:
  - Plan mode の plan file は `~/.claude/plans/<random>.md` にあるが、hook 入力 (`tool_input: {}`) には含まれない
  - `find .claude/plans docs/plans` は過去の plan のみヒット (現プランは `$HOME` 側)
- 対策: hook はキーワード検出を試みるが、**プラン本文が取れなくてもリマインダだけは注入する**。判定の詳細はメイン Claude に委ねる

**ロジック**:

1. stdin JSON から `cwd` 取得 (ExitPlanMode の `tool_input` は空)
2. プランファイルを探す (ベストエフォート):
   - `find $CWD/.claude/plans $CWD/docs/plans $HOME/.claude/plans -name "*.md" -type f` で候補列挙
   - `mtime` 最新を採用
   - **取れなければサイレントにキーワード判定スキップ → 常時リマインダを注入**
3. プラン本文が取れた場合はキーワード検出:
   - **subagent 推奨シグナル** (実装系): `実装|作成|Write|Edit|cargo|npm|build|並列発火|fmt|clippy`
   - **subagent 不適合シグナル** (対話フレーズ単位): `ユーザーに確認|意見を求める|途中で判断|対話的|AskUserQuestion`
4. 判定結果に応じて additionalContext を生成:
   - 推奨 ∧ ¬不適合 → 「**Subagent 推奨**: このプランは general-purpose subagent (run_in_background: true) で実行することを検討せよ...」
   - 推奨 ∧ 不適合 → 「**Subagent 不適合**: このプランは対話判断を含む...」
   - 不明 (プラン取得失敗) → 「**Subagent 判定**: プラン本文を直接参照してメイン Claude が subagent 適用を判断せよ...」
   - 推奨シグナルなし → サイレント
5. `exit 0` (失敗時もサイレント、エラーは `stderr` へ)

**実装テンプレート**:

```bash
#!/bin/bash
HOOK_INPUT=$(cat)
CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty' 2>/dev/null)
[ -z "$CWD" ] && exit 0

# プランファイル探索 (ベストエフォート)
PLAN_FILE=$(find "$CWD/.claude/plans" "$CWD/docs/plans" "$HOME/.claude/plans" -maxdepth 2 -name "*.md" -type f 2>/dev/null \
  | xargs -I{} stat -c '%Y {}' 2>/dev/null | sort -rn | head -1 | awk '{print $2}')

emit_context() {
  local msg="$1"
  local escaped
  escaped=$(echo -n "$msg" | jq -Rs . 2>/dev/null) || exit 0
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"additionalContext\":$escaped}}"
}

if [ -z "$PLAN_FILE" ] || [ ! -f "$PLAN_FILE" ]; then
  # プランファイルが取れない場合: メイン Claude に判断を委ねるリマインダ
  emit_context "**Subagent 判定リマインダ**: プラン本文を参照して、実装作業なら Agent (general-purpose, run_in_background: true) で subagent 起動を検討せよ。対話判断が必要なら手動実行。公式推奨パターン: https://claude.com/blog/using-claude-code-session-management-and-1m-context"
  exit 0
fi

PLAN_BODY=$(cat "$PLAN_FILE" 2>/dev/null) || exit 0

RECOMMEND_SIG="実装|作成|Write|Edit|cargo|npm|build|並列発火|fmt|clippy"
EXCLUDE_SIG="ユーザーに確認|意見を求める|途中で判断|対話的|AskUserQuestion"

HAS_RECOMMEND=$(echo "$PLAN_BODY" | grep -cE "$RECOMMEND_SIG" 2>/dev/null || echo 0)
HAS_EXCLUDE=$(echo "$PLAN_BODY" | grep -cE "$EXCLUDE_SIG" 2>/dev/null || echo 0)

if [ "$HAS_RECOMMEND" -gt 0 ] && [ "$HAS_EXCLUDE" -eq 0 ]; then
  emit_context "**Subagent 推奨**: このプランは general-purpose subagent (run_in_background: true) で実行することを検討せよ。プラン本文を Agent tool に渡して bg 起動すれば、クリーンコンテキストで context rot を回避できる。"
elif [ "$HAS_RECOMMEND" -gt 0 ] && [ "$HAS_EXCLUDE" -gt 0 ]; then
  emit_context "**Subagent 不適合**: このプランは対話判断を含む。subagent はインタラクティブ操作不可なので手動実行を推奨。"
fi

exit 0
```

### Step 1.5: 実行権限付与 (独立 step に昇格)

```bash
chmod +x /home/kosei/inventory-system/.claude/hooks/suggest-subagent-for-plan.sh
```

既存 hook も `chmod +x` 済みのはず (確認: `ls -la .claude/hooks/`)。

### Step 2: settings.json 登録

`/home/kosei/inventory-system/.claude/settings.json` の `hooks.PreToolUse` に追加 (既存配列を変更):

```json
"PreToolUse": [
  {
    "matcher": "ExitPlanMode",
    "hooks": [
      { "type": "command", "command": ".claude/hooks/suggest-subagent-for-plan.sh", "timeout": 10 }
    ]
  }
]
```

注意: グローバル側 `check-plan-on-exit.sh` と並列実行される。両方の additionalContext が連結される (10000文字上限内なら問題なし)。

### Step 3: 動作テスト

4パターンのテストプランを `/tmp/test-plan-{A,B,C,D}.md` に作成して hook 動作確認:

| パターン | ファイル | プラン内容例 | 期待動作 |
|---------|---------|-----------|--------|
| A. 大規模実装プラン | `/tmp/test-plan-A.md` | 「Rust モジュール作成、cargo test、npm install...」 | Subagent 推奨メッセージ |
| B. 対話必要プラン | `/tmp/test-plan-B.md` | 「実装を進めるが途中でユーザーに確認...」 | Subagent 不適合メッセージ |
| C. 小規模調査プラン | `/tmp/test-plan-C.md` | 「ファイルを Read して報告」(実装キーワードなし) | サイレント |
| D. プラン取得失敗 | (空ディレクトリで実行) | - | Subagent 判定リマインダメッセージ |

**テスト実行**:
```bash
# A-C: プランファイルを $CWD/docs/plans/ に置いてテスト
cp /tmp/test-plan-A.md /home/kosei/inventory-system/docs/plans/test-subagent-hook-a.md
echo '{"cwd":"/home/kosei/inventory-system"}' | bash .claude/hooks/suggest-subagent-for-plan.sh | jq .
rm /home/kosei/inventory-system/docs/plans/test-subagent-hook-a.md

# D: プランファイルを一切置かずに空の cwd で実行
mkdir -p /tmp/empty-project && cd /tmp/empty-project
echo '{"cwd":"/tmp/empty-project"}' | bash /home/kosei/inventory-system/.claude/hooks/suggest-subagent-for-plan.sh | jq .
```

**テスト完了後は必ず `/tmp/test-plan-*.md` と `/tmp/empty-project` を削除**。

### Step 4: ドキュメント追記

`/home/kosei/inventory-system/CLAUDE.md` を **まず Read して現状把握** してから、適切な位置にセクション追加。
候補位置:
- 「## コマンド」セクションの後
- 「## やってはいけないこと」セクションの前
- または末尾の「## Git」セクションの後

挿入するセクション:

```markdown
## ExitPlanMode hook の挙動

ExitPlanMode 発動時に以下の hook が並列実行される:
- `check-plan-on-exit.sh` (グローバル): プラン整合性チェック (エラー時は ExitPlanMode をブロック)
- `suggest-subagent-for-plan.sh` (プロジェクト): subagent 推奨判定 → additionalContext 注入

**Claude の判断規約**:
- 「**Subagent 推奨**」メッセージを受け取ったら、Agent tool (general-purpose, run_in_background: true) で subagent 起動を提案する
- 「**Subagent 不適合**」メッセージの場合は subagent を使わず手動実行
- 「**Subagent 判定リマインダ**」(プラン本文が取れなかった場合) の場合はプラン本文を自分で参照して判断する

動機: 公式ブログ「new task = new session」推奨パターンを半自動化。長時間実装タスクを subagent で独立コンテキスト化することで context rot を回避。
```

## 設計判断

| 判断 | 理由 |
|------|------|
| 既存 hook 拡張ではなく新規 hook | 単一責任原則。整合性チェック ≠ subagent 推奨 |
| キーワード検出の単純判定 | 80% カバーで十分。LLM 解析は hook 実行速度的に不適 |
| 推奨は「提案のみ」(強制しない) | hook で additionalContext 注入してもメイン Claude の判断は奪えない |
| 対話シグナルで除外 | 「途中ユーザー確認必要」なプランは subagent 不適合 (subagent はインタラクティブ不可) |
| プロジェクト hook (グローバルではなく) | inventory-system 固有の挙動。他プロジェクトに影響を与えない |

## 検証

- Step 3 のテストプラン3パターンで動作確認
- 実プランで試行: 例えば次の memory-migration T17 (継続運用ルール最終確認) で hook が発火するか観察
- 既存 check-plan-on-exit.sh の挙動が変わってないこと (回帰確認)

## 動機 (前セッション議論サマリ)

公式ブログの主張:
- 「new task = new session」を推奨
- subagent はチャンク化された出力に最適 (公式推奨パターン)
- /clear 自動化は SDK レベルでも非提供 = 手動

技術調査結果 (Explore Agent):
- ExitPlanMode の `tool_input` は空 = プラン本文は cwd から探す方式必要
- `additionalContext` は実装フェーズの最初の応答に注入される
- PreToolUse hook を並列で複数登録できる (機能障害なし)
- 判定はキーワード検出で十分

このプランで実現するもの:
- ExitPlanMode 時に「このプランは subagent でやるべき」を機械的に提案
- メイン Claude が判断 → subagent 起動 → クリーンコンテキストで実装
- 公式推奨パターン (subagent for chunked output) を hook で半自動化

## ロールバック

新規 hook 作成 + settings.json 編集のみ。副作用ゼロ:
- hook 削除 or chmod -x で無効化
- settings.json は Edit で revert
- 既存 hook (check-plan-on-exit.sh 等) は一切変更しない

## 既知のリスク

| リスク | 対応 |
|--------|------|
| キーワード判定が雑 (false positive / negative) | Step 3 で実プラン3つ試行 → パターン調整 |
| プランファイル探索が遅い (大規模プロジェクトで find が重い) | maxdepth=2 で制限済み、timeout=10s で保護 |
| グローバル check-plan-on-exit.sh と additionalContext が重複し冗長 | 10000文字上限内、両方サイレントケースが多数派 (整合性 OK + 推奨なし = 両方無音) |
| シェルスクリプトのエスケープ事故 | jq -Rs で JSON エスケープ、手動テスト必須 |

## 新セッションでの作業指示 (一言で)

「`docs/plans/exit-plan-subagent-hook.md` を読んで Step 1〜4 を順次実装してテスト」と言うだけで開始可能。
Step 0 (brief コピー) は現セッション中に実行済みの想定。完了後 git commit せず (ユーザー判断)。

## このプランは subagent 向きか? (自己適用テスト)

新 hook 自身の判定ルールをこのプランに適用すると:
- 推奨シグナル: 「実装」「作成」「cargo」(❌ 入ってないが似たキーワードあり) → 推奨 HIT
- 不適合シグナル: (含まない)

→ **このプランこそ Subagent 起動候補**。新セッションで実装するとき、メイン Claude が「Agent (general-purpose, run_in_background: true) でこのプラン丸投げ」を検討する機会になる。新 hook が発火すればドッグフーディングが成立する。
