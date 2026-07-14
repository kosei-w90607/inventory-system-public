# Agent Operating Manual

この文書は、どのモデル・ハーネスの組み合わせでもこの repository の workflow が停止しないための **availability mode / role mapping / task-shape / 追加 prompt の正本**。workflow の中身（phase、Risk、Plan、CI、review）は [DEV_WORKFLOW.md](DEV_WORKFLOW.md) が正本であり、本書は「誰がどの役割を担うか」と、役割割当だけでは表せない限定的な実行形態を扱う（D-034 / D-046）。

## 1. 入口

セッション開始の読み順の正本は [AGENTS.md](../AGENTS.md) `Session Start`。本書を含む他文書・skill はそのリストを複製せず参照する。作業中の live 状態は [Plans.md](../Plans.md) を確認する。

`$inventory-workflow-start`（[Skill doc](../.agents/skills/inventory-workflow-start/SKILL.md)）が start / resume 共通の入口。resume 時は active Plan Packet の `Workflow State` を読んで、現在 Phase から dependency-ready な次の一手を選ぶ。

## 2. 役割定義（model-neutral）

役割はモデル名から独立して定義する。モデル名は Plan Packet `Workflow State` の値としてのみ現れる。

| 役割 | 責務 |
|---|---|
| Coordinator | thread を薄く保ち、委譲・統合・phase 遷移を管理する。実作業は原則しない。[DEV_WORKFLOW.md](DEV_WORKFLOW.md) の `Owner Effort Budget` を承認インターフェースで可視化し、超過見込みまたは `goal-drift signal` で hard stop する |
| Plan Reviewer（Plan Gate 担当） | plan-draft を独立レビューし P1/P2 = 0 まで差し戻す。Writer と兼任不可。phase 名 plan-gate はこの役割の審査 phase を指す |
| Writer | 実装・docs 編集の書き手。one-writer rule（DEV_WORKFLOW `Subagent Budget`）に従う |
| Final Reviewer | independent-review phase の担当。R3/R4 は Contract Audit（DEV_WORKFLOW）を source docs 直読みで実施 |
| Explorer / Evidence | read-only の広域探索・証跡収集・docs 同期。file:line 付き summary だけ返す |
| Human Gate | owner のみ。L3 実機確認、R4 承認、Ready 化、merge |

## 3. Role Assignment（役割割当の制約とAvailability）

役割の実際の担当は各 PR の Plan Packet `Workflow State` の role assignment フィールドに記録する。model slot 名と現行実体の対応は §3.4 の表だけに置き、他文書へ複製しない。

以下の独立性制約は Execution Mode（§3.2）に関わらず適用する:

- Writer ≠ Plan Reviewer
- Writer ≠ Final Reviewer
- Final Reviewer は Coordinator および Writer と fresh context（自己承認禁止）
- R4・workflow gate change は Double Audit（独立2回の Contract Audit。詳細は [DEV_WORKFLOW.md](DEV_WORKFLOW.md)「Contract Audit (R3/R4)」参照）
- Human Gate は owner 限定
- 希少・高コストな model slot は通常実装の Writer に充てない（現行の容量温存規範を model-neutral に継承。投入条件は §3.1 参照）。例外を適用する場合は Workflow State に理由を 1 行記録する

数値閾値（`Owner Effort Budget` 等）は [DEV_WORKFLOW.md](DEV_WORKFLOW.md) を参照し、本書には再掲しない。

### 3.1 希少・最高能力 slot の投入条件

次のいずれかに該当する場合のみ、希少・最高能力 slot（§3.4 の用語集参照）を投入する:

1. R3/R4 の plan-gate 裁定、または workflow gate・stable contract を変える設計判断の最終裁定
2. レビュアー間で P1/P2 の見解が対立し、実証裁定が必要
3. R4 の最終 contract audit

投入しない場合: P3-only findings、機械的修正、実装作業、定型 R2 レビュー、docs 同期。

例外（design board）: workflow / architecture の design-only change に限り、owner の明示指示があれば希少・最高能力 slot を design docs の Coordinator / Writer に割り当ててよい。この場合、Plan Gate と Final Reviewer は希少・最高能力 slot 以外の独立 fresh context が担い、§2 の自己承認禁止を維持する。packet の `Workflow State` に本例外の適用を 1 行記録する。実装 code の Writer には引き続き割り当てない。

