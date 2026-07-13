# 73. UI-10: 棚卸し画面（StocktakePage）

> **親文書**: [FUNCTION_DESIGN.md](../FUNCTION_DESIGN.md)
> **入力ドキュメント**: [architecture/ui-task-specs.md](../architecture/ui-task-specs.md) UI-10、[DB_DESIGN.md](../DB_DESIGN.md)、[db-design/tracking-system-tables.md](../db-design/tracking-system-tables.md) §16-17（stocktakes / stocktake_items）、[35-biz-stocktake-service.md](35-biz-stocktake-service.md)、[42-cmd-sales-stocktake.md](42-cmd-sales-stocktake.md) §22.5、[UI_TECH_STACK.md](../UI_TECH_STACK.md) §7.2（10-4a）、[59-ui-shared-patterns.md](59-ui-shared-patterns.md)、[68-ui-backup-restore.md](68-ui-backup-restore.md) / [69-ui-threshold-settings.md](69-ui-threshold-settings.md)（構成の手本）
> **対応タスク / 仕様**: UI-10（REQ-205、棚卸し）
> **Design Phase**: 2026-07-07。運用一次入力は issue #135 Stage 5 ヒアリング（2026-07-07）+ 同日の価値提案訂正コメント。設計判断（UI-10-D1〜D9）は Design Phase packet `docs/archive/plans/2026-07-07-ui10-stocktake-design.md` で固定済み。本書は runtime 実装（route / components / hooks / specta 化）を含まない。以降「future」と明記した契約・コンポーネントは未実装であり、実装 PR（R3）の scope。UI-10-D10 以降は実装 PR #159（`docs/archive/plans/2026-07-07-ui10-stocktake-implementation.md`）のレビュー・契約監査で追記されたもので、future ではなく実装済み。

## 73.1 目的

年末（10月〜大晦日）の長期棚卸し作業を、開始・中断・再開・確定まで単独の operator が扱えるようにする。現運用は一人運用・数週間かけて商品マスタ全件（数千点規模）を回る前提であり（ヒアリングシート C60/B60/Q12/Q13/Q20）、既存 BIZ-06/CMD-10 契約（`start_stocktake` / `get_stocktake_items` / `update_count` / `complete_stocktake`）をそのまま UI から使う。新規に追加するのは軽量 CMD 3 本（進行中判定用 `get_active_stocktake`、カウント対象解決用 `find_stocktake_item`、前回比較用 `get_last_completed_stocktake`、いずれも future）のみで、DB スキーマ変更や BIZ 確定ロジックの変更は伴わない。

## 73.2 関数要求

| ID | 要求 |
|---|---|
| UI-10-F1 | `/stocktake` 到達時に新規 CMD `get_active_stocktake()`（DB 問い合わせ、§73.8）で進行中棚卸しの有無を判定し、あれば継続表示（開始日時・進捗）、なければ開始 CTA + 前回完了サマリを表示する。 |
| UI-10-F2 | 開始 CTA 押下で `start_stocktake` を呼び、成功後は継続表示（カウント画面）へ切り替える。 |
| UI-10-F3 | 部門フィルタ・未入力のみ toggle・進捗（counted/total）付きの一覧を `get_stocktake_items` で取得・表示する。 |
| UI-10-F4 | 検索/HID スキャンで商品を特定し、数量入力 → `update_count` で 1 件即保存する。counted 済み商品への再入力（上書き）を同一導線で常時許可する。 |
| UI-10-F5 | 確定 CTA 押下時、未入力 N 件があれば確認ダイアログ（force_fill 再送信）を経て `complete_stocktake` を呼び、結果画面（`total_cost` 主役 + `adjusted_items` 差異一覧 + `integrity_result`）を表示する。 |
| UI-10-F6 | 開始前画面・確定結果画面に、前回完了棚卸しの `total_cost` / `completed_at`（future `get_last_completed_stocktake`）を併記する。 |
| UI-10-F7 | 棚卸し中の商品登録・一括インポートによる明細自動追加（BIZ-01 実装済み）を、query invalidation / 再取得で自然に一覧へ反映する。専用通知は出さない。 |
| UI-10-F8 | `complete_stocktake` は単一 TX のため IPC channel を使わず、spinner + ボタン disabled で進行中を示す。 |

## 73.3 Design Decisions

### UI-10-D1: 開始/再開は同一画面での自動判別、明示 resume コマンドなし、中止機能なし

- **決定**: `/stocktake` 到達時に新規 CMD `get_active_stocktake()`（`stocktake_repo::find_active_stocktake` の BIZ 薄 wrapper、§73.8）を呼び、`Some(Stocktake)` なら継続表示（開始日時・進捗）にそのまま入る。`None` なら開始 CTA + 前回完了サマリを表示する。進行中判定の真実のソースは常に DB（`stocktakes.status`）であり、クライアント側の永続状態（localStorage 等）を判定に使わない。「再開する」という明示ボタン・コマンドは存在しない。棚卸しの途中破棄（中止）機能も作らない。
- **Why**: BIZ-06 に resume 専用の関数はなく、`start_stocktake` は進行中があれば `StocktakeInProgress` を返すだけである。実態にない機能を UI 側で作ると、存在しない中断状態（一時停止 vs 進行中）の区別を UI が勝手に発明することになる。中断・再開の実体は「autocommit された `update_count` をいつでも再開できる」ことそのものであり、専用 UI 状態を持つ必要がない。`find_active_stocktake` は IO 層に既存だが CMD として公開されていなかったため（本 Design Phase の初版で見落とし、2026-07-08 PR #159 レビューで顕在化）、新規 CMD として公開する。
- **Rejected**: 明示的な「一時中断」「再開」ボタン（BIZ に対応する状態がなく、フェイクの状態遷移を UI に作り込むことになる）。棚卸しの中止（途中破棄）機能（35-biz §20.7 の非目的を UI 側でも踏襲。年1回の作業を無に返す操作は非IT operator の事故リスクが高く、要求もない）。**進行中判定をクライアント側 `localStorage` に持たせ、復帰は `start_stocktake` の `stocktake_in_progress` エラーメッセージ文字列を正規表現でパースして ID を抽出する方式**（PR #159 で実装されたが却下。理由: ①バックエンドの人間可読エラーメッセージ（35-biz `StocktakeInProgress` の文言）をプログラム契約として利用しており、文言変更で復帰導線がサイレントに壊れる。②別端末・アプリ再インストール・WebView プロファイルリセット等で `localStorage` が失われると、進行中の棚卸し（数週間規模の単独作業）に到達する手段が「開始ボタンを押してエラー経由で推測復旧する」という回りくどい導線に落ちる。③本 Spec Contract の「status 自動判別」を実装が満たさない。新規 CMD 1 本（薄い wrapper）の追加コストの方が明確に小さい）。
- **Revisit trigger**: BIZ-06 に明示的な resume/中止 API が追加された場合。
- **契約監査追記（2026-07-08）**: PR #159 の契約監査で、継続表示ヘッダが本決定・UI-10-F1・73.10 Wording が明記する「開始日時」ではなく内部 `stocktake_id` を表示していた実装漏れが見つかった。バックエンド（`get_active_stocktake`）は `started_at` を返しているのに、`useStocktakeStatus` フックも `StocktakeProgressHeader` コンポーネントもこれを一切参照していなかった。`棚卸し中（ID: {stocktakeId}）` → `棚卸し中（開始日: {formatCountedAt(started_at)}）` に修正。

### UI-10-D2: カウント主動線は検索/スキャン→数量入力→即保存、counted 済みへの上書き再入力を常時許可

