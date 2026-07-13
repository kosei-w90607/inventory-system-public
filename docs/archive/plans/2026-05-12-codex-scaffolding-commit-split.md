# Codex 足場 + 周辺変更の 3 分割コミット

## Context

`.codex/` と `.agents/skills/inventory-code-review/` の Codex 用足場を新規追加した過程で、関連する複数ファイル変更（gitignore / AGENTS.md / doc-consistency-check.sh / DEV_SETUP_CHECKLIST.md / project-memory.md）が同時に working tree に積み上がった。これを「まとめて 1 コミット」せず、テーマで 3 分割してコミットする。

**判断根拠**:
- `.codex/` と `AGENTS.md` の Workspace Access セクションは `.codex/bin/read-safe-file.sh` 等を文書参照しており不可分（同コミット必須）
- 一方、`scripts/doc-consistency-check.sh` の `require_linux_ripgrep` 追加と `docs/DEV_SETUP_CHECKLIST.md` の ripgrep 追記は Codex とは独立した「静的チェック前提の明示化」テーマ
- `docs/project-memory.md` のリンク先修正 (`docs/current-status.md` → `Plans.md`) はさらに独立した 1 行修正
- `CLAUDE.md`「conventional commits only」ルール下で prefix が `chore(codex)` / `build(scripts)` / `docs:` と分かれる
- `git revert` / `git bisect` の粒度として、Codex 設定ロールバック時に rg 必須化やリンク修正まで吹き飛ばさない

## コミット計画

### A. `chore(codex): add codex agent scaffolding + review skill`

**対象**:
- `.codex/` (新規ディレクトリ全体: `config.toml`, `execpolicy.rules`, `hooks.json`, `hooks/`, `bin/`, `README.md`)
- `.agents/skills/inventory-code-review/` (新規: `SKILL.md`, `references/`)
- `.gitignore` (Codex local-only overrides 8 行追加)
- `AGENTS.md` (BOM/CRLF 正規化 + Workspace Access / Test Commands / Review Rules / Safety 追記)

**コミットメッセージ**:
```
chore(codex): add codex agent scaffolding + review skill

- .codex/ に config / execpolicy / hooks / 安全実行 bin スクリプトを追加
- .agents/skills/inventory-code-review/ に code review skill を追加
- .gitignore に Codex local-only ファイル (*.local.*, hooks/, logs/, state/) を除外
- AGENTS.md を BOM/CRLF 正規化し Workspace Access / Test Commands / Review Rules / Safety を追記
```

### B. `build(scripts): require linux ripgrep for doc-consistency-check`

**対象**:
- `scripts/doc-consistency-check.sh` (`require_linux_ripgrep` 関数 +25 行)
- `docs/DEV_SETUP_CHECKLIST.md` (必要ツール一覧 + apt install リストに `ripgrep` を追記)

**コミットメッセージ**:
```
build(scripts): require linux ripgrep for doc-consistency-check

WSL 内で実行される doc-consistency-check.sh が Windows 側 (/mnt/*) の
rg にフォールバックする事故を防ぐため、Linux 版 ripgrep を必須化する。
DEV_SETUP_CHECKLIST.md の必要ツール一覧と apt install コマンドにも追記。
```

### C. `docs: point project-memory live status to Plans.md`

**対象**:
- `docs/project-memory.md` (Companion Docs の live status を `docs/current-status.md` → `Plans.md`)

**コミットメッセージ**:
```
docs: point project-memory live status to Plans.md

docs/current-status.md は廃止済みで live status は Plans.md に統合済み。
project-memory.md の Companion Docs 参照を実体に合わせて更新。
```

## 実行手順

```bash
# A
git add .codex/ .agents/skills/inventory-code-review/ .gitignore AGENTS.md
git commit -m "$(cat <<'EOF'
chore(codex): add codex agent scaffolding + review skill

- .codex/ に config / execpolicy / hooks / 安全実行 bin スクリプトを追加
- .agents/skills/inventory-code-review/ に code review skill を追加
- .gitignore に Codex local-only ファイル (*.local.*, hooks/, logs/, state/) を除外
- AGENTS.md を BOM/CRLF 正規化し Workspace Access / Test Commands / Review Rules / Safety を追記
EOF
)"

# B
git add scripts/doc-consistency-check.sh docs/DEV_SETUP_CHECKLIST.md
git commit -m "$(cat <<'EOF'
build(scripts): require linux ripgrep for doc-consistency-check

WSL 内で実行される doc-consistency-check.sh が Windows 側 (/mnt/*) の
rg にフォールバックする事故を防ぐため、Linux 版 ripgrep を必須化する。
DEV_SETUP_CHECKLIST.md の必要ツール一覧と apt install コマンドにも追記。
EOF
)"

# C
git add docs/project-memory.md
git commit -m "$(cat <<'EOF'
docs: point project-memory live status to Plans.md

docs/current-status.md は廃止済みで live status は Plans.md に統合済み。
project-memory.md の Companion Docs 参照を実体に合わせて更新。
EOF
)"

# 検証
git log --oneline -5
git status
```

## 検証

- `git log --oneline -5` で 3 コミットが順に並ぶこと
- `git status` で working tree がクリーンになること
- push はしない（ユーザー指示待ち）

**注意**: コミット時に既存の pre-commit hook (lefthook: eslint --fix + prettier --write on `*.{ts,tsx,js,jsx,json,md,yml,yaml}`) が staged Markdown に走る可能性あり。AGENTS.md / docs/* が prettier 整形で差分追加された場合は warning メッセージを確認して同コミットに含める。

## Self-Review: 適用除外

**理由**: 本プランは実装変更 0、`git add` + `git commit` のみで構成される運用作業。新規ロジック・テスト・設計判断・破壊的操作なし。memory `plan-self-review-before-implementation.md` の 7 観点（prerequisites / scripts / verification / post-processing / constraints / commit split）のうち実質的に該当するのは commit split のみで、それは Context セクションで根拠を明示済み。
