# Review Order: Claude hook contract audit Final Double Audit

## 1. Goal

Claude Sonnet 5 / effort xHigh / fresh context と Claude Opus 5 / effort xHigh / fresh context（D-056 §5.4低制約profile）の read-only reviewer を各1人、相互に独立した context で起動し、PR #48 の Final Contract Audit を2 pass実施する。各 reviewer が互いの結果を受け取る前に独立判定を完了させる。相談窓口役は2結果を改変せず区別して集約し、共通点・相違点・Coordinatorが裁定すべき材料をownerへ返す。

## 2. Scope boundary

- Target Plan Packet: `docs/plans/2026-07-31-claude-hook-contract-audit.md`
- Target content SHA: `3a54baf67c900f20e72bddf5f4e5018961338c98`
- Target remote branch ref: `refs/heads/codex/claude-hook-audit`
- Target PR: `#48`
- Risk / stage: `R3 workflow gate change / independent-review`
- Review target: `origin/main...3a54baf67c900f20e72bddf5f4e5018961338c98` の全差分と、Plan Packet / Test Design Matrix / PR body が主張する契約・Scope・evidence。
- Contract Audit target:
  - Contract Coverage Ledgerの全rowがsource contract、実装、automated test、L3 / Non-scopeへ実際に接続し、触れたcontractの漏れがないこと。
  - Double Auditの2 passが独立し、同じexact target content SHAを評価すること。
  - CH1〜CH11がsource-directであり、実mutationがproject hook追加、plugin再有効化、tracked hook再追加、active claim再導入、canonical gate除去、local / hosted wiring除去、ignore除去をred化すること。fixtureだけを自己検証するtautologyがないこと。
  - touched source docsのnegative spaceとadjacent contractを含め、zero-hook inventory、harness project無効化、user-global / machine-local / tracked責務境界、optional plan helper、classifier、local full、hosted docs jobが一貫すること。
  - first drift findingがある場合に同語彙のlive repository sweepで追随漏れが判別できること。
  - automated testで証明できない事項が残る場合、そのmanual / new-session dogfood境界とmerge影響が明示されていること。
  - PR bodyが最終差分、Risk、Phase、local exact-head evidence、既知npm audit warning、pending hosted finalを正しく表すこと。
- Primary failure lenses:
  - tracked `.claude/settings.json`からeffective project hook inventory 0本とharness `false`を一意に復元できない。
  - retired hook、command文字列由来の虚偽完了通知、read-only roleへのwrite指示、旧Self-Review / plan rally強制がlive pathに残る。
  - `.claude/**`のclassifier / local / hosted wiringが抜け、変更が見せかけのgateを通過する。
  - canonical Plan Review、doc consistency、pre-push、L1 full、hosted finalの既存ownerを弱める、またはClaude hookへ重複実装する。
  - repo-owned `.gitignore`とmachine-local settingsの責務、plugin無効化とplugin cache Non-scope、product/runtime Non-scopeが混線する。
  - source testとCI static testの双方が同じ誤ったliteralを共有し、broken production wiringでもgreenになる。
- Hosted CIはReady authorization前のため未実行であり、pendingであること自体はfindingにしない。Ready前に必要なhosted wiringとexact-head L1の成立はreview対象。
- npm audit既知5件の解消、user-global `~/.claude/**`、Claude Code本体、plugin cache / upgrade / repair、Codex hook、product code、DB、UIはNon-scope。差分が越境している場合だけfindingとする。

## 3. Read-only declaration

相談窓口役と生成する2 reviewerはread-only。repository file編集、commit、push、PR操作、settings変更、state遷移、merge、発注書の作成・改変を行わない。mutation adequacyは使い捨てcopy / temporary clone等、target repositoryへ永続的副作用を残さない方法で検証する。reviewerは再委譲しない。

## 4. Report format

- Sonnet passとOpus passを分離し、それぞれ `APPROVE` または `REQUEST CHANGES`、P1 / P2 / P3件数を示す。
- findingは `P1|P2|P3 - file:line - issue / reproducible failure path / impact / smallest safe correction boundary`。
- 各passに Rejected / Deferred、Verification Gaps、Merge / Split Judgment、Review Summaryを含める。
- 相談窓口役は2 passの共通finding、片側finding、severity差、Coordinator裁定候補を区別し、aggregate verdictを示す。Findings Freezeは両pass完了後に発効する。
- source file:lineの実読を根拠とし、約20項目以内のbounded evidence summaryにする。raw log、full-file dump、長大なdiff転載は返さない。
- P1/P2=0なら`independent-review -> human-confirm`可。P1/P2が1件以上ならsame-PR correction要否とbacktrack先を示す。P3-onlyはFindings Freeze規則に従いfollow-upかsame-PRかを明記する。

## 5. Subagent generation cap

- Target risk ceiling: workflow gate change = concurrent 3
- Target current counted subagents/reviewers: 0
- Wave current counted subagents: 0（wave外の単独change）
- Reserved new generation count for this order: 2
- Arithmetic: target `0 + 2 <= 3`; wave `0 + 2 <= 4`
- このorderで生成してよいsubagentはClaude Sonnet 5 / effort xHigh / fresh context 1人とClaude Opus 5 / effort xHigh / fresh context 1人の計2人だけ。depth 1を維持し、生成したreviewerに再委譲させない。両passの完了またはorder supersedeまで予約枠を他へ割り当てない。