- **決定**: 主動線は「検索/HID スキャンで商品を特定 → 数量入力 → 1 件即保存」で、保存は `update_count`（autocommit）。商品の特定は新規 CMD `find_stocktake_item({ stocktake_id, code })`（future、§73.8。`code` は商品コードまたは JAN の完全一致で該当明細を 1 発解決）で行う。counted 済み（`actual_count` が既に入っている）商品への再入力を、未入力商品と全く同じ導線・確認なしで常時許可する（上書き＝都度訂正の代替）。プレカウント専用の別機能は作らない。
- **Why**: 現運用は部門キー売り中心で、CSV/PLU が未導入の間は商品単位のレジ販売が `sale_records` / `inventory_movements` に反映されない（D-025）。そのため「カウント後に売れた分の訂正」はシステム側にも訂正対象データが存在せず、operator が現物を見て再入力する以外に手段がない（issue #135 の訂正コメント 2026-07-07 で明示）。上書き保存を特別扱いすると、まさに一番必要な訂正導線に確認ダイアログという追加の摩擦を課すことになる。
- **Rejected**: BIZ 確定ロジック側で `counted_at` 以降の在庫変動を自動織り込む（現運用では織り込むべき商品単位データ自体が存在しないため実装不能。将来 Z004/PLU 運用が始まったら再検討）。上書き時だけ確認ダイアログを挟む（都度訂正が前提の運用で毎回ダイアログを出すのは実質妨害になる。DSR-07 も可逆操作には確認なしを原則としており、`update_count` は何度でも再入力できる可逆操作）。プレカウント専用モード（上書き入力で用が足りる）。クライアント側で全明細ページを順次取得して `product_code → stocktake_item_id` マップを構築する解決方式（`update_count` 成功ごとに一覧 invalidation（§73.11）が走るため 1 件保存のたびに数千件・複数ページの再取得とマップ再構築が反復する。部門を跨いでスキャンする使い方にも弱い。薄い解決 CMD 1 本（BIZ wrapper 込み）の追加コストの方が明確に小さい）。
- **Revisit trigger**: Z004/PLU 運用が始まり商品単位の販売データが `sale_records` に載るようになった時。
- **契約監査追記（2026-07-08、owner L3 実機発見）**: §73.5 は Design Phase 初版から「商品名で探したい場合は既存の商品検索（`commands.searchProducts`）で候補から選び、その `product_code` を使う」と明記していたが、実装から丸ごと漏れていた。owner が実機 L3 で「棚卸し中に新商品を登録し、その商品名で棚卸し検索欄に入力する」という自然な操作を行った際、`find_stocktake_item` は商品コード/JAN の完全一致のみ検索するため `None` を返し、「この商品は棚卸しの対象にありません」という誤解を招くメッセージが出た（一覧には UI-10-D9 の自動追加で実際に存在しているのに、検索では見つからないという矛盾した体験）。`resolveItem` を拡張し、`find_stocktake_item` が `None` を返した場合に `commands.searchProducts`（`ReceivingPage.tsx` の商品名検索と同じ経路・クエリ）へフォールバックする。0 件は既存の「対象にありません」文言、1 件は自動的にその `product_code` で `find_stocktake_item` を再実行して選択、複数件は候補テーブル（商品コード/商品名/部門 + 選択ボタン、`ReceivingPage.tsx` の候補表示パターンを踏襲）を表示する。T21/T22 追加。
- **契約監査追記2（2026-07-08、Codex レビュー）**: 商品名検索欄に日本語 IME の変換確定 Enter でも `resolveItem` が発火する欠落があった（`event.nativeEvent.isComposing` guard 未実装）。`ReceivingPage.tsx` の商品検索欄には既にこの guard があり、今回追加した商品名検索フォールバックが「同じパターン」を謳う以上この点でも一致させる必要があった。検索欄・数量入力欄の両方の `onKeyDown` に `if (event.nativeEvent.isComposing) return;` を追加（数量欄は `inputMode="numeric"` だが全角数字入力等の IME 経由ケースへの防御として追加）。T23 追加。

### UI-10-D3: 一覧は進捗管理用、ソートは既存のまま変更しない

- **決定**: 一覧は部門フィルタ + 未入力のみ toggle（`counted_only`）+ 進捗（counted/total）を表示する進捗管理ビューとして設計する。並び順は `list_stocktake_items` の既存 `ORDER BY si.id ASC` のまま変更しない（IO 変更なし）。
- **Why**: 主動線が検索/スキャンによる商品特定であり、一覧をスクロールして目的の商品を探す使い方を前提にしない。棚の物理的な並びはアプリが把握できる情報ではなく、`id` 順（＝棚卸し明細の生成順）を並べ替える業務的な意味が薄い。
- **Rejected**: 商品名/コード順や未入力優先ソートの追加（IO 層の `ORDER BY` 変更を伴う。主動線が検索/スキャンである以上、一覧の並び順を工夫する投資対効果が低い）。
- **Revisit trigger**: 一覧を目視でスクロールして探す使い方が実際の運用で主動線になった場合。

### UI-10-D4: 確定は常時確認ダイアログ（文言は未入力件数で分岐）、結果画面は total_cost が主役

- **決定**: 確定 CTA「棚卸しを確定する」は 1 個（DSR-01）。押下時は**常に**確認ダイアログを挟む。`progress.uncounted_items > 0` なら「未入力の商品が{N}件あります。現在の在庫数で確定しますか？」（確認後 `force_fill=true`）、`uncounted_items === 0` なら「棚卸しを確定します。確定後は取り消せません。」（確認後 `force_fill=false`）。確定結果画面は `total_cost`（税理士報告値）を主役に、`adjusted_items` 差異一覧、`integrity_result`（None 時はフォールバック文言）を並べる。
- **Why**: `complete_stocktake` は在庫を書き換える確定操作で、**確定の取り消し API が BIZ-06 に存在しない**。誤タップで確定した場合の回復手段は「新しい棚卸しを開始して全件数え直す」しかなく、数週間分の単独作業が失われる非対称に大きい損失になる。DSR-07（不可逆操作の直前確認）の対象として、儀式化の懸念より誤操作コストを優先する。未入力がある場合はさらに force_fill の意味（未入力を現在庫数とみなす）を説明する必要があるため、文言を分岐する。
- **Rejected**: 全件入力済み時の確認なし直確定（誤タップ時の損失が数週間分の再カウントと非対称に大きく、確定取消 API がない。68-ui-backup-restore が復元操作に確認を課すのと同じ risk profile）。常時同一文言のダイアログ（未入力ありの場合は force_fill の意味説明が必要で、説明なしの汎用文言では判断材料にならない）。
- **Revisit trigger**: BIZ-06 に確定取消（reopen）API が追加された場合、全件入力済み時の確認省略を再検討してよい。

### UI-10-D5: 前回完了棚卸しとの比較を軽量 CMD 1 本で追加する

- **決定**: 開始前画面と確定結果画面に、前回完了棚卸しの `total_cost` / `completed_at` を併記する。新規 CMD `get_last_completed_stocktake()`（IO query + BIZ 薄 wrapper + CMD、future）を追加し、戻り値は `Option<LastStocktakeSummary { stocktake_id, completed_at, total_cost }>`。
- **Why**: ヒアリング⑥「合計が前年と極端に違わないか見る」という既存の目視確認をシステム側で軽く支援する。棚卸し履歴の一覧画面や比較グラフのような重い機能は過剰。
- **Rejected**: 棚卸し履歴一覧画面の新設（過去複数回分の一覧・詳細は要求されておらず、直近1回との比較で足りる）。前回比較なし（ヒアリングの目視確認要求に応えられない）。
- **Revisit trigger**: 複数年分の推移を見たいという要望が出た時。
- **契約監査追記（2026-07-08、Codex）**: `complete_stocktake` 成功後、§73.11 の契約どおり `lastCompleted` query を invalidate すると、`get_last_completed_stocktake()`（`ORDER BY completed_at DESC, id DESC LIMIT 1`）は「今確定した棚卸し自身」を返す（確定処理が先に `stocktakes.status` を `completed` にするため）。結果画面はその再取得後の値をそのまま表示していたため、「前回の棚卸し」が今回確定した棚卸し自身に置き換わるバグがあった（既存 T11 の `mockGetLast` が常に同一値を返す実装だったため検出できていなかった）。`handleCompleteConfirm` で `complete_stocktake` 呼び出し直後・invalidate 前の `lastCompletedQuery.data` を local state にスナップショットし、結果画面にはそのスナップショットを渡すよう修正（invalidate 自体は次の未開始画面表示のために維持）。T19 追加。

### UI-10-D6: IPC channel 不採用（10-4a 判定を「不採用」で確定）

- **決定**: `complete_stocktake` は単一 TX で進捗の粒度が存在しないため、Tauri channel は使わない。spinner + ボタン disabled のみで完了を待つ。[UI_TECH_STACK.md §7.2](../UI_TECH_STACK.md) の 10-4a 判定はこの PR で「不採用」として閉じる。
- **Why**: UI-07（CSV 取込み）の 8-2b 判定と同根拠。`complete_stocktake` は force_fill の自動補完・差異計算・movement 記録・整合性チェックを 1 トランザクション内で行い、途中経過を刻める中間状態がない。
- **Rejected**: channel 経由の進捗表示（実装コストに見合う体験改善がない。§7.2 の再検討トリガ「UI-10 で channel 採用が決まったら CSV 取込みへ展開」はこの判定により不成立で閉じる）。
- **Revisit trigger**: `complete_stocktake` が商品単位のバッチ処理に分割される設計変更が入った時。

