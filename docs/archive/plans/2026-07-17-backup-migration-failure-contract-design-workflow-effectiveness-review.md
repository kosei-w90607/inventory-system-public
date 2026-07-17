# Workflow Effectiveness Review: backup / migration failure contract design phase（PR #14）

## Workflow Used

- R3 docs-only design phase（監査是正 順 1+2）。Coordinator / Writer = Fable 5、独立検証 = Sonnet subagent（Plan Reviewer / Final Reviewer / 反映検証 reviewer の 3 役を別 context で分離）、外部独立レビュー = Codex（owner 発注・relay 経由、計 9 round）。
- Plan Gate 3 round → 独立 Final Review → Codex round（全面監査）→ 以降は「Codex round → Coordinator 裁定（全 P1 実証裏取り）→ 反映 → Sonnet 敵対検証 → 状態帳簿 → L1 full → push → 裁定返信」の反復。第 7 round から**相互修正案方式**（owner 決定: 双方が findings に修正案を添付し、採否を相互裁定）。
- 実証規律: P1 は反例系列の構成を必須条件とし、閉鎖確認は「言及の有無」でなく「反例の再実行トレースによる成立不能の確認」で判定。

## What Worked

- **反例駆動の設計転換**: D5 は「存在ビット marker → 記録集合 manifest → phase 付き manifest → pending marker（log 完了まで保持）」と 3 回転換したが、全転換が具体的反例（世代判定不能 / アップグレード境界の実データ削除 / log 恒久欠落）で正当化され、後戻りが一度もなかった。「反例を書けない懸念は P2 以下」の条件が P1 の precision を保った（rebut 0 件、全 accept）。
- **2 系統検証の相補性**: Sonnet 敵対検証が Codex の指摘を 2 回先取り（UX P2 = 遅延成功の可視化欠如、attempt ID 突合不能 + restore 永久ブロック P2×2）。逆に Codex は Sonnet がすり抜けた系列（unlink 永続順序逆転、温度の低い temp 孤児）を拾った。単系統では到達しなかった網羅性。
- **相互修正案方式**（第 7 round〜）: Codex の 3 値定義案・行分類集約案は即全面採用で各 1 round 圧縮。当方の要約表提案は Adopt-with-changes（索引特化 + branch ID）で二重管理懸念ごと解消。以降の空転 round ゼロ。
- **Codex 指定の閉鎖確認系列**: 第 7 round から Codex が「修正後に再実行すべき系列」を指定し、当方検証がそれを最優先で再実行する往復が確立。閉鎖判定の基準が両者で一致した。
- **branch ID（T0/R1〜R7）**: 散文 8 分岐に ID を振り §71.10 と相互参照させた結果、traceability の穴（R6 fixture 欠落）が機械的に検出可能になった。

## What Did Not Work

- **drift 是正の grep 不徹底が 4 回再発**: 43 の CMD パターン見逃し（re-review not-closed P1-1）、「wire shape 変更なし」の 2 箇所残存、68 本文 vs 文言表の片方修正、PR body の別文言による置換空振り。いずれも「1 箇所直して同主張の他箇所を grep しない」同一 failure class。手動規律（claude-codex-review-loop skill に記載済み）では再発を止められなかった。
- **STATECAP cap 超過**: forward `state-only遷移` commit を 4 件積み cap 3 を超過、owner 承認の rebase + force-push を要した。DEV_WORKFLOW 118 行（UI-13 教訓: 遷移 commit 直後に check-workflow-git.sh）の読み落とし。既存規範の再違反であり、規範の存在だけでは防げないことの再実証。
- **自作の契約矛盾**: 第 6 round で「log 恒久欠落は構造的に発生しない」の絶対保証を書き、同 round の escape hatch（committed 例外）と自己矛盾させた。保証文言を書く時に「この保証を破る系列が同 PR 内に既にないか」の突合を怠った。
- **closeout の && 直結事故**: `check && commit && push` で doc-consistency ERROR 4 件（archive 移動のリンク切れ）を目視せず main へ push。即検知・即修正したが、検証と commit の直結は検証を素通しにする。

## Issues Caught Before Implementation

- 実装コード変更ゼロの設計 phase として、監査 5 findings + レビューラリー累計 40 件超（P1×9・P2×20 超・P3×10 超）の契約欠陥を**実装着手前に**閉じた。うち「二重失敗で空 DB が recoverable に偽装」「旧 main + 新世代 WAL の混在」「アップグレード境界で唯一の実データを削除」はいずれも実装後に発見された場合データ喪失事故になり得た系列で、design-first 分割（監査 adjudication の判断)の妥当性を裏付ける。

## Issues Caught by Tests

