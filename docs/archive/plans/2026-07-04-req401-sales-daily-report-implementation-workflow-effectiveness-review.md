# Workflow Effectiveness Review: REQ-401 SALES 日報取込み第1スライス（PR #125）

> **対象**: [2026-07-04-req401-sales-daily-report-implementation.md](2026-07-04-req401-sales-daily-report-implementation.md)（R3、Codex 実装委譲の 2 例目）
> **記入日**: 2026-07-04

## 実績サマリ

- rally R1（Plan agent × 2 並列レンズ、cycle-time 既定）で P1 2 / P2 7 / P3 6 を検出し 1 round で cutoff（機械検出可能クラス収斂）。rally が事前に拾った「migration v4 追加で既存 `schema_v2.rs` assert が確定 fail」「traceability T4 baseline 衝突」は実装時にゼロコストで回避された
- Codex 実装 → orchestrator 受け入れ 2 round（R1: Test Matrix 約束行の欠落 P2 5 / P3 8 → R2 全反映）→ CI green
- Windows native L3 で 3 round の実機起因修正が発生（下記 lessons）。最終的に L3 全項目合格、merge `2618949`

## うまくいったこと

1. **並列 2 レンズ rally + 機械クラス cutoff**: 事実突合レンズと契約縮退レンズの分担が有効。既存固定値 assert / baseline との衝突という「実装後 CI で確実に爆発する」クラスを起草直後に潰せた
2. **orchestrator 独立 probe**: 受け入れで subagent / Codex の green 報告を鵜呑みにせず、`#[path]` 取込みの throwaway テストで実ファイル parse を独立再現したことが、L3-R1 の真因特定（列マッピング誤導出）と修正検証の両方で決定打になった
3. **owner の運用知識が設計を正した**: 「エクスポート機能は使っていない / ツール内部ファイルが日常の実体」という owner 供述が、parser の照準（2 layout 両対応）と将来の手順書方針を確定させた。実機・実運用の事実は doc からは出てこない

## うまくいかなかったこと / 原因

1. **synthetic fixture だけの green を信じて L3 まで実ファイル破綻に気付けなかった**: 29-io §29.4.1 の shape 導出（列マッピング）自体が誤っており、fixture がその誤導出を忠実に再現したため全テスト green のまま parser は実データ全滅だった。「実装完了前に実ファイル手元確認」が manual 節の努力目標で、push 前 gate として強制されていなかったのが構造原因
2. **WebView2 の HTML file input 白画面バグは自動テストで原理的に検出不能**: jsdom/RTL に webview の描画スタックが存在しない。L3（実機）だけが検出できる欠陥クラスが実在することを再確認した
3. **L3 3 round は前 2 件の帰結**: parser 契約（R1）→ 白画面 + 視認性（R2）→ インラインエラー（R3）。R1 は実ファイル gate があれば L3 前に潰せた

## Lessons / 今後の適用

1. **adapter 契約（POS CSV / 外部フォーマット）実装の AC に「実サンプル local-only gate」を必須で入れる**: synthetic fixture は shape 導出が正しい場合のみ有効。導出自体の検証は実ファイルでしかできない。今回確立した手順 = untracked throwaway テスト（`#[path]` 取込み）で実ファイルを parse し、件数・エラー 0 のみを PR body に記録（実値・実ファイルは非コミット）。→ memory `feedback-adapter-real-sample-gate` に昇格済み
2. **ファイル選択 UI は plugin-dialog を第一選択にする**: HTML `<input type="file">` は WebView2 でダイアログ起動後の再描画が保証されない（白画面、JS 例外なし、console 無出力が署名）。既存 HTML input 画面（Z004 / UI-01c / UI-03）の移行 backlog は優先度を上げた（Plans.md「ファイル選択 UI の共通化」）
3. **フィールド事実は「ファイル shape」だけでなく「取得経路」を記録する**: 同一データがツール内部形式（layout A）とエクスポート形式（layout B）の 2 表現を持っていた。29-io §29.4 には経路ごとの shape を別表で記録する形に落ち着いた
4. **rally の効きどころと L3 の効きどころは別**: rally は「repo 内の機械的整合」に強く、実機・外部ツール・実データ起因の欠陥は L3 でしか出ない。L3 を「最後の目視確認」ではなく「実データ・実環境という別テスト空間」として計画に織り込む（本 packet の manual 節は妥当だったが、実ファイル gate を自動側に寄せられた分だけ L3 round を減らせた）

## 次の dogfood 対象

- 第2スライス（BIZ-05 拡張 + UI-09a/b official 表示）: 同じ R3 packet → rally → Codex 委譲の型。実ファイル gate は「取込み済み DB からのレポート表示検証」になるため、seed でなく実 bundle 取込み後の表示確認を L3 に含める