### UI-10-D7: specta 化は既存 4 + 新規 3、生 invoke 禁止を維持

- **決定**: 既存 4 コマンド（`start_stocktake` / `get_stocktake_items` / `update_count` / `complete_stocktake`）は現状 `#[tauri::command]` のみで `#[specta::specta]` が付いておらず、`src/lib/bindings.ts` にも生成型がない（実装 PR 着手前に実コード突合で確認済み）。実装 PR でこの 4 本 + 新規 `get_active_stocktake` / `find_stocktake_item` / `get_last_completed_stocktake` の計 7 本に `#[specta::specta]` を付与し、bindings を再生成する。UI からの生 `invoke()` 直呼びは既存の禁止方針（ADR-004）を維持する。
- **Why**: ADR-004 の生 invoke 禁止方針を UI-10 でも一貫させる。既存 4 本が specta 未対応のまま長期間放置されていた事実は本 Design Phase で顕在化したため、実装 PR の Rust 差分に明記する。
- **Rejected**: 実装 PR 内での暫定的な生 invoke 経由実装（撤去忘れの前例＝ 7-5c fallback を再演する）。

### UI-10-D8: エラーは kind 別に専用ハンドリングする

- **決定**: `CmdError.kind` が `stocktake_in_progress`（`start_stocktake` を進行中に呼んだ場合）なら、開始 CTA 経路を止めて継続表示へ切り替える。`stocktake_not_in_progress`（`update_count` / `complete_stocktake` を完了済み棚卸しに対して呼んだ場合、他端末や再読み込みのタイミング差で発生し得る）なら、棚卸し状態を再取得して完了済み/未開始表示へ切り替える。`validation`（`actual_count` 負数、`page`/`per_page` 不正、`complete_stocktake` の未入力超過 force_fill=false）は FieldError または確認ダイアログ誘導で回復する。`integrity_result: None`（整合性チェック失敗）は「整合性チェックは実行できませんでした」のフォールバック文言で表示する。
- **Why**: BIZ-06/CMD-10 は既に 3 つの意味あるエラー種別（`StocktakeInProgress` / `StocktakeNotInProgress` / `ValidationFailed`）を返すため、UI 側で汎用エラー表示にまとめると回復導線が失われる。
- **Rejected**: 全エラーを共通の destructive Alert にまとめる（`stocktake_in_progress` は実は「継続表示に戻ればよいだけ」の非エラー的状況であり、汎用エラー表示では誤解を招く）。
- **契約監査追記（2026-07-08）**: PR #159 の実装レビューで、UI-10-D11（フォーカス管理漏れ）を owner 確認質問で発見した後、73 全体を実装コードと突き合わせる監査を行った結果、`stocktake_not_in_progress` の実装漏れが追加で見つかった。`get_stocktake_items`（一覧取得）の `stocktake_not_in_progress` は invalidate 処理があったが、`update_count`（カウント保存）と `complete_stocktake`（確定）で発生した場合は kind 判定・invalidate ともに未実装で、汎用エラー表示のまま画面が完了済み状態に固まっていた。加えて表示文言もバックエンドのエラーメッセージ文字列をそのまま出しており（たまたま UI 側の想定文言と一致していたため既存テストでは検出できなかった）、UI 固定文言としてハードコードされていなかった。3 箇所（一覧取得・カウント保存・確定）すべてで共通ヘルパー `isStocktakeNotInProgressError` による kind 判定 + UI 固定文言 + invalidate に統一した。§73.9 のエラーテーブルに詳細を追記。
- **追記2（2026-07-08、owner 指摘起因）**: force_fill 未入力超過 `validation` エラーについて、owner から「発生条件がそこまで珍しくないのでは」という指摘を受けて再検討した。`useStocktakeItems` は `staleTime: 0` で画面再訪時に自動再取得されるため大半のケースは緩和されるが、商品登録画面（`ProductFormPage.tsx`）は自身の商品一覧クエリしか invalidate しておらず、棚卸し関連クエリには触れない。確定直前に新商品登録を挟み、棚卸し画面へ戻った直後の自動再取得が完了する前に確定 CTA を押すと到達しうる。kind 判別不能という制約は変わらないため専用の再試行ボタンは作らないが、`handleCompleteConfirm` の `validation` エラー catch に `itemsRoot` invalidate を追加した。これにより次回の確定操作は最新の `uncounted_items` に基づいて正しく動作し、実質的な再試行導線として機能する。T20 追加。

### UI-10-D9: カウント中の明細自動追加は通知なしで自然反映

- **決定**: 棚卸し中に商品登録・一括インポートが行われて `stocktake_items` に明細が追加される（BIZ-01 実装済み）動作は、UI 側では専用の通知を出さず、一覧の query invalidation / 再取得によって自然に反映されるだけとする。
- **Why**: 追加自体は BIZ-01 側で完結しており、UI が能動的に検知するイベント経路（push 通知等）を持たない。一覧を開き直す・フィルタを変える操作のたびに最新状態が見えれば十分であり、追加専用の通知は実装コストに見合わない。
- **Rejected**: 新規追加分をハイライトする専用 UI（追加検知のための差分比較ロジックが必要になり、投資対効果が低い）。

### UI-10-D10: 一覧の差異・最終カウント列 + 確定警告の視認性 + 前回比較の独立表示（実装レビュー起因の追記）

- **決定**: 2026-07-08、Windows native L3 実機観察（PR #159）と実装コード確認を受けて 3 点を追加・是正する。
  1. **一覧に「差異」「最終カウント」列を追加**する。差異は `current_stock - actual_count`（`update_count` の `current_difference` と同一計算式、35-biz §20.4「差異の動的計算」を一覧にも適用）。`actual_count` が `null`（未入力）の行は差異・最終カウントとも「—」。列表示は符号付き数値のプレーンテキストのみとし、結果画面の `adjusted_items` テーブル（既存、色分けなし）と表現を揃える（新規に色分けを導入しない）。最終カウントは既存 `formatMovementDateTime`（`src/features/stock-movements/lib/movement-formatters.ts`）と同じ `T` 区切り→スペース変換を流用する。**既存の「システム在庫」列（`stocktake_items.system_stock`、開始時点の参考値）は「現在在庫」列に改め、表示値を `current_stock` に揃える**（カウント入力欄の選択商品情報表示も同様）。差異の計算根拠と画面表示の在庫値が異なる列に見えると、棚卸し中に在庫が動いた場合（35-biz §20.4 の前提どおり CSV 取込み等で変動しうる）に「現在在庫 10 / 実際 9 / 差異 +3」のような数値的に矛盾した表示になるため、両者を同一ソースに統一する（実装レビュー P2 是正、2026-07-08）。
  2. **確定確認ダイアログに warning Alert（`border-warning bg-warning-soft text-warning-strong` + `AlertTriangle`）を `AlertDialogContent` 内へネストし、不可逆性を視覚的に強調する**。実装（PR #159）は `AlertDialogTitle` が「未入力の商品があります」という状態説明に留まり、取り消せないことを伝えていなかった。一次是正として `RestoreConfirmDialog`（`BackupRestorePage.tsx`）のタイトル強調パターンに倣い「棚卸しを確定します（取り消せません）」に統一したが、owner が Before/After 比較 Artifact を見た上で **warning Alert ネスト版の視認性を明示的に支持**（2026-07-08）。`AlertDialogTitle` は未入力有無で状態を示す文言に戻し（未入力あり「未入力の商品があります」/ なし「棚卸しの確定」）、`AlertDialogContent` 直下に常時 warning Alert を配置して `AlertTitle`「確定すると取り消せません」+ `AlertDescription`（未入力有無で分岐）で不可逆性を伝える。
  3. **結果画面の前回比較を、総額カードから独立したカードに分離**する。既存実装は `formatLastStocktake()` の1文をコストカード内に注記として同居させており、独立した情報として認識しにくい。
- **Why**: L3 実機観察で「警告文言が小さく薄いグレーで正確な文言を記録できなかった」という指摘、および一覧に差異・カウント日時が出ないため実カウントとシステム在庫の乖離を目視で追えないという指摘。原因はコード確認の結果、①既存の design-system 警告パターン（`BackupRestorePage.tsx` の `RestoreConfirmDialog`）を踏襲していなかったこと、②本設計書（UI-10-D2〜D9 初版）が一覧の情報構造・確定ダイアログの文言強度をここまで具体的に指定していなかったこと、の両方に起因する。warning Alert ネストへの再変更は、タイトル強調のみの一次是正版と Artifact の warning Alert 版を owner が実際に見比べ、後者を明示的に選んだため（2026-07-08）。
- **Rejected**: 差異列の色分け（正=success系・負=destructive系）（結果画面の `adjusted_items` テーブルが無色のプレーンテキストであり、進行中一覧だけに新しい色分け表現を導入すると同じ「差異」という概念の表現が画面間で割れる。DSR-01 の視覚言語継承を優先）。
- **Revisit trigger**: 結果画面の差異テーブル自体に色分けを導入する設計変更が別途入った場合、進行中一覧の差異列も合わせて見直す。`RestoreConfirmDialog`（`BackupRestorePage.tsx`）も同様に warning Alert ネスト版へ揃えるかは、他の不可逆操作ダイアログでも同じ視認性懸念が出た時に横展開を検討する（本 PR のスコープでは UI-10 のみ変更）。

