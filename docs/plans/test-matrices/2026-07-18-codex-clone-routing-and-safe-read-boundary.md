# Test Design Matrix — `.codex/` clone routing + safe-read boundary 是正

対象: `scripts/tests/codex-safe-wrappers.test.sh`（新設）。契約 ID は packet の SPEC-CODEX-SAFE-BOUNDARY-2026-07-18 C1–C7。
fixture は `$TMPDIR` の合成 git repo（allowlist 相当 dir + 合成 file + repo 外実体への symlink）で構成し、実在の global Skill・secrets を fixture 化しない。

| ID | 契約 | 対象 script | 系列 | 入力 / 手順 | 期待結果 |
|---|---|---|---|---|---|
| T1 | C2 | search-safe-files.sh | `..` traversal | `"^name:" "docs/../../../.claude/skills"`（現 repo で再現済みの実攻撃列） | 非 0 exit、repo 外内容を出力しない |
| T2 | C2 | list-safe-files.sh | `..` traversal | `docs/../../../` 系引数 | 非 0 exit、repo 外 file 名を列挙しない |
| T3 | C2 | read-safe-file.sh | `..` traversal（回帰） | 同上 | 既存の `refusing path outside repository` 拒否を維持 |
| T4 | C2 | 3 script 各 | allowlist 内 正常系 | `docs/` 配下の実在 file / dir 相対 path | 成功（read は内容、search は match、list は列挙） |
| T5 | C2 | 3 script 各 | 絶対 path | root 内・root 外の絶対 path | 拒否（allowlist は repo 相対字面のみ、現行挙動維持） |
| T6 | C2 | 3 script 各 | symlink 脱出 | fixture repo の allowlist dir 内に repo 外実体への symlink を置き参照 | canonicalize 後 root 外として拒否 |
| T7 | C6 | 3 script 各 | sensitive path | `.env` / `auth.json` / `*secret*` 系名 | 拒否（既存挙動維持） |
| T8 | C2/C6 | 3 script 各 | option-like 引数 | `-x` / `--foo` | 拒否（既存挙動維持） |
| T9 | C1 | 5 script | root 動的解決 | fixture: script 一式を `$TMPDIR` 合成 git repo にコピーして実行 + 実 repo copy の解決先確認 | root = script 所属 repo（fixture copy は fixture repo、実 copy は public root） |
| T10 | C1/C3 | codex-inventory / -bar | override / dry-run | `CODEX_INVENTORY_REPO` 設定時と未設定時の解決先を、tmux / codex 本体を起動しない手段（dry-run flag または root 解決部の関数化）で確認 | 設定時 = override 先、未設定時 = script 所属 repo |
| T11 | C4 | execpolicy 2 mirror | 同一性 + 旧参照ゼロ | `cmp` + 旧 clone path grep（explicit file 2 本、負 glob 不使用） | byte-identical かつ `-public` を除く旧 clone path 0 件 |
| T12 | C5/C7 | B 群 docs / hooks | 旧参照ゼロ | Scope 4–10 の explicit file list を grep（A 群 file は対象外） | 旧 clone 参照 0 件 |
| T13 | C7 | .claude/hooks 6 script | namespace 実在 | hook 内の auto-memory / log path が public namespace（`-home-kosei-Projects-inventory-system-public`）を指す | 参照 dir が現行実体と一致 |

負系列の網羅根拠: 棚卸しで実証された攻撃列（T1/T2）、read-safe-file.sh 既存拒否の後退防止（T3/T5/T7/T8）、canonicalize 導入で新たに閉じるべき系列（T6）、root 動的化のデグレ防止（T9/T10）。

runner 登録: `scripts/local-ci.sh` の `run_required` 明示登録（glob 収集ではない）。hosted CI の job routing で同 test が走ることを Writer が確認し PR body に記録。
