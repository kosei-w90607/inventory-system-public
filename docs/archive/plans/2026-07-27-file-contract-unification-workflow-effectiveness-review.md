# Workflow Effectiveness Review — 監査是正 順9: file 選択・上限・Z004 flow の一契約化

## Workflow Used

- R3 / fable-window。Coordinator = Fable 5（scope 精査・Design Phase・packet・裁定・closeout）、
  Writer = Codex（owner relay 2 往復）、Plan / Final Reviewer = Sonnet 5 fresh context。
- plan-first commit（D-054 等の Design 正本化 + packet + Matrix 同時）→ Plan Review 3 round
  0/0/0 → owner 承認 → Codex 実装（Draft PR #26）→ Final Review 一次（X1〜X9 を clean tree
  実注入で独立再実測）→ P1 是正の追発注（Matrix X10 を plan-first で先行追加）→ 差分再レビュー
  + X10/X7/X8 再実測 → Human Gate（視認 + Windows native L3）→ ready-hosted-final（exact HEAD
  L1 full）→ hosted green → squash merge `9cba5aa`。state-only 遷移は 3 commit で cap 内。

## What Worked

- mutation 独立再実測: X1〜X9 全件 red を reviewer 自身の実注入で確認、writer の kill 主張に
  虚偽なし。順6 の虚偽 kill 事案からの改善が持続している。
- Final Reviewer の diff 読みが、Matrix の事前定義面の外にあった regression（共通化で
  旧 `extractFilename` の Windows WebView2 drag&drop 絶対パス防御が drop 経路から消失）を
  P1 捕捉。X1〜X9 が全件 red でも防げない種類の欠落を独立 diff review が塞いだ。
- 是正の plan-first 維持: P1 是正発注の前に Matrix へ X10 を Coordinator が追加 commit し、
  test 契約が実装に先行する順序を是正 round でも崩さなかった。
- oracle 独立性の事前契約（境界値のみ bindings 定数 import を許容し、その判断を Matrix 行に
  明記）が一次・差分の両 review で検査項目として機能した。
- L3 停止時の対応: 既知 backlog（Z004 parser layout A）への該当を docs 突合で即特定し、
  現行 parser 受理 shape の synthetic fixture（ASCII のみ・実在 JAN 差し替え式）を生成して
  owner の実働を最小化、gate を完走させた。

## What Did Not Work

- 「動作等価リファクタ」の等価性検査が Matrix の事前定義面（cancel / drop 経路存在 / 出力契約）
  に限定され、移行元 code が担っていた防御（extractFilename）の等価維持は design 時に列挙され
  なかった。P1 は Final Review の diff 読みだけが最後の防壁だった。
- Human Gate の L3 が実採取 file で既知 graceful stop（layout A）に当たり一時停止。既知 backlog
  と end-to-end flow の交差を packet 作成時に確認せず、fixture の事前準備が段取りに無かった。
- 長時間 L1 の subagent（haiku）background 実行が silent に死に、owner の「止まってない？」
  指摘で発覚した。長時間 CI は Coordinator 直接の background Bash 管理に切り替えて解決。

## Issues Caught Before Implementation

- Plan Review 一次（P1=1 / P2=3）: UI_TECH_STACK の旧「暫定例外維持」と新 D-054 の自己矛盾、
  tauri-specta 定数 export API 不在（Contract Probe 訂正 → 手書き append 方式へ確定）、
  File 型中間 handler signature 変更の明記漏れ、商品 import guard の CMD 単独非対称
  （→ BIZ 安全網 X9 追加）。

## Issues Caught by Tests

- この cycle で test が事前に落とした regression はなし（mutation 感度は事後実測で全件確認）。

## Issues Caught by External Review

- Final Review 一次（P1=1 / P2=2 / P3=2、全件 accept）: drop 経路の basename 正規化消失（P1）、
  55-ui-csv-import.md の stale 記述（P2）、FilePicker 5 call site の aria-label が可視文言を
  含まない Label in Name 不一致（P2、統合で新規導入）、死コード / basename ロジック重複（P3、
  P1 是正へ統合）。

## Escaped / Late Findings

- merge 後の escape なし。L3 での実採取 layout A graceful stop は escape ではなく既知挙動の
  3 回目の再確認（PR #125 L3 / 2026-07-06 issue #135 / 本 L3）。

## Test Adequacy

- X1〜X10 の全 mutant を clean committed tree への実注入で red 確認（一次 X1〜X9、差分
  X10/X7/X8）。移設 test（extractFilename）の case 等価は旧版との突合で確認。oracle 独立性
  （bindings 定数 import は境界値 1 例外のみ）を両 review で検査した。

## Signal / Noise

- reviewer findings は一次 5 件 / 差分 0 件で、Coordinator の実証裏取りによる棄却 0。
  signal は高く、発注書の観点指定（oracle 独立性 / REQ domain 整合 / 既存 test 削除検査）が
  機能した。

## Cost / Friction

- owner 介入 3/3、relay 2/2 で予算どおり。ただし L3 の既知事象診断と fixture 待ちで owner の
  実働が計画外に発生した（fixture 事前準備があれば 1 往復減らせた）。

## Recommended Workflow Adjustment

- 共通化・リファクタ系 packet では、design 時に「移行元の防御 code 一覧と等価維持先」を
  Matrix 行として列挙する（X10 の事前版。今回の P1 を Plan Gate 段階で捕捉できた形）。
- Human Gate に end-to-end flow を含める場合、下流工程が依存する既知 backlog・制限を packet
  作成時に列挙し、受理 shape の fixture と disposition 経路を Ready 承認依頼と同時に渡す
  （project memory `l3-flow-needs-fixture-prep` に保存済み）。
- 長時間 CI 実行は subagent 委譲ではなく Coordinator 直接の background 実行で管理する。

## Retired / Consolidated Rules

- なし。

## Applied / Deferred Workflow Changes

- fixture 事前準備と長時間 CI の直接管理は本 cycle 内で適用済み。防御 code 等価維持の Matrix
  列挙は次の共通化・リファクタ系 packet の Plan Gate で適用判定する。
