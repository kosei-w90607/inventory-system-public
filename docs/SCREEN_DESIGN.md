# 在庫管理システム 画面設計ドキュメント

> **このファイルの目的**: 画面設計の意図・判断・気付きを保存し、セッション間で引き継ぐ。モックアップHTMLファイル（screen_mockups.html）と対で使用する。
>
> **最終更新**: 2026-07-07 / UI-10 棚卸し Design Phase 追加

---

## 1. 画面一覧と使用頻度

### 毎日使う
| # | 画面名 | 対応REQ | モックアップ | 状態 |
|---|--------|---------|-------------|------|
| 1 | ホーム画面 | REQ-301/302, SP-102-07 | 完了 | Phase 2 実装済み（PR #56 `e6da3d8`） |
| 2 | 売上データ取込み（日報 / 商品別CSV） | REQ-401 | 完了 | Phase 2 実装済みZ004画面をREQ-401再設計で日報主動線へ更新予定 |
| 3 | 日次売上レポート | REQ-501 | 完了 | Phase 2 実装済み（PR #65 `8c2be51`） |
| 4 | 在庫照会 | REQ-301/302/303 | 完了 | Phase 2 実装済み（PR #67 `cf89082`、高視認性 follow-up PR #74 `ae0c68f`） |
| 5 | 月次売上レポート | REQ-502 | 完了 | Phase 2 実装済み（PR #66 `caf7d57`、seed / card overflow follow-up PR #70 `aeeee2a`） |

### 週に数回
| # | 画面名 | 対応REQ | モックアップ | 状態 |
|---|--------|---------|-------------|------|
| 6 | 入庫記録 | REQ-201 | — | 実装済み（PR #103 `fa34a8e`） |
| 7 | 商品検索・一覧 | REQ-103 | — | 実装済み（PR #91） |

### 月に数回
| # | 画面名 | 対応REQ | モックアップ | 状態 |
|---|--------|---------|-------------|------|
| 8 | 返品・交換 | REQ-202 | — | 実装済み（PR #107 `1c8ff66`） |
| 9 | 手動販売出庫 | REQ-203 | — | 実装済み（PR #104 `32c98e0`） |
| 10 | 商品登録 | REQ-101 | — | 実装済み（PR #95） |
| 11 | 商品修正 | REQ-102 | — | 実装済み（PR #95） |
| 12 | 廃棄・破損 | REQ-204 | — | 実装済み（PR #110 `0794342`） |
| 12a | 入出庫履歴 | REQ-206/207/208 | — | Design Phase 追加（入出庫記録・在庫変動追跡完成形） |

### 年に数回 / 初回のみ
| # | 画面名 | 対応REQ | モックアップ | 状態 |
|---|--------|---------|-------------|------|
| 13 | 棚卸し | REQ-205 | — | Design Phase 追加。Phase 4 実装予定（10-4、検索/スキャン主動線 + 上書き再入力 + 常時確認確定。10-4a channel 判定は不採用で確定） |
| 14 | 一括インポート | REQ-104 | — | 実装済み（PR #100） |
| 15 | PLU書出し | REQ-402 | — | Design Phase 追加。Phase 4 実装予定（10-3、CV17 1.1.1 / SD カード経由実機確認 10-3a） |
| 16 | 在庫整合性検証 | REQ-904 | — | Phase 4 実装予定（10-6、UI-13、Q40 障害時対応と合わせて具体化）。REQ-403 の POS 部門別売上照合は別 task として deferred |
| 17 | バックアップ・復元 | QR-05 | — | Design Phase 追加。Phase 4 実装予定（10-5b、復元前強制バックアップ + 二段確認 + cache clear） |
| 18 | 操作ログ | QR-06 / REQ-902 | — | PR #164で実装済み（Draft / Phase `implementing`）。閲覧MVP: 期間/種別filter + pagination + detail_json安全表示。CSV出力・保持設定変更・削除は別task |
| 19 | 設定（在庫少の基準） | QR系 | — | Design Phase 追加。Phase 4 実装予定（10-5a、在庫少基準 2 key + 部分失敗表示） |

---

## 2. 画面遷移の構造

### 全体構成（4エリア）

> **2026-04-21 注記**: 下記の緑/青/オレンジ/黄は初期モックアップ作成時の色分け表記。**色分け廃止が確定**（正典: [design-system/00-foundations.md](design-system/00-foundations.md)「4色エリアモデルの扱い」）したため、実装ではエリアラベルの識別はアイコン + 区切り線で行う（色は使わない）。色情報はモックアップアーカイブとして残す。詳細は [docs/archive/plans/2026-04-21-ui-12-design-agreement.md §1.2](archive/plans/2026-04-21-ui-12-design-agreement.md) 参照。
>
> **2026-05-08 注記**: 4 エリア × 19 項目の最終確定形は `src/config/navigation.ts`（`NavStatus` / `NavItem` / `NavArea` 型 + `navigation` 定数）として実装済み。SCREEN_DESIGN は意図ドキュメント、`navigation.ts` が実装の正ソース。新規画面追加時は `navigation.ts` も更新する（[docs/function-design/52-ui-shared-layout.md §52.3](function-design/52-ui-shared-layout.md) 参照）。

- **緑（毎日の業務）**: 売上データ取込み → 日次売上レポート → 在庫照会 → 月次売上レポート
- **青（商品管理）**: 商品検索・一覧 → 商品登録 / 商品修正 / 一括インポート、PLU書出し
- **オレンジ（入出庫）**: 入庫記録 / 返品・交換 / 手動販売出庫 / 廃棄・破損 / 棚卸し / 在庫変動履歴
- **黄（システム管理）**: バックアップ / 操作ログ / 設定

### 利用者の1日の動線
```
開店 → 在庫照会（発注判断） → 入庫記録（商品到着時）
→ 営業中（レジで販売、システム操作なし）
→ レジ精算 → 閉店
→ 売上データ取込み（日報Z001/Z002/Z005） → 売上レポート確認 → バックアップ
```

### 主要な画面間遷移
- ホーム → 各機能画面（大きなボタンで1クリック）
- 売上データ取込み完了 → 売上レポート（自然な流れ）
- 在庫照会 → 商品詳細 → 商品修正 / 在庫変動履歴 / 入庫記録（詳細カードから遷移）
- 在庫変動履歴 → 元業務記録詳細 → 関連する在庫変動履歴へ戻る
- 入出庫履歴 → 入庫 / 返品・交換 / 手動販売 / 廃棄・破損 / CSV取込み / 棚卸しの詳細確認 → 検索条件を保持した入出庫履歴へ戻る
- 商品検索・一覧 → 商品修正（一覧から選択して遷移）
- 日次売上レポート ↔ 月次売上レポート（**別 route**: `/reports/daily` / `/reports/monthly`、タブ UI は `<Link>` で 2 route を切り替える視覚表現として実装。詳細は [docs/archive/plans/2026-04-21-ui-12-design-agreement.md §7.3](archive/plans/2026-04-21-ui-12-design-agreement.md)）

