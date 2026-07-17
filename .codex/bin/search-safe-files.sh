#!/usr/bin/env bash
set -euo pipefail

script_parent="$(dirname -- "${BASH_SOURCE[0]}")"
if ! SCRIPT_DIR="$(cd -- "$script_parent" 2>/dev/null && pwd -P)"; then
  echo "search-safe-files.sh: cannot resolve script directory: $script_parent" >&2
  exit 1
fi
if ! REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)"; then
  echo "search-safe-files.sh: cannot resolve repository root from script directory: $SCRIPT_DIR" >&2
  exit 1
fi
if ! REPO_ROOT="$(realpath -e -- "$REPO_ROOT" 2>/dev/null)"; then
  echo "search-safe-files.sh: cannot canonicalize repository root" >&2
  exit 1
fi
if ! cd -- "$REPO_ROOT"; then
  echo "search-safe-files.sh: cannot enter repository root: $REPO_ROOT" >&2
  exit 1
fi

is_sensitive_path() {
  local lower_path
  lower_path="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$lower_path" in
    .env|.env.*|*/.env|*/.env.*|auth.json|*/auth.json|credentials.json|*/credentials.json) return 0 ;;
    *.pem|*.key|*.crt|*.cer|*.cert|*.p12|*.pfx) return 0 ;;
    id_rsa|*/id_rsa|id_ed25519|*/id_ed25519) return 0 ;;
    *secret*|*credential*|*credentials*) return 0 ;;
    *access_token*|*access-token*|*refresh_token*|*refresh-token*|*id_token*|*id-token*|*api_token*|*api-token*|*auth_token*|*auth-token*|*bearer_token*|*bearer-token*|*github_token*|*github-token*|*npm_token*|*npm-token*) return 0 ;;
    token|*/token|.token|*/.token|*.token|*/*.token|token.*|*/token.*) return 0 ;;
    *) return 1 ;;
  esac
}

canonicalize_path() {
  if [[ -e "$1" || -L "$1" ]]; then
    realpath -e -- "$1"
  else
    realpath -m -- "$1"
  fi
}

if [ "$#" -lt 1 ]; then
  echo "usage: .codex/bin/search-safe-files.sh <pattern> [path...]" >&2
  exit 2
fi

pattern="$1"
shift

if [ "$#" -eq 0 ]; then
  set -- docs src src-tauri/src src-tauri/tests scripts .github/workflows .codex/README.md .codex/execpolicy.rules .codex/rules/default.rules .codex/bin .agents/skills .claude/skills AGENTS.md Plans.md
fi

is_allowed_path() {
  case "$1" in
    docs|docs/*|src|src/*|src-tauri/src|src-tauri/src/*|src-tauri/tests|src-tauri/tests/*|scripts|scripts/*|.github/workflows|.github/workflows/*|.codex/README.md|.codex/execpolicy.rules|.codex/rules|.codex/rules/*|.codex/bin|.codex/bin/*|.agents/skills|.agents/skills/*|.claude/skills|.claude/skills/*|AGENTS.md|Plans.md) return 0 ;;
    *) return 1 ;;
  esac
}

canonical_paths=()
for input_path in "$@"; do
  case "$input_path" in
    *$'\n'*|*$'\r'*)
      echo "refusing path containing CR or LF" >&2
      exit 1
      ;;
    -*)
      echo "refusing option-like path: $input_path" >&2
      exit 2
      ;;
    /*)
      echo "refusing absolute path: $input_path" >&2
      exit 1
      ;;
  esac

  if ! abs_path="$(canonicalize_path "$input_path" 2>/dev/null)"; then
    echo "cannot canonicalize path: $input_path" >&2
    exit 1
  fi

  case "$abs_path" in
    "$REPO_ROOT"/*) ;;
    *)
      echo "refusing path outside repository: $input_path" >&2
      exit 1
      ;;
  esac

  rel_path="${abs_path#"$REPO_ROOT"/}"
  if is_sensitive_path "$rel_path"; then
    echo "refusing sensitive path: $rel_path" >&2
    exit 1
  fi

  if ! is_allowed_path "$rel_path"; then
    echo "path is not in the Codex safe-search allowlist: $rel_path" >&2
    exit 1
  fi

  canonical_paths+=("$rel_path")
done

rg -n --hidden \
  --iglob '!**/.env' \
  --iglob '!**/.env.*' \
  --iglob '!**/auth.json' \
  --iglob '!**/credentials.json' \
  --iglob '!**/*.pem' \
  --iglob '!**/*.key' \
  --iglob '!**/*.crt' \
  --iglob '!**/*.cer' \
  --iglob '!**/*.cert' \
  --iglob '!**/*.p12' \
  --iglob '!**/*.pfx' \
  --iglob '!*secret*' \
  --iglob '!*credential*' \
  --iglob '!*credentials*' \
  --iglob '!*access_token*' \
  --iglob '!*access-token*' \
  --iglob '!*refresh_token*' \
  --iglob '!*refresh-token*' \
  --iglob '!*id_token*' \
  --iglob '!*id-token*' \
  --iglob '!*api_token*' \
  --iglob '!*api-token*' \
  --iglob '!*auth_token*' \
  --iglob '!*auth-token*' \
  --iglob '!*bearer_token*' \
  --iglob '!*bearer-token*' \
  --iglob '!*github_token*' \
  --iglob '!*github-token*' \
  --iglob '!*npm_token*' \
  --iglob '!*npm-token*' \
  --iglob '!token' \
  --iglob '!.token' \
  --iglob '!*.token' \
  --iglob '!token.*' \
  -- "$pattern" "${canonical_paths[@]}"
