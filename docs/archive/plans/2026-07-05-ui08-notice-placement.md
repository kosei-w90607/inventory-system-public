# Plan Packet: UI-08 表示改善 follow-up — 注意情報の上部集約 + 回復手順文言の強調

## Risk

Risk: R2

Reason:
UI-08 PLU書出し画面の表示位置・文言強調のみの変更。command / DTO / DB / route / 状態機械は不変。operator 安全文言の可視性改善であり Windows native L3 は必要（レジ実機は不要、アプリ画面確認のみ）。D-028 PR #124 L3 起源の follow-up（Plans.md backlog 記載、memory feedback-operator-ui-critical-notes-placement）。

## Goal

PR #124 L3 で owner から出た 2 点を解消する: ①「書出しに含めなかった商品（要修正）」一覧が画面最下部にありスクロールしないと目に入らない ②CV17 スロット上書き事故（UI-08-D9）を防ぐ回復手順文言「PCツールに取り込めなかった場合は、未反映を外さずに全件を書き出し直して取り込んでください。」が保存完了 Alert 内の平文に埋もれている。

## Scope

1. `PluExportPage.tsx`: 要修正一覧 section（現 L579-613）を「PLU書出し状態」section の直後・2 カラム content section の前へ移動。見出しに AlertTriangle アイコン + warning トーンを付け、「これらの商品は今回のPLUファイルに含めていません。商品マスタでJANコードを修正すると、次回の書出しから含まれます。」の説明 1 行を追加（色のみ符号化しない: アイコン + 文言主体）
2. `PluExportPage.tsx`: 回復手順文言を saved 成功 Alert 内の平文から独立させ、saved 時に success Alert 直後の **warning Alert（AlertTriangle + タイトル「PCツールに取り込めなかった場合」）** として表示。「保存済みで未確認のPLU書出しがあります」（pending recovery）Alert にも同じ回復手順文言を 1 行追加（PCツール取込み失敗に気づくのは復帰画面のことが多いため）
3. `PluExportPage.test.tsx`: 配置（要修正一覧が未反映商品カードより前に出る）と回復手順 Alert の表示条件のテスト追加・既存更新
4. `67-ui-plu-export.md`: UI-08-D10（注意情報の配置と回復文言の強調）を Design Decisions へ追加、§67.9 UI / Wording へ説明文言を追記

## Non-scope

- 状態機械・command 契約・localStorage 復帰仕様の変更
- 要修正一覧から商品編集への直接リンク（既存どおり誘導文言のみ。導線追加は要望が出てから）
- PLU スロット永続割当の恒久設計（既存 backlog）
- 上限警告・full-mode バックアップ警告の文言変更

## Acceptance Criteria

- `npm run typecheck` / `npm run lint` / `npm test` / `npm run build` 全通過
- `./scripts/doc-consistency-check.sh` 全通過
- DOM 順: 要修正一覧 section が「未反映商品」カードより前（テストで evidence）
- saved 状態で回復手順が warning Alert として success Alert と別に表示される（テストで evidence）
- pending recovery Alert に回復手順文言が含まれる（テストで evidence）
- Windows native L3: 要修正商品がある状態で prepare 実行 → スクロールなしで要修正一覧が見える / 保存後に回復手順が目に留まる（owner 目視、レジ実機不要）

## Design Sources

- Screen / UI: [67-ui-plu-export.md](../../function-design/67-ui-plu-export.md) §67.5 UI-08-D6（状態表示の上部集約）/ UI-08-D8（要修正一覧）/ UI-08-D9（Full-only 投入ガード = 本文言の根拠）、§67.9 UI / Wording
- design-system: [01-decision-rules.md](../../design-system/01-decision-rules.md) DSR-03（上部 Alert 帯 = データ安全系専用。本回復文言はデータ安全系に該当）/ DSR-08（色のみ符号化禁止）
- Decision log: D-028
- 判断軸 memory: feedback-operator-ui-critical-notes-placement（注意情報は視線が最初に通る場所 + 強調）

## Required Design Artifacts

| Area touched by upcoming work | Required source doc / artifact | Status |
|---|---|---|
| Backend / Command / DB / CSV | 変更なし | 該当なし |
| Screen / UI / Japanese wording | 67-ui §67.5 / §67.9 | **updated in this PR**（UI-08-D10） |
| Durable decision / ADR | UI-08-D10 | updated in this PR |

## Design Intent Trace

