#!/usr/bin/env bash
set -euo pipefail

script_parent="$(dirname -- "${BASH_SOURCE[0]}")"
if ! SCRIPT_DIR="$(cd -- "$script_parent" 2>/dev/null && pwd -P)"; then
  echo "read-safe-file.sh: cannot resolve script directory: $script_parent" >&2
  exit 1
fi
if ! REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)"; then
  echo "read-safe-file.sh: cannot resolve repository root from script directory: $SCRIPT_DIR" >&2
  exit 1
fi
if ! REPO_ROOT="$(realpath -e -- "$REPO_ROOT" 2>/dev/null)"; then
  echo "read-safe-file.sh: cannot canonicalize repository root" >&2
  exit 1
fi
if ! cd -- "$REPO_ROOT"; then
  echo "read-safe-file.sh: cannot enter repository root: $REPO_ROOT" >&2
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
  echo "usage: .codex/bin/read-safe-file.sh <path> [path...]" >&2
  exit 2
fi

is_allowed_path() {
  case "$1" in
    AGENTS.md|Plans.md|README.md|package.json|package-lock.json|tsconfig*.json|vite.config.ts|eslint.config.js|components.json|lefthook.yml|.gitignore|.editorconfig|.prettierignore|.prettierrc.json) return 0 ;;
    docs/*|src/*|src-tauri/src/*|src-tauri/tests/*|scripts/*|.github/workflows/*|.codex/README.md|.codex/config.toml|.codex/execpolicy.rules|.codex/rules/*|.codex/bin/*) return 0 ;;
    .agents/skills/*.md|.agents/skills/*.txt|.agents/skills/*.json|.agents/skills/*.toml|.agents/skills/*.yml|.agents/skills/*.yaml) return 0 ;;
    .claude/skills/*.md|.claude/skills/*.txt|.claude/skills/*.json|.claude/skills/*.toml|.claude/skills/*.yml|.claude/skills/*.yaml) return 0 ;;
    *) return 1 ;;
  esac
}

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
    echo "path is not in the Codex safe-read allowlist: $rel_path" >&2
    exit 1
  fi

  if [ ! -f "$rel_path" ]; then
    echo "not a file: $rel_path" >&2
    exit 1
  fi

  cat -- "$rel_path"
done
