# Test Design Matrix: Codex 計画癖対策の workflow docs PR

## Risk

Risk: R3

## Contracts Under Test

- C1: `AGENTS.md` Working Rules と `.agents/skills/test-design/SKILL.md` Rules の両方に、数値主張は実測コマンド+出力併記か `未実測` タグの二択である旨の規則が同趣旨で存在する（D-062-D1）
- C2: `docs/templates/plan-packet.md` の Impact Review Lenses table に「環境・再現性」行が追加され、既存 8 行と同じ 3 列構造を保つ（D-062-D2）
- C3: `docs/DEV_WORKFLOW.md` Review Rules に、Writer が Codex の packet では Plan Reviewer が別 vendor 必須である旨、かつ `codex-only` Execution Mode でも免除されない旨が明記され、既存 `Writer ≠ Plan Reviewer`（AGENT_OPERATING_MANUAL.md）と矛盾しない。non-Codex Plan Reviewer が実在しない場合は AGENT_OPERATING_MANUAL.md §3.3 Capacity-degraded に従い pending 化する旨も明記される（D-062-D3、round 1 P1 是正）
- C4（任意）: `scripts/doc-consistency-check.sh` の PK6 heuristic が、Contract Probe / Review Response 内の数値+単位トークンのうち実測 evidence（backtick span または `未実測` タグ）を伴わないものを WARN し、exit code に影響しない（D-062-D4）
- C5: `docs/decision-log.md` に D-062 が新設され、既存 D-034〜D-061 と矛盾しない

## Failure Modes

- F1: AGENTS.md 側と test-design skill 側の文言が乖離し、規則の実効範囲（Test Design Matrix の数値行を含むか）が曖昧になる、または一方にしか追加されない
- F2: Impact Review Lens 行が table 構造を壊す（列数不一致、セクション外への挿入、既存行フォーマットからの逸脱）
- F3: (c) の新規則が既存 `Writer ≠ Plan Reviewer` と重複・矛盾する記述になる、または `codex-only` 免除の除外文が欠落して「codex-only では適用外」と誤読される、または non-Codex Plan Reviewer 不在時の pending fallback（AGENT_OPERATING_MANUAL.md §3.3 Capacity-degraded）への参照が欠落し「vendor 制約ごと免除される」と誤読される
- F4: PK6 が既存 PK1/PK2/PK4 の ERROR 契約や PK3 の WARN 契約を壊す、または exit code に影響する
- F5: PK6 の検出パターンが歴史的 red/green を弁別できない（red 文言で WARN が出ない、または green 文言で WARN が誤検出される）
- F6: D-062 が既存 D-034/D-035/D-038/D-050/D-055/D-056/D-058/D-059 のいずれかと矛盾する記述になる
- F7: PK6 が Contract Probe / Review Response セクション自体が無い packet に対して誤って ERROR を出す、または既存 PK3 の Trace Matrix / Acceptance Criteria 検査と二重計上する

## Test Matrix

- Before citing an existing test as regression coverage, use `rg` or an equivalent repository search to verify that the cited test exists.

