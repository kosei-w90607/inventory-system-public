# P8 テスト品質

## 確認範囲

- Rust CMD / BIZ / IO / MNT test の production 関数呼出し、fixture、REQ 命名、error / validation branch への感度
- frontend test の QueryClient 配線、mutation 後 invalidation、navigation 利用側、central invoke error adapter の間接 coverage
- traceability generator の FE file discovery、ID presence 判定、baseline 検査と生成済み未参照一覧
- `npm test` は 98 files / 666 tests、`cargo test` は Rust unit 670 tests、traceability generator 14 tests、architecture / design-compliance / integration tests を含め pass。`cargo run --bin generate_traceability -- --check` も ERROR / WARN 0 で pass

### P8-1: 4つの CMD module の validation test が production command を呼ばず同じ分岐を再実装する
- 観点: テスト品質
- 証拠: `src-tauri/src/cmd/product_cmd.rs:118`、`src-tauri/src/cmd/product_cmd.rs:162`、`src-tauri/src/cmd/integrity_cmd.rs:31`、`src-tauri/src/cmd/integrity_cmd.rs:58`、`src-tauri/src/cmd/stocktake_cmd.rs:63`、`src-tauri/src/cmd/stocktake_cmd.rs:148`、`src-tauri/src/cmd/stocktake_cmd.rs:214`、`src-tauri/src/cmd/stocktake_cmd.rs:252`、`src-tauri/src/cmd/sales_cmd.rs:52`、`src-tauri/src/cmd/sales_cmd.rs:127`、`src-tauri/src/cmd/sales_cmd.rs:148`
- 害の経路: 回帰リスク — test 内で `if empty.is_empty()`、`count < 0`、`page < 1`、`match mode` と `CmdError` を作り直しており、production command の防御分岐を削除したり `field` / message を変えたりしても当該 test は green のままになる。stocktake module 内には同じ `AppState` fixture で実 command を呼ぶ test もあるため、Tauri State が必要というコメントは現在の test 構造を正当化しない。
- repo 規範との対照: `docs/quality/review-checklist.md:93` は test green の確認を要求し、`src-tauri/src/cmd/stocktake_cmd.rs:290`、`:336`、`:369`、`:383` は mock app state 経由で production CMD を実行する repository 内の既存パターンを示す。
- 提案方向: validation を production helper または実 command 経由で検証し、test 内の分岐複製をなくす。
- 想定労力: M
- 確度: 確実

### P8-2: mutation test が現行 invalidation の列挙を写し、必要 consumer key の欠落を検出できない
- 観点: テスト品質
- 証拠: `src/features/receiving/ReceivingPage.test.tsx:214`、`src/features/receiving/ReceivingPage.test.tsx:227`、`src/features/receiving/ReceivingPage.test.tsx:246`、`src/features/return-exchange/ReturnExchangePage.test.tsx:126`、`src/features/return-exchange/ReturnExchangePage.test.tsx:134`、`src/features/return-exchange/ReturnExchangePage.test.tsx:151`、`src/features/manual-sale/ManualSalePage.test.tsx:443`、`src/features/manual-sale/ManualSalePage.test.tsx:455`、`src/features/manual-sale/ManualSalePage.test.tsx:472`、`src/features/disposal/DisposalPage.test.tsx:246`、`src/features/disposal/DisposalPage.test.tsx:254`、`src/features/disposal/DisposalPage.test.tsx:279`、`src/lib/query-keys.ts:43`
- 害の経路: 回帰リスク / 一貫性破壊 — 入庫・レジ未処理返品・手動販売・廃棄の test は production と同じ key 群だけを個別 assertion するため、P5-2 で確認した `stock-movements` 欠落をすべて通す。商品 form test は QueryClient を返さず invalidation 自体を検査せず、整合性補正 test も client を外へ出さないため、P5-1 / P5-3 の欠落も full suite green のまま残る。
- repo 規範との対照: `docs/UI_TECH_STACK.md:235`〜`:249` は変更 entity の全 query invalidation と複数 entity の明示リスト化を要求するが、mutation→consumer の期待集合を定義・検査する test contract は規範未定義である。
- 提案方向: mutation の業務影響から必要 consumer key を定める共通 contract を置き、実装の列挙ではなくその集合に対して検査する。
- 想定労力: M
- 確度: 確実

