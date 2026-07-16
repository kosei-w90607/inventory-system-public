# P7 可読性・慣用性・命名

## 確認範囲

- production TypeScript / React の lint 抑止、型 assertion、effect dependency、navigation / route 命名と失敗時挙動
- production Rust の clippy 抑止、動的 SQL parameter 構築、コメントと関数設計の一致
- phase / 未実装 / 互換 / 逸脱コメントを現行 route・CMD・テストと突合
- `npm run lint` と `cargo clippy --all-targets --all-features -- -D warnings` は pass。generated code と test fixture の assertion、理由が局所記載された互換抑止は除外した

### P7-1: 整合性補正は実装が正本からの逸脱を自己申告し、正本内部も相反する
- 観点: 可読性・慣用性・命名
- 証拠: `src-tauri/src/biz/integrity_service.rs:124`、`src-tauri/src/biz/integrity_service.rs:171`、`src-tauri/src/biz/integrity_service.rs:172`、`src-tauri/src/biz/integrity_service.rs:176`、`docs/function-design/36-biz-integrity-check.md:108`、`docs/function-design/36-biz-integrity-check.md:140`、`docs/function-design/36-biz-integrity-check.md:142`、`docs/function-design/36-biz-integrity-check.md:188`
- 害の経路: 回帰リスク / 読み手の混乱 — 設計 §21.4 は `adjustment` movement の挿入と `stock_quantity=movements_sum` を同時に要求するが、挿入後は movements_sum 自体が変わるため再チェックが収束しない。実装はこの矛盾を避けて direct update だけを行い、後段の不変条件表も direct update と書く一方、関数コメントは正本逸脱を明記しているため、書き手がどちらを「修正」しても別の契約を壊す。
- repo 規範との対照: `AGENTS.md:4` は docs を設計意図の source of truth とするが、同じ関数設計内の処理ステップと不変条件表、production 実装が一致していない。
- 提案方向: 補正後に再チェックが収束する不変条件を先に確定し、設計・実装・audit trail 方針を同時に一本化する。
- 想定労力: M
- 確度: 確実

### P7-2: 2つの動的 SQL builder が手動 index と dummy read で lint を黙らせる
- 観点: 可読性・慣用性・命名
- 証拠: `src-tauri/src/db/product_repo.rs:600`、`src-tauri/src/db/product_repo.rs:602`、`src-tauri/src/db/product_repo.rs:614`、`src-tauri/src/db/product_repo.rs:623`、`src-tauri/src/db/stocktake_repo.rs:477`、`src-tauri/src/db/stocktake_repo.rs:480`、`src-tauri/src/db/stocktake_repo.rs:482`、`src-tauri/src/db/stocktake_repo.rs:495`
- 害の経路: 変更コスト増 / 回帰リスク — placeholder番号と params push を別々に進め、最後の加算を `let _ = param_idx` で「使用済み」にしているため、filter の挿入・並べ替え時に番号と値の対応を手で証明する必要がある。特に stocktake 側は最後の filter が parameter を追加しないのに index を増やしたまま捨て、意図を読み取るためのノイズになっている。
- repo 規範との対照: `src-tauri/src/db/return_repo.rs:122`〜`:131`、`src-tauri/src/db/inventory_repo.rs:238`〜`:258` は `params.len() + 1` から placeholder を導出し、独立 counter を持たない repository 内の既存慣用を示す。
- 提案方向: placeholder番号を params の現在長から導出する既存パターンへ統一する。
- 想定労力: S
- 確度: 確実

### P7-3: `ActionButton` の `NavItem["id"]` は制約型に見えて実際は任意 string を許す
- 観点: 可読性・慣用性・命名
- 証拠: `src/config/navigation.ts:33`、`src/config/navigation.ts:34`、`src/config/navigation.ts:53`、`src/config/navigation.ts:245`、`src/features/home/components/ActionButton.tsx:12`、`src/features/home/components/ActionButton.tsx:20`、`src/features/home/components/ActionButton.tsx:21`、`src/features/home/components/ActionButton.tsx:29`
- 害の経路: 読み手の混乱 / 回帰リスク — prop 型は navigation ID の union に見えるが、`NavItem.id` が `string` なので typo も typecheck を通り、runtime では画面上に disabled の `Unknown: <id>` を出す。`navigation` が `readonly NavArea[]` と先に注釈され literal ID を widening しているため、`as const` もこの接続点を守らない。
- repo 規範との対照: `tsconfig.json:18` の strict mode と fail-fast の意図に対し、既知の有限 ID 集合を型検査へ接続できておらず runtime fallback に委ねている。
- 提案方向: navigation 定義から ID literal union を保持・導出して prop と lookup を制約する。
- 想定労力: S
- 確度: 確実

