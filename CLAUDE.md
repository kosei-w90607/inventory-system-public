# 在庫管理システム（手芸店向けデスクトップアプリ）

個人経営手芸店のPOS連携在庫管理システム。Tauri 2.0 + React + TypeScript + SQLite。

## 言語ルール

日本語で応答。コメントも日本語OK。識別子（変数/関数/型）は英語。コミット本文は日本語OK、prefixは英語（`feat:`/`fix:`/`test:`/`docs:`/`refactor:`）。

## Codex と共通の作業視界

`AGENTS.md` `Session Start` が唯一の canonical reading order。Claude Code でもその順序とリンク先に従い、ここへ順序や共通 workflow を複製しない。Codex/OpenAI harness の `.agents/skills/*/SKILL.md` は、Claude Code が Skill として load しない場合も plain procedure docs として読める。

## Claude subagent / project hook

Role / availability mode / subagent budget は `docs/AGENT_OPERATING_MANUAL.md` と `docs/DEV_WORKFLOW.md` を正とする。Claude worker が編集するときは worktree isolation または Plan Packet に明示した非重複 ownership を使い、writer を自己承認者にしない。

このrepositoryのtracked project hook inventoryは0本。`claude-code-harness`もproject scopeで無効化する。Plan Gateは独立Plan Review、doc consistency、pre-push、local full、hosted finalが所有し、Claude固有hookで再実装しない。

## セッション復旧・引き継ぎ

長い作業や複数 tool call を伴う作業では、節目ごとに「目的 / 変更済みファイル / 実行コマンドと結果 / 未完了タスク / 次の一手」を短く残す。Claude Code が tool call 後に停止・ハングした場合、まず `Ctrl+C`、だめなら新しい terminal で同じ repo から `claude --resume <session-id>` を試す。再開後も同じ不具合が出る場合は `claude --resume <session-id> --fork-session` で分岐する。`tool_use` / `tool_result` 系 API 400 など transcript 破損が疑われる場合は resume/fork を諦め、新規 session で `AGENTS.md` `Session Start` の canonical order、`git diff`、直近の引き継ぎメモを読んで再開する。

## 記憶システム運用

Claude Code純正のauto-memoryは個人用の補助層としてのみ使う。project固有の事実・判断・進捗は`AGENTS.md`のMemory Modelに従ってtracked docsへ置き、repository hookからmemory writeを注入しない。

- 格納場所: `/home/kosei/.claude/projects/-home-kosei-Projects-inventory-system-public/memory/`
- project固有の進捗正本: `Plans.md` / Plan Packet / PR body
- durableなproject判断: `docs/decision-log.md`または該当design doc
- auto-memoryへの保存は明示的な個人メモ用途に限定し、workflow gateや完了条件にしない

## npm 供給網防御ルール（常設、2026-07-05 D-030 で凍結から移行）

npm supply chain 攻撃は 2026 年に常態化している（Axios 3月 / node-ipc 5月 / Mini Shai-Hulud 5月 / Miasma 6月 / Mastra 6月）。方針は「攻撃が止んだら解禁」ではなく「**攻撃が続く前提で、当たっても発火しない常設ガードの下で通常運用する**」（D-030）。blanket 凍結期間（2026-05-13〜2026-07-05）の経緯は memory `feedback-npm-install-blocked-mini-shai-hulud-2026-05.md` と decision-log D-019/D-029/D-030 を参照。

### 常設ガード（恒久維持、解除しない）

- `.npmrc` `ignore-scripts=true`: install script 実行 block。preinstall / postinstall / binding.gyp 経由の暗黙 node-gyp rebuild を含む（Miasma 型 payload の発火を遮断）
- `.npmrc` `min-release-age=7`: publish から 7 日未満の version を解決しない。悪性 version は通常数時間〜数日で registry から削除されるため、cooldown 中に消える
- 新規追加は `npm install <pkg>@<ver> --save-exact`（devDep は `--save-dev` 併用）、lockfile 変更は PR diff でレビュー
- CI / 環境再構築は `npm ci --ignore-scripts`

### 禁止（引き続き実行しない）

- `npm audit fix --force`（一括強制更新）
- package 名を明示しない `npm update` / `npm upgrade`（更新は名指しの意図的更新のみ）
- version pin なしの `npx <package>`（`npx <pkg>@x.y.z` は可）
- `min-release-age-exclude[]` の追加（cooldown bypass は user 明示承認必須）

### 逐次投入の手順（軽量）

1. 必要になった package を `npm install <pkg>@<ver> --save-exact` で追加
2. 既知の active advisory（例: GHSA-g7cv-rxg3-hmpx）に関連する package のみ affected range を確認
3. PR 前に `npm audit --audit-level=high` を確認
4. 新規 runtime 依存の追加は plan / PR で明示する（セキュリティ儀式ではなく通常の設計規律として）

## やってはいけないこと

- 設計ドキュメントを読まずに実装を始める
- 既存のテストを削除または無効化する（skipも不可）
- プロジェクトのファイルをこのディレクトリ外（`~/.claude/` 配下等）に保存する。sandbox で read-only かつ git 管理外になり、作業継続も履歴追跡も不可になる
- **npm の常設ガードを迂回する**（`ignore-scripts` / `min-release-age` の解除・bypass、`npm audit fix --force`、名指しでない一括 `npm update`。上記「npm 供給網防御ルール」参照）