### UI-10-D11: 連続 HID スキャンのためのフォーカス自動遷移（実装漏れの是正）

- **決定**: 2026-07-08、owner からの確認質問（「他画面のようにカーソルを置いたまま連続スキャンできるのか」）を受けて実装を確認した結果、§73.5 が既に定めていた「解決できたら数量入力欄にフォーカスを移す」という契約が実装（PR #159）に反映されておらず、初期フォーカス・保存後のフォーカス復帰も未実装だったことが判明。`StocktakeCountEntry` に次の 3 つのフォーカス遷移を追加する。
  1. 画面表示時（コンポーネント mount 時）、検索/スキャン欄（`stocktake-code`）に自動フォーカスする。
  2. `find_stocktake_item` が該当明細を解決したら、数量入力欄（`stocktake-actual-count`）に自動フォーカスする（§73.5 の既存契約の実装漏れ是正）。
  3. `update_count` が成功したら、検索/スキャン欄に自動フォーカスを戻す（次のスキャンに備える）。
  1（mount 時）は `useEffect(() => { codeInputRef.current?.focus(); }, [])` で直接 `.focus()` を呼ぶ。mount 後の `useEffect` は DOM コミット後に実行されるため、`window.setTimeout` による遅延は不要。2・3（`find_stocktake_item` 解決成功後 / `update_count` 成功後）は、状態更新に伴い DOM 構造が切り替わる箇所であり、`ReceivingPage.tsx`（UI-02）の `addProduct` / `resetForm` と同じ理由で `useRef` + `window.setTimeout(() => ref.current?.focus(), 0)` パターンを踏襲する（state 更新後のレンダリング完了を待ってから focus する）。合わせて、数量入力欄に `onKeyDown` の Enter ハンドラを追加し、キーボードで数量を入力した場合も Enter で保存できるようにする（HID スキャナは数量欄では使わない想定だが、キーボード操作の対称性のため）。
- **Why**: HID スキャナ運用（`docs/UI_TECH_STACK.md` §5.3、memory `barcode_scanner_ux.md`）は「フォーカスが正しい入力欄にある」ことが前提条件。フォーカス管理が欠けていると、1 件目はスキャンできても 2 件目以降は毎回マウスでクリックし直す必要があり、「検索欄にカーソルを置いたまま連続スキャンする」という運用が成立しない。UI-02/UI-03（入庫記録・返品交換）では同じ課題に対して確立済みのパターンがあるのに、UI-10 だけそれが実装されていなかった。Codex の複数回のレビューでも検出されず、owner の実運用視点の質問で発覚した。
- **Rejected**: なし（実装漏れの是正であり、新規の設計判断選択肢はない）。
- **Revisit trigger**: `UI_TECH_STACK.md` §5.3 の「global scan detection」（連続文字入力の間隔での自動判定）を実店舗確認後に採用する場合、本フォーカス遷移ロジックとの整合を再検討する。

## 73.4 Route / 状態遷移 / Components（future）

```
src/routes/stocktake/index.tsx          … route 定義（search param: dept/counted_only/page）
src/features/stocktake/
  StocktakePage.tsx                     … 画面本体（状態分岐のエントリポイント）
  StocktakeStartPanel.tsx               … 未開始時: 開始CTA + 前回完了サマリ
  StocktakeProgressHeader.tsx           … 進行中: 開始日時 + 進捗（counted/total）+ 前回比較
  StocktakeItemList.tsx                 … 部門フィルタ + 未入力のみtoggle + 明細テーブル
  StocktakeCountEntry.tsx               … 検索/スキャン入力 + 数量入力 + 即保存
  StocktakeCompleteDialog.tsx           … 確定確認ダイアログ（force_fill分岐）
  StocktakeResultPage.tsx               … 確定結果（total_cost + adjusted_items + integrity_result + 前回比較）
  hooks/useStocktakeStatus.ts           … 進行中判定（新規CMD get_active_stocktake を叩く。DBが真実のソース。localStorage不使用）
  hooks/useStocktakeItems.ts            … getStocktakeItems を包む useQuery（部門/counted_only/page）
  hooks/useUpdateCount.ts               … updateCount を包む useMutation（1件即保存）
  hooks/useCompleteStocktake.ts         … completeStocktake を包む useMutation
  hooks/useLastCompletedStocktake.ts    … get_last_completed_stocktake を包む useQuery（future）
  hooks/useFindStocktakeItem.ts         … find_stocktake_item を包む解決 hook（future、§73.5）
```

- 共通部品は `patterns/PageHeader` / `patterns/DepartmentFilter` / `patterns/EmptyState` / `patterns/SearchBar`（既存 [59-ui-shared-patterns.md](59-ui-shared-patterns.md)）を再利用する。進捗表示は shadcn/ui `Progress`（[design-system/02-component-catalog.md](../design-system/02-component-catalog.md) 既存カタログ「確定的進捗」用途、CSV 取込み・バックアップに続く 3 例目の採用）。
- URL state（`dept` / `counted_only` / `page`）は [58-ui-stock-inquiry.md](58-ui-stock-inquiry.md) / [66-ui-stock-movements.md](66-ui-stock-movements.md) の `validateSearch`（zod 4）パターンを踏襲する。開始/未開始/確定結果のような画面全体の局面（`none` / `in_progress` / `completed`）は復元・共有する価値のある表示状態ではないため URL 化しない（ローカル state / query の有無で判定する）。

### シグネチャ（擬似コード、future）

```ts
// 進行中判定（新規CMD get_active_stocktake。DBへ直接問い合わせる。localStorage不使用）
function useStocktakeStatus(): UseQueryResult<Stocktake | null, InvokeError>

// 明細一覧（部門/counted_only/page）
function useStocktakeItems(params: {
  stocktakeId: number;
  departmentId?: number;
  countedOnly?: boolean;
  page: number;
  perPage: number; // IO 側で 200 上限にクランプされる（PAGINATION_MAX_PER_PAGE）
}): UseQueryResult<StocktakeItemListResponse, InvokeError>

// カウント更新（1件即保存）
function useUpdateCount(): UseMutationResult<UpdateCountResult, InvokeError, {
  stocktakeItemId: number;
  actualCount: number;
}>

// 確定
function useCompleteStocktake(): UseMutationResult<StocktakeResult, InvokeError, {
  stocktakeId: number;
  forceFill: boolean;
}>

// 前回完了棚卸し（新規CMD、future）
function useLastCompletedStocktake(): UseQueryResult<LastStocktakeSummary | null, InvokeError>

// 検索/スキャン値 → 対象明細解決（新規CMD find_stocktake_item を包む、future）
function useFindStocktakeItem(): UseMutationResult<StocktakeItemDetail | null, InvokeError, {
  stocktakeId: number;
  code: string; // 商品コードまたは JAN の完全一致
}>
```

### 状態遷移（ローカル UI 状態）

| 状態 | 入る条件 | 表示 |
|---|---|---|
| `loading` | `get_active_stocktake` query 実行中 | Skeleton |
| `not_started` | `get_active_stocktake` が `None` | 開始 CTA + 前回完了サマリ（`get_last_completed_stocktake` が `None` なら「前回の記録はありません」） |
| `starting` | 開始 CTA 押下、`start_stocktake` 実行中 | ボタン disabled |
| `counting` | `get_active_stocktake` が `Some(Stocktake)` | 進捗ヘッダ + 一覧 + カウント入力 |
| `confirming_complete` | 確定 CTA 押下、未入力あり | force_fill 確認ダイアログ |
| `completing` | `complete_stocktake` 実行中 | spinner + 操作 disabled（UI-10-D6） |
| `completed_result` | `complete_stocktake` 成功 | 結果画面（`total_cost` / `adjusted_items` / `integrity_result` / 前回比較） |

## 73.5 カウント導線（処理ステップ）

