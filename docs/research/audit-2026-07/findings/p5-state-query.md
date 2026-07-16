# P5 状態管理・データ取得パターン

## 確認範囲

- `src/lib/query-keys.ts` と全 production `useQuery` / `useMutation` の key、staleTime、gcTime、retry、success invalidation
- backend mutation が変更する product / stock / sales / record / log と、それを購読する query key の対応
- 全 production route の `validateSearch` と list/filter/page/sort state、feature-local state の設計理由
- list/filter/page/sort は概ね URL search state に置かれ、import flow・確認dialog・一時的実行結果は local reducer/state に置かれている。後者には関数設計上の理由があり、URL state 観点の finding はなし

### P5-1: 商品 CRUD は商品一覧しか invalidate せず、派生する在庫・PLU query を fresh のまま残す
- 観点: 状態管理・データ取得パターン
- 証拠: `src/features/products/ProductFormPage.tsx:83`、`src/features/products/ProductFormPage.tsx:84`、`src/features/products/ProductFormPage.tsx:157`、`src/features/products/ProductFormPage.tsx:159`、`src-tauri/src/biz/product_service.rs:171`、`src-tauri/src/biz/product_service.rs:174`、`src-tauri/src/biz/product_service.rs:216`、`src-tauri/src/biz/product_service.rs:291`、`src-tauri/src/biz/product_service.rs:305`、`src-tauri/src/biz/product_service.rs:348`、`src/features/products/import/useProductImportFlow.ts:82`
- 害の経路: 一貫性破壊 / 回帰リスク — create は初期在庫・PLU dirty・進行中棚卸し明細を作り、update/toggle は PLU dirty や廃番状態を変えるが、form 成功時は `productList.root()` だけを無効化する。同じ商品追加・更新を行う一括 import は product list、low stock、stock inquiry、PLU dirty をすべて無効化するため、フォーム経由直後にホームへ戻ると最大60秒、古い在庫少件数やPLU通知を「fresh」cacheとして表示し得る。
- repo 規範との対照: `docs/UI_TECH_STACK.md:235`〜`:249` は mutation 成功時に影響 entity を明示リストで invalidate する方針を定める。商品 form の関数設計には invalidation contract が未定義で、実装間の差を防ぐ正本がない。
- 提案方向: 商品 mutation ごとの影響 query を明示し、一括 import と共通の dependency set で invalidate する。
- 想定労力: M
- 確度: 確実

### P5-2: 在庫を動かす mutation が UI-06c の stock-movements cache を一度も invalidate しない
- 観点: 状態管理・データ取得パターン
- 証拠: `src/lib/query-keys.ts:43`、`src/lib/query-keys.ts:44`、`src/lib/query-keys.ts:45`、`src/features/stock-movements/hooks/useStockMovements.ts:27`、`src/features/stock-movements/hooks/useStockMovements.ts:39`、`src/features/stock-movements/hooks/useStockMovements.ts:53`、`src/features/receiving/ReceivingPage.tsx:164`、`src/features/return-exchange/ReturnExchangePage.tsx:232`、`src/features/manual-sale/ManualSalePage.tsx:184`、`src/features/disposal/DisposalPage.tsx:164`、`src/features/csv-import/hooks/useCsvImportFlow.ts:113`
- 害の経路: 一貫性破壊 / 回帰リスク — 入庫・返品・手動販売・廃棄・CSV取込みはいずれも在庫と movement 履歴を変えるが、invalidate list に `stock-movements` がなく、factory に root helper もない。直前に履歴画面を見た商品へ10秒以内に戻ると、商品在庫と履歴一覧の双方が fresh cache と判定され、新規 movement がない旧履歴を表示する。
- repo 規範との対照: `docs/UI_TECH_STACK.md:235`〜`:249` は mutation 成功時の影響 entity 一括 invalidation を要求し、`src/lib/query-keys.ts:17`〜`:20` は複数 parameter key を prefix helper で無効化する既存パターンを示す。各在庫操作の関数設計には UI-06c を含む横断 dependency が未定義である。
- 提案方向: `stock-movements` の prefix invalidation を全 stock-changing success path に含める。
- 想定労力: M
- 確度: 確実

### P5-3: 整合性補正が stock_quantity 更新後も関連 query を何も invalidate しない
- 観点: 状態管理・データ取得パターン
- 証拠: `src-tauri/src/biz/integrity_service.rs:124`、`src-tauri/src/biz/integrity_service.rs:171`、`src-tauri/src/biz/integrity_service.rs:176`、`src/features/integrity-check/IntegrityCheckPage.tsx:139`、`src/features/integrity-check/IntegrityCheckPage.tsx:147`、`src/features/integrity-check/IntegrityCheckPage.tsx:152`、`src/features/home/hooks/useHomeSummary.ts:31`、`src/features/home/hooks/useHomeSummary.ts:35`、`src/features/stock-inquiry/hooks/useStockInquiry.ts:62`、`src/features/stock-inquiry/hooks/useStockInquiry.ts:93`
- 害の経路: 一貫性破壊 / 回帰リスク — `fixIntegrity` は選択商品の `products.stock_quantity` を直接書き換えるが、page は成功結果を local state へ反映するだけで QueryClient に触れない。補正直後にホームや商品一覧へ移ると low-stock は最大60秒、商品一覧は最大30秒、在庫照会は最大10秒、補正前の数量を fresh cache として表示し、「補正済み」の直後に別画面で旧値が見える。
- repo 規範との対照: `docs/UI_TECH_STACK.md:235`〜`:249` の mutation invalidation 方針に対し、`docs/function-design/75-ui-integrity-check.md` は fix 後の画面内 state だけを定義し、他 feature の query invalidation を定義していない。
- 提案方向: integrity fix の成功時に stock/product 派生 query の dependency set を invalidate する。
- 想定労力: S
- 確度: 確実

### P5-4: operation logs と integrity latest log だけが query key factory を迂回する
- 観点: 状態管理・データ取得パターン
- 証拠: `src/lib/query-keys.ts:1`、`src/lib/query-keys.ts:6`、`src/lib/query-keys.ts:9`、`src/features/operation-logs/OperationLogsPage.tsx:155`、`src/features/operation-logs/OperationLogsPage.tsx:156`、`src/features/operation-logs/OperationLogsPage.tsx:166`、`src/features/operation-logs/OperationLogsPage.tsx:167`、`src/features/integrity-check/IntegrityCheckPage.tsx:76`、`src/features/integrity-check/IntegrityCheckPage.tsx:77`
- 害の経路: 変更コスト増 / 回帰リスク — 他の production query は共通 factory を使う一方、同じ operation log domain の3 keyだけが page内 literal である。log cleanup、integrity実行、別の管理操作から横断 invalidate を追加する書き手は cache key を repository-wide search で再発見する必要があり、一方の表記だけを無効化してもう一方を stale のまま残し得る。
- repo 規範との対照: `src/lib/query-keys.ts:6`〜`:7` は typo による cache miss 防止のため「すべて本 helper 経由」「直書き禁止」と明記する。`docs/function-design/74-ui-operation-logs.md:283` は literal key を設計しているため、共通規範と画面設計が矛盾している。
- 提案方向: operation log domain の key と prefix を共通 factory に収容する。
- 想定労力: S
- 確度: 確実