| Contract | Failure Mode | Test Type | Test / anchor | Would fail if... | Mutation |
|---|---|---|---|---|---|
| C1 | F1 | doc anchor | `rg -c "実測コマンドとその出力を併記" AGENTS.md` → `1` かつ `rg -c "未実測" .agents/skills/test-design/SKILL.md` → `1`+（baseline 両方 0 実測） | 一方にのみ規則が追加され他方が旧文言のまま残る | M1: `AGENTS.md` の新規 bullet を一時削除し、AC の `rg -c` 実測が `1` から `0` に落ちることを確認 |
| C2 | F2 | doc anchor + 構造確認 | `rg -n "^\| 環境・再現性 " docs/templates/plan-packet.md` が 1 行ヒットし、同行の `\|` 出現数が既存行（例 `\| Replacement path \|  \|  \|`）と同数であることを `rg -o '\|'` の件数比較で確認 | 行の列数が既存 7 行と不一致、またはテーブル外（節の外）に挿入される | M2: 追加行を一時削除し、AC のヒット数が `1` から `0` に落ちることを確認 |
| C3 | F3 | doc anchor + 独立レビュー | `rg -c "must be a different vendor than Codex" docs/DEV_WORKFLOW.md` → `1`（baseline 0 実測）+ `rg -c "Capacity-degraded" docs/DEV_WORKFLOW.md` → `1`+（baseline 0 実測）+ 独立レビューで `AGENT_OPERATING_MANUAL.md` の `Writer ≠ Plan Reviewer`（既存記述）との非矛盾、`codex-only` 免除文の存在、non-Codex Plan Reviewer 不在時に AGENT_OPERATING_MANUAL.md §3.3 Capacity-degraded の pending fallback へ委譲する記述の存在を確認 | 新規則が既存独立性制約と矛盾する文言になる、`codex-only` 免除の除外文が欠落する、または pending fallback への参照が欠落する | M3a: 新規 bullet を一時削除し AC が `0` になることを確認。M3b（review-only）: 「even when Execution Mode is codex-only」相当の除外文を一時削除し、独立レビューが「codex-only では適用外」と誤読しないかを確認する。M3c（review-only）: pending fallback（Capacity-degraded 参照）の一文を一時削除し、独立レビューが「vendor 制約ごと免除される」と誤読しないかを確認する |
| C4（任意） | F4, F5, F7 | unit（bash）+ red/green fixture | `scripts/tests/doc-consistency-plan-packet.test.sh` の新規 fixture group（synthetic packet の Contract Probe へ D-059 round1 相当文言を注入して PK6 WARN 発火を確認、round2 相当文言で WARN 非発火を確認、セクション欠落 packet で ERROR/WARN いずれも出ないことを確認）+ `bash scripts/doc-consistency-check.sh` の exit code が `0` のまま | PK6 が ERROR 相当になる、red/green 判定が逆転する、またはセクション欠落時に誤検出する | X1: red fixture（`outer 30秒より短い内部20秒 + kill-after 2秒deadline` 相当、backtick なし）で PK6 WARN が発火することを確認（Contract Probe で実測済み、パターンレベルの red 確認は済）。X2: green fixture（`` `scripts/doc-consistency-check.sh` fullは33.53 / 33.70 / 33.64秒 `` 相当、backtick あり）で PK6 WARN が非発火であることを確認（同、green 確認は済）。X3: green fixture から backtick span のみを除去した変種で PK6 WARN が発火することを確認（Contract Probe でパターンレベル実測済み、実装後にスクリプト経由で再現） |
| C5 | F6 | doc anchor + 独立レビュー | `rg -c "^## D-062" docs/decision-log.md` → `1`（baseline 0 実測、次番号は `D-061`〈473 行〉であることを実測済み）+ 独立レビューで既存 D-034/D-035/D-038/D-050/D-055/D-056/D-058/D-059 との非矛盾を確認 | D-062 が既存決定と矛盾する記述になる、または番号が重複する | 該当なし（review-only。番号重複は `rg -c "^## D-062"` が `1` を超えることで機械検知される） |

## State Lifecycle Matrix

not applicable — 本 PR は docs / skill / チェッカーの静的規律追加のみで、operator 可視の状態遷移（success/failure/retry/pending 等）を一切持たない。

## Adjacent Pattern Audit