1. `counting` 状態で、部門フィルタ・未入力のみ toggle を指定して `get_stocktake_items` を呼び、明細一覧（`StocktakeItemDetail[]` + `progress`）を取得する。
2. 検索欄（既存 `patterns/SearchBar`、HID スキャナは Enter キー入力として扱う既存パターンを踏襲）に商品コードまたは JAN を入力する。商品名で探したい場合は既存の商品検索（`commands.searchProducts`、入出庫系画面の商品追加と同じ経路）で候補から選び、その `product_code` を使う。
3. 入力値（商品コード/JAN）を `find_stocktake_item({ stocktake_id, code })` に渡し、該当明細（`StocktakeItemDetail`）を 1 発解決する（UI-10-D2、§73.8）。解決できたら数量入力欄にフォーカスを移す。counted 済み商品を指定した場合も同じ導線で現在値を初期表示し、上書き入力を許可する（UI-10-D2）。`None` の場合、`commands.searchProducts` で商品名検索にフォールバックする（UI-10-D2 契約監査追記）: 0 件は §73.9 の回復に従う。1 件は自動的にその `product_code` で再解決して選択。複数件は候補テーブル（商品コード/商品名/部門）を表示し、選択した `product_code` で再解決する。
4. 数量入力後 Enter または保存操作で `update_count({ stocktake_item_id, actual_count })` を呼ぶ。負数は送信前に FieldError で止める（CMD 側も同じ検証を持つ防御的二重チェック）。
5. 保存成功で該当行の `actual_count` / `current_difference` / `counted_at` を即時反映する。1 件保存ごとの toast は出さない（4000 件規模の反復操作で toast が積み重なるとかえって妨げになるため、一覧行の即時反映のみで結果を示す）。
6. 一覧・進捗（`progress.counted_items` / `uncounted_items`）を invalidate して次の入力に備える。

### 設計判断: 検索/スキャン値の解決は新規 CMD `find_stocktake_item` で行う

`get_stocktake_items` は `department_id` / `counted_only` / ページングのみを受け付け、商品コード・JAN・商品名による検索パラメータを持たない（`stocktake_repo::list_stocktake_items` 実装確認済み。`PAGINATION_MAX_PER_PAGE=200` のため商品マスタ全件を対象とする棚卸しでは 1 部門が複数ページに分かれ得る）。このギャップは主動線（UI-10-D2 の検索/スキャン → 即保存）の成立条件そのものであるため、クライアント側の回避策ではなく新規 CMD `find_stocktake_item({ stocktake_id, code })`（§73.8）で埋める。`code` は商品コードまたは JAN の完全一致で、該当明細を index 付き単一クエリで解決する。クライアント側マップ方式を却下した理由は UI-10-D2 の Rejected を参照。

## 73.6 一覧・フィルタ

| 要素 | 設計 |
|---|---|
| 部門フィルタ | `patterns/DepartmentFilter`。`department_id` を `get_stocktake_items` にそのまま渡す。 |
| 未入力のみ toggle | `counted_only=false` 相当（UI-10-D3。`counted_only` は 3 値: 指定なし/true/false）。ラベル「未入力のみ表示」。 |
| 進捗表示 | 「入力済み {counted_items} / 全 {total_items}」+ `Progress`（value = `counted_items / total_items * 100`、`02-component-catalog.md` 既存採用パターン）。`uncounted_items` は確定ダイアログの文言にのみ使う。 |
| 差異列（UI-10-D10） | `current_stock - actual_count`（`update_count` の `current_difference` と同一計算式）。`actual_count` が `null` なら「—」。色分けなし、符号付き数値のプレーンテキストのみ（結果画面 `adjusted_items` テーブルと表現統一）。 |
| 最終カウント列（UI-10-D10） | `counted_at`。`null` なら「—」、値ありは `formatMovementDateTime` と同じ `T`→スペース変換（`src/features/stock-movements/lib/movement-formatters.ts` 流用）。 |
| 並び順 | 変更しない（`ORDER BY si.id ASC`、UI-10-D3）。 |
| 0 件表示 | `patterns/EmptyState`。「この条件に一致する商品がありません」+ フィルタ解除導線。 |

## 73.7 確定フロー

1. 確定 CTA「棚卸しを確定する」を押すと常に `confirming_complete` へ遷移する（UI-10-D4）。
2. `progress.uncounted_items > 0` ならダイアログ title「未入力の商品があります」+ warning Alert（`AlertTitle`「確定すると取り消せません」+ `AlertDescription`「{N}件が未入力のまま残っています。確定すると、この{N}件は現在の在庫数で棚卸しされます。」）を表示し、「確定する」で `complete_stocktake({ force_fill: true })`、「キャンセル」で `counting` に戻る。
3. `uncounted_items === 0` ならダイアログ title「棚卸しの確定」+ warning Alert（`AlertTitle`「確定すると取り消せません」+ `AlertDescription`「入力した内容で棚卸しを確定します。」）を表示し、「確定する」で `complete_stocktake({ force_fill: false })`、「キャンセル」で `counting` に戻る。（いずれも UI-10-D10）
   - アクセシビリティ: Radix `AlertDialog` は `AlertDialogDescription` を `aria-describedby` に紐付けるため、`AlertDialogDescription` は `sr-only` にした上で「確定すると取り消せません。」+ warning Alert 本文を結合したテキストを持たせる。視覚的な warning Alert 側のテキストと分離しているのは、Alert 本文だけでは不可逆性の title（「確定すると取り消せません」）がスクリーンリーダーの初期 dialog announcement に含まれないため（実装レビュー P2 是正、2026-07-08）。
4. `completing` 中は spinner + 全操作 disabled（UI-10-D6）。
5. 成功時は `completed_result` へ遷移し、`total_cost`（主役、大きめの表示）、`adjusted_items`（差異のあった商品一覧。0 件なら「差異はありませんでした」）、`integrity_result`（`None` ならフォールバック文言）、前回完了棚卸しの独立カード（`total_cost` / `completed_at`、UI-10-D5/D10）を表示する。
6. 失敗時は §73.9 のエラー処理に従う。

## 73.8 Command Contract

既存 4 コマンド（現行契約、`src-tauri/src/cmd/stocktake_cmd.rs` / `src-tauri/src/biz/stocktake_service.rs` 実装確認済み）:

| 呼び出し | 入力 | 戻り | 備考 |
|---|---|---|---|
| 開始 | `start_stocktake()` | `StartStocktakeResult { stocktake_id, item_count, auto_filled_count }` | 進行中あり → `CmdError.kind = "stocktake_in_progress"` |
| 一覧取得 | `get_stocktake_items({ stocktake_id, department_id?, counted_only?, page, per_page })` | `StocktakeItemListResponse { items: StocktakeItemDetail[], progress: StocktakeProgress, total_count, page, per_page }` | `page < 1` / `per_page < 1` は `kind = "validation"`。`per_page` は IO 側（`PAGINATION_MAX_PER_PAGE`）で 200 件を上限にクランプされる |
| カウント更新 | `update_count({ stocktake_item_id, actual_count })` | `UpdateCountResult { success, current_difference }` | `actual_count < 0` は `kind = "validation"`。完了済み棚卸し対象なら `kind = "stocktake_not_in_progress"` |
| 確定 | `complete_stocktake({ stocktake_id, force_fill })` | `StocktakeResult { total_cost, adjusted_items: AdjustedItem[], total_items, integrity_result: IntegrityResult \| null }` | 未入力あり + `force_fill=false` は `kind = "validation"`。完了済みの二重確定は `kind = "stocktake_not_in_progress"` |

`IntegrityResult { mismatches: IntegrityMismatch[], mismatch_count, checked_count }`（`biz::integrity_service` 実装確認済み）。

これら 4 コマンドは現状 `#[tauri::command]` のみで `#[specta::specta]` が付与されておらず、`src/lib/bindings.ts` にも型が生成されていない（実コード突合済み、UI-10-D7）。実装 PR で specta 属性付与・bindings 再生成を行うまでは、UI からの直接利用はできない。

新規コマンド（future、本書で設計。UI → CMD → BIZ → IO の層原則（CMD は「型変換 + BIZ 呼出し + エラー変換」のみ、[42-cmd-sales-stocktake.md](42-cmd-sales-stocktake.md) §22.5）に従い、BIZ に薄い wrapper を置く。読み取り専用でも BIZ 経由に揃えるのは、`get_stocktake_items` が CMD 直ラップから BIZ wrapper 経由へ修正された経緯（2026-04-13 `882cec6`、[35-biz-stocktake-service.md](35-biz-stocktake-service.md) §20.7）との CMD-10 内一貫性のため）:

