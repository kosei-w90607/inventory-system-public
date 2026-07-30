# Review Order: Claude hook contract audit final CH10 closure

## 1. Goal

Claude Opus 5 / effort xHigh / fresh context（D-056 §5.4低制約profile）のread-only reviewerを1人だけ起動し、PR #48のfrozen P2-CH10について最終closure-only reviewを行う。相談窓口役は原本を改変せず投入し、reviewer結果と自身の検算を区別して集約し、Coordinatorが`independent-review -> human-confirm`可否を裁定できる材料をownerへ返す。P2-CH4の再審、新規Broad Audit、P3探索、任意の証跡拡張は行わない。

## 2. Scope boundary

- Target Plan Packet: `docs/plans/2026-07-31-claude-hook-contract-audit.md`
- Target content SHA: `e28249948ff53a8a906aee4c170e4f3e5a2d111f`
- Target remote branch ref: `refs/heads/codex/claude-hook-audit`
- Target PR: `#48`
- Risk / stage: `R3 workflow gate change / independent-review closure`
- Initial reviewed SHA: `4cc49baec3a31aa6d705c7402177501e86ff764a`
- Review target: `4cc49baec3a31aa6d705c7402177501e86ff764a..e28249948ff53a8a906aee4c170e4f3e5a2d111f`のCH10 re-correction差分、およびexact target HEADの該当source / test / Packet / Matrix / PR body。
- Frozen P2-CH10: `scripts/tests/claude-hooks.test.sh`でsource-direct検査2行をコメント化してliteralだけ残し、tracked sourceへstray hookを追加する合成mutationがredになること。
- Behavioral closure criterion: `make_fixture(source, fixture)`がtracked sourceのsettings / docs / `.claude/hooks/**`を同じ派生fixtureへmaterializeし、duplicate fixtureだけを読む退化やsource hook非伝播を許さないこと。使い捨てcopy / temporary cloneで合成mutationを実行して確認すること。
- Claim alignment: Matrix CH10のsource propagation mutation、Packet / PR bodyのcorrection claim、実装のfailure pathが一致すること。
- Frozen P2-CH4は前回closureでCLOSED済み。再審しない。CH6 / CH8 / CH9と既存P3も再審しない。
- Evidence check: PR headRefOidがtarget content SHAと一致し、working tree clean、exact target HEADのL1 fullがPR bodyのSHAと一致してPASS / CLEAN / `MERGE_EVIDENCE_VALID=true`であること。hosted final pendingはReady前の既知gapでありfindingにしない。
- Findings Freezeを維持する。新規P2はruntime failureを実証した場合だけfreeze exception候補として報告し、既存P3や新規cosmetic findingの探索は行わない。
- npm audit既知5件、user-global `~/.claude/**`、Claude Code本体、plugin cache / upgrade / repair、Codex hook、product code、DB、UIはNon-scope。correction差分が越境した場合だけ報告する。

## 3. Read-only declaration

相談窓口役と生成するreviewerはread-only。repository file編集、commit、push、PR操作、settings変更、state遷移、merge、発注書の作成・改変を行わない。mutation adequacyは使い捨てcopy / temporary clone等、target repositoryへ永続的副作用を残さない方法で検証する。reviewerは再委譲しない。

## 4. Report format

- Verdictは`APPROVE`または`REQUEST CHANGES`とし、closure対象のP1 / P2 / P3件数を示す。P1/P2=0ならhuman-confirm可、1件以上ならfrozen finding IDごとのresidual failure pathと最小是正境界を示す。
- `P2-CH10`を`CLOSED` / `PARTIALLY CLOSED` / `OPEN`で判定し、source file:line、合成mutationの実行 evidence、主張と実体の一致を根拠にする。P2-CH4は再審しない。
- Rejected / Deferred、Verification Gaps、Merge / Split Judgment、Review Summaryを含める。約15項目以内のbounded evidence summaryとし、raw log、full-file dump、長大なdiff転載は返さない。
- 相談窓口役はreviewerのverdictを改変せず示し、その後に独立検算、発注spec遵守、Coordinator裁定候補を区別して集約する。

## 5. Subagent generation cap

- Target risk ceiling: workflow gate change = concurrent 3
- Target current counted subagents/reviewers: 0
- Wave current counted subagents: 0（wave外の単独change）
- Reserved new generation count for this order: 1
- Arithmetic: target `0 + 1 <= 3`; wave `0 + 1 <= 4`
- このorderで生成してよいsubagentはClaude Opus 5 / effort xHigh / fresh context 1人だけ。depth 1を維持し、生成したreviewerに再委譲させない。review完了またはorder supersedeまで予約枠を他へ割り当てない。