---

## 3. 画面ごとの設計判断ログ

### ホーム画面
- **対応仕様**: REQ-301/302（在庫アラート表示）, SP-102-07（PLU書出し通知）
- **レイアウト判断**:
  - PLU書出し未反映がある場合は黄色の通知バーを最上部に表示
  - サマリ3枚（昨日の売上、在庫切れ件数、在庫少件数）で朝一の状況把握
  - 毎日使う4機能を上段に2×2の大きなボタンで配置
  - 入出庫4機能を中段に2×2
  - たまに使う機能（棚卸し/バックアップ/設定）を下段に小さく
- **利用者配慮**:
  - 全ボタンにタイトル＋説明文（「何をするボタンか」がボタン自体で伝わる）
  - 「売上データ取込み」は毎日の最重要操作なので青枠で強調
  - 在庫切れ件数 / 在庫少件数は日本語ラベルを主情報とし、赤 / 黄色は危険度を補助する強調として使う

### 売上データ取込み画面（日報 / 商品別CSV）
- **対応仕様**: REQ-401（SP-401-01〜16）
- **レイアウト判断**:
  - current operation の既定主動線は Z001/Z002/Z005 の日報取込み。Z004商品別CSV取込みはPLU運用後の別トラックとして分ける
  - 日報取込みは3ステップウィザード形式（3ファイル選択 → 内容確認 → 完了）
  - ステップ2で対象日、3ファイル名、総売上/純売上、支払集計、部門別集計、部門未対応warningを表示する
  - 部門未対応は取込み可能なwarningとして扱い、日報自体は保存できるようにする
  - 完了画面に日報サマリ（対象日/日報取込みID/総売上または純売上/警告件数）を表示する
  - 完了後に「日次売上を見る」ボタンで自然にREQ-501へ遷移する。ただし日次売上では日報集計と商品別明細を分けて表示する
  - 商品別CSV取込み（Z004）では既存の正常行/スキップ行/在庫引落し/警告表示を維持する
- **利用者配慮**:
  - 毎日の作業だから、日報取込みは「Z001/Z002/Z005を選ぶ→確認→実行」の短い導線にする
  - 「日報取込み」と「商品別CSV取込み（Z004）」はタブまたはsegmented controlで分け、在庫が動く/動かないを日本語で明示する
  - 日報取込みの取消は在庫を戻さない。そもそも在庫を動かしていないことを結果画面と確認ダイアログで表示する
  - 精算日付をファイルから自動取得して表示（間違いファイル防止）

### PLU書出し画面
- **対応仕様**: REQ-402（商品マスタからPLU登録用データを生成し、レジに書き出せること）
- **レイアウト判断**:
  - route は `/products/plu-export`。商品管理エリアの独立画面として扱う
  - 上部に差分件数、最終書出し目安、レジ反映は自動確認できない注意を表示する
  - 書出しモードは `差分を書き出す` / `全件を書き出す` の二択 SegmentedControl とする。既定は差分
  - 差分対象一覧は商品コード、JANコード、商品名、売価、在庫を表示する。JAN未登録の商品は「未登録」と表示し、prepare失敗時に商品マスタ確認へつなげられるようにする。0件なら「差分はありません」と表示し、Full書出し導線は残す
  - `prepare_plu_export` でCV17 1.1.1向けPLUタブ区切りテキストを生成し、Tauri native save dialog で `.txt` 保存する。保存キャンセル・保存失敗では未反映状態を変えない
  - JANコードが未登録、13桁以外、またはチェックディジット不正の商品がある場合は書出しを止め、商品マスタで13桁JANを確認する案内を出す。`product_code` をスキャニングコードに代用しない
  - 保存成功後は、保存ファイル名、件数、次に行うPCツール/SDカード/レジ手順、`この書出しを未反映から外す` ボタンを表示する
  - `この書出しを未反映から外す` は、保存したPLUファイルをPCツールへ投入する対象として扱うことを利用者が明示した時だけ押す。押すまで `plu_dirty` は残る
  - 保存成功後、未反映解除前に画面遷移やアプリ再起動があっても、復帰用 `localStorage` から `保存済みで未確認のPLU書出しがあります` を上部に表示し、保存先・件数・文字コード・未反映解除 / 破棄して再書出しの導線を出す。PLUファイル本文は保存しない
  - 完了画面には `アプリで確認できるのはPLUファイル保存までです。PCツールへの取込み、SDカード書出し、レジ読込みは手動で確認してください。` を常時表示する
- **利用者配慮**:
  - `PLU未反映` / `PLUファイル保存済み` / `未反映から外しました` / `レジ反映は未確認` の日本語ラベルを主情報にし、色だけで状態を示さない
  - PCツールに取り込めなかった場合は、未反映を外さずにもう一度差分を書き出せることを保存後画面で明示する
  - Full書出しでは既存PLUバックアップ確認の Alert を出し、実店舗データを壊さない小規模確認を促す
  - CV17 1.1.1 の受理確認、SDカード書出し、SR-S4000読込み、代表商品の呼出し確認は UI-08 implementation PR の manual gate とし、実JAN・実商品名・価格を含む証跡はrepoに残さない
  - 詳細な command contract、状態遷移、L3確認項目は [function-design/67-ui-plu-export.md](function-design/67-ui-plu-export.md) を正とする

### バックアップ・復元画面
- **対応仕様**: QR-05 / REQ-905（バックアップ・復元、設定・ログ・バックアップ系 CMD）
- **レイアウト判断**:
  - UI-11b はシステム管理エリアの独立画面として扱う。`src/config/navigation.ts` の `ui-11b` は現状 pending のため、実装 PR で route と navigation active 化を同時に行う。
  - `backup_enabled` / `backup_time` / `backup_path` / `backup_retention_days` はこの画面が所有する。UI-11a 閾値設定には混ぜない。
  - バックアップ一覧は和式日時を主情報、MB サイズを副情報にし、最新行へ「最新」Badge、各行に復元導線を置く。ファイル名・絶対パスは詳細/補助表示へ下げる。
  - backup_path 変更は native directory picker のみ。自由入力は置かない。
  - 復元は「一覧から選択して詳細提示」→「最終確認 AlertDialog」の 2 段確認とし、復元実行ボタンのラベルに対象日時を含める。
  - 復元前に `createBackup` を自動実行し、成功しない限り通常経路では復元へ進めない。事前バックアップ自体が失敗した場合だけ break-glass checkbox を出す。
