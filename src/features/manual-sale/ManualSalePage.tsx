// src/features/manual-sale/ManualSalePage.tsx
//
// UI-04 手動販売出庫 page。設計: docs/function-design/62-ui-manual-sale.md

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, Hand, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/patterns/EmptyState";
import { PageHeader } from "@/components/patterns/PageHeader";
import { formatDateTime, formatRecordStatus } from "@/features/inventory-records/types";
import { commands, type ManualSaleCreateResult, type ProductWithRelations } from "@/lib/bindings";
import { invalidateByContract, invalidationContract } from "@/lib/invalidation-contract";
import { isInvokeError, toCmdError, unwrapResult } from "@/lib/invoke";
import { scrollPageToTop } from "@/lib/page-scroll";
import { queryKeys } from "@/lib/query-keys";
import {
  addProductToManualSaleRows,
  removeManualSaleRow,
  updateManualSaleRow,
} from "./lib/manual-sale-row-utils";
import {
  buildManualSaleRequest,
  buildManualSaleSignature,
  createManualSaleIdempotencyKey,
  getLocalDateString,
} from "./lib/manual-sale-request";
import type {
  ManualSaleFormErrors,
  ManualSaleFormValues,
  ManualSaleReason,
  PluConfirmationState,
  ProductCandidate,
} from "./types";

const PRODUCT_SEARCH_QUERY = {
  department_id: null,
  is_discontinued: false,
  sort_key: "ProductCode" as const,
  sort_order: "Asc" as const,
  page: 1,
  per_page: 10,
};

const RECENT_MANUAL_SALES_QUERY = {
  record_type: "manual_sale",
  date_from: null,
  date_to: null,
  record_id: null,
  product_keyword: null,
  department_id: null,
  status: null,
  page: 1,
  per_page: 5,
} as const;

const REASON_LABELS: Record<ManualSaleReason, string> = {
  plu_unregistered: "PLU未登録商品の販売",
  other: "その他",
};

function createEmptyForm(): ManualSaleFormValues {
  return {
    saleDate: getLocalDateString(),
    reason: "plu_unregistered",
    note: "",
    rows: [],
  };
}

function formatQuantity(value: number, unit: string): string {
  return `${value.toLocaleString()} ${unit}`;
}

function rowErrorSignature(row: ManualSaleFormValues["rows"][number]): string {
  return JSON.stringify({
    productCode: row.productCode,
    quantity: row.quantity,
    amount: row.amount,
  });
}

function clearStaleRowErrors(
  errors: ManualSaleFormErrors,
  prevValues: ManualSaleFormValues,
  nextValues: ManualSaleFormValues,
): ManualSaleFormErrors {
  const nextErrors = { ...errors };
  if (errors.rows !== undefined) {
    const prevSignatures = new Map(
      prevValues.rows.map((row) => [row.productCode, rowErrorSignature(row)]),
    );
    const nextSignatures = new Map(
      nextValues.rows.map((row) => [row.productCode, rowErrorSignature(row)]),
    );
    const retainedRows = Object.fromEntries(
      Object.entries(errors.rows).filter(([productCode]) => {
        const prevSignature = prevSignatures.get(productCode);
        return prevSignature !== undefined && nextSignatures.get(productCode) === prevSignature;
      }),
    );
    if (Object.keys(retainedRows).length > 0) nextErrors.rows = retainedRows;
    else delete nextErrors.rows;
  }
  if (nextValues.rows.length > 0) delete nextErrors.items;
  return nextErrors;
}

