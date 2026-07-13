# Active Todo

## Current Task

- Task: `CLAUDE.md` を短い root rules に整理し、`tasks/` と初回 review Skill に責務分離する
- Goal: root instructions を短く保ちながら、lessons と review workflow を再利用可能な形で repo に定着させる
- Status: Completed

## Plan

- [x] Understand current state
- [x] Confirm constraints
- [x] Implement or review
- [x] Verify
- [x] Summarize results

## Notes

- Assumptions: `CLAUDE.md` は常時読む憲法、`tasks/lessons.md` は再発防止、`.claude/skills/` は specialized workflow を置く場所として使う
- Risks: specialized guidance を root に戻し始めると、再び `CLAUDE.md` が肥大化する
- Relevant files:
  - `CLAUDE.md`
  - `tasks/lessons.md`
  - `tasks/todo.md`
  - `.claude/skills/inventory-code-review/SKILL.md`
  - `.claude/skills/inventory-code-review/references/review-checklist.md`
  - `.claude/skills/inventory-code-review/references/source-map.md`

## Verification

- [x] Files created in expected locations
- [x] `CLAUDE.md` and `tasks/lessons.md` stored as UTF-8
- [x] review Skill references the repository design docs
- [x] git status checked

## Review Summary

- Outcome: `CLAUDE.md` を短い working defaults に整理し、`tasks/` と repo-local review Skill へ責務分離した
- What changed: `CLAUDE.md` を再構成し、`tasks/lessons.md` と `tasks/todo.md` を追加、`.claude/skills/inventory-code-review/` を新設した
- What was verified: 追加ファイルの配置、UTF-8 の保存、review Skill の参照構造
- Remaining risks: review Skill は初版なので、実際のレビュー運用で観点不足が出たら `references/review-checklist.md` を増強する
