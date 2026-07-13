# Codex Inventory Status Bar Notes

This directory tracks the project-local Codex status bar experiments for
`inventory-system`. Keep operational conclusions here so `.codex/README.md`
can stay focused on the supported launch surface.

## Current Modes

- `codex-inventory`: starts plain Codex without creating tmux and expands
  Codex's native footer with the `inventory-no-bar` profile when available.
- `CODEX_INVENTORY_TMUX_BAR=1 codex-inventory`: starts Codex in the project
  tmux wrapper and adds the lower-pane status bar from
  `.codex/bin/codex-inventory-bar`.

The default plain mode is the supported path for normal work because it keeps
mouse wheel conversation scrolling usable when launched from a non-tmux shell.
The tmux bar mode is retained as an explicit legacy mode for cases where the
richer three-line pane status is worth the mouse-wheel tradeoff.

## Known Symptom

- In Codex TUI, mouse wheel input can be consumed by the TUI/composer instead
  of scrolling the visible conversation history.
- The symptom was first suspected to be caused by the tmux split pane used for
  the lower status bar.
- On 2026-07-07, a tmux `status 3` experiment removed the split pane while
  preserving three lines of status information. User retest showed the mouse
  wheel issue still reproduced, so split pane is not the sole cause.
- Later on 2026-07-07, raw Codex with and without `--no-alt-screen` did not
  reproduce the symptom, and plain `codex-inventory` without tmux also did not
  reproduce. The failing paths are tmux paths.
- Bare tmux boundary test: running raw Codex inside a manually created tmux
  session reproduced mouse wheel absorption. This moves the likely root cause
  from the project wrapper to the tmux + Codex TUI interaction.

Current working hypothesis: this is primarily caused by the tmux + Codex TUI
interaction, not Codex TUI alone and not the project wrapper alone. The split
pane is not sufficient to explain the bug by itself because the no-split tmux
status experiment still reproduced it.

## Timeline

- Baseline: default `codex-inventory` used a lower tmux split pane for the bar.
  Information density was good, but mouse wheel input could reach the Codex
  composer instead of scrolling the conversation.
- Mitigation: `codex-inventory` added a suppressor that repeatedly disables
  xterm mouse reporting and alternate-scroll modes with DEC private-mode reset
  sequences.
- No-bar mode: `CODEX_INVENTORY_NO_BAR=1 codex-inventory` was added for a
  wrapper path with no external bar.
- Native footer attempt 1: passing a top-level `-c status_line=[...]` override
  did not expand the footer reliably in Codex 0.142.5.
- Native footer attempt 2: `$CODEX_HOME/inventory-no-bar.config.toml` with
  `[tui].status_line` worked. Verified footer items include model/reasoning,
  context remaining/used, 5h/weekly usage limits, Git branch/diff summary,
  approval mode, and Codex version.
- Split-pane hypothesis test: tmux 3.4 `status 3` plus
  `status-format[0..2]` rendered the same three-line bar without a split pane.
  Rendering and cleanup worked, but user retest showed mouse wheel absorption
  still reproduced.
- Interim decision: after the no-split experiment failed, the default was
  briefly reverted to the lower-pane bar because it had the desired information
  layout.
- Raw Codex boundary test: `/home/kosei/.npm-global/bin/codex ...` and the same
  command with `--no-alt-screen` did not reproduce mouse wheel absorption.
  This makes Codex TUI alone less likely as the root cause.
- Bare tmux boundary test: raw Codex inside a manually created tmux session
  reproduced mouse wheel absorption. This makes tmux the next layer to isolate.
- tmux `mouse off` test: raw Codex inside tmux still reproduced mouse wheel
  absorption, so tmux mouse mode alone is not the root cause.
- tmux `alternate-screen off` test: raw Codex inside tmux still reproduced
  mouse wheel absorption, so alternate-screen alone is not the root cause.
- tmux `mouse off` plus `alternate-screen off` test: raw Codex inside tmux
  still reproduced mouse wheel absorption, so the simple tmux mouse and
  alternate-screen options are not sufficient.
- Raw Codex with `--no-alt-screen` inside tmux still reproduced mouse wheel
  absorption, so Codex's no-alt-screen flag alone is not sufficient once tmux
  is in the path.
- tmux `mouse on` test: the wheel appears to enter tmux copy/scroll mode
  (`[1/1]` indicator at the top right) instead of cleanly scrolling Codex
  history. This is not a usable fix; it changes the failure mode from composer
  absorption to tmux copy-mode capture.
