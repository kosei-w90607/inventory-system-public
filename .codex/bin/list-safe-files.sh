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

if [ "$#" -eq 0 ]; then
  set -- docs src src-tauri/src src-tauri/tests scripts .github/workflows .codex .agents/skills .claude/skills AGENTS.md Plans.md
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
    docs|docs/*|src|src/*|src-tauri/src|src-tauri/src/*|src-tauri/tests|src-tauri/tests/*|scripts|scripts/*|.github/workflows|.github/workflows/*|.codex|.codex/README.md|.codex/config.toml|.codex/execpolicy.rules|.codex/rules|.codex/rules/*|.codex/bin|.codex/bin/*|.agents/skills|.agents/skills/*|.claude/skills|.claude/skills/*|AGENTS.md|Plans.md)
      ;;
    *)
      echo "path is not in the Codex safe-list allowlist: $input_path" >&2
      exit 1
      ;;
  esac
done

find "$@" -type f \
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
