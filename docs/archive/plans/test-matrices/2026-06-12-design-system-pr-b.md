# Test Design Matrix: デザインシステム構築 PR-B 共通 component 抽出

> **親文書**: [2026-06-12-design-system-pr-b.md](../2026-06-12-design-system-pr-b.md)

| 対象 | 入力クラス | 期待 | Failure Mode | 検出手段 |
|---|---|---|---|---|
| PageHeader | title のみ / +subtitle / +actions / edit error 分岐 | 4 site 構造の DOM 同値 | subtitle 余白崩れ・error 分岐 header 見落とし | characterization + 既存 page test |
| FormSection | description あり / なし / 三項式 | あり = 現 DOM 同値、なし = `<p>` 非描画 | optional 化で空 `<p>` 残留 | unit test + 既存 4 見出し assert |
| DepartmentFilter | 3 呼び出し元 props | width/id/disabled 現値維持、allLabel 統一（daily のみ文言差分） | 既定値適用漏れで width/id が変わる | B0 characterization + 選択操作 test |
| SummaryCard | isLoading / isError+onRetry / data | 移動前後で home 3 カード DOM 同値 | import 張替漏れ・path alias 崩れ | B0 characterization（唯一の net）+ typecheck |
| SearchBar | commit 型 / live 型 / IME 合成中 Enter / trim 境界 | 確定経路・型・wrapper 維持、IME 中は両モード不発火 | debounce flush 漏れ・stock の type="search"/max-w-md 喪失 | 移管 test + 新規 IME test × 2（red→green） |
| EmptyState | icon/title/desc/action 組合せ / monthly 月度の文言移植 / pure 3（rows=[] 直接 render）+ page-level 3（renderWithClient） | catalog ⑥ 標準UI 準拠 DOM、月度は文言維持 | 文言劣化・既存 2 文との重複・query mock 経由で空分岐に到達不能 | unit test + B0 文言 characterization（render 二分準拠）+ L3 |
| 横断 | 全画面 render | wire 契約不変・全 test green | bindings/route 差分混入 | `git diff --name-only` + CI |