| Source pattern / contract | Repository sites inspected | Ported sites | Explicit exclusions and reason | Test / evidence |
|---|---|---|---|---|
| PK heuristic 実装パターン（PK3 = `check_plan_packet_heuristic_warnings`, WARN-only, `has_acceptance_observable_token` の「任意 backtick span で足りる」寛容基準） | `scripts/doc-consistency-check.sh` 1163-1221 行（PK3）、1223 行以降（PK4） | PK6 は PK3 と同じ WARN-only 契約、同じ backtick span 寛容基準を踏襲 | PK4（ERROR 契約）は踏襲しない — PK6 は WARN のみで exit code に影響しないため | `rg -n "check_plan_packet_heuristic_warnings\|WARNINGS" scripts/doc-consistency-check.sh` |
| workflow gate change の decision-log 昇格パターン（D-055/D-056/D-058/D-059 の Decision/Status/Why/Impact/Alternatives/Rollback/Revisit フォーマット） | `docs/decision-log.md` 434-482 行 | D-062 は同フォーマットを踏襲 | なし | `rg -n "^## D-05[5-9]" docs/decision-log.md` |
| SPEC-WF-\<code\> root ID + 子 Decision ID（D-0XX-DN）の Design Intent Trace 命名 | `docs/archive/plans/2026-07-30-d058-consultation-relay-role.md`（`SPEC-WF-D058-D1`）、`docs/archive/plans/2026-07-27-wave-operation-dev-workflow-amendment.md`（`SPEC-WF-WAVE` + `D-055-D1〜D3`） | `SPEC-WF-CPHG` + `D-062-D1〜D4` | なし | `rg -n "SPEC-WF-" docs/archive/plans/2026-07-30-d058-consultation-relay-role.md` |
| synthetic fixture を tmpdir 生成し tracked fixture file を増やさないテスト規範 | `scripts/tests/doc-consistency-plan-packet.test.sh`（PK3/PK4 fixture、1-5 行コメント） | PK6 fixture も同じ file 内の同じ tmpdir 生成パターンで追加 | なし | `rg -n "setup_repo_dirs\|write_packet" scripts/tests/doc-consistency-plan-packet.test.sh` |

## Negative Paths

- missing input: Contract Probe / Review Response セクション自体が無い packet に対して PK6 は skip し、ERROR にも WARN にもしない（PK1/PK2 の必須セクション欠落 ERROR とは別契約であることを明示）
- invalid input: バージョン番号（`2.1.220`）や exit code（`0/2`）など、数値+単位トークンのパターンに一致しない表現は誤検出しない（パターンは `秒|分|回|件|%` サフィックス必須のため構造的に除外される）
- duplicate/ambiguous input: 同一行に複数の数値+単位トークンがある場合（例: 「30秒/20秒/2秒」）、行単位で 1 回だけ WARN する（トークン単位で重複 WARN を出さない）
- false positive（実プローズ型・evidence-backed だが backtick なし）: 例えば「17 件を独立実注入で全 kill 再現」のような、実際には実測・実証済みの主張であっても同一行に backtick span も `未実測` タグも無い文は PK6 の検出パターンに一致し WARN が発火する。これは PK6 が構文的シグナルのみを見る WARN-only heuristic であるための既知の偽陽性であり、許容する（ERROR 化しない）。実装時に既存 active packet 群 + 直近 archive packet 群へ `bash scripts/doc-consistency-check.sh --target plan` を一度実行し、この種の偽陽性を含む WARN 発火件数（noise 量）を実測して PR の Review Response で報告する（round 1 P2 是正）
- unknown reference: 該当なし
- dependency missing: 該当なし（`rg` 依存は既存 checker が既に前提としている）
- permission/write failure: 該当なし（read-only checker）
- dry-run side effect: not applicable

## Boundary Checks

- threshold: 数値+単位トークンの検出は整数・小数点いずれも対象（`[0-9]+(\.[0-9]+)?`）。小数点の有無自体を「実測っぽさ」の判定根拠にはしない — 判定は同一行の backtick span / `未実測` タグの有無のみで行う（D-059 round2 の実測値も round1 の仮置き値も、どちらも小数点なしの整数を含み得るため、精度だけでは判別できないことを Contract Probe で確認済み）
- null/default: Contract Probe / Review Response セクションが空（見出しはあるが本文なし）の場合は検出対象行が 0 件のため WARN も 0 件
- empty/non-empty: セクションに数値+単位トークンを含む行が 0 件の packet は該当なし扱い（WARN を出さない）
- min/max: 該当なし（本 PR に数値範囲契約なし）
- status/policy enum: 該当なし
- wire type: 該当なし
- internal type: 該当なし
- producer/consumer: 該当なし
- round-trip token: 該当なし
- precision/range: 該当なし（上記 threshold 参照）
- cross-language parse: 該当なし

## Compatibility Checks

