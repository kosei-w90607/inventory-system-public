# Review Order: Claude hook contract audit frozen P2 closure

## 1. Goal

Claude Opus 5 / effort xHigh / fresh context（D-056 §5.4低制約profile）のread-only reviewerを1人だけ起動し、PR #48のFinal Double AuditでfrozenとなったP2 2件についてclosure-only reviewを行う。相談窓口役は原本を改変せず投入し、reviewer結果と自身の検算を区別して集約し、Coordinatorが`independent-review -> human-confirm`可否を裁定できる材料をownerへ返す。新規Broad Audit、P3探索、任意の証跡拡張は行わない。

## 2. Scope boundary

- Target Plan Packet: `docs/plans/2026-07-31-claude-hook-contract-audit.md`
- Target content SHA: `4cc49baec3a31aa6d705c7402177501e86ff764a`
- Target remote branch ref: `refs/heads/codex/claude-hook-audit`
- Target PR: `#48`
- Risk / stage: `R3 workflow gate change / independent-review closure`
- Initial reviewed SHA: `3a54baf67c900f20e72bddf5f4e5018961338c98`
- Review target: `3a54baf67c900f20e72bddf5f4e5018961338c98..4cc49baec3a31aa6d705c7402177501e86ff764a`のcorrection差分、およびexact target HEADの該当source / tests / Packet / Matrix / PR body。
- Frozen P2-CH4: `scripts/tests/claude-hooks.test.sh`の`validate_live_docs()`が`docs/Plans.md`を実際に読み、Plans専用mutationで契約違反がredになること。Matrixの「Plans backlogをCH4 + drift sweepで覆う」主張と実装が一致すること。
- Frozen P2-CH10: source-direct `validate_contract "$SOURCE_ROOT"`呼出しの削除がfixture mutation群とは独立にredになるanti-tautology guardが実装され、documented CH10 claimと実装が一致すること。
- Correction-boundary regression check: 上記2件と同じtest-only correctionに含めたCH6 / CH8 / CH9 labelとhosted validator failure診断が、既存Scope / Non-scope / durable zero-hook contractを変えず成立すること。
- Evidence check: PR headRefOidがtarget content SHAと一致し、working tree clean、exact target HEADのL1 fullがPR bodyのSHAと一致してPASS / CLEAN / `MERGE_EVIDENCE_VALID=true`であること。hosted final pendingはReady前の既知gapでありfindingにしない。
- Findings Freezeを維持する。新規P2はruntime failureを実証した場合だけfreeze exception候補として報告し、既存P3や新規cosmetic findingの探索は行わない。
- npm audit既知5件、user-global `~/.claude/**`、Claude Code本体、plugin cache / upgrade / repair、Codex hook、product code、DB、UIはNon-scope。correction差分が越境した場合だけ報告する。

## 3. Read-only declaration

相談窓口役と生成するreviewerはread-only。repository file編集、commit、push、PR操作、settings変更、state遷移、merge、発注書の作成・改変を行わない。mutation adequacyは使い捨てcopy / temporary clone等、target repositoryへ永続的副作用を残さない方法で検証する。reviewerは再委譲しない。

## 4. Report format

- Verdictは`APPROVE`または`REQUEST CHANGES`とし、closure対象のP1 / P2 / P3件数を示す。P1/P2=0ならhuman-confirm可、1件以上ならfrozen finding IDごとのresidual failure pathと最小是正境界を示す。
- `P2-CH4` / `P2-CH10`をそれぞれ`CLOSED` / `PARTIALLY CLOSED` / `OPEN`で判定し、source file:line、実行・mutation evidence、主張と実体の一致を根拠にする。
- Rejected / Deferred、Verification Gaps、Merge / Split Judgment、Review Summaryを含める。約15項目以内のbounded evidence summaryとし、raw log、full-file dump、長大なdiff転載は返さない。
- 相談窓口役はreviewerのverdictを改変せず示し、その後に独立検算、発注spec遵守、Coordinator裁定候補を区別して集約する。

## 5. Subagent generation cap

- Target risk ceiling: workflow gate change = concurrent 3
- Target current counted subagents/reviewers: 0
- Wave current counted subagents: 0（wave外の単独change）
- Reserved new generation count for this order: 1
- Arithmetic: target `0 + 1 <= 3`; wave `0 + 1 <= 4`
- このorderで生成してよいsubagentはClaude Opus 5 / effort xHigh / fresh context 1人だけ。depth 1を維持し、生成したreviewerに再委譲させない。review完了またはorder supersedeまで予約枠を他へ割り当てない。
