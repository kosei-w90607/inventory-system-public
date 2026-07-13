/**
 * TanStack Query queryKey helper.
 *
 * docs/function-design/53-ui-home.md §53.3 + docs/UI_TECH_STACK.md §2.5 補強 1
 *
 * D-4 採用: オブジェクト形式の第 3 要素で命名衝突回避 + 直書き禁止
 * （タイポによる cache miss を防ぐため、すべて本 helper 経由で参照）。
 */
export const queryKeys = {
  // UI-00 ホーム画面
  dailySales: (date: string) => ["daily-sales", "detail", { date }] as const,
  lowStock: (includeDiscontinued: boolean) =>
    ["products", "low-stock", { includeDiscontinued }] as const,
  pluDirty: () => ["plu-dirty"] as const,
  csvImports: (page: number, perPage: number) =>
    ["csv-imports", "list", { page, perPage }] as const,
  // UI-07 CSV取込み画面: prefix helper。
  // TanStack Query v5 の prefix match で `["csv-imports", "list", ...]` 配下を一括 invalidate。
  // 設計: docs/function-design/55-ui-csv-import.md §55.3 prefix helper 追加の根拠
  csvImportLists: () => ["csv-imports", "list"] as const,
  dailyReportImports: (page: number, perPage: number) =>
    ["daily-report-imports", "list", { page, perPage }] as const,
  dailyReportImportLists: () => ["daily-report-imports", "list"] as const,
  // UI-09b 月次売上レポート
  // 設計: docs/function-design/57-ui-monthly-sales.md §57.5 useMonthlySalesReport
  monthlySalesRoot: () => ["monthly-sales"] as const,
  monthlySales: (month: string, mode: string) =>
    ["monthly-sales", "detail", { month, mode }] as const,
  // UI-06a 在庫照会
  // 設計: docs/function-design/58-ui-stock-inquiry.md §58.5 useStockInquiry
  stockInquiry: {
    list: (status: string, q: string, dept: number | null) =>
      ["stock-inquiry", "list", { status, q, dept }] as const,
    departmentOptions: (status: string, q: string) =>
      ["stock-inquiry", "department-options", { status, q }] as const,
    detail: (productCode: string) => ["stock-inquiry", "detail", { productCode }] as const,
  },
  // UI-06a prefix helper。CSV 取込み後の在庫照会一括 invalidate 用
  // （list / detail 両方を `["stock-inquiry"]` prefix match で無効化、csvImportLists パターン踏襲）。
  stockInquiryRoot: () => ["stock-inquiry"] as const,
  // UI-06c 商品別在庫変動履歴
  // 設計: docs/function-design/66-ui-stock-movements.md §66.4
  stockMovements: {
    product: (productCode: string) => ["stock-movements", "product", { productCode }] as const,
    list: (productCode: string, search: object) =>
      ["stock-movements", "list", { productCode, ...search }] as const,
  },
  // REQ-206 入出庫履歴ハブ
  inventoryRecords: {
    root: () => ["inventory-records"] as const,
    list: (search: object) => ["inventory-records", "list", search] as const,
    departments: () => ["inventory-records", "departments"] as const,
    receivingDetail: (recordId: number) =>
      ["inventory-records", "receiving-detail", { recordId }] as const,
    returnDetail: (recordId: number) =>
      ["inventory-records", "return-detail", { recordId }] as const,
    manualSaleDetail: (recordId: number) =>
      ["inventory-records", "manual-sale-detail", { recordId }] as const,
    disposalDetail: (recordId: number) =>
      ["inventory-records", "disposal-detail", { recordId }] as const,
  },
  // UI-01a 商品検索・一覧
  // 設計: docs/function-design/50-ui-product-list.md §50.5
  productList: {
    root: () => ["product-list"] as const,
    search: (search: object) => ["product-list", "search", search] as const,
    departments: () => ["product-list", "departments"] as const,
  },
  // UI-01b 商品登録・修正
  productForm: {
    product: (productCode: string) => ["product-form", "product", { productCode }] as const,
    suppliers: () => ["product-form", "suppliers"] as const,
  },
  // UI-02 入庫記録
  // 設計: docs/function-design/61-ui-receiving.md §61.7
  receivings: {
    root: () => ["receivings"] as const,
    recent: () => ["receivings", "recent", { page: 1, perPage: 10 }] as const,
  },
  // UI-03 返品・交換
  // 設計: docs/function-design/63-ui-return-exchange.md §63.7
  returns: {
    root: () => ["returns"] as const,
    recent: () => ["returns", "recent", { page: 1, perPage: 10 }] as const,
  },
  // UI-05 廃棄・破損
  // 設計: docs/function-design/64-ui-disposal.md §64.7
  disposals: {
    root: () => ["disposals"] as const,
    recent: () => ["disposals", "recent", { page: 1, perPage: 10 }] as const,
  },
  // UI-11b バックアップ・復元
  backupRestore: {
    settings: () => ["backup-restore", "settings"] as const,
    list: () => ["backup-restore", "list"] as const,
    effectiveDir: () => ["backup-restore", "effective-dir"] as const,
  },
  // UI-11a 閾値設定（在庫少の基準）
  // 設計: docs/function-design/69-ui-threshold-settings.md §69.10
  thresholdSettings: {
    settings: () => ["threshold-settings", "settings"] as const,
  },
  // UI-10 棚卸し
  // 設計: docs/function-design/73-ui-stocktake.md §73.11
  stocktake: {
    status: () => ["stocktake", "status"] as const,
    itemsRoot: () => ["stocktake", "items"] as const,
    items: (stocktakeId: number, search: object) =>
      ["stocktake", "items", { stocktakeId, ...search }] as const,
    departments: () => ["stocktake", "departments"] as const,
    lastCompleted: () => ["stocktake", "last-completed"] as const,
  },
} as const;