- Decision: make plain non-tmux `codex-inventory` the default with an expanded
  native footer, and move the old lower-pane tmux bar behind the explicit
  `CODEX_INVENTORY_TMUX_BAR=1 codex-inventory` mode.

## Tried Results

| Approach | Result | Current decision |
|---|---|---|
| Plain `codex-inventory` | No tmux; expanded native footer works via `[tui].status_line`; mouse wheel absorption not reproduced | Default |
| `CODEX_INVENTORY_TMUX_BAR=1` lower-pane tmux bar | Best information density; mouse wheel failure reproduced | Explicit legacy mode |
| `CODEX_INVENTORY_NO_BAR=1` | Legacy alias for no external bar; mouse wheel absorption not reproduced | Keep compatible |
| `-c status_line=[...]` only | Did not reliably expand the TUI footer | Avoid as primary path |
| tmux `status 3` no-split bar | Rendered correctly, but did not fix mouse wheel absorption | Reverted |
| Alt-scroll/mouse suppressor | Mitigates some terminal mode drift, but not proven root fix | Keep while investigating |
| Raw Codex | Mouse wheel absorption not reproduced | Use as control |
| Raw Codex with `--no-alt-screen` | Mouse wheel absorption not reproduced | Use as control |
| Raw Codex inside bare tmux | Mouse wheel absorption reproduced | Isolate tmux options next |
| Raw Codex inside tmux with `mouse off` | Mouse wheel absorption reproduced | Not sufficient |
| Raw Codex inside tmux with `alternate-screen off` | Mouse wheel absorption reproduced | Not sufficient |
| Raw Codex inside tmux with `mouse off` and `alternate-screen off` | Mouse wheel absorption reproduced | Not sufficient |
| Raw Codex with `--no-alt-screen` inside tmux | Mouse wheel absorption reproduced | Not sufficient |
| Raw Codex inside tmux with `mouse on` | Enters tmux copy/scroll mode and shows `[1/1]`; does not cleanly scroll Codex history | Not usable |

## Related Upstream Issues

- <https://github.com/openai/codex/issues/22936>:
  WSL Codex CLI long sessions can jump the viewport back to the top after a
  response or while scrolling.
- <https://github.com/openai/codex/issues/15380>:
  Windows Terminal / WSL scrollback and rendering behavior differs from macOS
  terminals.
- <https://github.com/openai/codex/issues/10726>:
  WSL scroll regression where planner output could not be scrolled while idle.
- <https://github.com/openai/codex/issues/2836>:
  zellij plus Codex TUI could not use mouse/pane scrollback to view earlier
  conversation, with analysis around alternate screen and alternate scroll.
- <https://github.com/openai/codex/issues/27644>:
  xterm.js hosts can lose inline TUI history when Codex uses scroll-region
  sequences that do not enter scrollback in those emulators.

No exact upstream issue has been found yet for "mouse wheel events appear in
the Codex composer as typed input" on current Codex CLI 0.142.x, but the issues
above point to the same terminal/TUI surface area.

## Next Debug Checklist

Record each result here before changing code again.

- Done: raw Codex with no wrapper did not reproduce:
  `/home/kosei/.npm-global/bin/codex -C /home/kosei/Projects/inventory-system --sandbox workspace-write --ask-for-approval on-request`.
- Done: raw Codex with `--no-alt-screen` did not reproduce.
- Done: plain / no-tmux `codex-inventory` did not reproduce.
- Done: `CODEX_INVENTORY_NO_BAR=1 codex-inventory` did not reproduce.
- Done: `CODEX_INVENTORY_DISABLE_ALT_SCROLL=0 codex-inventory` reproduced.
- Done: raw Codex inside a bare tmux session reproduced.
- Done: tmux with `mouse off` reproduced.
- Done: tmux with `alternate-screen off` reproduced.
- Done: tmux with both `mouse off` and `alternate-screen off` reproduced.
- Done: raw Codex with `--no-alt-screen` inside tmux reproduced.
- Done: tmux with `mouse on` captured wheel into tmux copy/scroll mode, but did
  not provide a usable Codex history scroll.
- Capture `codex --version`, `echo $TERM`, `tmux -V`, `tmux show -g mouse`,
  `tmux show -g terminal-features`, terminal app name/version, and whether the
  session is inside Windows Terminal, Codex Desktop, VS Code, or another
  xterm.js host.
- If this is reported upstream, include both the raw Codex control case and the
  tmux reproducer with the
  exact environment, command, expected behavior, actual behavior, and whether
  the input appears as literal composer text or only prevents scrolling.