### P8-3: navigation 設定 test と mocked Sidebar は `ActionButton` と動的 title の利用側を通らない
- 観点: テスト品質
- 証拠: `src/config/navigation.test.ts:4`、`src/config/navigation.test.ts:20`、`src/config/navigation.test.ts:43`、`src/components/layout/Sidebar.test.tsx:12`、`src/components/layout/Sidebar.test.tsx:53`、`src/features/home/components/ActionButton.tsx:12`、`src/features/home/components/ActionButton.tsx:20`、`src/features/home/components/ActionButton.tsx:29`、`src/components/layout/RootLayout.tsx:25`、`src/components/layout/RootLayout.tsx:33`
- 害の経路: 回帰リスク — config test は一部 item の値と pending 0 件だけを検査し、Sidebar test は `SidebarArea` を丸ごと mock する。P7-3 の未知 ID が typecheck を通って `Unknown` button になる接続点と、P7-4 の parameterized route title が app 名へ落ちる接続点はいずれも test から到達せず、navigation の追加・変更時に利用側だけ壊れても green になる。
- repo 規範との対照: `docs/function-design/52-ui-shared-layout.md:168`、`:181`、`:202`、`:207` は route ごとの画面把握性と動的 title を契約化し、`docs/function-design/53-ui-home.md:6` は `ActionButton` が navigation SSOT を参照する共通部品であるとするが、その seam を検証する test はない。
- 提案方向: navigation ID lookup と固定・parameterized route title を利用側の公開挙動として直接検査する。
- 想定労力: S
- 確度: 確実

### P8-4: FE traceability gate は未参照 file の同一性を検査せず、domain test 17本を baseline に固定する
- 観点: テスト品質
- 証拠: `docs/DEV_WORKFLOW.md:226`、`docs/DEV_WORKFLOW.md:283`、`docs/quality/review-checklist.md:93`、`src-tauri/src/bin/generate_traceability.rs:37`、`src-tauri/src/bin/generate_traceability.rs:43`、`src-tauri/src/bin/generate_traceability.rs:539`、`src-tauri/src/bin/generate_traceability.rs:756`、`docs/function-design/90-traceability.md:52`、`docs/function-design/90-traceability.md:61`、`docs/function-design/90-traceability.md:80`
- 害の経路: 回帰リスク / 読み手の混乱 — T4 は ID 未参照 file の件数が22かだけを比較するため、未参照 file が別 file と入れ替わっても green になり得る。うち5本は画面非依存 pattern として意図的だが、残る17本は CSV・日次/月次売上・ホームの domain helper test で、どの REQ/UI の挙動を守るか traceability table から辿れず、要件変更時の影響 test を過小評価し得る。
- repo 規範との対照: `docs/DEV_WORKFLOW.md:226` は traceability がある touched area の test に REQ / UI 等の ID を付ける方針を定め、`docs/quality/review-checklist.md:93` は test 名の REQ 番号と traceability green を同時に要求するが、現行 gate は後者を件数だけで満たせる。
- 提案方向: 意図的な除外 file を名前で allowlist 化し、domain test は対応 ID を保持する検査へ切り替える。
- 想定労力: M
- 確度: 確実

## 第 2 パス（recall sweep）

### P8b-1: Z004取込みの中核 hook が test では丸ごと mock され、実配線を一度も通らない
- 観点: テスト品質
- 証拠: `src/features/csv-import/CsvImportPage.test.tsx:9`、`src/features/csv-import/CsvImportPage.test.tsx:10`、`src/features/csv-import/CsvImportPage.test.tsx:23`、`src/features/csv-import/hooks/useCsvImportFlow.ts:21`、`src/features/csv-import/hooks/useCsvImportFlow.ts:67`、`src/features/csv-import/hooks/useCsvImportFlow.ts:72`、`src/features/csv-import/hooks/useCsvImportFlow.ts:94`、`src/features/csv-import/hooks/useCsvImportFlow.ts:134`、`src/features/csv-import/hooks/useCsvImportFlow.ts:166`
- 害の経路: 回帰リスク — page test は `useCsvImportFlow` を常に idle の手組み object に置換して tab label だけを検査し、repository-wide test search に実 hook の import はない。したがって 20MB early reject、File→bytes変換、parse/commit/rollback の command 引数、`import_error` の idle recovery、rollback failure の state 維持、importing 中の `useBlocker`、成功後 invalidation のいずれを削除・反転しても reducer test と page test は green のままになる。
- repo 規範との対照: `docs/function-design/55-ui-csv-import.md:224`〜`:258` と `:344`〜`:365` は3 mutation・error recovery・navigation block を画面 contract とする。同種の `useDailyReportImportFlow` は `src/features/daily-report-import/hooks/useDailyReportImportFlow.test.tsx:182` 以降で実 hook を QueryClient に接続し、command・state・invalidation まで検査している。
- 提案方向: daily report の既存 pattern を使って `useCsvImportFlow` 自体を renderHook し、入口 guard、3 mutation の成功/失敗、kind別 recovery、blocker、必要 consumer invalidation を公開挙動として検査する。
- 想定労力: M
- 確度: 確実