### 3.2 Execution Mode

Execution Mode は Plan Packet `Workflow State` に記録する、その時点の可用 vendor 構成を示すラベル:

- `fable-window`: 希少・最高能力 slot（§3.4 参照）が利用可能な期間
- `dual-vendor-no-fable`: Claude 側 slot はあるが希少・最高能力 slot（§3.4 参照）はない期間
- `codex-only`: Codex/OpenAI 側の slot のみで構成する期間

いずれの Execution Mode でも本節冒頭の独立性制約を維持する。

### 3.3 Capacity-degraded（役割担当の一時不能）

Execution Mode は vendor 単位の可用性を扱う。個別の役割担当（Coordinator / Plan Reviewer / Final Reviewer）が rate limit・枠切れ・障害で一時的に利用不能な場合は次を適用する:

- Workflow State の該当役割を pending にし、理由を 1 行残す
- Phase は前進禁止。特に plan-approved / independent-review 通過 / ready-hosted-final への遷移を止める。既に implementing の Writer 作業は継続してよいが、レビューを要する遷移では停止する
- owner が代替担当を指名するか、同 vendor の fresh context で再開する。§2 の独立性（Coordinator の自己承認禁止）は代替時も維持する
- 代替が決まらない場合は停止し、[Plans.md](../Plans.md) のブロッカーへ記録する。pending のまま実装や Ready を進めない

### 3.4 Model slot 対応表

informational only（非規範。archive 文書の slot 名解読用）。本節の独立性制約・§3.1〜§3.3 の規範を代替しない。

| Slot | 現行実体（2026-07-10 時点） |
|---|---|
| Fable | Claude Fable 5（サブスク枠にある間のみ） |
| Sol | Codex/OpenAI 側の主力 reasoning モデル |
| Terra | Codex/OpenAI 側の実装向けモデル |
| Luna | Codex/OpenAI 側の軽量探索モデル |
| Sonnet | Claude Sonnet 5（subagent または単独セッション） |

モデル更改時はこの表だけを更新する。owner をモデル間の伝書鳩にしない: 各役割への発注は Plan Packet / PR body / review packet という repository 証跡経由で渡し、owner の手作業転送を前提にしない。

### 3.5 Task Shape: one-shot irreversible

`一回きり × 不可逆 × owner gate 必須` の task shape では、非同期自律実行ではなく owner 同席の time-boxed 同期セッションを選べる。この task-shape 軸は Risk と、vendor 可用性を示す Execution Mode（§3.2）の双方に直交する。Execution Mode の enum は変更しない。

- セッション前に Goal Invariant、利用者可視の完了1文、time-box、正確な mutation target、停止条件、利用可能な rollback / containment を固定する。
- owner は不可逆 mutation の直前 gate に同席し、Coordinator は承認依頼に `この change での介入 N 回目 / 予算 M 回` を表示する。runbook 実行と最小証跡の記録は agent が担い、owner に証跡編集や relay を求めない。
- time-box、Owner Effort Budget、または `goal-drift signal` に達したら mutation 前に停止する。同期セッション中に自由な証跡拡張へ切り替えない。
- 新規スクリプトは「どの具体的な failure path を防ぐか」を1文で説明でき、Goal Invariant の最小完了経路に必要な場合だけ作る。説明できない一回限りの補助スクリプトは作らない。

## 4. 既存資産 router 表