- **利用者配慮**:
  - 復元は元に戻せない操作として扱い、「この控えより後に記録した内容は消えます」を選択詳細と最終確認で読ませる。
  - 復元成功後は DB 全体が変わるため React Query cache を全消去し、ホームへ遷移して成功を知らせる。通常成功でアプリ再起動は求めない。
  - restore 失敗 + 退避復元も失敗した double failure だけは、DSR-03 上部帯の destructive Alert と「アプリを閉じて、もう一度開いてください」で再起動を案内し、画面内操作を disabled にする。
  - 詳細な command contract、状態遷移、復元安全契約、Windows native L3 は [function-design/68-ui-backup-restore.md](function-design/68-ui-backup-restore.md) と [decision-log.md](decision-log.md) D-032 を正とする。

### 閾値設定画面（在庫少の基準）
- **対応仕様**: QR系 / D-4（在庫少閾値の初期値・最小値 1、[DB_DESIGN.md](DB_DESIGN.md) 設計方針メモ）
- **レイアウト判断**:
  - UI-11a はシステム管理エリアの独立画面として扱う。`src/config/navigation.ts` の `ui-11a` は現状 pending のため、実装 PR で route（`/settings/thresholds`）と navigation active 化を同時に行う。
  - この画面が所有する app_settings key は `stock_low_threshold` / `stock_low_threshold_fabric` の 2 件のみ（UI-11a-D1）。backup 系 4 key は UI-11b 所有（UI-11b-D6 の相互不可侵）。
  - フォームは 1 セクション（DSR-09）、主動線は「保存する」1 個（DSR-01）、確認ダイアログなし（DSR-07: 可逆操作）。
- **利用者配慮**:
  - operator 向け名称は「在庫少の基準」で統一し、「閾値」という専門語を画面に出さない（UI-11a-D6。ナビ・タイトル・h1 の 3 点一致）。
  - 必須はラベル内「（必須）」、単位（個 / cm）は入力欄の隣に常時表示し、色だけに意味を持たせない（DSR-06/08）。
  - 保存の部分失敗は、失敗したフィールドの日本語名と「保存済み分」を事実どおり明示して再保存を促す。
  - 詳細な command contract、検証、保存フロー、Windows native L3 は [function-design/69-ui-threshold-settings.md](function-design/69-ui-threshold-settings.md) を正とする。

### 操作ログ画面
- **対応仕様**: QR-06 / REQ-902（ログ管理: 操作ログ記録/一覧/自動削除）/ TRACE-D3（操作ログは業務記録の代替にしない）
- **レイアウト判断**:
  - UI-11c はシステム管理エリアの独立画面として扱う。PR #164でroute（`/settings/logs`）と`src/config/navigation.ts`の`ui-11c` active化を実装済み。DraftのP2/P3 remediationは完了し、fresh再監査とWindows native L3は未完了である。
  - 本画面は**閲覧 MVP**。CSV出力、ログの保持設定変更・手動削除、診断ログファイル/ディレクトリ導線（MNT-04）は別 task とする（365日超の自動削除は既存 `72-mnt-log-manager.md` の起動時 cleanup のまま、archive は作らない）。
  - 期間（開始日・終了日、JST暦日、片側指定可）と個別 operation_type で絞り込み、既定は直近30暦日・全種別。operation_type の選択肢は現在ページ/現在の絞り込み結果からではなく、保持中ログ全体の distinct 値から生成する。
  - 各行の明示的な「詳細を表示」ボタンで直下に detail_json を展開し、展開中は可視text「詳細を閉じる」に変える。Enter / Spaceはnative button契約で動作し、行全体clickは追加しない。既知フィールドの日本語要約を優先し、生JSONは既定で折りたたみの「技術情報」に隠す。
  - 関連業務記録リンクは、detail_json が明示的な `record_type` + `record_id` の組を持つ場合だけ表示する。JSONの任意キーからの推測はしない。
- **利用者配慮**:
  - 操作ログは監査・保守ログであり、「なぜ在庫が増減したか」の説明には使わない（在庫変動履歴と業務記録詳細が担う、TRACE-D3）。
  - ログが0件の理由（既定期間内に本当にログがない／絞り込み条件に該当がない）を異なる文言で区別する。
  - 取得失敗時は現在の絞り込み条件を保持したまま再試行できる。
  - 詳細な command contract、期間 predicate、operation_type registry、detail_json 安全設計、関連記録リンク contract、Windows native L3 は [function-design/74-ui-operation-logs.md](function-design/74-ui-operation-logs.md) を正とする。

### 棚卸し画面
- **対応仕様**: REQ-205（開始 / 中断再開 / カウント入力 / 差異表示 / 確定）
- **レイアウト判断**:
  - `/stocktake` 到達時に進行中の有無で未開始（開始 CTA + 前回完了サマリ）/ 進行中（進捗ヘッダ + 一覧 + カウント入力）を自動判別する（UI-10-D1。明示 resume なし・中止機能なし）。
  - カウント主動線は検索/HID スキャンによる商品特定 → 数量入力 → 1 件即保存。counted 済みへの上書き再入力を同一導線で常時許可する（UI-10-D2、部門キー売り運用下の都度訂正の受け皿）。
  - 一覧は進捗管理用（部門フィルタ + 未入力のみ toggle + 入力済み/全件の進捗表示、UI-10-D3）。
  - 確定は常時確認ダイアログ（未入力ありは force_fill の意味説明、全件入力済みは取り消し不可の明示、UI-10-D4）。結果画面は仕入原価総額（total_cost）が主役で、前回完了棚卸しとの比較を併記する（UI-10-D5）。
- **利用者配慮**:
  - 一人運用・数週間スパンの反復作業を前提に、1 件保存ごとの toast は出さず一覧行の即時反映で結果を示す。
  - 棚卸し対象外のコード/JAN をスキャンした場合はエラー扱いにせず、回復文言を出して次の入力を受け付ける。
  - 詳細な command contract、状態遷移、文言、Windows native L3 は [function-design/73-ui-stocktake.md](function-design/73-ui-stocktake.md) を正とする。

### 日次売上レポート画面
- **対応仕様**: REQ-501（SP-501-01〜07）
- **レイアウト判断**:
  - 前日/翌日ボタンで日付切替。デフォルトは当日（SP-501-02）
  - サマリ4枚（売上合計/販売点数/売上明細数(自動・手動内訳)/前日比）
    - 「売上明細数」= `items.length` (sale_records の行数ベース)。レシート単位の「取引件数」は receipt_id / POS 取引キー仕様確定後に BIZ-05 拡張で別 PR 対応（命名と実態を一致させる方針、memory `feedback-naming-must-match-reality.md` 準拠）
  - 部門別小計行をグレー帯で挿入（SP-501-03）
  - 手動入力分は黄色「手動」バッジで識別（SP-501-05/SP-203-04の記録元フラグ）
  - 列ヘッダーでソート可能（SP-501-06）
  - 日次/月次はタブ切替で同一画面内に統合
  - REQ-401再設計後は、上部に「日報サマリ」領域を追加し、Z001/Z002/Z005由来の公式日報集計を表示する。商品別一覧はZ004/手動販売出庫由来の明細として別セクションにする