export function ManualSalePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<ManualSaleFormValues>(createEmptyForm);
  const [errors, setErrors] = useState<ManualSaleFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ProductCandidate[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState(createManualSaleIdempotencyKey);
  const [failedSignature, setFailedSignature] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<PluConfirmationState | null>(null);
  const [result, setResult] = useState<ManualSaleCreateResult | null>(null);

  const recentQuery = useQuery({
    queryKey: queryKeys.inventoryRecords.list({
      recordType: "manual_sale",
      page: 1,
      perPage: 5,
    }),
    queryFn: () =>
      unwrapResult(commands.listInventoryRecords(RECENT_MANUAL_SALES_QUERY), {
        source: "commands",
        cmd: "list_inventory_records",
      }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 0,
  });

  const createMutation = useMutation({
    mutationFn: async (confirmationToken: string | null) => {
      const built = buildManualSaleRequest(values, idempotencyKey, confirmationToken);
      setErrors(built.errors);
      if (built.request === null) throw new Error("validation");
      setFailedSignature(built.signature);
      return unwrapResult(commands.createManualSale(built.request), {
        source: "commands",
        cmd: "create_manual_sale",
      });
    },
    onSuccess: async (data) => {
      scrollPageToTop();
      setSaveError(null);
      if (data.needs_confirmation) {
        if (data.confirmation_token === null) {
          setSaveError("確認トークンを取得できませんでした。明細を見直して再実行してください。");
          return;
        }
        setConfirmation({ token: data.confirmation_token, warnings: data.plu_warnings });
        setResult(null);
        return;
      }

      setResult(data);
      setConfirmation(null);
      setFailedSignature(null);
      setIdempotencyKey(createManualSaleIdempotencyKey());
      toast.success("手動販売を保存しました", { id: "manual-sale-save-success" });
      await invalidateByContract(queryClient, invalidationContract.manualSale(values.saleDate));
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "validation") return;
      scrollPageToTop();
      const cmdError = isInvokeError(error) ? error.cmdError : toCmdError(error);
      setSaveError(cmdError.message);
    },
  });

  const isSaving = createMutation.isPending;
  const isFormLocked = isSaving || result !== null;
  const canSubmit = values.rows.length > 0 && values.saleDate.trim() !== "" && !isFormLocked;

  useEffect(() => {
    if (confirmation !== null) {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [confirmation]);

  function updateValues(updater: (prev: ManualSaleFormValues) => ManualSaleFormValues) {
    setValues((prev) => {
      const next = updater(prev);
      setErrors((current) => clearStaleRowErrors(current, prev, next));
      if (confirmation !== null) {
        setConfirmation(null);
        setIdempotencyKey(createManualSaleIdempotencyKey());
        setFailedSignature(null);
      } else if (failedSignature !== null && buildManualSaleSignature(next) !== failedSignature) {
        setIdempotencyKey(createManualSaleIdempotencyKey());
        setFailedSignature(null);
      }
      return next;
    });
    setResult(null);
  }

  function addProduct(product: ProductWithRelations) {
    if (isFormLocked) return;
    updateValues((prev) => ({ ...prev, rows: addProductToManualSaleRows(prev.rows, product) }));
    setSearchText("");
    setCandidates([]);
    setSearchMessage(null);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  async function handleProductSearch() {
    const keyword = searchText.trim();
    if (keyword === "" || isFormLocked) return;
    setSearchMessage(null);
    setCandidates([]);
    try {
      const products = await unwrapResult(
        commands.searchProducts({ ...PRODUCT_SEARCH_QUERY, keyword }),
        {
          source: "commands",
          cmd: "search_products",
        },
      );
      if (products.items.length === 0) {
        setSearchMessage("該当する商品がありません");
        return;
      }
      if (products.items.length === 1) {
        addProduct(products.items[0]);
        return;
      }
      setCandidates(products.items);
      setSearchMessage("候補から手動販売する商品を選んでください");
    } catch (error) {
      const cmdError = isInvokeError(error) ? error.cmdError : toCmdError(error);
      setSearchMessage(cmdError.message);
    }
  }

  function resetForm() {
    setValues(createEmptyForm());
    setErrors({});
    setSaveError(null);
    setSearchText("");
    setSearchMessage(null);
    setCandidates([]);
    setConfirmation(null);
    setFailedSignature(null);
    setResult(null);
    setIdempotencyKey(createManualSaleIdempotencyKey());
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function submitCurrentForm() {
    setSaveError(null);
    createMutation.mutate(confirmation?.token ?? null);
  }

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="手動販売出庫"
        subtitle="レジCSVに入らない販売を手入力し、在庫と売上へ反映します"
        actions={
          !isFormLocked ? (
            <Button asChild variant="outline">
              <Link to="/stock">
                <ArrowLeft aria-hidden="true" />
                在庫照会へ戻る
              </Link>
            </Button>
          ) : null
        }
      />

      {saveError !== null ? (
        <Alert variant="destructive">
          <AlertTitle>保存に失敗しました</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      ) : null}

      {confirmation !== null ? (
        <Alert>
          <AlertTitle>PLU登録済みの商品があります</AlertTitle>
          <AlertDescription>
            {/* Alert 直下の生要素は grid-cols-[0_1fr] の幅0px列に落ちるため、
                リストは AlertDescription 内に置く（memory: shadcn-alert-grid-raw-children-pitfall） */}
            レジで打てる商品を手動販売として保存するため、二重記録にならないことを確認してから保存します。
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {confirmation.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {result !== null ? (
        <section className="space-y-3 rounded-md border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">手動販売を保存しました</h2>
            {result.idempotent_replay ? <Badge variant="outline">再送結果</Badge> : null}
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground">記録ID</span>
              <div className="font-medium">{result.sale_id ?? "-"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">明細数</span>
              <div className="font-medium">{values.rows.length} 件</div>
            </div>
            <div>
              <span className="text-muted-foreground">PLU警告</span>
              <div className="font-medium">{result.plu_warnings.length} 件</div>
            </div>
            <div>
              <span className="text-muted-foreground">在庫警告</span>
              <div className="font-medium">{result.stock_warnings.length} 件</div>
            </div>
          </div>
          {result.plu_warnings.length > 0 || result.stock_warnings.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {[...result.plu_warnings, ...result.stock_warnings].map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={resetForm}>
              <RotateCcw aria-hidden="true" />
              続けて手動販売
            </Button>
            {result.sale_id !== null ? (
              <Button asChild type="button" variant="outline">
                <Link
                  to="/inventory/manual-sale/records/$recordId"
                  params={{ recordId: String(result.sale_id) }}
                >
                  <Eye aria-hidden="true" />
                  詳細を見る
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigate({ to: "/reports/daily", search: { date: values.saleDate } });
              }}
            >
              日次売上へ
            </Button>
            <Button asChild type="button" variant="outline">
              <Link to="/stock">
                <ArrowLeft aria-hidden="true" />
                在庫照会へ戻る
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      <section className="space-y-4 rounded-md border p-4">
        <h2 className="text-lg font-semibold">販売内容</h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]">
          <div className="space-y-2">
            <Label htmlFor="manual-sale-date">販売日</Label>
            <Input
              id="manual-sale-date"
              type="date"
              value={values.saleDate}
              disabled={isFormLocked}
              aria-invalid={errors.saleDate !== undefined}
              onChange={(event) => {
                updateValues((prev) => ({ ...prev, saleDate: event.target.value }));
              }}
            />
            {errors.saleDate !== undefined ? (
              <p className="text-sm text-destructive">{errors.saleDate}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-sale-reason">理由</Label>
            <select
              id="manual-sale-reason"
              value={values.reason}
              disabled={isFormLocked}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) => {
                updateValues((prev) => ({
                  ...prev,
                  reason: event.target.value as ManualSaleReason,
                }));
              }}
            >
              <option value="plu_unregistered">{REASON_LABELS.plu_unregistered}</option>
              <option value="other">{REASON_LABELS.other}</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="manual-sale-note">備考</Label>
          <Input
            id="manual-sale-note"
            value={values.note}
            disabled={isFormLocked}
            maxLength={200}
            onChange={(event) => {
              updateValues((prev) => ({ ...prev, note: event.target.value }));
            }}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-md border p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[18rem] flex-1 space-y-2">
            <Label htmlFor="manual-sale-product-search">商品追加</Label>
            <Input
              ref={searchInputRef}
              id="manual-sale-product-search"
              value={searchText}
              disabled={isFormLocked}
              placeholder="商品コード・JAN・商品名を入力"
              aria-label="手動販売商品検索"
              onChange={(event) => {
                setSearchText(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleProductSearch();
                }
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={isFormLocked}
            onClick={() => {
              void handleProductSearch();
            }}
          >
            <Search aria-hidden="true" />
            追加
          </Button>
        </div>

        {searchMessage !== null ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{searchMessage}</span>
            {searchMessage === "該当する商品がありません" ? (
              <>
                <span>
                  未登録商品の場合は、商品マスタに登録してから手動販売へ戻って追加します。
                </span>
                {values.rows.length > 0 ? (
                  <span className="text-destructive">
                    未保存の手動販売内容があります。商品登録へ進むとこの画面の入力は残りません。
                  </span>
                ) : null}
                {!isFormLocked ? (
                  <Button asChild variant="link" className="h-auto p-0">
                    <Link to="/products/new">商品登録へ進む</Link>
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {candidates.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品コード</TableHead>
                  <TableHead>商品名</TableHead>
                  <TableHead>部門</TableHead>
                  <TableHead>現在庫</TableHead>
                  <TableHead>売価</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => (
                  <TableRow key={candidate.product_code}>
                    <TableCell className="font-medium">{candidate.product_code}</TableCell>
                    <TableCell>{candidate.name}</TableCell>
                    <TableCell>{candidate.department_name}</TableCell>
                    <TableCell>
                      {formatQuantity(candidate.stock_quantity, candidate.stock_unit)}
                    </TableCell>
                    <TableCell>¥{candidate.selling_price.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        disabled={isFormLocked}
                        onClick={() => {
                          addProduct(candidate);
                        }}
                      >
                        <Hand aria-hidden="true" />
                        手動販売に追加
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {errors.items !== undefined ? (
          <p className="text-sm text-destructive">{errors.items}</p>
        ) : null}

        {values.rows.length === 0 ? (
          <EmptyState
            title="手動販売する商品がありません"
            description="商品コード・JAN・商品名で検索して明細を追加してください"
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品コード</TableHead>
                  <TableHead>商品名</TableHead>
                  <TableHead>部門</TableHead>
                  <TableHead>現在庫</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>販売金額</TableHead>
                  <TableHead>単位</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {values.rows.map((row) => (
                  <TableRow key={row.productCode}>
                    <TableCell className="font-medium">{row.productCode}</TableCell>
                    <TableCell>{row.productName}</TableCell>
                    <TableCell>{row.departmentName}</TableCell>
                    <TableCell>{formatQuantity(row.currentStockQuantity, row.stockUnit)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={row.quantity}
                        disabled={isFormLocked}
                        aria-label={`${row.productCode} の数量`}
                        aria-invalid={errors.rows?.[row.productCode] !== undefined}
                        className="w-24"
                        onChange={(event) => {
                          updateValues((prev) => ({
                            ...prev,
                            rows: updateManualSaleRow(prev.rows, row.productCode, {
                              quantity: event.target.value,
                            }),
                          }));
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={row.amount}
                        disabled={isFormLocked}
                        aria-label={`${row.productCode} の販売金額`}
                        aria-invalid={errors.rows?.[row.productCode] !== undefined}
                        className="w-32"
                        onChange={(event) => {
                          updateValues((prev) => ({
                            ...prev,
                            rows: updateManualSaleRow(prev.rows, row.productCode, {
                              amount: event.target.value,
                            }),
                          }));
                        }}
                      />
                    </TableCell>
                    <TableCell>{row.stockUnit}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={isFormLocked}
                        aria-label={`${row.productCode} を削除`}
                        onClick={() => {
                          updateValues((prev) => ({
                            ...prev,
                            rows: removeManualSaleRow(prev.rows, row.productCode),
                          }));
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {errors.rows !== undefined ? (
              <div className="space-y-1 border-t p-3 text-sm text-destructive">
                {Object.entries(errors.rows).map(([productCode, message]) => (
                  <p key={productCode}>
                    {productCode}: {message}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={isFormLocked} onClick={resetForm}>
            <RotateCcw aria-hidden="true" />
            リセット
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={submitCurrentForm}>
            <Hand aria-hidden="true" />
            {isSaving ? "保存中..." : confirmation !== null ? "確認して保存" : "手動販売を保存"}
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">直近の手動販売出庫</h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/inventory/records" search={{ recordType: "manual_sale" }}>
              すべての履歴を見る
            </Link>
          </Button>
        </div>

        {recentQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : recentQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>直近の手動販売出庫を取得できませんでした</AlertTitle>
            <AlertDescription>
              入力中の内容はそのままです。保存や商品追加は続けられます。
            </AlertDescription>
          </Alert>
        ) : recentQuery.data?.items.length === 0 ? (
          <EmptyState
            title="直近の手動販売出庫はありません"
            description="保存するとここに表示されます"
          />
        ) : recentQuery.data ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>販売日</TableHead>
                  <TableHead>記録ID</TableHead>
                  <TableHead>代表商品</TableHead>
                  <TableHead className="text-right">明細数</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>記録日時</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentQuery.data.items.map((record) => (
                  <TableRow key={record.record_id}>
                    <TableCell>{record.business_date}</TableCell>
                    <TableCell className="font-mono tabular-nums">
                      #{String(record.record_id)}
                    </TableCell>
                    <TableCell className="min-w-[12rem] whitespace-normal">
                      {record.representative_item}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{record.item_count}</TableCell>
                    <TableCell>{formatRecordStatus(record.status)}</TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {formatDateTime(record.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link
                          to="/inventory/manual-sale/records/$recordId"
                          params={{ recordId: String(record.record_id) }}
                        >
                          <Eye aria-hidden="true" />
                          詳細を見る
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