| 呼び出し | 入力 | 戻り |
|---|---|---|
| `get_active_stocktake()` | なし | `Option<Stocktake { id: i64, started_at: String, completed_at: Option<String>, status: String, total_cost: Option<i64> }>` |
| `find_stocktake_item({ stocktake_id, code })` | `code`: 商品コードまたは JAN（完全一致） | `Option<StocktakeItemDetail>` |
| `get_last_completed_stocktake()` | なし | `Option<LastStocktakeSummary { stocktake_id: i64, completed_at: String, total_cost: i64 }>` |

- `get_active_stocktake` BIZ 側（future）: `stocktake_service::get_active_stocktake(conn) -> Result<Option<db::stocktake_repo::Stocktake>, BizError>`。`stocktake_repo::find_active_stocktake` を呼ぶだけの薄い wrapper で業務ルールを持たない（`start_stocktake` の進行中チェックが内部で使うのと同じ関数）。
- `get_active_stocktake` IO 側: `stocktake_repo::find_active_stocktake(conn) -> Result<Option<Stocktake>, DbError>`（既存、`stocktake_service.rs:220` の `start_stocktake` から呼ばれている実装をそのまま流用）。`Stocktake` 型は PR #159 で既に `specta::Type` 付与済み・`biz::mod` から re-export 済み（実コード確認済み）のため、型定義の追加作業は不要。
- `find_stocktake_item` BIZ 側（future）: `stocktake_service::find_stocktake_item(conn, stocktake_id, code) -> Result<Option<StocktakeItemDetail>, BizError>`。`stocktake_repo::find_stocktake_item_by_code` を呼ぶだけの薄い wrapper で業務ルールを持たない。
- `find_stocktake_item` IO 側（future）: `stocktake_repo::find_stocktake_item_by_code(conn, stocktake_id, code) -> Result<Option<StocktakeItemDetail>, DbError>`。SQL は `list_stocktake_items` と同じ SELECT 列に `JOIN products p ON si.product_code = p.product_code` を加え、`WHERE si.stocktake_id = ?1 AND (p.product_code = ?2 OR p.jan_code = ?2) ORDER BY si.id ASC LIMIT 1`。`products.jan_code` / `stocktake_items(stocktake_id, product_code)` の既存インデックスで解決できる。同一 JAN が複数商品に付く場合は `si.id` 最小の 1 件を決定的に返す（既存 `find_by_jan_code` と同じ先勝ちの割り切り + 決定性の担保）。
- `get_last_completed_stocktake` BIZ 側（future）: `stocktake_service::get_last_completed_stocktake(conn) -> Result<Option<LastStocktakeSummary>, BizError>`。`stocktake_repo::find_last_completed_stocktake` を呼ぶだけの薄い wrapper で業務ルールを持たない。
- `get_last_completed_stocktake` IO 側（future）: `stocktake_repo::find_last_completed_stocktake(conn) -> Result<Option<LastStocktakeSummary>, DbError>`。SQL は `SELECT id, completed_at, total_cost FROM stocktakes WHERE status = 'completed' ORDER BY completed_at DESC, id DESC LIMIT 1`。`stocktakes.completed_at` / `total_cost` は `complete_stocktake`（IO）が同一 UPDATE で必ず両方書き込むため、`status='completed'` の行では両カラムとも非 NULL であることが保証される（[db-design/tracking-system-tables.md](../db-design/tracking-system-tables.md) §16-17）。DB スキーマ変更なし。
- CMD 側（future）: いずれも `state.db.lock()` → BIZ 呼出し → `BizError` → `CmdError` 変換のみ（既存 4 コマンドと同型、42-cmd §22.5 の CMD-10 原則）。業務ルールを持たない。

## 73.9 エラー / 回復

| エラー | 回復 |
|---|---|
| `stocktake_in_progress`（開始時、他経路で既に開始済み） | 開始操作を止め、`get_active_stocktake` query を invalidate/再取得して `counting` 表示へ切り替える。エラーメッセージそのものは表示せず、パースもしない（状況が解決した形で見せる。UI-10-D1）。 |
| `stocktake_not_in_progress`（カウント/確定時、完了済み棚卸しに対する操作） | UI 固定文言「この棚卸しは既に完了しています」を表示する（バックエンドのエラーメッセージ文字列をそのまま出さない）。`get_active_stocktake` / `get_stocktake_items` query を invalidate/再取得して `not_started` 表示へ切り替える。`update_count` / `complete_stocktake` どちらの呼び出しで発生した場合も同じ回復を行う。**結果表示への自動切り替えはしない**: 他端末で完了した棚卸しの `total_cost` / `adjusted_items` はこのクライアントの `complete_stocktake` レスポンスとしてしか得られず、技術的に再現できないため（実装レビュー起因、2026-07-08 契約監査）。 |
| `find_stocktake_item` が `None`（棚卸し対象に存在しないコード/JAN） | 検索欄直下に「この商品は棚卸しの対象にありません。商品コードまたはJANを確認してください。新しく登録した商品は自動で追加されます」を表示する。エラー扱いにせず次の入力を受け付ける。 |
| `validation`（`actual_count` 負数） | 発生源直近の FieldError「0以上の数値を入力してください」（DSR-03）。送信しない。 |
| `validation`（`complete_stocktake` の未入力超過 + `force_fill=false`） | 通常はクライアント側で `uncounted_items` を見て事前に確認ダイアログへ誘導するため到達しない。到達しうるのは、確定直前に別画面で新商品登録を行い（UI-10-D9 の自動追加）、棚卸し画面へ戻った直後・`staleTime: 0` の自動再取得が完了する前に確定 CTA を押した場合。専用の kind 別再試行導線は実装しない（`CmdError.kind` は `validation` 共通で `actual_count` 負数と区別できず、message 文字列判別は UI-10-D1 で却下したアンチパターンに該当するため）。到達時は汎用エラー表示（`describeError`、バックエンドのメッセージには「force_fill=true で確定する」旨の案内を含む）に加え、一覧 query（`itemsRoot`）を invalidate/再取得する。これにより次回の確定 CTA 押下では最新の `uncounted_items` に基づいて正しいダイアログ文言・`force_fill` 値になり、実質的な再試行導線として機能する（2026-07-08 owner 指摘起因）。 |
| `integrity_result: null` | 結果画面に「整合性チェックは実行できませんでした」を表示する。棚卸し確定自体は成功として扱う（BIZ 側で確定 TX とは独立して整合性チェックが実行されるため）。 |
| 一覧/状態取得の通信エラー | 上部 Alert（destructive）+ 再試行ボタン。 |

## 73.10 UI / Wording

| 場所 | 文言 |
|---|---|
| ナビ / タイトル / h1 | 棚卸し |
| 未開始時 CTA | 棚卸しを開始する |
| 前回サマリ（未開始時） | 前回の棚卸し（`formatCountedAt(completed_at)`、`T`→スペース変換）: 仕入原価総額 ¥{total_cost}／記録がなければ「前回の記録はありません」 |
| 継続表示ヘッダ | 棚卸し中（開始日: `formatCountedAt(started_at)`、`T`→スペース変換） |
| 進捗表示 | 入力済み {counted}/{total} |
| 未入力のみ toggle | 未入力のみ表示 |
| 在庫列 見出し（UI-10-D10、一覧 + カウント入力欄選択商品情報。値は `current_stock`） | 現在在庫 |
| 差異列 見出し（UI-10-D10） | 差異 |
| 最終カウント列 見出し（UI-10-D10） | 最終カウント |
| 未入力行の差異・最終カウント（UI-10-D10） | — |
| 検索/スキャン欄 | 商品を検索・スキャン |
| 検索/スキャン欄 placeholder（UI-10-D2 契約監査追記） | 商品コード・JAN・商品名を入力 |
| 商品名検索フォールバック 複数候補時の案内（UI-10-D2 契約監査追記） | 候補から商品を選んでください |
| 数量入力欄 | 実際の数 |
| 確定 CTA | 棚卸しを確定する |
| 確定確認ダイアログ title（未入力あり、UI-10-D10） | 未入力の商品があります |
| 確定確認ダイアログ title（全件入力済み、UI-10-D10） | 棚卸しの確定 |
| 確定確認ダイアログ warning Alert title（共通、UI-10-D10） | 確定すると取り消せません |
| 確定確認ダイアログ warning Alert 本文（未入力あり、UI-10-D10） | {N}件が未入力のまま残っています。確定すると、この{N}件は現在の在庫数で棚卸しされます。 |
| 確定確認ダイアログ warning Alert 本文（全件入力済み、UI-10-D10） | 入力した内容で棚卸しを確定します。 |
| 確定確認ダイアログ sr-only description（UI-10-D10、実装レビュー P2 是正） | 「確定すると取り消せません。」+ warning Alert 本文（`aria-describedby` に不可逆性 title を含める） |
| 対象なし（find_stocktake_item None） | この商品は棚卸しの対象にありません。商品コードまたはJANを確認してください。新しく登録した商品は自動で追加されます |
| 結果画面 見出し | 棚卸し結果 |
| 結果画面 total_cost ラベル | 仕入原価総額 |
| 結果画面 前回比較カード ラベル（UI-10-D10） | 前回の棚卸し（`formatCountedAt(completed_at)`、`T`→スペース変換） |
| 結果画面 前回比較カード 記録なし（UI-10-D10） | 前回の記録はありません |
| 差異一覧 見出し | 差異のあった商品 |
| 差異一覧 0件 | 差異はありませんでした |
| 整合性チェック失敗フォールバック | 整合性チェックは実行できませんでした |

