#!/usr/bin/env bash
set -euo pipefail

script_parent="$(dirname -- "${BASH_SOURCE[0]}")"
if ! SCRIPT_DIR="$(cd -- "$script_parent" 2>/dev/null && pwd -P)"; then
  echo "list-safe-files.sh: cannot resolve script directory: $script_parent" >&2
  exit 1
fi
if ! REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)"; then
  echo "list-safe-files.sh: cannot resolve repository root from script directory: $SCRIPT_DIR" >&2
  exit 1
fi
if ! REPO_ROOT="$(realpath -e -- "$REPO_ROOT" 2>/dev/null)"; then
  echo "list-safe-files.sh: cannot canonicalize repository root" >&2
  exit 1
fi
if ! cd -- "$REPO_ROOT"; then
  echo "list-safe-files.sh: cannot enter repository root: $REPO_ROOT" >&2
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

if [ "$#" -eq 0 ]; then
  set -- docs src src-tauri/src src-tauri/tests scripts .github/workflows .codex .agents/skills .claude/skills AGENTS.md Plans.md
fi

is_allowed_path() {
  case "$1" in
    docs|docs/*|src|src/*|src-tauri/src|src-tauri/src/*|src-tauri/tests|src-tauri/tests/*|scripts|scripts/*|.github/workflows|.github/workflows/*|.codex|.codex/README.md|.codex/config.toml|.codex/execpolicy.rules|.codex/rules|.codex/rules/*|.codex/bin|.codex/bin/*|.agents/skills|.agents/skills/*|.claude/skills|.claude/skills/*|AGENTS.md|Plans.md) return 0 ;;
    *) return 1 ;;
  esac
}

canonical_paths=()
for input_path in "$@"; do
  case "$input_path" in
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
    echo "path is not in the Codex safe-list allowlist: $rel_path" >&2
    exit 1
  fi

  canonical_paths+=("$rel_path")
done

find "${canonical_paths[@]}" -type f \
  ! -iname '.env' \
  ! -iname '.env.*' \
  ! -iname 'auth.json' \
  ! -iname 'credentials.json' \
  ! -iname '*.pem' \
  ! -iname '*.key' \
  ! -iname '*.crt' \
  ! -iname '*.cer' \
  ! -iname '*.cert' \
  ! -iname '*.p12' \
  ! -iname '*.pfx' \
  ! -iname '*secret*' \
  ! -iname '*credential*' \
  ! -iname '*credentials*' \
  ! -iname '*access_token*' \
  ! -iname '*access-token*' \
  ! -iname '*refresh_token*' \
  ! -iname '*refresh-token*' \
  ! -iname '*id_token*' \
  ! -iname '*id-token*' \
  ! -iname '*api_token*' \
  ! -iname '*api-token*' \
  ! -iname '*auth_token*' \
  ! -iname '*auth-token*' \
  ! -iname '*bearer_token*' \
  ! -iname '*bearer-token*' \
  ! -iname '*github_token*' \
  ! -iname '*github-token*' \
  ! -iname '*npm_token*' \
  ! -iname '*npm-token*' \
  ! -iname 'token' \
  ! -iname '.token' \
  ! -iname '*.token' \
  ! -iname 'token.*' \
  ! -path '*/node_modules/*' \
  ! -path '*/target/*' \
  ! -path '*/.git/*' \
  | sort