| Spec / requirement ID | Source design doc section | Decision ID | Why / rejected alternatives | Implementation target | Test target |
|---|---|---|---|---|---|
| REQ-402 / D-028 | 67-ui §67.5 | UI-08-D10（新規） | 注意情報（要修正一覧・回復手順）は結果表示と同じくページ上部圏に集約し、事故防止文言は warning トーン + アイコンで通常説明文と視覚的に区別する。代替案「最下部のまま件数バッジだけ上部に出す」は 2 度手間の導線になり非 IT 利用者に不向きで棄却 | PluExportPage.tsx | 配置テスト + Alert 表示テスト + L3 |

## Design Intent Audit

- Source docs can answer what/why: UI-08-D6/D8/D9 が既に根拠を持ち、本 PR は配置と強調の判断（D10）を追加するのみ
- Assumptions: excluded 一覧の中身・取得契約は不変（prepare response 由来）
- Deferred gaps: 商品編集への直接導線（Non-scope）

## Impact Review Lenses

| Lens | Applicability / finding | Follow-up artifact |
|---|---|---|
| Operator workflow | 適用 — PCツール取込み失敗時の回復判断が画面上で迷わず取れることが目的 | L3 |
| Data safety / evidence | 適用 — CV17 スロット上書き事故防止文言の可視化（UI-08-D9 の運用面の担保） | 67-ui D10 |
| Manual verification | 適用 — 配置の重みは L3 でしか判定できない（PR #124 の教訓そのもの）。レジ実機は不要 | L3 チェックリスト |
| その他（adapter 境界 / lifecycle / replacement / reporting / fact-check） | not applicable — 表示位置と文言のみ | — |

## Design Readiness

- Existing design docs are sufficient because: 表示対象・文言・状態機械は 67-ui 既定のまま。位置と強調のみ D10 として追加
- Source docs updated in this PR: 67-ui §67.5 / §67.9
- 実装は主 Claude（1-3 ファイル、CLAUDE.md Subagent 方針の主 Claude レンジ。Codex 委譲は R3 feature lane の運用であり本件は軽量 follow-up）

## Test Plan

- targeted tests: DOM 配置順（要修正一覧 < 未反映商品カード）、saved 時の回復手順 warning Alert、pending recovery 内の回復文言
- negative tests: excluded 空のとき要修正 section 非表示（既存挙動維持）
- compatibility checks: 既存 15 テストの通過（状態機械・文言アサーションの既存分）
- main wiring/integration checks: なし（表示のみ）

## Boundary / Wire Contract

not applicable — wire 契約変更なし。

## Review Focus

- 要修正一覧の移動で aria-label / section 構造・スクロール挙動が崩れていないか
- 回復手順 Alert が DSR-03（データ安全系 = 上部帯）と DSR-08（色のみ禁止）に整合するか
- saved / pending recovery 両状態での文言重複が過剰でないか

## Spec Contract / Trace Matrix / Data Safety

R2 につき Spec Contract / Trace Matrix は省略。Data Safety: 実店舗データなし（テストは合成データ）。

## Implementation Results

- `PluExportPage.tsx`: 要修正一覧 section を状態表示 section 直後（コンテンツ 2 カラム前）へ移動、見出しに AlertTriangle + 説明 1 行追加。saved 時の回復手順を warning Alert（タイトル「PCツールに取り込めなかった場合の回復手順」）として独立表示、pending recovery Alert に同文言を `font-medium` で追加
- `PluExportPage.test.tsx`: 3 テスト追加（配置 DOM 順 / saved 時の独立 Alert / pending recovery 内文言）→ 18 tests green
- `67-ui-plu-export.md`: UI-08-D10 追加（§67.5）、§67.9 に excluded list lead 文言 + 配置規約追記
- Gates: typecheck / lint / test（536 全体）/ build / doc-consistency 全通過

## Review Response

Review-only skipped because: R2 UI 表示のみ（契約・状態機械不変）。機械 gates（typecheck / lint / test / build / doc-consistency）+ orchestrator 実装 + Windows native L3 owner 目視で担保。

## L3 Findings Response（2026-07-05）

- L3 目視 #1〜#6 全 pass（#1/#2 は要修正商品のみの初期状態が prepare failure 経路だったため、書出し可能商品 1 件 + 要修正 4 件の混在状態で再確認して pass）
- P3-1（同 PR で対応）: excluded list lead が muted 一色で薄い + 「JANコードを修正すると」が除外理由（売価・税率不一致）より狭い → 文言を「JANコード・売価・税率を修正すると」に拡張し、後半の行動文を `font-medium text-foreground` で強調。67-ui §67.9 同期
- P3-2（Backlog へ）: prepare failure Alert の対象コード横並び列挙が読みにくい。要約文言 + 構造化された excluded 表の表示には prepare failure 経路の構造変更が必要なため、本 PR の scope（配置と強調のみ）外として Plans.md Backlog に記録
