#!/usr/bin/env bash
# scripts/check-env-safety.sh
# ============================================================================
# env ファイル運用の静的安全性検査
# docs/UI_TECH_STACK.md §6.9 環境変数設計に準拠
# ============================================================================
#
# 4 項目検査:
#   1. .env.production に VITE_DEBUG=true / VITE_MOCK_MODE=true が無いか
#      (quote / case insensitive / trailing comment 対応で bypass 経路を狭める)
#   2. .env.{development,test,production} に VITE_ 変数名で SECRET / TOKEN /
#      KEY / PASSWORD を word-boundary で含むものが無いか (.env.example は除外)
#   3. .gitignore に .env / .env.local / .env.*.local が記載されているか
#   4. git ls-files で .env / .env.local / .env.*.local が tracked になっていないか
#      (subfolder src-tauri/.env 等も対象、大文字含む .env.*.local も検出)
#
# 失敗時は exit 1 で CI/pre-push を block する。
#
# この検査の限界:
#   - typo / うっかり対策であり、変数名を偽装した意図的リーク
#     (例: VITE_FOO=secret_abc) は検出できない
#   - 秘密語の検出範囲は SECRET / TOKEN / KEY / PASSWORD のみ。
#     複数形 (KEYS / TOKENS) や AUTH / CREDENTIAL / PRIVATE / HASH 等は現在未対応
#   - 秘密の本格管理は Rust 側 OS keychain (keyring crate) 経由が原則
#     (docs/UI_TECH_STACK.md §6.9)
# ============================================================================

set -u  # 各 check を独立 FAIL=1 集約方式のため set -e は使わない

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

FAIL=0

# ----------------------------------------------------------------------------
# Check 1: .env.production に devtools / mock mode が true で設定されていないか
# ----------------------------------------------------------------------------
# 対応: "true" / 'true' / TRUE / True / trailing space + # comment
CHECK1_PATTERN="^VITE_(DEBUG|MOCK_MODE)=[\"']?true[\"']?[[:space:]]*(#.*)?$"

if [ -f .env.production ]; then
    if grep -iE "$CHECK1_PATTERN" .env.production > /dev/null 2>&1; then
        echo "❌ [env-safety] .env.production に VITE_DEBUG=true または VITE_MOCK_MODE=true が設定されています"
        echo "   本番ビルドで devtools / mock mode が動作する事故を防ぐため禁止"
        grep -niE "$CHECK1_PATTERN" .env.production || true
        FAIL=1
    fi
fi

# ----------------------------------------------------------------------------
# Check 2: VITE_* 変数名に秘密情報キーワード (word boundary) が含まれていないか
# (.env.example は ドキュメント目的でキーワード使用許容のため除外)
# ----------------------------------------------------------------------------
# 変数名の word boundary は underscore (_) または行頭 / '=' 区切り
# 検出: VITE_SECRET=x, VITE_API_KEY=x, VITE_DB_PASSWORD_HASH=x
# 除外: VITE_MONKEY_FOO=x (KEY は MONKEY 内部、word 境界なし)
CHECK2_PATTERN='^VITE_([A-Z0-9]+_)*(SECRET|TOKEN|KEY|PASSWORD)(_[A-Z0-9]+)*='

for env_file in .env.development .env.test .env.production; do
    if [ -f "$env_file" ]; then
        if grep -E "$CHECK2_PATTERN" "$env_file" > /dev/null 2>&1; then
            echo "❌ [env-safety] $env_file に秘密情報キーワード (SECRET/TOKEN/KEY/PASSWORD) を含む VITE_* 変数があります"
            echo "   VITE_ prefix はバンドル公開されるため秘密情報は置けない"
            echo "   秘密が必要な場合は Rust 側 OS keychain (keyring crate) 経由 (docs/UI_TECH_STACK.md §6.9)"
            grep -nE "$CHECK2_PATTERN" "$env_file" || true
            FAIL=1
        fi
    fi
done

# ----------------------------------------------------------------------------
# Check 3: .gitignore に env 個人機上書きパターンが記載されているか
# ----------------------------------------------------------------------------
CHECK3_LABELS=(".env" ".env.local" ".env.*.local")
CHECK3_PATTERNS=('^\.env$' '^\.env\.local$' '^\.env\.\*\.local$')

for i in "${!CHECK3_LABELS[@]}"; do
    label="${CHECK3_LABELS[$i]}"
    pattern="${CHECK3_PATTERNS[$i]}"
    if ! grep -qE "$pattern" .gitignore; then
        echo "❌ [env-safety] .gitignore に $label の記載がありません"
        FAIL=1
    fi
done

# ----------------------------------------------------------------------------
# Check 4: 個人機上書き env ファイルが git tracked になっていないか
# (subfolder src-tauri/.env 等も対象、大文字 .env.Development.local も対象)
# ----------------------------------------------------------------------------
CHECK4_PATTERN='(^|/)\.env$|(^|/)\.env\.local$|(^|/)\.env\.[a-zA-Z0-9_-]+\.local$'

TRACKED_PERSONAL=$(git ls-files | grep -E "$CHECK4_PATTERN" || true)
if [ -n "$TRACKED_PERSONAL" ]; then
    echo "❌ [env-safety] 個人機ローカル env ファイルが git tracked になっています:"
    echo "$TRACKED_PERSONAL"
    echo "   git rm --cached <file> で untrack してください"
    FAIL=1
fi

# ----------------------------------------------------------------------------
# Result
# ----------------------------------------------------------------------------
if [ $FAIL -eq 0 ]; then
    echo "✅ [env-safety] 全チェック通過"
fi

exit $FAIL