- **利用者配慮**:
  - P30のゴール「JANコード・商品名付きで、いくらの何が何個売れた」をそのまま形にした画面
  - CSV出力・印刷ボタンを下部に配置（SP-501-07）
  - 商品別明細が空でも日報サマリがあれば「売上なし」とは表示しない。「商品別明細は未取込み」と分かる空状態にする

### 在庫照会画面
- **対応仕様**: REQ-301（SP-301-01〜03）, REQ-302（SP-302-01〜04）, REQ-303へのリンク
- **レイアウト判断**:
  - REQ-301（商品別照会）とREQ-302（在庫切れ/少一覧）を統合した1画面
  - 検索バー（商品コード / 商品名 / JAN。バーコードスキャナは HID キーボード入力として検索欄に入る前提、Phase 2 では専用スキャンボタンなし）＋部門フィルタ＋状態チップ（すべて / 在庫切れ / 在庫少）
  - チップのワンクリックで在庫切れ一覧、在庫少一覧に切替可能。Phase 2 ではチップ上の件数バッジは表示しない（件数 contract は Phase 4 UI-06c または count API 設計時に再評価。在庫少一覧は独立画面ではなく本画面の `status=low_stock` フィルタへのサイドバー deep-link として D-047 で確定済み）
  - 商品クリックで詳細カードが展開。在庫数/売価/原価/最終入庫日/最終販売日を表示
  - 詳細カードから「商品修正」「在庫変動履歴」「入庫記録」へ直接遷移
- **利用者配慮**:
  - 在庫少判定は BIZ が返す `list_low_stock` 結果を正とし、frontend はその集合を `stock_quantity <= 0`（在庫切れ）/ `stock_quantity > 0`（在庫少）に分ける。閾値は frontend に持たない
  - 2026-06-07 の実利用者 L3 で、赤文字 / 黄文字だけでは在庫ゼロと在庫少の識別が不十分と判明。高視認性 follow-up では状態列を追加し、「在庫切れ」「在庫少」「通常」の日本語ラベル + アイコン / バッジを主情報、在庫数の赤 / amber を補助シグナルにする
  - 生地は「0 cm」と単位付き表示
  - 廃番商品は在庫切れ一覧に出さない（SP-302-04）
  - 発注判断→入庫記録の動線が詳細カードから1クリック

### 入出庫履歴・在庫変動追跡
- **対応仕様**: REQ-206 / REQ-207 / REQ-208 / REQ-303 / REQ-902
- **レイアウト判断**:
  - 作成画面の recent list は保存直後の確認 UI に限定する。過去記録の検索、詳細確認、取消、訂正、CSV出力、印刷は `入出庫履歴` と各記録詳細へ分離する。
  - `入出庫履歴` は入出庫エリアの調査用画面とし、日付範囲、記録ID、商品、部門、種別、状態で検索できるようにする。
  - 商品別の `在庫変動履歴` は在庫照会の商品詳細から開き、各 movement 行から元業務記録詳細へ遷移できるようにする。
  - 初回 UI-06c は `/stock/$code/movements` とし、商品名/商品コード/現在庫のサマリ、日付範囲、種別、ページング、日時・種別・増減・変動後在庫・元記録・備考の一覧を表示する。
  - 元記録リンクは backend の `MovementRecord.source` をそのまま使う。`source` がない初期在庫や legacy row は movement 行を残し、元記録欄だけ「元記録なし」と表示する。
  - 操作ログはシステム管理画面に置き、業務記録の代替にしない。操作ログに関連記録リンクがある場合だけ業務記録詳細へ遷移できるようにする。
- **利用者配慮**:
  - 「なぜ在庫が増減したか」は操作ログではなく、在庫変動履歴と業務記録詳細で説明する。
  - 増減数量は色だけで区別せず、`+N` / `-N` と「増加」「減少」の日本語ラベルを併記する。
  - 取消/訂正は詳細画面で内容を確認してから行い、一覧行の即時操作にはしない。
  - 状態は「有効」「取消済み」「訂正済み」の日本語ラベルを主情報にする。

### 入庫記録画面
- **対応仕様**: REQ-201（仕入入庫記録）
- **レイアウト判断**:
  - route は `/inventory/receiving`。入出庫エリアの独立画面として扱い、商品一覧や在庫照会の query param で mode 切替しない
  - UI は generated `commands.createReceiving(req)` / `commands.listReceivings(page, perPage, dateFrom, dateTo)` のみを使う。実装 PR では CMD-02 を tauri-specta binding に追加する
  - 入庫ヘッダは入庫日（既定は今日）、取引先（任意）、備考（任意）。取引先候補は `commands.listSuppliers()` 由来の complete master data とし、inline 新規取引先作成は初回実装では扱わない
  - 商品追加欄は商品コード / JAN / 商品名を同じ入力で扱う。Enter で検索し、1件なら明細追加、複数件なら候補から選択、0件なら商品登録への導線を出す
  - バーコードスキャナは HID キーボード入力として商品追加欄に入る前提。初回実装ではグローバル検知を置かず、フォーカス中の入力欄 + Enter + 追加後フォーカス戻しに限定する
  - 同一商品を再追加した場合は重複行を作らず、既存行の数量を +1 する
  - 明細は商品名、商品コード、現在庫、入庫数量、原価、単位、削除を表示する。数量は整数 `> 0`、原価は整数 `>= 0` を保存前に検証する
  - 保存成功後は record_id、明細数、stock_warnings、再送処理済みかを表示し、「続けて入庫」「在庫照会へ戻る」を出す。画面下部には最近の入庫記録を 10 件表示する。保存結果や保存系エラーはページ先頭側に出るため、保存成功または command 失敗時はページ先頭へスクロールする
- **利用者配慮**:
  - 生地は `cm` 単位を主表示にし、cm 整数で入力する。cm / m 表示切替は横断表示方針で扱うため初回 UI-02 では扱わない
  - 保存中はヘッダ、明細、商品追加、戻る/リセット導線を disabled にし、中断可能に見せない
  - 保存失敗時は入力と `idempotency_key` を保持し、再試行で二重入庫にならないようにする
  - Windows native L3 で navigation、取引先候補、商品検索/スキャン相当 Enter 追加、同一商品数量加算、cm 表示、validation、保存中 disabled、結果表示、recent list、在庫照会/商品登録導線を確認する
  - 詳細な関数設計と Design Intent Trace は [function-design/61-ui-receiving.md](function-design/61-ui-receiving.md) を参照

