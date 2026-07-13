# Codex Project Configuration

This directory is the project-owned Codex workspace for `inventory-system`.
It is separate from the Codex application/config area on the Windows `C:` drive.

## Shared Project Files

- `config.toml` records project-local Codex defaults such as sandbox intent.
- `rules/default.rules` records the current project-local command policy for Codex versions that load `.codex/rules/*.rules`.
- `execpolicy.rules` mirrors the same policy for explicit validation and older notes.
- `bin/` contains safe wrappers used by the command policy.
- `README.md` explains this directory's project-local permission model.

## Permission Layers

| Layer | Path | Git | Purpose |
|---|---|---|---|
| Project shared | `.codex/config.toml`, `.codex/rules/default.rules`, `.codex/execpolicy.rules`, `.codex/README.md` | tracked | Repository-wide Codex defaults and command policy intent |
| Project local | `.codex/config.local.toml`, `.codex/execpolicy.local.rules`, `.codex/hooks.json`, `.codex/hooks/` | ignored | Machine-specific temporary overrides and hook experiments |
| Global / app-owned | Codex app config outside this repo | not touched here | Codex-wide defaults managed by the app/user, not by this project |

Do not treat repo-local `config.toml` or `hooks.json` as automatically active unless the active Codex version documents project autoloading for those files. Current Codex Desktop/CLI builds load project-local policy from `.codex/rules/*.rules` only when the project is trusted. Keep `execpolicy.rules` mirrored for explicit `codex execpolicy check --rules` validation.

## Recommended Local Mode

For this WSL repository, prefer a low-friction but still sandboxed local mode:

```toml
sandbox_mode = "workspace-write"
approval_policy = "on-request"
```

This avoids repeated prompts for normal sandboxed shell commands and file edits while keeping explicit escalation, remote mutation, and destructive operations as review points. If the active Codex version does not load project `.codex/config.toml`, start Codex with equivalent CLI flags:

```bash
codex -C /home/kosei/Projects/inventory-system --sandbox workspace-write --ask-for-approval on-request
```

`approval_policy = "untrusted"` is useful for auditing but too noisy for normal implementation work in this repo. `approval_policy = "never"` and `--dangerously-bypass-approvals-and-sandbox` are not normal project defaults.

For experiments with rule-driven approvals, Codex CLI 0.137 accepts the granular shape:

```toml
approval_policy = { granular = { sandbox_approval = true, rules = true, mcp_elicitations = true, request_permissions = true, skill_approval = true } }
```

In practice, `workspace-write + on-request` has been less noisy for WSL-local work than repeatedly validating rule matches during an implementation session.

## Inventory Launch Wrapper

The `bin/codex-inventory` helper is the project-local launch command for this
repository. It starts Codex with the canonical WSL path and normal sandbox
settings. By default it starts plain Codex without tmux and expands Codex's
native footer with the project status items. There are two supported launch
modes:

```bash
codex-inventory
CODEX_INVENTORY_TMUX_BAR=1 codex-inventory
```

The default `codex-inventory` path avoids tmux because mouse wheel input was
confirmed to be captured incorrectly when Codex TUI runs inside tmux. In this
plain mode, the wrapper temporarily expands the native footer with
model/reasoning, context remaining and used, 5-hour and weekly usage limits,
Git branch/diff summary, approval mode, and Codex version. It prefers a Codex
profile named `inventory-no-bar` when
`$CODEX_HOME/inventory-no-bar.config.toml` exists; otherwise it falls back to an
equivalent one-shot `-c status_line=...` override. Use
`CODEX_INVENTORY_NATIVE_STATUS=0 codex-inventory` only when the launch should
preserve the user's normal native footer exactly. To avoid the mouse-wheel bug,
run the default command from a non-tmux shell; the wrapper cannot remove an
already active parent tmux session.

Mouse wheel absorption into the Codex composer is tracked separately in
`status-bar/README.md`. The split-pane bar was tested as a possible cause, but
the symptom also reproduced after removing the split pane while remaining in
the tmux wrapper path. Raw Codex with and without `--no-alt-screen` did not
reproduce the symptom, and `CODEX_INVENTORY_NO_BAR=1` also did not reproduce.
Raw Codex inside a manually created tmux session did reproduce, so the current
working assumption is tmux + Codex TUI interaction rather than the project
wrapper alone.

The legacy lower-pane tmux bar is still available with
`CODEX_INVENTORY_TMUX_BAR=1 codex-inventory` for sessions where the richer
three-line pane status is more important than mouse-wheel history scrolling.
The lower-pane bar intentionally stays lightweight. It shows only stable local
information that does not require reading Codex credentials or private service
internals: repository, branch/dirty state, diff size, Codex version,
model/reasoning, and sandbox/approval settings. It also calls `codex app-server
--stdio` through `bin/codex-inventory-metrics` to display the safe subset of
account rate-limit metadata used by Codex's native `/usage` and footer
surfaces: 5h and 7d usage percent, reset countdown, and available reset
credits. That rate-limit line is cached under `/tmp` for 60 seconds.
Per-thread context usage is intentionally deferred until the wrapper has a
stable way to identify the active Codex thread.

Current local wiring:

- `~/.zshrc` maps `codex-inventory` to
  `/home/kosei/Projects/inventory-system/.codex/bin/codex-inventory`.
- `bin/codex-inventory` defaults to plain Codex with an expanded native footer.
- `CODEX_INVENTORY_TMUX_BAR=1 codex-inventory` starts a `tmux` session when
  needed and adds the lower-pane bar.