| 場面 | 使う資産 |
|---|---|
| start / resume kickoff | [.agents/skills/inventory-workflow-start](../.agents/skills/inventory-workflow-start/SKILL.md) + Plan Packet `Workflow State` |
| Design Phase | [DEV_WORKFLOW.md](DEV_WORKFLOW.md)「Design Phase Rules / Impact Review Lenses」 |
| 実装 | [.agents/skills/inventory-implementation](../.agents/skills/inventory-implementation/SKILL.md) + [docs/templates/plan-packet.md](templates/plan-packet.md) |
| Contract Audit / review-only subagent | [DEV_WORKFLOW.md](DEV_WORKFLOW.md)「Contract Audit (R3/R4)」+ [docs/templates/subagent-review-packet.md](templates/subagent-review-packet.md) |
| PR review 依頼 | [docs/templates/pr-review-prompt.md](templates/pr-review-prompt.md) + [docs/code_review.md](code_review.md) |
| 設計書レビュー観点 | [docs/quality/review-checklist.md](quality/review-checklist.md) |
| PR handoff | [.github/pull_request_template.md](../.github/pull_request_template.md) + [DEV_WORKFLOW.md](DEV_WORKFLOW.md)「Draft PR Checkpoint」 |

## 5. 追加 prompt 3 本（本 manual が正本）

### 5.1 Field-check / 実機調査 kickoff prompt

```text
目的の業務フローを 1 文で固定する。

1. 「事実確認」と「設計判断」を分離する。docs/ARCHITECTURE.md の POS Adapter Boundary に従い、実機 / PC ツール / 外部ファイルで確認した事実は adapter facts として記録し、BIZ/CMD/UI/DB の contract へ昇格する判断は Design Phase で行う。
2. 調査項目は GitHub issue でバッチ管理する。各項目は L3 checklist 形式で、場所 / 操作 / 目視できる合格基準を必ず書く。参考実例は issue #135。
3. 証跡は匿名化または形状のみを残す。実 JAN、実商品名、価格、店舗固有情報、実ファイルは repo に入れない。
4. 結果は docs/plu-export-and-real-csv-verification.md 方式の状態列で source doc へ反映する。
5. adapter facts がアプリ core の contract に影響する場合は、同じ PR で source doc / decision-log へ昇格するか、後続 Design Phase の blocker として明記する。
```

### 5.2 Backfill audit prompt

```text
対象領域の source docs を必ず開いてから audit する。

1. 各判断を次に分類する:
   (a) source docs で復元可能
   (b) archive plan・PR body 頼み
   (c) code を読まないと不明
   (d) 変更前 backfill 必須
2. 判定フロー:
   - docs と code が矛盾しているなら、即修正 PR を切る。
   - 次 PR で触る contract の手順欠落なら、その PR の Design Phase 内で backfill する。
   - 外部境界の判断が archive にしかないなら、decision-log へ 1 エントリ昇格する。
   - それ以外は backfill しない。
3. 自己検証として「docs にある設計を無い扱いにしていないか」を必ず確認する。
4. backfill 専用 PR は月 1 本まで。超えそうなら backfill ではなく設計変更として Design Phase を回す。
```

### 5.3 Plans.md cleanup prompt

```text
docs/Plans.md cleanup は DEV_WORKFLOW.md の Post-Merge Closeout に準拠する。

1. 「現在の基準」の SHA / PR 番号を GitHub main の実態と突合する。
2. 完了項目を archive へ移す。archive へ移したリンクは必ず相対パスへ変換する。
3. 同一項目の重複記載を 1 箇所へ統合する。
4. 「次の行動」が空なら、active runway / roadmap / backlog から補充する。
5. bash scripts/doc-consistency-check.sh を実行し、green を確認してから PR / closeout を完了する。
```

## 6. ハーネス間の既知の非対称（重要な注意）

- `.codex/hooks.json` は gitignore 済みの未確認実験で非稼働。Claude 側 hook（ExitPlanMode チェック等）の機械強制は Codex には効かない。その分、pre-push / CI の機械ゲートと review-only packet を厚めに使う。
- `$inventory-workflow-start` 等の `$` 記法は Codex/OpenAI harness の入口。Claude や他 agent は `.agents/skills/*/SKILL.md` を plain procedure docs として読む。
- subagent 数の上限は [DEV_WORKFLOW.md](DEV_WORKFLOW.md)「Subagent Budget」が正本。ハーネス側の並列機能がこれを超えられる場合でも budget を守る。
- CASIO 語彙（`Z00x` / `CV17` / `SR-S4000` / `CP932`）の BIZ/CMD 契約への混入検出は機械ガードが存在しない。レビューが最後の砦であり、[review-checklist](quality/review-checklist.md) の設計判断レンズ #2 を必ず使う。