### P7-4: `deriveTitle` は全 route の画面名を導く名前だが、parameterized route をすべてアプリ名へ落とす
- 観点: 可読性・慣用性・命名
- 証拠: `src/components/layout/RootLayout.tsx:19`、`src/components/layout/RootLayout.tsx:25`、`src/components/layout/RootLayout.tsx:29`、`src/components/layout/RootLayout.tsx:33`、`src/components/layout/RootLayout.tsx:41`、`src/routes/products/$code.edit.tsx:13`、`src/routes/stock/$code.movements.tsx:30`、`src/routes/inventory/receiving.records.$recordId.tsx:14`
- 害の経路: 一貫性破壊 / 読み手の混乱 — navigation の固定 path と完全一致する画面だけ title を得るため、商品編集・在庫変動履歴・4種の記録詳細など実装済み parameterized route は Alt+Tab / taskbar 上で全て単なる「在庫管理システム」になる。関数名とコメントは「pathname から画面タイトルを引く」と読めるため、route を追加する書き手がこの silent fallback を見落とす。
- repo 規範との対照: `docs/function-design/52-ui-shared-layout.md:168` は route 遷移ごとの画面把握性を要件化し、`:181`、`:202`、`:207` は Phase 2 以降に動的 title を実装すると定めるが、実装済み動的 route は `head()` を持たない。
- 提案方向: route metadata を title の正本にし、parameterized route も明示 title を返す。
- 想定労力: M
- 確度: 確実

### P7-5: phase 状態コメントが全 route active の現状と逆になり、設計正本にも残存する
- 観点: 可読性・慣用性・命名
- 証拠: `src/config/navigation.ts:51`、`src/config/navigation.ts:52`、`src/features/home/components/InventoryActionGrid.tsx:3`、`src/features/home/components/InventoryActionGrid.tsx:5`、`src/features/home/components/MiscActionRow.tsx:3`、`src/features/home/components/MiscActionRow.tsx:5`、`src/components/layout/Sidebar.test.tsx:53`、`src/components/layout/Sidebar.test.tsx:57`、`docs/function-design/53-ui-home.md:189`、`docs/function-design/53-ui-home.md:192`
- 害の経路: 読み手の混乱 / 変更コスト増 — production comment とホーム関数設計は入出庫・棚卸し・設定を「全 pending / 未着手」と説明するが、navigation と regression test は pending 0 件を現行 contract とする。記憶のない書き手は route の実装状況を再調査しない限り、既存画面を未実装と誤認して重複作業・誤った phase 判断を行い得る。
- repo 規範との対照: `AGENTS.md:4`、`:28` は repository docs を source of truth とする。現行状態を直接持つ `navigation` と test に対し、その説明文と UI-00 関数設計が同期されていない。
- 提案方向: lifecycle を再述するコメントを削り、必要な状態説明は navigation SSOT から参照する。
- 想定労力: S
- 確度: 確実

## 第 2 パス（recall sweep）

