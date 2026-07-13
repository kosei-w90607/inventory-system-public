#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/home/kosei/Projects/inventory-system"
cd "$REPO_ROOT"

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

if [ "$#" -lt 1 ]; then
  echo "usage: .codex/bin/search-safe-files.sh <pattern> [path...]" >&2
  exit 2
fi

pattern="$1"
shift

if [ "$#" -eq 0 ]; then
  set -- docs src src-tauri/src src-tauri/tests scripts .github/workflows .codex/README.md .codex/execpolicy.rules .codex/rules/default.rules .codex/bin .agents/skills .claude/skills AGENTS.md Plans.md
fi

for input_path in "$@"; do
  case "$input_path" in
    -*)
      echo "refusing option-like path: $input_path" >&2
      exit 2
      ;;
  esac

  if is_sensitive_path "$input_path"; then
    echo "refusing sensitive path: $input_path" >&2
    exit 1
  fi

  case "$input_path" in
    docs|docs/*|src|src/*|src-tauri/src|src-tauri/src/*|src-tauri/tests|src-tauri/tests/*|scripts|scripts/*|.github/workflows|.github/workflows/*|.codex/README.md|.codex/execpolicy.rules|.codex/rules|.codex/rules/*|.codex/bin|.codex/bin/*|.agents/skills|.agents/skills/*|.claude/skills|.claude/skills/*|AGENTS.md|Plans.md)
      ;;
    *)
      echo "path is not in the Codex safe-search allowlist: $input_path" >&2
      exit 1
      ;;
  esac
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
  -- "$pattern" "$@"
