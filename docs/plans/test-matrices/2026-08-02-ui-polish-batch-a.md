# Test Design Matrix: UI backlog 消化 batch A（focus ring / Link 統一 / 復元成功 Alert）

## Risk

Risk: R3（packet と同値）

## Contracts Under Test

- C1: `SidebarLink.tsx` の link に §5.4 実装標準の focus ring class（`focus-visible:border-ring` / `focus-visible:ring-[3px]` / `focus-visible:ring-ring/50`）が付与され、active / inactive / pending の既存 class 分岐が保持される
- C2: src/ の production `.tsx`（test 除外）に生 `<a href>` が 0 件（複数行属性を含む）
- C3: static 9 箇所は型付き `<Link to/search>`、runtime 10 箇所は `<Link to={string}>` で、いずれも click で SPA 遷移する（全画面リロードなし）
- C4: `<Link>` 化後の遷移先 URL（path + search）が旧 `<a href>` の href 文字列と同値
- C5: 復元成功 → flag set → ホーム遷移 → ホーム初回 render で success Alert 表示（実 Router + memory history の producer→consumer 統合）
- C6: Alert は one-shot — consume 後の再 render・ホーム再訪・store reset（reload 相当）で非表示
- C7: flag なしの通常ホーム到達で Alert 非表示
- C8: 復元失敗経路で flag が set されず、ホームに Alert が出ない
- C9: 既存 test の削除・無効化・skip なし（既存 assertion の弱体化なし）
- C10: docs anchor — 68-ui-backup-restore.md に `UI-11b-D11` 行が存在し「in-memory flag」「one-shot」を含む。UI_TECH_STACK.md §5.4 に `focus-visible:ring-[3px]` literal が存在する

## Failure Modes

- F1: SidebarLink だけ focus ring が欠落 or 追加時に active/pending 分岐 class を壊す
- F2: 複数行属性の `<a href>` が残存し単純 grep をすり抜ける
- F3: runtime 文字列遷移が `<a>` のまま残る、または `<Link>` 化で全画面リロードが残存する
- F4: helper 構造化変更で search param が欠落・変形し遷移先が変わる
- F5: 復元成功しても Alert が出ない（flag set 漏れ / consume 結線漏れ）
- F6: Alert が reload・再訪・通常到達で再表示される（one-shot 破れ）
- F7: 復元失敗時に flag が set され偽の成功表示が出る
- F8: test 側の Router wrapper 追随で既存 assertion を削る・弱める
- F9: 設計 anchor が消え、実装と docs の対応が追えなくなる

## Test Matrix

| Contract | Failure Mode | Test Type | Test Name / anchor | Would fail if... | Mutation |
|---|---|---|---|---|---|
| C1 | F1 | component test (Vitest/RTL) | `SidebarLink` test へ focus class assertion 追加（3 状態それぞれで `focus-visible:ring-[3px]` を含む class を assert） | ring class 欠落 / 状態分岐破壊 | X1: baseClass から focus-visible 群を除去して red |
| C2 | F2 | mechanical gate | `rg -U --count-matches '<a\s+[^>]*href=' src --glob '*.tsx' --glob '!*.test.tsx'` = 0 件。**空集合 oracle の canary**: 変更前 HEAD で同コマンドが 19 件 / 10 file を返すことを PR body に記録し、コマンド自体の検出能力を証明する | 変換漏れ残存 | X2: 1 箇所を複数行 `<a href>` へ戻して非 0 を確認 |
| C3 | F3 | component integration (Vitest) | 代表 static 1 箇所 + 代表 runtime 2 箇所（`detail_route` 由来 / `MovementSourceLink.route` 由来）の click 遷移を memory history で assert | `<Link>` 未結線 / SPA 遷移不成立 | X3: `<Link>` を `<a>` へ戻して red |
| C4 | F4 | component integration (Vitest) | 同上 test で遷移後 location（pathname + search）を旧 href 期待値（**test 内へ独立転記した literal**、helper から導出しない）と完全一致比較 | URL 同値性破れ / search 欠落 | X4: helper の search 組み立てから 1 param を除去して red |
| C5 | F5 | integration (実 Router + memory history) | 復元成功 flow: mock 成功応答 → flag set → home render → Alert 文言表示を assert | flag set 漏れ / consume 結線漏れ | X5: navigate 前の flag set 行を除去して red |
| C6 | F6 | integration negative | consume 後に home 再 render + 再訪 + store reset 後 render で Alert 非表示を assert（非空 oracle と対: C5 が表示側を固定） | consume で消えない / reset で残る | X6: consume 時の flag clear を除去して red |
| C7 | F6 | integration negative | flag 未設定で home render、Alert 非表示 | 無条件表示 | X7: 受け口の flag 判定を常 true 化して red |
| C8 | F7 | integration negative | 復元失敗応答で flag 非 set + home に Alert 非表示 | 失敗経路で flag set | X8: 失敗 branch へ flag set を注入して red |
| C9 | F8 | diff review gate | `git diff` で test file の削除行を review。既存 assertion の削除・`skip`・`todo` 出現 0 | assertion 弱体化 | review red（機械 gate は lint の no-skip 慣行に従う） |
| C10 | F9 | docs gate | `rg -c 'UI-11b-D11' docs/function-design/68-ui-backup-restore.md` ≥ 2（D11 行 + §68.7 参照）/ `rg -c 'focus-visible:ring-\[3px\]' docs/UI_TECH_STACK.md` = 1 | anchor 消失・重複増殖 | X9: D11 行を旧 D4 のみへ戻して red |

anchor 一意性の確認（Matrix anchor uniqueness 教訓）: `UI-11b-D11` は 68 内の新設 ID で他 doc に出現しない。`focus-visible:ring-[3px]` は docs 内では §5.4 のみ（src 内の多数出現は対象外の実装 file であり docs gate の glob で分離する）。

## Characterization Baseline

実装前に green 固定する既存挙動:

| Surface | Existing oracle | 今回補強する不足 |
|---|---|---|
| `BackupRestorePage` 復元成功 | 既存 test の成功経路（toast + navigate） | ホーム側 Alert の統合 assert（C5）。既存 toast assertion は残置または Alert へ置換を packet の文言判断に従い実施 |
| Affected Surfaces 9 test file | 各画面の render / 遷移 assertion | Router wrapper 追随のみ。assertion 本体は不変（C9） |
| `SidebarLink` | active/pending 分岐の既存 test | focus class assertion 追加（C1） |

既存 REQ literal の件数は変更しない。新規 test case 名は `UI-11b` token を使い、`90-traceability.md` を変化させない。

## Mutation 実測の運用

Final Review で Matrix の Mutation 列（X1-X9）から最低 4 件（C2 canary / C5 / C6 / C8 を必須含む）を clean tree 上で実注入し、red 化を独立再現する（mutation kill claims need reproduction / clean tree only の運用教訓に従う）。
