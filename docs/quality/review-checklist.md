# 設計書レビューチェックリスト

> 設計書PRのレビュー時に使用する。9カテゴリと設計判断レンズを固定観点とする。観点の後出し追加を防ぐ。

## 運用ルール

1. **レビュー前**: `./scripts/doc-consistency-check.sh` を実行し、機械検出可能な不整合をゼロにする
2. **レビュー時**: 下記9カテゴリと設計判断レンズのみを観点とする。カテゴリ外の指摘は「次回の観点候補」としてメモし、今回は対象外
3. **返却時**: 各カテゴリで最大3件。「今回の観点外」を明示して返す
4. **GitHub投稿**: GitHub PRレビュー依頼は、ユーザーが止めない限り、findingsを該当PRへコメント投稿するところまで含める
5. **投稿境界**: PRレビュー依頼で許可されるのはレビュー本文・コメント投稿のみ。labels / review-thread resolve / merge / close 等は別途明示許可を必要とする
6. **再レビュー**: 前回指摘の修正確認のみ。新規観点の追加は禁止（新規は次PRで）

## 9カテゴリ

### 1. 型・契約の整合

- [ ] 関数シグネチャの引数型・戻り値型が、呼び出し元と一致しているか
- [ ] 構造体の定義（フィールド名・型）が、使用箇所と一致しているか
- [ ] エラー型の変換経路が正しいか（IO→BIZ→CMD の各層で適切な変換）

### 2. 責務境界

- [ ] IO層がBizError/CmdErrorを参照していないか
- [ ] CMD層がDbErrorを参照していないか
- [ ] BIZ層がキャッシュやAppStateを直接操作していないか
- [ ] CMD層が業務ロジック（バリデーション以外）を持っていないか

### 3. TX境界・データ整合

- [ ] operation_log がTX外で記録されているか（全TX外方針）
- [ ] TX範囲が明示されているか（開始・コミット・ロールバック）
- [ ] 上書きフロー（旧void+新commit）が同一TX内か
- [ ] TOCTOU防止（TX内の再チェック）が必要な箇所に入っているか

### 4. エラーハンドリング

- [ ] 各エラーパスのBizErrorバリアント/メッセージが設計書と一致しているか
- [ ] ログ記録失敗時の方針（「警告のみ」等）が明記されているか
- [ ] 冪等性の方針が明記されているか（2回目呼出し時の挙動）

### 5. 用語・命名

- [ ] CSV / PLUファイル の使い分けが正しいか（PLU関連=CV17向け `.txt` タブ区切り、Z004関連=CSV）
- [ ] 関数名が設計書間で一致しているか（_for_plu等のサフィックス）
- [ ] 定数がリテラル直書きではなく constants:: 参照か

### 6. 入出力例・手順

- [ ] 処理ステップの番号が連番か（欠番なし）
- [ ] 入力例・出力例が型定義と一致しているか
- [ ] ローカル変数の導出が明示されているか（未定義変数の参照なし）

### 7. 防御・境界値

- [ ] LIMIT に ORDER BY が付いているか
- [ ] ページングに per_page 上限があるか
- [ ] ファイルサイズ・行数の上限チェックがあるか
- [ ] ロック取得パターンが方針と一致しているか（同時保持しない）

### 8. 設計-コード整合

- [ ] 関数シグネチャを変更した場合、対応する設計書も更新したか
- [ ] 新規 pub 関数を追加した場合、設計書に記載があるか（なければ allowlist に追加理由を明記）
- [ ] `cargo test --test design_compliance_test` を PR 提出前に実行したか
- [ ] テスト・設計書・REQ インベントリを変更した場合、`cd src-tauri && cargo run --bin generate_traceability -- --check` が green か（drift 時は再生成して commit）

### 9. Operator UI visibility

- [ ] 既存画面の共通レイアウト、spacing、typography、色トークン、テーブル / カード / チップ表現を継承しており、ページごとに別アプリのような見た目になっていないか（DSR-01）
- [ ] 業務ステータスが色だけで符号化されていないか（日本語ラベル + アイコン / 形 / 位置 / バッジ / 状態列などの非色シグナルがあるか）（DSR-08）
- [ ] 非IT系・高齢利用者が通常距離で主要テキスト、数値、状態を読める設計か（DSR-13）
- [ ] `在庫切れ` / `在庫少` / `商品コード` / `売上明細数` などの表示文言が業務上の意味と一致しているか（DSR-11）
- [ ] テーブル、カード、チップの密度・幅・truncate が主要値の理解を壊していないか（DSR-12）
- [ ] keyboard focus、active state、filter selection が色以外でも判別できるか（DSR-02）
- [ ] 状態を変える control は、変更後も到達可能で、元に戻す / 別状態へ移る recovery path が残っているか（例: 表示拡大後に表示サイズ control へ戻れる）（DSR-07）
- [ ] Select / filter の候補を現在の filtered result から派生していないか。派生する場合、選択後に候補が現在値だけへ縮退せず、他候補へ直接切り替えられるか（DSR-10）
- [ ] 明細行を持つフォームでは、行の追加 / 編集 / 削除 / 再追加後に validation error が stale 表示されないか。変更・削除された行のエラーだけ消え、未変更行のエラーは残るか（DSR-07）
- [ ] operator-facing UI flow / status の変更で Windows native L3 が必要か、必要なら Plan / PR evidence に記録されているか（DSR-08）

## 設計判断レンズ（model-neutral 必須観点）

1. Layer: UI→CMD→BIZ→IO 一方向か。CMD に業務ルールが増えていないか。architecture_test の例外 allowlist を増やす変更は理由を doc に書いたか。
2. POS boundary: CASIO 語彙（Z00x/CV17/SR-S4000/CP932）が BIZ/CMD/UI の契約に新規混入していないか。機械ガードなし、レビューが最後の砦。混入が正当なら design doc に理由を書く（UI-07-D9 前例）。
3. Vendor literal: `casio_sr_s4000` 等のベンダー識別子を新たに埋め込むなら、既存の分散点を増やさず定数 / adapter 側へ。
4. Operator: 非IT高齢オーナーが単独で完遂できるか。失敗時に画面が次の手を告げるか。色のみの状態符号化は禁止。
5. Manual gate: アプリが自動確認できない外部反映（PCツール/SD/レジ）を「確認済み」と偽装する UI 文言になっていないか（D-027 原則）。
6. Data safety: 復元・削除・rollback は取り返しがつくか。物理削除ではなく状態遷移か（D-6 原則）。実データ・JAN・価格を fixture / docs / PR に入れていないか。
7. CSV/report semantics: `daily_report_*`（公式日報）と `sale_records`（商品別正本）を混ぜていないか。日報を `sale_records` / `inventory_movements` へ擬似展開していないか（D-025）。
8. Rollback 非対称: `csv_import` = 物理 void / `daily_report` = 論理取消。新しい取込みを作るならどちらの semantics か明示したか。
9. Idempotency: 書き込み系に冪等キーはあるか（migration v2 契約）。
10. Docs vs Plan Packet: durable な判断を Plan Packet に置き逃げしていないか。昇格先は decision-log / function-design / DB_DESIGN。
11. REQ/test trace: REQ 番号がテスト名にあるか。traceability check が green か。
12. Fixture 信頼: adapter 系は synthetic fixture green を信じず実サンプル local gate を AC に（PR #125 の教訓）。

## 観点外（次回以降の候補として蓄積）

このセクションに、レビュー中に気づいた「今回のカテゴリに含まれないが将来対応すべき指摘」をメモする。次PRの観点追加候補として管理する。

- （なし）