- 該当なし（docs-only）。ただし §71.10 に failpoint・fixture・oracle を branch ID 付きで固定したため、実装 PR のテストが設計時の反例系列をそのまま回帰固定できる状態になっている。

## Issues Caught by Review-only Sub-agent

- closure 監査: D5 旧 2 分岐の網羅性欠如（P1 — marker 直後中断で新旧両方を失う反例）。
- 反映検証: 22 §9 scopeguard 矛盾、manifest 操作のステップ本文未統合、UX P2（遅延成功の可視化）、attempt ID 突合の実現可能性、INSERT 持続失敗の restore 永久ブロック。要約表 8 行の散文全行突合（drift 0 確認）×2 回。

## Issues Caught by L3 / Owner / 実 Operator

- 該当なし（docs-only、L3 対象は実装 PR1 へ委譲）。owner 判断が効いた場面: D5 再設計方針（manifest 化 + single-instance 昇格）、STATECAP rebase 承認、相互修正案方式の導入。

## Escaped / Late Findings

- 設計正本の欠陥が実装へ到達した escape はゼロ（実装未着手のため定義上も発生し得ないが、merge 時点の残存 finding もゼロ）。
- 「late」に相当するのは Sonnet 検証をすり抜けて Codex round で発見された系列（世代判定不能、durability barrier、アップグレード境界等）。傾向として Sonnet は契約テキスト内の整合に強く、Codex は実装現物（backup.rs の固定名・NULL detail_json 等）との突合に強かった — 役割分担として妥当で、両方を残す根拠になる。

## Test Adequacy

- §71.10 は round を追うごとに oracle が精密化（committed 一括 → 中断点 3 分割、fixture 5 種、branch ID 被覆 8/8）。「テスト行の oracle が正しい実装を落とす」という Codex 第 5 round P2-2 型の指摘は、テスト設計自体もレビュー対象にする価値の実証。

## Signal / Noise

- Codex 9 round の findings は実質すべて signal（rebut 0）。round を追うごとに指摘対象が「監査対象の旧テキスト → 当方反映の穴 → 新設テキストの精密化 → traceability 注釈」へ単調に縮退し、収束が計測可能だった（P1: 3→1→2→0×6）。
- noise 側の失敗は当方に 1 件: 「INSERT 持続失敗は P3 級」の先行見立てを Codex が P2 と判定し、Codex が正しかった（operator 可視化の唯一の手段の喪失を軽く見た）。

## Cost / Friction

- Codex 9 round + Sonnet 検証 11 巡 + L1 full 7 回 + 状態遷移 11 回は design phase として過去最重量。対象が「データ喪失の failure contract 正本」で R4 実装 2 PR の前提であることから正当化されるが、R2 級の設計に同じ密度を適用してはならない（収束予測: P1 が 2 round 連続ゼロになったら fresh 監査の密度を落とす、が経験則）。
- friction: STATECAP rebase（約 1 時間のロス）、owner relay 9 往復（相互修正案方式導入後は 1 往復あたりの前進量が増加）。

## Retired / Consolidated Rules

- 廃止・統合した規則なし。追加は memory 3 件（STATECAP subject 形式 + cap 運用 / 相互修正案方式 / check-commit-push 直結禁止）で、いずれも既存規範の運用注記であり新規 rule の新設はなし。

## Recommended Workflow Adjustment

1. **drift 是正の機械補助**（優先度高）: 「契約文言を変更した commit では、旧文言の残存を repo 全体 grep して 0 件を確認する」を手動規律から機械 gate（pre-commit hook or doc-consistency-check への同語検査追加）へ昇格する検討。同一 failure class の 4 回再発は「memory rule needs hook」（engineering-judgment-axioms）の発動条件を満たす。
2. **相互修正案方式の DEV_WORKFLOW 昇格**: 効果実証済み（空転 round ゼロ化）。Codex review 節に「findings への修正案添付 + 相互採否裁定 + 裁定への異議窓口」を標準手順として記載する。次の workflow docs PR で。
3. **保証文言の自己突合**: 「〜は発生しない」「必ず〜する」形の絶対保証を設計書へ書く際、同 PR 内の例外・escape hatch との両立を書いた時点で確認する。checklist 1 行で足りる。

## Applied / Deferred Workflow Changes

- Applied: memory 3 件（本 session 内）。branch ID traceability パターン（§71.10 相互参照）は 71 に適用済みで、実装 PR の Test Design Matrix が引用予定。
- Deferred: 上記 Adjustment 1〜3 はいずれも次の workflow docs PR（R3 workflow gate change）へ。`.codex/` 旧 clone 参照の棚卸し・是正は別 R2（Codex へ read-only 棚卸し発注済み、2026-07-18）。