### 返品・交換画面
- **対応仕様**: REQ-202（顧客返品・交換記録）
- **レイアウト判断**:
  - route は `/inventory/return`。入出庫エリアの独立画面として扱い、商品一覧や在庫照会の query param で mode 切替しない
  - UI は generated `commands.createReturn(req)` / `commands.listReturns(page, perPage, dateFrom, dateTo)` / `commands.saveReceiptImage(request)` のみを使う。実装 PR では CMD-03 と画像保存 command を tauri-specta binding に追加する
  - ヘッダは返品日（既定は今日）、種別（返品 / 交換）、レジ戻し済み（既定 true）、備考（任意）。レジ戻し済み true では在庫は CSV 取込みで反映、false ではこの保存で在庫反映することを、各選択肢内の日本語 Badge と説明で示す。備考は返品・交換の確認優先度が高い項目として、単一行ではなく複数行欄で入力する
  - 商品追加欄は商品コード / JAN / 商品名を同じ入力で扱う。Enter で検索し、1件なら明細追加、複数件なら候補から選択、0件なら商品登録への導線を出す
  - バーコードスキャナは HID キーボード入力として商品追加欄に入る前提。初回実装ではグローバル検知を置かず、フォーカス中の入力欄 + Enter + 追加後フォーカス戻しに限定する
  - 明細は商品名、商品コード、部門、現在庫、方向（戻り / 渡し）、数量、単位、削除を表示する。返品では `戻り` のみ、交換では `戻り` と `渡し` の両方を要求する
  - 明細の一意性は商品コード + 方向。同じ商品を同じ方向で再追加した場合は数量を +1 し、交換で同じ商品が戻り/渡し両方にある場合は別行として残す
  - レシート画像は任意添付。ドロップゾーン + ファイル選択ボタン + プレビューサムネイルを置き、保存時に画像を `saveReceiptImage` で保存してから `createReturn` に相対パスを渡す
  - 保存成功後は record_id、明細数、レジ戻し済みか、画像添付有無、備考、stock_warnings、再送処理済みかを表示し、「続けて返品・交換」「在庫照会へ戻る」を出す。画面下部には最近の返品・交換記録を 10 件表示する。保存結果や保存系エラーはページ先頭側に出るため、保存成功または command 失敗時はページ先頭へスクロールする
- **利用者配慮**:
  - レジ戻し済みかどうかは二重計上防止の要点なので、色だけで示さず「CSV取込みで反映」「この保存で反映」の文言と説明文を主情報にする
  - 備考は保存結果、直近一覧、返品・交換詳細で「備考」と分かる独立ラベル付き領域にし、本文は通常本文色で読める濃さにする。入力なしの場合は「備考なし」と表示する
  - 交換の方向は `戻り（在庫+）` / `渡し（在庫-）` とし、在庫視点の符号を日本語で補足する
  - 生地は `cm` 単位を主表示にし、cm 整数で入力する。cm / m 表示切替は横断表示方針で扱うため初回 UI-03 では扱わない
  - 画像保存と返品保存は単一 TX ではないため、画像保存後に返品保存が失敗した場合は保存済み相対パスを保持して再試行し、同じ画像を再保存しない
  - 保存中はヘッダ、明細、商品追加、画像選択、戻る/リセット導線を disabled にし、中断可能に見せない
  - Windows native L3 で navigation、種別切替、レジ戻し済み説明、商品検索/スキャン相当 Enter 追加、同一商品+方向の数量加算、画像選択/プレビュー、validation、保存中 disabled、結果表示、recent list、在庫照会導線を確認する
  - 詳細な関数設計と Design Intent Trace は [function-design/63-ui-return-exchange.md](function-design/63-ui-return-exchange.md) を参照

### 商品検索・一覧画面
- **対応仕様**: REQ-103（商品検索・一覧表示）
- **レイアウト判断**:
  - 商品管理の入口として、初期表示は廃番以外の商品一覧を表示する。検索するまで空にする設計は在庫照会 UI-06a には合うが、商品管理では修正対象を探す入口として弱い
  - 検索欄は商品名 / 商品コード / JAN コードを同じ入力で扱う。バーコードスキャナは HID キーボード入力として検索欄 + Enter で扱い、専用スキャンボタンは初回実装では置かない
  - 部門フィルタ、廃番表示モード（表示中 / すべて / 廃番のみ）、並替え、ページングを同じ画面で扱う。部門候補は検索結果の現在ページから作らず、部門マスタ全件を取得する
  - 商品コード、商品名、部門、売価、在庫数を一覧で見せる。商品コードだけで利用者判断を強制しない。廃番状態は専用列を持たず、商品名セル内に廃番 badge と行 muted で示す（UI-01a-D8）
  - ページングは UI-01a で実装する。`perPage` は 50 / 100 / 200 の選択式にし、既存 `search_products` の 200 超クランプ契約を UI から踏みに行かない
- **利用者配慮**:
  - 廃番状態は色だけにせず、廃番商品のみ商品名セル内に `廃番` text badge を出し、行を muted 表示にする。「表示中」badge は出さない（UI-01a-D8）
  - 生地は単位付きで在庫数を表示する。cm / m 表示切替は UI-01a 初回実装だけで局所的に作らず、横断表示方針または商品登録・修正設計と合わせて再評価する
  - 検索条件とページングは URL state に置き、F5 後も同じ一覧状態を復元できるようにする
  - 詳細な関数設計と Design Intent Trace は [function-design/50-ui-product-list.md](function-design/50-ui-product-list.md) を参照

### 商品登録・修正画面
- **対応仕様**: REQ-101（商品登録）, REQ-102（商品修正）
- **レイアウト判断**:
  - route は `/products/new`（新規）と `/products/$code/edit`（修正）を分ける。新規 / 修正を query param だけで切り替えない
  - UI は generated `commands.*` のみを使う。実装 PR では `createProduct` / `updateProduct` / `toggleDiscontinue` / `listSuppliers` を tauri-specta binding に追加する
  - create mode の商品コードは「JANコードあり」と「JANなし独自コード自動発番」に分ける。JAN blank + 選択部門に `code_prefix` がない場合は保存前に止める
  - edit mode では `product_code` / `jan_code` / `stock_quantity` / `stock_unit` を読取専用にする。`stock_unit` 変更は在庫履歴・閾値・POS 連動への影響が大きいため別 Design Phase
  - 取引先候補は取引先マスタ全件を取得する。inline 新規取引先作成は初回 UI-01b 実装では扱わない
  - 保存成功後は商品一覧へ戻る。`returnTo` は `/products` 一覧 route とその search params だけを許可し、`/products/new`、`/products/$code/edit`、`/products/import`、外部 URL、他画面 route は `/products` に戻す
  - form は「商品の識別」「分類と取引先」「価格」「在庫」の 4 セクションに分割し、各セクションに h2 見出しと 1 行説明を付ける（UI-01b-D10）