- 主動線 CTA は 1 個（DSR-01）。状態は色だけで表さず、「入力済み」「未入力のみ表示」等の日本語ラベルを主情報にする（DSR-08）。
- 確定確認ダイアログは確定 CTA 押下時に**常に**表示する（UI-10-D4/D10。DSR-07 の不可逆操作直前確認 — 確定取消 API が存在しないため確認を省略しない）。`AlertDialogTitle` は未入力有無で状態を示す文言、`AlertDialogContent` 直下の warning Alert（常時表示）が `AlertTitle`「確定すると取り消せません」で不可逆性を明示し、`AlertDescription` のみ未入力有無で本文が分岐する。DSR-08（色のみで意味を伝えない）を満たすため、warning の色は `AlertTriangle` アイコン + 太字テキストと併用する。

## 73.11 Query Invalidation

| Event | Query handling |
|---|---|
| `start_stocktake` 成功 | 棚卸し状態 query・一覧 query を invalidate。 |
| `update_count` 成功 | 一覧 query・進捗を invalidate（該当行は楽観的更新でも可）。 |
| `complete_stocktake` 成功 | 棚卸し状態 query・一覧 query・前回完了棚卸し query（`get_last_completed_stocktake`）を invalidate。 |
| 商品登録・一括インポートによる自動追加 | 既存の商品/在庫系 invalidation に相乗りする形で一覧 query が再取得される（UI-10-D9、専用 invalidation は追加しない）。 |

具体的な query key は実装 PR で既存命名規約（UI-06a/UI-09a 等）に従って列挙する。

## 73.12 テスト設計の起点

RTL（text / role / value assertion、色 class のみの assert は不可）:

- `get_active_stocktake` が `None` → 開始 CTA + 前回サマリ表示、`Some` → 継続表示（開始日時・進捗）。localStorage やエラーメッセージパースに依存せず、DB 問い合わせ（mock の戻り値）のみで状態が決まることを検証する（UI-10-D1）
- 開始 CTA 押下で `start_stocktake` が呼ばれ、成功後にカウント画面へ切り替わる
- 部門フィルタ変更・未入力のみ toggle で一覧取得パラメータが変わる（UI-10-D3）
- 検索/スキャン入力で `find_stocktake_item` が呼ばれ、解決成功で数量入力へフォーカス移動 → `update_count` が該当 `stocktake_item_id` で 1 回呼ばれる（UI-10-D2）
- 検索欄・数量入力欄とも、IME 変換確定の Enter（`isComposing: true`）では `find_stocktake_item` / `update_count` が呼ばれない（UI-10-D2 契約監査追記2、Codex レビュー P2 是正）
- 画面表示時は検索/スキャン欄に自動フォーカスし、`update_count` 成功後は検索/スキャン欄へフォーカスが戻る（連続 HID スキャン運用の検証、UI-10-D11、実装漏れ是正）
- `find_stocktake_item` が `None` → `searchProducts` で商品名検索にフォールバックする。0 件は「棚卸しの対象にありません」文言が表示され `update_count` は呼ばれない、1 件は自動的にその `product_code` で再解決して選択（数量欄へフォーカス移動）、複数件は候補テーブルが表示され選択操作で解決する（UI-10-D2 契約監査追記）
- counted 済み商品を再度指定 → 上書き入力 → 確認ダイアログなしで `update_count` が呼ばれる（UI-10-D2）
- 進捗表示が `progress.counted_items` / `total_items` の値と一致し、`Progress` の value が同じ比率で表示される（UI-10-D10）
- 一覧の在庫列は `current_stock` を表示し（`system_stock` ではない）、差異列は `current_stock - actual_count` と一致する。未入力行は差異・最終カウントとも「—」表示になる。`system_stock !== current_stock` のケースで在庫列と差異列の数値が矛盾しないことを検証する（UI-10-D10、実装レビュー P2 是正）
- 未入力 0 件で確定 CTA → title「棚卸しの確定」+ warning Alert（`AlertTitle`「確定すると取り消せません」+ `AlertDescription`「入力した内容で棚卸しを確定します。」）のダイアログを経て `complete_stocktake({ force_fill: false })` が呼ばれる（UI-10-D4/D10）
- 未入力 N 件で確定 CTA → title「未入力の商品があります」+ 同じ warning Alert title + 件数を含む本文のダイアログ、確認後 `force_fill: true` で再送信される（UI-10-D4/D10）
- 確定結果画面が `total_cost` / `adjusted_items` を表示し、前回比較が総額カードとは別の独立した要素として表示される（UI-10-D5/D10）
- `integrity_result` が `null` のときフォールバック文言が表示される
- `stocktake_in_progress` エラーで `get_active_stocktake` が invalidate/再取得され継続表示へ切り替わる（エラーメッセージのパースをしないことを assert する）、`stocktake_not_in_progress` エラーで UI 固定文言「この棚卸しは既に完了しています」が表示され状態再取得後の `not_started` 表示に切り替わる（UI-10-D8。`update_count` 経路・`complete_stocktake` 経路の両方で検証、契約監査により追加）
- `complete_stocktake` の `validation`（force_fill 未入力超過）エラーでバックエンドのメッセージがそのまま表示され、一覧 query（`itemsRoot`）が invalidate/再取得される（次回確定操作での実質的な再試行導線、owner 指摘起因）
- `actual_count` に負数を入力 → FieldError が出て `update_count` が呼ばれない
- 棚卸し中に商品登録/インポートが行われた想定で invalidation 後に一覧の対象件数が増える。専用通知は出ない（UI-10-D9）
- `complete_stocktake` 実行中は spinner 表示 + 全操作 disabled（UI-10-D6）

## 73.13 Windows Native L3

| # | 画面 / 見る場所 | 到達手順 | 合格基準 |
|---|---|---|---|
| L3-1 | `/stocktake`、継続表示ヘッダ | 棚卸しを開始する | ヘッダに「棚卸し中（開始日: YYYY-MM-DD HH:MM:SS）」の形式で**日時**が表示される（内部 ID の数字ではない）。進捗バーが表示される。アプリ再起動後も継続表示に戻る |
| L3-2 | `/stocktake`、検索/スキャン欄・数量入力欄 | 検索欄をクリックしてカーソルを置く → 商品コード（またはバーコードスキャナで JAN）を入力し Enter → 数量を入力し Enter、を**マウスに触らず**3商品分連続で行う | 1商品目: コード確定後、自動的にカーソルが「実際の数」欄へ移る。数量確定後、自動的にカーソルが検索欄へ戻る。この一連が3商品ともマウスクリックなしで完了する |
| L3-3 | `/stocktake`、一覧 | counted 済み（差異列に数値が入っている）行のコードを再度検索・スキャンして別の数量を保存 | 確認ダイアログなしで保存でき、一覧の実カウント・差異・最終カウント日時が更新される |
| L3-4 | `/stocktake`、確定ダイアログ・結果画面 | 未入力を1件以上残したまま「棚卸しを確定する」を押す | ダイアログ title が「未入力の商品があります」、直下に黄色い警告ボックス（⚠️ アイコン + 太字「確定すると取り消せません」）が表示される。確定後、結果画面の「前回の棚卸し」カードの金額が、画面上部の「仕入原価総額」（今回確定した金額）と**異なる値**になっている |
| L3-5 | `/stocktake`、確定ダイアログ | 全件カウント済みの状態で「棚卸しを確定する」を押す | ダイアログ title が「棚卸しの確定」（L3-4 とは異なる文言）になる |
| L3-6 | `/stocktake`、一覧 | カウント中に別画面（商品登録）で新商品を1件登録し、棚卸し画面へ戻る | 一覧を開き直すと新規商品の明細が表示される（専用の通知は出ない） |
| L3-7 | `/stocktake`、検索/スキャン欄 | L3-6 で登録した新商品の**商品名**（コード/JANではなく）を検索欄に入力して「対象を確認」を押す | 「対象にありません」エラーにならず、1件だけ一致すれば自動的にその商品が選択され数量入力欄にフォーカスが移る。複数件一致する名前で試すと候補テーブル（商品コード/商品名/部門 + 選択ボタン）が表示され、選択すると対象が確定する |