- old schema/input: `iter_active_dated_plans()`（`scripts/doc-consistency-check.sh` 797-805 行）は `find "$PLAN_DIR" -maxdepth 1 -name "*.md"` で `docs/archive/plans/**` を元々スキャン対象外にしている（実測確認済み: `rg -n 'find "\$PLAN_DIR" -maxdepth 1' scripts/doc-consistency-check.sh` → 804 行）。したがって既存 archived packet（`docs/archive/plans/**`）に対する `bash scripts/doc-consistency-check.sh --target plan` 実行結果（ERROR 0 件）は PK6 導入前後で不変（round 1 P3 是正）
- new schema/input: 該当なし（新規 field 追加なし）
- output order: PK6 の WARN 出力順は既存 PK3 と同様、file → セクション内出現順
- optional field behavior: 該当なし

## Data Safety Checks

- source-derived data: なし（実店舗データ非接触）
- generated outputs: なし
- secrets: 非接触
- local-only files: なし
- synthetic sample boundaries: PK6 fixture は既存 `scripts/tests/doc-consistency-plan-packet.test.sh` の `setup_repo_dirs` / tmpdir 生成パターンを踏襲し、tracked fixture file を増やさない

## Main Wiring / Integration Checks

- helper connected to main path: PK6（実装時）は既存 `check_plan_packet_heuristic_warnings` の呼び出し箇所（1905/1959 行、`--target plan` と full docs check の両方）に相乗りし、`bash scripts/doc-consistency-check.sh --target plan` の実行ログで到達可能性を確認する
- output reaches manifest/report: not applicable
- effective config reaches runtime: not applicable
- CLI arg reaches implementation: not applicable
- 新規 test file 登録: 該当なし（既存 `scripts/tests/doc-consistency-plan-packet.test.sh` への追記のみで、`scripts/local-ci.sh:211` のみが本 file を呼ぶ — hosted CI docs job は doc-consistency-check.sh 直接実行で PK6 自体は機能する。実測: ci.yml に本 file 参照 0 hit（Final Review P2 是正、既存 gap で本 PR の退行ではない））

## Mutation-style Adequacy Questions

- green fixture（D-059 round2 相当、backtick でコマンド参照あり）から backtick span のみを除去したとき、PK6 は必ず WARN を発火するか（X3、Contract Probe でパターンレベル実測済み）
- red fixture（D-059 round1 相当、backtick なし）に `未実測` タグを追加したとき、PK6 の WARN は消えるか
- 既存 PK3 の Trace Matrix / Acceptance Criteria 検査対象行と PK6 の Contract Probe / Review Response 検査対象行が重複せず、二重 WARN を出さないか（セクション排他性の確認）
- `docs/templates/plan-packet.md` の Impact Review Lenses 新規行を一時的に列数が異なる形（例: 2 列）に改変したとき、独立レビューまたは目視確認でテーブル崩れを検知できるか（機械 gate ではなく review-only である点を明示）
- (c) の免除除外文（`even when Execution Mode is codex-only`）を一時削除したとき、独立レビューが「codex-only では別 vendor 不要」という誤読可能性を指摘できるか（M3b、review-only）
- (c) の pending fallback（AGENT_OPERATING_MANUAL.md §3.3 Capacity-degraded 参照）を一時削除したとき、独立レビューが「non-Codex Plan Reviewer 不在時は制約ごと免除される」という誤読可能性を指摘できるか（M3c、review-only、round 1 P1 是正）

## Residual Test Gaps

- 「実測コマンド」の意味的妥当性（コマンドが実在するか、出力が本当にその数値を裏付けるか）は PK6 heuristic では検証できない。あくまで構文的シグナル（backtick span または `未実測` タグの有無）であり、意味的な因果性は review-only の独立 reviewer の判断に委ねる。これが PK6 を ERROR ではなく PK3 と同格の WARN に留める理由そのものである。
- Writer/Plan Reviewer の vendor 不一致（D-062-D3）を Workflow State の自由記述 field から機械検知する仕組みは無い。将来 Plan Reviewer / Writer field に構造化 vendor tag を導入する場合、別 change として Non-scope から取り出す。
- PK6 の実装（bash 関数本体）は本 Packet 起票時点では未着手であり、Contract Probe の実証はパターンレベル（`rg` による手動検証）に留まる。実装後は Test Design Matrix の X1/X2/X3 をスクリプト経由の synthetic fixture test として再現し、パターンレベル実証との一致を確認する。