- **利用者配慮**:
  - 廃番状態は色だけにせず、「表示中」「廃番」の日本語 badge と廃番 / 復帰 button label で示す
  - read-only 入力（商品コード / edit の JANコード・現在庫）は `readonly` + muted 背景で読める形にし、必須項目（商品名・部門・売価・原価、create 時は初期在庫）はラベルに `（必須）` を付けて色だけで符号化しない（UI-01b-D11 / D12）
  - `stock_unit='cm'` を選んだ場合は `pos_stock_sync=false` を提案するが、利用者が true に戻せる
  - 部門取得失敗は保存不可、取引先取得失敗は取引先未指定なら保存可能にする。必須項目と任意項目の失敗を同じ扱いにしない
  - 商品名やメーカー品番など日本語入力を伴うため、実装 PR では Windows native L3 で IME / Tab 移動 / 保存後遷移を確認する
  - 詳細な関数設計と Design Intent Trace は [function-design/51-ui-product-form.md](function-design/51-ui-product-form.md) を参照

### 商品一括インポート画面
- **対応仕様**: REQ-104（商品マスタCSV一括インポート）
- **レイアウト判断**:
  - route は `/products/import`。商品管理エリアの独立画面として扱い、商品一覧 / 商品フォームの query param で mode 切替しない
  - 3ステップ構成（ファイル選択 → 内容確認 → 完了）にし、プレビュー段階で新規登録候補 / エラー行 / 重複行を同じ画面で確認できるようにする
  - ファイル選択は UI-07 と同じ plain `<input type="file">` + drag/drop で始める。`@tauri-apps/plugin-dialog` は UI-01c 単独では導入しない
  - 重複行は既定「スキップ」。行ごとに「上書き」を選べる。上書き選択が 1 件以上ある場合だけ確認ダイアログを出す
  - エラー行があっても正常行があれば取込み可能にする。ただしエラー行は取り込まれないことを件数サマリと行別エラーで明示する
  - 取り込める行が 0 件の場合は「取り込む」を disabled にし、理由を日本語で表示する
  - 完了画面では新規 / 更新 / スキップ件数を明示し、「商品一覧へ戻る」「別のCSVを取り込む」の 2 導線に絞る
- **利用者配慮**:
  - CSV 初期投入は失敗影響が大きいため、色だけで状態を示さず、`新規登録候補` / `エラー行` / `重複行` / `上書き` / `スキップ` の日本語ラベルを主情報にする
  - 一括上書きは初回実装では置かない。既存商品を変える操作は行ごとに明示選択させる
  - commit 中は中断可能に見せない。backend は単一 TX であり、UI だけの cancel は誤認を招く
  - Windows native L3 で file input / dragdrop、エラー行と重複行の見分け、上書き確認、結果サマリ、商品一覧への戻り導線を確認する
  - 詳細な関数設計と Design Intent Trace は [function-design/60-ui-product-import.md](function-design/60-ui-product-import.md) を参照

### 月次売上レポート画面
- **対応仕様**: REQ-502（SP-502-01〜06）
- **レイアウト判断**:
  - 日次レポートとは別 route (`/reports/monthly`)、TabsHeader 共通化 (`src/components/sales/TabsHeader.tsx`、router-driven `<Link>` で「日次/月次」切替)
  - 前月/翌月ナビ + `<input type="month">` で月切替（HTML5 native picker、F-11 Windows native 標準動作）
  - サマリ4枚（月間売上合計 / 月間販売点数 / 期間表示「YYYY/MM/DD-MM/DD」固定文言 / 前月比、Q-1 営業日数 BIZ 拡張は Backlog）
  - 部門別テーブルに構成比バーチャート（shadcn `<Progress>`、SP-502-02）と前月比（数値 / `比較不可` / `—` 表示を主情報とし、色分け閾値 ±1.0% は補助、SP-502-04）
  - 売上金額ランキング上位10商品（SP-502-03）。1位は黄色バッジ強調（`item.ranking === 1` 追従）
  - 商品ランキング: モード切替（商品別 / 部門別）は `?mode=by_product|by_department` URL state、部門フィルタは MonthlySaleItem DTO に部門情報がないため非対応（Q-4 部門情報 BIZ 拡張は Backlog、SP-502-05）
  - REQ-401再設計後は、Z005日報由来の「公式部門集計」と、Z004/手動販売由来の「商品ランキング」を分けて表示する。日報取込み済みでも商品ランキングが空の場合は「商品別CSV未取込み」と表示する
- **利用者配慮**:
  - 構成比をバーで視覚化。数字を読まなくても割合がわかる
  - 前月比は `+/- %`、`比較不可`、`—` のテキストを主情報とし、緑（+1.0% 以上）/灰（±1.0% 範囲内）/赤（-1.0% 以下）は傾向把握の補助に使う
  - prev_amount = 0 / prev_amount < 0（Z004 返品超過月）は「比較不可」灰「—」表示（除算ガード + 色分け逆転回避、Q-7）
  - CSV出力ボタン（SP-502-06、`useExportFile({ reportType: "monthly_by_product" | "monthly_by_department" })`）+ 印刷ボタン (Phase 2 では disabled、aria-disabled + Tooltip)

---

## 4. 設計中の気付き・未決事項

### 表記統一（要対応）
- **列名「JANコード」→「商品コード」に統一**: JANコードと独自コード（F-0001, H-0001等）が同じ列に並ぶため。CSV取込みプレビュー、売上レポート、在庫照会の全テーブルで統一する
- **「手動」バッジの判定基準**: JANコードの有無ではなく、記録元フラグ（自動/手動）で判定。独自コード商品でもCSV取込み経由なら手動バッジは付かない

### 独自コードの認知負荷（コード形式は確定、表示方針はUI実装時に判断）
- コード形式は確定: 2文字大文字アルファベット＋4桁連番（例: HZ-0047）。詳細は db-design/master-tables.md「独自コードルール（C-1、2026-03-29確定）」
- 残検討ポイント: 画面上で商品名と常に並べて表示するか、コードだけ見せる場面を作らないか → UI実装時に各画面ごとに判断

### 日次/月次レポートのタブ統合
- REQ-501とREQ-502を別画面にせずタブ切替にした判断
- 理由: 利用者が「日次を見て、月次も見たい」と思ったときにワンクリックで切り替わる方が自然。ホームに戻ってから月次ボタンを探す動線は非効率
- 注意: タブ内のUI構成は大きく異なる（日次=商品別テーブル、月次=部門別＋ランキング）
- **2026-04-21 更新**: ルーティング設計確定により別 route (`/reports/daily` / `/reports/monthly`) に変更。タブ UI 自体は維持し、`<Link>` による route 切替の視覚表現として実装。状態の URL 化によりテスト容易性 / F5 耐性 / queryKey 独立 / コード分割が向上。根拠は [ui-12-design-agreement.md §7.3](archive/plans/2026-04-21-ui-12-design-agreement.md)