### P7b-1: 画面状態を保持する2つの ref が render 中に読み書きされる
- 観点: 可読性・慣用性・命名
- 証拠: `src/features/operation-logs/OperationLogsPage.tsx:141`、`src/features/operation-logs/OperationLogsPage.tsx:143`、`src/features/operation-logs/OperationLogsPage.tsx:145`、`src/features/disposal/DisposalPage.tsx:123`、`src/features/disposal/DisposalPage.tsx:183`、`src/features/disposal/DisposalPage.tsx:209`、`src/features/disposal/DisposalPage.tsx:230`、`package.json:38`
- 害の経路: 回帰リスク / 状態の不決定性 — 操作ログは render 中に「直前の有効な検索条件」を ref へ書き、その ref を同じ render の query key・表示 pagination に使う。廃棄画面も render 中に form lock を ref へ書き、非同期商品検索の完了後にその値で結果反映を許否する。React が render を再試行・破棄した場合、commit されなかった render の値が共有 ref に残り、表示していない検索条件の一覧を保持したり、実際の画面と異なる lock 判定で候補を反映・破棄したりし得る。
- repo 規範との対照: 本 repo は React 19 を採用している。React 公式 [`useRef` reference](https://react.dev/reference/react/useRef) は初期化を除く render 中の `ref.current` 読み書きを予測不能として禁止しているが、`eslint-plugin-react-hooks` は `package.json:64` の 5.2.0 で、`eslint.config.js:43` の recommended lint を通ってもこの2箇所は検出されない。
- 提案方向: 直前の有効な検索条件は state/effect など commit 後に更新されるスナップショットへ、非同期 callback 用の最新 lock は effect/event 境界で同期する ref へ移し、対応可能な hooks lint で render-phase ref access を guard する。
- 想定労力: M
- 確度: 確実

### P7b-2: アプリ内遷移が TanStack `Link` と生の `<a href>` に分裂している
- 観点: 可読性・慣用性・命名
- 証拠: `src/main.tsx:10`、`src/main.tsx:24`、`src/features/inventory-records/InventoryRecordsPage.tsx:320`、`src/features/inventory-records/ManualSaleRecordDetailPage.tsx:86`、`src/features/inventory-records/ManualSaleRecordDetailPage.tsx:104`、`src/features/operation-logs/OperationLogsPage.tsx:103`、`src/features/stock-movements/StockMovementsPage.tsx:61`、`src/features/receiving/ReceivingPage.tsx:612`、`docs/design-system/02-component-catalog.md:36`
- 害の経路: 一貫性破壊 / 変更コスト増 — 履歴一覧→詳細、詳細→戻る、在庫照会、操作ログ関連記録などの内部導線が raw anchor で document navigation を起こす一方、同じ `Button asChild` の内部導線は別画面で router `Link` を使う。raw anchor 側では React root・Router・module-scope QueryClient が作り直され、in-memory cache とローカル UI state を失って再取得するため、どの導線だけ full reload になるかを利用側から予測できない。型付き route/search からも外れ、route 変更時の追従点を増やしている。
- repo 規範との対照: `src/main.tsx:3`、`:43` は TanStack Router をアプリの遷移基盤とし、component catalog もアプリ内 action を `<Link to=...>` で例示する。`ReceivingPage` 等の既存導線はこの慣用に従うが、少なくとも履歴・在庫・日報・操作ログの複数 feature が raw anchor を選んでいる。
- 提案方向: 外部資源以外の導線を TanStack `Link` / router navigation に統一し、動的 route と search/returnTo も typed builder から生成する。
- 想定労力: M
- 確度: 確実

### P7b-3: PLU書出しが内部名と公開エラー分類で CSV取込み語彙を引きずる
- 観点: 可読性・慣用性・命名
- 証拠: `src-tauri/src/io/plu_formatter.rs:3`、`src-tauri/src/io/plu_formatter.rs:31`、`src-tauri/src/io/plu_formatter.rs:33`、`src-tauri/src/io/plu_formatter.rs:96`、`src-tauri/src/io/plu_formatter.rs:165`、`src-tauri/src/biz/plu_export_service.rs:40`、`src-tauri/src/biz/plu_export_service.rs:170`、`src-tauri/src/biz/plu_export_service.rs:171`、`src-tauri/src/cmd/plu_export_cmd.rs:18`、`src-tauri/src/cmd/plu_export_cmd.rs:104`、`src-tauri/src/biz/mod.rs:58`、`src-tauri/src/biz/mod.rs:77`
- 害の経路: 読み手の混乱 / 誤った分岐の誘発 — 実体と MIME は CP932 の tab-separated `.txt` なのに IO 型は `PluCsvOutput`、BIZ field は `csv_output`、CMD comment まで同名を伝播する。さらに formatter 失敗を CSV取込み専用の `BizError::ImportError` へ変換するため、CMD は書出し失敗を機械可読な `kind="import_error"` として返し、ログ表示も「インポートエラー」になる。将来 `import_error` を取込み画面の cache 消失・ファイル再選択分岐として共通化すると、PLU書出しまで誤って同じ recovery に入る。
- repo 規範との対照: `docs/quality/review-checklist.md:44` は「PLU = CV17向け `.txt` タブ区切り、Z004 = CSV」を固定し、`docs/function-design/41-cmd-pos.md:92` は `import_error` を CSV取込み固有案内のために新設したと説明する。`PluCsvOutput` は serde response ではなく、CMD が `PluExportPrepareResponse` へ詰め替える内部型なので、コメントの「互換維持」は frontend IPC contract の制約になっていない。
- 提案方向: 内部型・field を `PluFileOutput` / `plu_output` 等の実体語彙へ改名し、formatter failure は取込み専用ではない error variant / kind へ分離する。
- 想定労力: M
- 確度: 確実