### P8b-2: ホームの4 query orchestration と日付またぎが手組み表示 fixture の外に残る
- 観点: テスト品質
- 証拠: `src/features/home/hooks/useHomeSummary.ts:16`、`src/features/home/hooks/useHomeSummary.ts:19`、`src/features/home/hooks/useHomeSummary.ts:31`、`src/features/home/hooks/useHomeSummary.ts:40`、`src/features/home/hooks/useHomeSummary.ts:49`、`src/features/home/hooks/useHomeSummary.ts:63`、`src/features/home/hooks/useYesterdayDate.ts:19`、`src/features/home/hooks/useYesterdayDate.ts:22`、`src/features/home/HomePage.tsx:30`、`src/features/home/HomePage.tsx:37`、`src/features/home/HomePage.tsx:53`、`src/features/home/components/SummaryCards.test.tsx:24`、`src/features/home/components/SummaryCards.test.tsx:52`
- 害の経路: 回帰リスク — home の test は `UseQueryResult` と全 derived 値を手で組み立てて `SummaryCards` に渡すため、実際の4 command / query key /引数を通らない。`needsImportWarning` の `< yesterday` を壊す、`listCsvImports(1, 1)` を誤配線する、visibility listener を外して日付またぎ後も前々日の query key を使う、PLU・取込み履歴失敗 toast を削除する、といった operator-facing 回帰が full frontend suite を通過する。
- repo 規範との対照: `docs/function-design/53-ui-home.md:102`〜`:125` は4 query と24時またぎ再fetchを、`:174`〜`:207` は独立した部分障害表示と前日未取込み警告を contract 化する。一方 `:287` の「Vitest未着手のため後続」は現在も残り、純関数 `count-stock-status` の test だけが追加されて orchestration の後続課題が回収されていない。
- 提案方向: mock commands + QueryClient で `useHomeSummary` の4 query・派生値・部分障害独立性を、fake Date + `visibilitychange` で日付またぎを、`HomePage` integration で2 toast と未取込み警告を検査する。
- 想定労力: M
- 確度: 確実

### P8b-3: DB移行・restore test は成功/早期NotFoundだけを通り、WAL失敗とデータ意味論を検査しない
- 観点: テスト品質
- 証拠: `src-tauri/src/db/mod.rs:304`、`src-tauri/src/db/mod.rs:310`、`src-tauri/src/db/mod.rs:314`、`src-tauri/src/db/mod.rs:353`、`src-tauri/src/mnt/backup.rs:696`、`src-tauri/src/mnt/backup.rs:700`、`src-tauri/src/mnt/backup.rs:752`、`src-tauri/src/mnt/backup.rs:771`、`src-tauri/src/cmd/settings_cmd.rs:587`、`src-tauri/src/cmd/settings_cmd.rs:602`、`src-tauri/src/cmd/settings_cmd.rs:607`
- 害の経路: 回帰リスク — legacy migration の「WAL test」は `main` / `wal` / `shm` という平文ファイルの存在だけを確認し、WAL にのみ commit 済み row がある実 SQLite snapshot を再openしない。restore の3 test は正常置換・存在しないbackup・migration成功だけで、CMDの「recovery after failure」も rename 前に返る NotFound を使う。そのため WAL copy failure を成功扱いする P3b-1 と WAL evacuation failure 後も置換を続ける P3b-2 が、backend全test green のまま残った。
- repo 規範との対照: `docs/function-design/71-mnt-backup.md:58` は WAL mode 下のデータ整合性を restore contract とし、`src-tauri/src/db/mod.rs:195` も legacy DB を3ファイルセットとして定義する。現 test はファイル名・存在の構造だけを守り、障害時に「元 snapshot または新 snapshot のどちらか一方」という意味的完了条件を固定していない。
- 提案方向: 未checkpoint commit を含む実 SQLite WAL fixture を新パスで再openして row を検証し、destination collision / rename failure（または注入可能な file-ops）で各段階を失敗させ、部分DBを残さず元 snapshot が再接続可能であることを検査する。
- 想定労力: M
- 確度: 確実