実機で再現しにくいエラー経路（`stocktake_not_in_progress`、`complete_stocktake` の `validation` force_fill 未入力超過）は、L3 では確認しない。前者は自動テスト T13/T18、後者は T20 で担保済み。

実店舗データを含む証跡は repo に残さない。必要な差分確認は synthetic / test DB で行う。

## 73.14 Non-scope

- 棚卸しの中止（途中破棄）機能（UI-10-D1、35-biz §20.7 の非目的踏襲）。
- 明示的な resume（再開）専用コマンド・UI（UI-10-D1）。
- BIZ-06 確定ロジックの変更（`counted_at` 以降の在庫変動の自動織り込み等、UI-10-D2）。
- 一覧のソート追加（UI-10-D3）。
- 棚卸し履歴一覧画面（複数回分の比較。UI-10-D5、前回 1 回分の比較のみ実装）。
- IPC channel によるカウント/確定処理の進捗表示（UI-10-D6、10-4a は不採用で確定）。
- UI-11c / UI-13 の設計。
- ルーティング実装、コンポーネント実装、hooks 実装、specta 属性付与、テストコード（本書は Design Phase のみ。実装 PR (R3) の scope）。

### 更新履歴

| 日付 | PR | 内容 |
|------|-----|------|
| 2026-07-07 | - | UI-10 Design Phase 初版（UI-10-D1〜D9、`docs/archive/plans/2026-07-07-ui10-stocktake-design.md` 準拠） |
| 2026-07-08 | #159 (private archive) レビュー起因 | 新規 CMD `get_active_stocktake()` を追加（UI-10-D1 更新）。実装 PR #159 で進行中判定が `localStorage` + `start_stocktake` のエラーメッセージ文字列パースで代替されていたのを P1 として却下し、DB 問い合わせ CMD による正式な進行中判定に差し替え。specta 化本数を既存4+新規2=6本 → 既存4+新規3=7本に更新。 |
| 2026-07-08 | #159 (private archive) 実装レビュー起因 | UI-10-D10 追加（一覧の差異・最終カウント列、確定ダイアログ title 統一、前回比較独立カード）。同日の Codex レビュー P2 是正で、一覧・カウント入力欄の在庫列を `system_stock` から `current_stock` へ統一（列名「システム在庫」→「現在在庫」）し、差異の計算根拠と表示在庫値の不一致を解消。 |
| 2026-07-08 | #159 (private archive) owner フィードバック起因 | UI-10-D10 の確定ダイアログを warning Alert ネスト構造に再変更（`RestoreConfirmDialog` 前例なしを理由に不採用としていた判断を訂正）。同日の Codex レビュー P2 是正で、`AlertDialogDescription`（sr-only）に不可逆性 title「確定すると取り消せません」を含めるよう修正（`aria-describedby` から警告 title が欠落していた）。 |
| 2026-07-08 | #159 (private archive) owner 確認質問起因 | UI-10-D11 追加。§73.5 が定めていた「解決できたら数量入力欄にフォーカスを移す」契約が実装に反映されておらず、初期フォーカス・保存後のフォーカス復帰も未実装だった実装漏れを是正（`ReceivingPage.tsx` の `useRef` + `window.setTimeout` パターンを踏襲）。連続 HID スキャン運用が成立しない状態だった。 |
| 2026-07-08 | #159 (private archive) Codex レビュー起因 | UI-10-D11 是正: mount 時の初期フォーカスは `useEffect` で直接 `.focus()`（`window.setTimeout` 不要）、解決成功後・保存成功後は `window.setTimeout` パターン、と実装の使い分けに合わせて記述を明確化（P3）。T17 の検索欄操作を `user.click`（対象を確認ボタン）から `{Enter}` 経由に変更し、実際の HID スキャン経路を検証するよう修正（P2）。 |
| 2026-07-08 | #159 (private archive) 契約監査（Fable 実施） | UI-10-D1 是正: 継続表示ヘッダが「開始日時」ではなく内部 `stocktake_id` を表示していた実装漏れを是正。UI-10-D8 是正: `stocktake_not_in_progress` が `update_count` / `complete_stocktake` 経路で kind 判定・invalidate 未実装のまま汎用エラー表示に留まっていた欠落を是正、UI 固定文言をハードコード（従来はバックエンドのエラーメッセージ文字列をそのまま表示）。§73.9 の `validation`（force_fill 未入力超過）専用再試行導線は、`kind` が `actual_count` 負数と共有で判別不能なため実装しない判断を明記（UI-10-D1 で却下した message パースのアンチパターンに該当するため）。T18 追加。 |
| 2026-07-08 | #159 (private archive) 契約監査（Codex 実施） | UI-10-D5 是正: `complete_stocktake` 成功後の `lastCompleted` invalidate/再取得により、結果画面の「前回の棚卸し」が今確定した棚卸し自身に置き換わるバグを是正（`handleCompleteConfirm` で invalidate 前に local state スナップショットを取り、結果画面にはそのスナップショットを渡す）。§73.12 の確定ダイアログ title 記述（旧「棚卸しを確定します（取り消せません）」表記）を UI-10-D10 の現行構造に同期。テスト冒頭コメントを T1〜T19 に更新。T19 追加。 |
| 2026-07-08 | #159 (private archive) owner 指摘起因 | UI-10-D8 追記2: force_fill 未入力超過の到達条件を再検討し「一人・一台でも、確定直前の商品登録 + 画面再訪後の自動再取得完了前の確定操作、という限定的なタイミングでは到達しうる」と明記。専用再試行ボタンは作らないまま、`handleCompleteConfirm` の `validation` エラー catch に `itemsRoot` invalidate を追加し、次回の確定操作が最新状態に基づいて正しく動くようにした（実質的な再試行導線）。§73.9 の validation 行を更新。T20 追加。 |
| 2026-07-08 | #159 (private archive) L3 チェックリスト刷新 | §73.13 を「画面/到達手順/観測可能な合格基準」形式に全面更新（memory `feedback-l3-checklist-eye-observable-absolute` 準拠）。開始日時表示、連続 HID スキャンのフォーカス遷移、確定ダイアログの title 分岐（未入力あり/なし）、前回比較の差し替わり確認を新規に L3 項目化。実機で再現しにくいエラー経路（`stocktake_not_in_progress`、force_fill validation）は L3 対象外とし自動テスト（T13/T18/T20）で担保する旨を明記。L3-4/5/6 追加（旧 5 項目 → 6 項目）。 |
| 2026-07-08 | #159 (private archive) owner L3 実機観察 | 開始前画面の「前回サマリ」と結果画面の「前回比較カード」に `completed_at` を `formatCountedAt` 未適用のまま生の ISO 8601（`T` 区切り）で表示していた見落としを是正。継続表示ヘッダ（UI-10-D1 是正で新設）には適用済みだったが、既存の前回比較表示 2 箇所は未適用のままだった。73.10 Wording の該当 2 行 + 継続表示ヘッダ行を `formatCountedAt` 適用済みである旨に更新。 |
| 2026-07-08 | #159 (private archive) owner L3 実機発見 | UI-10-D2 是正: §73.5 が Design Phase 初版から明記していた「商品名検索フォールバック（`commands.searchProducts`）」が実装から丸ごと漏れていた。owner が実機で「棚卸し中に新商品登録→その商品名で棚卸し検索」という自然な操作をした際、一覧には存在するのに検索では「対象にありません」と表示される矛盾した体験になっていた。`resolveItem` を拡張し、`find_stocktake_item` が `None` の場合に商品名検索へフォールバック（0件は既存メッセージ、1件は自動選択、複数件は候補テーブル表示）する形で是正（`ReceivingPage.tsx` の商品名検索パターンを踏襲）。T21/T22 追加。§73.13 L3-7 追加（商品名検索フォールバックの実機確認）。 |
| 2026-07-08 | #159 (private archive) Codex レビュー起因 | UI-10-D2 契約監査追記2: 商品名検索欄追加時に、`ReceivingPage.tsx` の商品検索欄に既にある `event.nativeEvent.isComposing` guard を移植し忘れており、日本語 IME の変換確定 Enter でも検索が発火していた。検索欄・数量入力欄の両方の `onKeyDown` に guard を追加。T23 追加。 |