### 在庫照会のREQ統合
- REQ-301（商品別照会）とREQ-302（在庫切れ/少一覧）を1画面に統合した判断
- 理由: フィルタチップの切替で両方のニーズを満たせる。別画面にすると「在庫切れを見たいだけなのにどっちの画面？」と迷う
- REQ-303（在庫変動履歴）は商品詳細カードからのリンクで遷移する形

### UI-06a Phase 2 実装前スコープ調整（2026-05-20）
- **専用スキャンボタンは Phase 2 では実装しない**: バーコードスキャナは HID キーボードとして検索欄に入力される前提（UI_TECH_STACK.md §5.3）。Phase 2 は検索欄 focus + Enter 検索 + 1 件なら自動展開までに限定し、専用スキャン UX / 連続スキャン検知は Phase 3 UI-01a/UI-02 の HW 連携時に再評価する
- **状態チップは件数なしの単純ラベル**: `すべて / 在庫切れ / 在庫少` のフィルタ操作に限定する。件数バッジは検索条件・部門フィルタ・count contract の意味が絡むため、Phase 4 UI-06c または count API 設計時に再評価する
- **在庫少判定は BIZ を正とする**: `list_low_stock` が BIZ 側で `stock_low_threshold` / `stock_low_threshold_fabric` を適用した集合を返す。frontend は閾値を持たず、その集合を `stock_quantity <= 0`（在庫切れ）/ `stock_quantity > 0`（在庫少）に分ける
- **変更理由**: 古いモックアップの「スキャン」ボタン / 「在庫少 12件」チップをそのまま実装すると、未着手 HW 連携や件数 contract が実装済みに見える。Phase 2 では scope と UX honesty を優先する

### ホーム画面の情報量バランス（2026-04-22 確定）
- **判断**: 「昨日の売上」表示（カレンダー昨日基準）+ 別途「前日分未取込み警告」を併用する 2 系統設計に確定
- **昨日の売上**: `get_daily_sales(yesterday)` で算出。CSV 未取込みなら 0 円表示（取込み前提のサマリ）
- **前日分未取込み警告**: `list_csv_imports(latest)` の `settlement_date < yesterday` を満たす場合に通知バーで警告。「最後の CSV 取込み日 = 〇〇」を併記して取込み忘れを検知
- **設計根拠**: `imported_at`（取込み実行時刻）ではなく `settlement_date`（精算日）で判定する。詳細は [docs/archive/plans/2026-05-09-phase-2-ui-00.md](archive/plans/2026-05-09-phase-2-ui-00.md) D-8 / D-9 + ui-task-specs.md §UI-00 参照

---

## 5. 今後の作業

### 実装フェーズ分類（Plans.md 第8〜10段階と整合）

**Phase 2: 毎日使う5画面（完了、`v0.8.0-ui-daily` タグ済み）**
1. UI-00 ホーム画面（実装プラン → [docs/archive/plans/2026-05-09-phase-2-ui-00.md](archive/plans/2026-05-09-phase-2-ui-00.md) 完了済、PR #56 squash merge `e6da3d8` 2026-05-09）
2. UI-07 CSV取込み（REQ-401、PR #62 `b8db619`。状態管理は `useReducer + discriminated union` 採用済み）
3. UI-09a 日次売上レポート（REQ-501、PR #65 `8c2be51`）
4. UI-06a 在庫照会（REQ-301/302/303 統合、PR #67 `cf89082` + PR #74 `ae0c68f`）
5. UI-09b 月次売上レポート（REQ-502、PR #66 `caf7d57` + PR #70 `aeeee2a`）

Phase 2 完了判断で daily 5 画面の追加実装は不要。H-6 5 画面通しの Windows native 利用者 OK は通過済み。UI_TECH_STACK §7.2 の E2E / visual regression 採否は 8-9 として完了し、Phase 2 tag gate にはしない。`typedInvoke` fallback 撤去も Phase 2 closeout で完了済み。PR #75 closeout merge `f44f99a` に `v0.8.0-ui-daily` tag を作成済み。

**Phase 3: 商品管理 + 入出庫7画面（`v0.9.0-ui-product-inventory` タグ目標）**
- UI-01a/b/c 商品検索・一覧 / 登録 / 修正 / 一括インポート（REQ-103/101/102/104）
- UI-02 入庫記録（REQ-201、バーコードスキャン + 複数商品一括）
- UI-03 返品・交換（REQ-202、レジ戻し済みフラグ + レシート添付）。詳細な route / command / validation / L3 確認項目は `docs/function-design/63-ui-return-exchange.md` を正とする。
- UI-04 手動販売出庫（REQ-203、PLU 未登録新商品のみ）
- UI-05 廃棄・破損（REQ-204）

UI-04 は `/inventory/manual-sale` で、レジCSVに入らない販売を手入力し、在庫減算と売上記録を同時に残す。PLU 登録済み商品の場合は二重記録を避けるため確認を挟み、保存後は日次売上へ遷移して「手動」Badge を確認できる導線を置く。画面下部には保存直後確認用の `直近の手動販売出庫` を置き、`すべての履歴を見る` と `詳細を見る` から入出庫履歴 / 手動販売詳細へ遷移できるようにする。保存成功、PLU確認待ち、保存系エラーはページ先頭側に出るため、保存応答後はページ先頭へスクロールする。詳細な route / command / validation / recent list / L3 確認項目は `docs/function-design/62-ui-manual-sale.md` を正とする。

UI-05 は `/inventory/disposal` で、廃棄・破損による在庫減算とロス記録を残す。保存結果や保存系エラーはページ先頭側に出るため、保存成功または command 失敗時はページ先頭へスクロールする。詳細な route / command / validation / L3 確認項目は `docs/function-design/64-ui-disposal.md` を正とする。

**Phase 4: 在庫特殊 + システム管理7画面（`v1.0.0` タグ目標）**
- UI-06c 在庫変動履歴（REQ-303）。在庫少一覧（REQ-302）は D-047 により UI-06a `status=low_stock` フィルタへの deep-link で完了済み、独立画面なし
- UI-08 PLU書出し（REQ-402、SD カード経由実機確認は Phase 4 着手時）
- UI-10 棚卸し（REQ-205、Design Phase 追加済み。中断再開は status 自動判別、IPC channel は 10-4a 判定で不採用確定）
- UI-11a/b/c 設定 / バックアップ / 操作ログ
- UI-13 在庫整合性検証（REQ-904、Q40 障害時対応と合わせて具体化）
- REQ-403 / SP-403 POS 部門別売上照合（画面 task 未割当、deferred。数量・金額差と原因調査材料を示し、自動修正しない）

