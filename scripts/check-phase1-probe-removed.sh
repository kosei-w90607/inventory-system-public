#!/bin/bash
# Phase 1 の toy command (greet) が残っていないか検知する運用補助スクリプト
#
# 実行タイミング: Phase 2 UI-00 実装前（Plans.md 7-5c / 第8段階着手時）
# 出典: PR #42 Codex レビュー P3-2 対応（機械的防止策として grep ベースの軽量検知を採用）
#
# 注意:
# - set -e は使わない。rg が 0 件ヒット時に exit 1 を返すのは正常ケースで、
#   if 節で包んでいるため set -e は不要。かえって予期せぬ早期 exit を招く
# - docs/ 配下は検索対象外（ADR 等の説明言及はマッチさせない）
# - 自動生成物（routeTree.gen.ts / lib/bindings.ts）は検索対象外

# 前提チェック（Codex 任意改善対応）:
# rg (ripgrep) 未導入環境や git 管理外実行時を exit 2 で明示区別する。
# exit code 設計:
#   0 = Phase 1 toy command 削除完了
#   1 = greet 参照が残留
#   2 = 前提不備（rg 未導入 or git 管理外）
if ! command -v rg >/dev/null 2>&1; then
    echo "❌ rg (ripgrep) が見つかりません。インストール（例: apt install ripgrep / brew install ripgrep）してから再実行してください。" >&2
    exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
    echo "❌ git 管理下で実行してください（git rev-parse --show-toplevel が失敗）。" >&2
    exit 2
fi

found=0

echo "🔍 src-tauri/src/lib.rs で greet 参照を検索..."
if rg -n '\bgreet\b' "$REPO_ROOT/src-tauri/src/lib.rs" 2>/dev/null; then
    echo "❌ src-tauri/src/lib.rs に greet 参照が残っています"
    found=1
fi

echo "🔍 src/ (frontend) で greet 参照を検索..."
if rg -n '\bgreet\b' "$REPO_ROOT/src" --glob '!routeTree.gen.ts' --glob '!lib/bindings.ts' 2>/dev/null; then
    echo "❌ src/ に greet 参照が残っています"
    found=1
fi

if [ $found -eq 0 ]; then
    echo "✅ Phase 1 toy command (greet) 削除完了"
fi
exit $found