- `~/.codex/config.toml` keeps the native Codex footer limited to
  `status_line = ["context-used"]`; `codex-inventory` overrides this only for
  that launch unless `CODEX_INVENTORY_NATIVE_STATUS=0` is set.
- `~/.codex/inventory-no-bar.config.toml` is the preferred local profile for
  the plain launch mode when present.

  ```toml
  [tui]
  status_line = ["model-with-reasoning", "context-remaining", "context-used", "five-hour-limit", "weekly-limit", "git-branch", "branch-changes", "approval-mode", "codex-version"]
  ```
- The legacy tmux bar path still disables xterm mouse reporting and
  alternate-scroll modes while Codex runs by default
  (`CODEX_INVENTORY_DISABLE_ALT_SCROLL=0` opts out). This mitigation is not a
  root fix for tmux mouse-wheel behavior.

Context status decision:

- The lower-pane bar should not read Codex transcripts, auth files, or internal
  SQLite/log details just to estimate context.
- A small app-server probe confirmed `thread/list`, `thread/read
  includeTurns=true`, and experimental `thread/turns/list` do not expose
  persisted `tokenUsage` / `modelContextWindow` for normal Codex TUI sessions.
- The app-server schema includes live `thread/tokenUsage/updated`
  notifications, but those are available to the app-server client driving a
  thread, not to a sidecar bar watching a separate Codex TUI process.
- Therefore the current split is: lower-pane bar owns account rate limits and
  local repo/session facts; Codex's native footer owns per-thread context usage.

Follow-up candidates:

- Tune the ANSI colors and compact layout to better match the preferred usage
  bar style.
- Revisit context only if Codex exposes a stable active-thread metrics source
  for the TUI, or if the launch wrapper intentionally moves from Codex TUI to an
  app-server-driven client.

## Local Files

Machine-specific overrides must stay untracked:

- `config.local.toml`
- `execpolicy.local.rules`
- `rules/*.local.rules`
- `hooks.json` and `hooks/` until Codex Desktop hook loading and input schema are confirmed for this project
- `logs/`
- `state/`

## Working Directory

Use WSL execution against the canonical repository path:

```powershell
wsl.exe -d Ubuntu-22.04 --cd /home/kosei/Projects/inventory-system --exec <command>
```

Avoid direct `\\wsl.localhost\...` access for project automation because it can fail at the Windows sandbox/UNC boundary.

## Policy Principles

- Treat the Windows `C:` drive Codex installation/config area as app-owned, not project workspace.
- Keep project work under the developer's Codex workspace area on `D:` or inside each app/repository directory.
- Allow low-risk inspection and documented verification commands.
- Read/search files through repo-owned wrapper prefixes rather than broad raw `cat` / `sed` / `rg` / `find` approvals.
  The command policy allows both the canonical WSL absolute form and the shorter repo-relative form from a trusted project session:

```powershell
wsl.exe -d Ubuntu-22.04 --cd /home/kosei/Projects/inventory-system --exec /home/kosei/Projects/inventory-system/.codex/bin/read-safe-file.sh
wsl.exe -d Ubuntu-22.04 --cd /home/kosei/Projects/inventory-system --exec /home/kosei/Projects/inventory-system/.codex/bin/search-safe-files.sh
wsl.exe -d Ubuntu-22.04 --cd /home/kosei/Projects/inventory-system --exec /home/kosei/Projects/inventory-system/.codex/bin/list-safe-files.sh
wsl.exe -d Ubuntu-22.04 --cd /home/kosei/Projects/inventory-system --exec .codex/bin/read-safe-file.sh
wsl.exe -d Ubuntu-22.04 --cd /home/kosei/Projects/inventory-system --exec .codex/bin/search-safe-files.sh
wsl.exe -d Ubuntu-22.04 --cd /home/kosei/Projects/inventory-system --exec .codex/bin/list-safe-files.sh
```

- Direct WSL sessions in the canonical repository root may also use:

```bash
.codex/bin/read-safe-file.sh AGENTS.md
.codex/bin/search-safe-files.sh "pattern" docs
.codex/bin/list-safe-files.sh docs
```

- Keep `wsl.exe ... bash -lc ...`, raw `cat`, raw `sed`, raw `rg`, raw `find`, arbitrary shell, destructive operations, and GitHub mutations in ask/deny.
- Allow non-secret instruction and skill docs under `.agents/skills/` and `.claude/skills/` so review workflows can load their `SKILL.md` and reference Markdown through the safe wrappers.
- Refuse `.env*`, key/certificate-looking files, secret/credential-looking files, and `auth.json` in safe wrappers.
- Prompt for git mutations and generated tracked-file updates.
- Forbid destructive commands in the project policy; run them only after separate explicit approval naming the exact target.
- Allow documented local verification commands without prompts from both WSL bridge and trusted direct WSL sessions, including `git status` / `git diff` / `git log` / `git show`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, doc consistency scripts, and Rust `cargo fmt --check` / `cargo clippy` / `cargo test` from `src-tauri/`.
- Allow local Codex diagnostic commands such as `codex execpolicy check`, `codex doctor`, and `codex features list`.

## Validation

Check a proposed rule match with:

```powershell
codex execpolicy check --pretty --rules .codex\rules\default.rules -- <command tokens>
```

Example:

```powershell
codex execpolicy check --pretty --rules .codex\rules\default.rules -- wsl.exe -d Ubuntu-22.04 --cd /home/kosei/Projects/inventory-system --exec /home/kosei/Projects/inventory-system/.codex/bin/read-safe-file.sh AGENTS.md
```

If Codex Desktop does not auto-load project rules in a given version, copy or import the reviewed rules through the active Codex rules mechanism instead of broadening the global sandbox.