### 利用者への確認に使う画面（Phase 2 8-0 必須 gate）
- **Phase 2 完了時の利用者デモ**: 5 画面（UI-00 / UI-07 / UI-09a / UI-06a / UI-09b）を実機で触ってもらい操作フロー合意を取る（Plans.md 8-0 ゲート）。H-6 は通過済み。商品コードは小さいとの feedback があったが、他の視認性問題はなし。商品コード readability は Phase 2 blocker にせず、2026-06-07 follow-up で UI-06a / UI-09a の商品コードセルを通常 table text に上げ、全体表示は Sidebar footer の 3 段階 WebView 表示スケール option で扱う
- 「この画面でこのボタンを押すと、こうなります」の形で具体的に説明
- Tauri 2 on Linux 日本語 IME 制約（tauri#11412 OPEN）のため、デモは Windows native ビルドで実施

---

## 6. Phase 1 で確定した UI 実装上の制約

Phase 1 UI 基盤構築（PR #50 / #52 等）で固まった「画面実装時に必ず守る制約」を集約。各画面の §3 設計判断ログとは別に、横断的に適用される。

### カラーパレット

> 詳細は [docs/design-system/00-foundations.md](design-system/00-foundations.md) §カラーパレット 参照。

- **Tailwind stone系 + ウォーム系セマンティック HEX**: 純グレーは使わない。手芸店業務の暖色寄り環境と一致させる
- **エリア識別は色で行わない**: ナビゲーションの 4 エリア（毎日 / 商品管理 / 入出庫 / システム管理）はアイコン + 区切り線で区別。色情報はモックアップアーカイブとして残す（§2 注記参照）
- **状態色（赤 / 黄 / 緑）は補助的な意味強調にのみ使う**: 在庫切れ赤 / 在庫少黄 / 前月比増加緑など、業務上の判断補助に限定。ステータスの意味そのものは色だけに依存させない

### 業務ステータスの視認性

> 詳細は [docs/design-system/00-foundations.md](design-system/00-foundations.md) §業務ステータスの視認性 参照。横断規約として移設済み（2026-06-12）。

- 非IT系・高齢利用者前提。老眼や色の識別しづらさを前提に、読めること / 区別できることを機能要件として扱う
- 業務ステータスは色だけで符号化しない。日本語ラベル + アイコン / 形 / 位置 / バッジ / 状態列を組み合わせる（WCAG 1.4.1）
- Windows native L3 で実利用者が状態を言い分けられない場合は機能欠陥として扱う

### ページヘッダー規約（2026-06-12 追加）

- **画面タイトル h1**: 各ページの最上位タイトルは `text-2xl font-semibold`（[design-system/00-foundations.md](design-system/00-foundations.md) タイポグラフィの h1=24px/weight=600）で統一する。画面ごとに別サイズにして視覚言語を分裂させない
- **header 要素で包む**: タイトル（と必要なら主要 action ボタン）を `<header>` で包む。タイトルだけの場合は `<header className="space-y-1">`、右に action を置く場合は `<header className="flex flex-wrap items-center justify-between gap-3">` にする
- **適用画面（初回）**: UI-01a 商品検索・一覧、UI-01b 商品登録・修正（通常 + edit-error 分岐の両方）、UI-06a 在庫照会。UI-06a は L3 承認済み画面の変更として扱い、再確認する
- **section 見出し**: フォーム等のページ内セクション見出しは h2 `text-xl font-semibold`（[design-system/00-foundations.md](design-system/00-foundations.md) タイポグラフィの h2=20px）を使い、Separator で区切る
- **共通 component 化**: PageHeader 共通 component への抽出は、同型ヘッダーが 3 箇所目で重複した時点（rule-of-three）で別 PR として扱う

### URL 設計

> 詳細は [docs/design-system/00-foundations.md](design-system/00-foundations.md) §URL 設計 参照。横断規約として移設済み（2026-06-12）。

- 状態（タブ切替・フィルタ・選択中エンティティ）は URL（route + search params）に持たせる
- 実装例: 日次/月次レポートは別 route、商品検索フィルタは search params

### ウィンドウタイトル動的更新（PR #50 / [docs/function-design/52-ui-shared-layout.md](function-design/52-ui-shared-layout.md) §52.6 参照）
- **書式**: `<アプリ名> - <画面名>`（例: 「在庫管理 - ホーム」「在庫管理 - 商品検索」）
- **実装**: TanStack Router `useRouterState({ select })` + `getCurrentWindow().setTitle()`（WSL2 WebKitGTK で `document.title` rebind されないため Tauri API 併用必須）
- **Tauri capability**: `core:window:allow-set-title` を `src-tauri/capabilities/default.json` に許可済

### Tauri 2 on Linux IME 制約
- 日本語 IME インライン入力未対応（tauri#11412 OPEN、WSL2 固有でなく Ubuntu ネイティブでも再現）
- **Phase 1 P0 IPC 疎通**: 英字入力で検証完了
- **Phase 2 以降**: 商品名 / 取引先名 / 部門名の日本語入力を伴う全画面実装時に Windows native ビルドへ移行

### デスクトップアプリ前提の UI 設計

> 詳細は [docs/design-system/00-foundations.md](design-system/00-foundations.md) §デスクトップアプリ前提の UI 設計制約 参照。横断規約として移設済み（2026-06-12）。

- レスポンシブ不要（単一店舗 PC 前提）、初期ウィンドウ 1280x800 / 最小 1024x720、hover 許容、shadcn/Radix で a11y 担保
- `@axe-core/react` or hooks accessibility coverage は 7-7b follow-up

### 共通レイアウト（PR #50 / docs/function-design/52-ui-shared-layout.md §52.2-§52.6 参照）
- **2 カラム**: サイドバー（左、固定幅）+ メイン（右、可変）
- **サイドバー実装**: `RootLayout` / `Sidebar` / `SidebarArea` / `SidebarLink` / `SidebarHeader` の 5 components、`src/config/navigation.ts` の `navigation` 定数で定義
- **アクティブ表示**: TanStack Router `<Link>` の `inactiveProps` で hover を完全分離（`activeProps` は base `className` 上書きせず追加するため）

### 画面実装の workflow（PR #72 で `docs/DEV_WORKFLOW.md` に統合）
- 3 層駆動開発: Layer 1 自動テスト（Vitest / RTL、必要に応じて axe）/ Layer 2 設計書照合（doc-consistency-check.sh）/ Layer 3 利用者デモ（operator-facing UI gate）
- 詳細は `docs/DEV_WORKFLOW.md`、`docs/quality/review-checklist.md`、`docs/code_review.md` を参照
