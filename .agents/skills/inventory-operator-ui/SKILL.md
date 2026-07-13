---
name: inventory-operator-ui
description: "Use instead of generic frontend-design/web-design-guidelines when designing, implementing, or reviewing operator-facing UI in inventory-system, especially stock status, tables, badges, filters, summary cards, active states, Japanese labels, readability, accessibility, or Windows native L3 for a non-IT older store operator. Read SCREEN_DESIGN, UI_TECH_STACK, quality/review-checklist, and the relevant function design; prioritize business readability over visual novelty; forbid color-only state encoding."
---

# Inventory Operator UI

## Purpose

Use this skill for inventory-system UI work where the store operator must read, distinguish, or act on business state.

This is not a general frontend-design skill. The goal is a calm Windows desktop business app for a non-IT older operator, not a landing page, SaaS marketing surface, or visually striking demo.

Use this skill as the main guidance for inventory-system operator UI work even if generic `frontend-design` or `web-design-guidelines` skills are available in the machine/global registry. Those generic skills may be reference material only after this skill and the inventory source docs.

## Required Reading

Follow the single canonical reading order in `AGENTS.md` `Session Start`, loading only the task-specific UI/design documents it routes to; do not restate or reorder that list here.

If the task changes operator workflow, status meaning, route/search behavior, or shared UI contracts, use `$inventory-workflow-start` and treat the work as R3 unless the Plan Packet proves a lower risk.

## Rules

- Design for the actual operator: non-IT, daily store work, Japanese labels, possible presbyopia, and limited tolerance for ambiguous UI.
- Preserve the existing inventory-system visual language before changing a screen: inspect nearby implemented screens, shared layout, table/card/chip patterns, spacing, typography, color tokens, and component variants. A new page should feel like the same Windows business app unless a Plan Packet explicitly changes the shared UI direction.
- Do not encode business status by hue alone. Pair semantic color with Japanese text and at least one non-color signal such as icon, shape, position, badge, or column.
- Keep business labels literal: use terms like `在庫切れ`, `在庫少`, `商品コード`, and `売上明細数` when those are the domain meaning.
- Prefer existing shadcn/Radix components and `lucide-react` icons already in the project. Do not add packages for basic status labels, badges, icons, tables, or tooltips without an explicit plan.
- Keep high-density tables readable: stable column widths, `min-w-0` where truncation is intended, no accidental overflow, and no critical value hidden without a recovery path.
- For state-changing controls, test the full loop: apply the state, return to the previous state, and move directly to another state. The control must remain reachable after its own state change.
- For Select/filter controls, explicitly decide whether options come from all eligible data or the currently filtered result. If options are derived from the filtered result, prove the selection will not collapse to only the current value and block direct switching.
- Do not answer small text complaints with local font-size increases as the default fix. Display scale or webview zoom is a separate cross-screen design involving capability, persistence, and L3 verification.
- Avoid decorative cards, hero treatments, gradient spectacle, novelty layouts, and marketing copy. This app is a repeated-use operations tool.
- Test non-color meaning with text, role, label, and value assertions. Do not rely only on Tailwind color class snapshots.
- For operator-facing UI flow/status changes, plan Windows native L3. A real operator failing to distinguish or read the state is a functional defect, not polish.

## Output Checklist

For implementation or review, report:

- operator task and affected screen
- existing screens/components used as the visual baseline, and any intentional divergence
- status meanings and non-color signals
- Japanese labels that carry the business meaning
- table/card overflow and truncation behavior
- keyboard/focus/active-state behavior
- recovery paths after state changes, including reset and direct switching to other options
- Select/filter option source and whether options remain available after filtering
- tests that assert text/role/value, not only classes
- Windows native L3 requirement and evidence status
