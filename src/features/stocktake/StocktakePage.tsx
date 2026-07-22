import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RotateCcw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DepartmentFilter } from "@/components/patterns/DepartmentFilter";
import { EmptyState } from "@/components/patterns/EmptyState";
import { FormSection } from "@/components/patterns/FormSection";
import { PageHeader } from "@/components/patterns/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  commands,
  type LastStocktakeSummary,
  type ProductWithRelations,
  type StocktakeItemDetail,
  type StocktakeResult,
} from "@/lib/bindings";
import { isInvokeError, unwrapResult } from "@/lib/invoke";
import { invalidateByContract, invalidationContract } from "@/lib/invalidation-contract";
import { queryKeys } from "@/lib/query-keys";

import { useCompleteStocktake } from "./hooks/useCompleteStocktake";
import {
  computeListDifference,
  formatCountedAt,
  formatListDifference,
} from "./lib/stocktake-formatters";
import { useFindStocktakeItem } from "./hooks/useFindStocktakeItem";
import { useLastCompletedStocktake } from "./hooks/useLastCompletedStocktake";
import { useStocktakeItems } from "./hooks/useStocktakeItems";
import { useStocktakeStatus } from "./hooks/useStocktakeStatus";
import { useUpdateCount } from "./hooks/useUpdateCount";
import {
  refreshStocktakeItemsAfterValidation,
  refreshStocktakeStateAfterConflict,
} from "./stocktake-error-invalidation";
import type { StocktakeSearch } from "./types";

interface StocktakePageProps {
  search: StocktakeSearch;
  onSearchChange: (updater: (prev: StocktakeSearch) => StocktakeSearch) => void;
}

function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function formatLastStocktake(last: LastStocktakeSummary | null | undefined): string {
  if (!last) {
    return "前回の記録はありません";
  }
  return `前回の棚卸し（${formatCountedAt(last.completed_at)}）: 仕入原価総額 ${formatYen(last.total_cost)}`;
}

function describeError(error: unknown): string {
  if (isInvokeError(error)) return error.cmdError.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

function isStocktakeNotInProgressError(error: unknown): boolean {
  return isInvokeError(error) && error.cmdError.kind === "stocktake_not_in_progress";
}

const STOCKTAKE_NOT_IN_PROGRESS_MESSAGE = "この棚卸しは既に完了しています";

const PRODUCT_NAME_SEARCH_QUERY = {
  department_id: null,
  is_discontinued: false,
  sort_key: "ProductCode" as const,
  sort_order: "Asc" as const,
  page: 1,
  per_page: 10,
};

export function StocktakePage({ search, onSearchChange }: StocktakePageProps) {
  const queryClient = useQueryClient();
  const stocktakeStatus = useStocktakeStatus();
  const activeStocktakeId = stocktakeStatus.activeStocktakeId;
  const [effectiveSearch, setEffectiveSearch] = useState<StocktakeSearch>(search);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [completedResult, setCompletedResult] = useState<StocktakeResult | null>(null);
  const [lastStocktakeSnapshot, setLastStocktakeSnapshot] = useState<
    LastStocktakeSummary | null | undefined
  >(undefined);

  useEffect(() => {
    setEffectiveSearch(search);
  }, [search]);

  const departmentsQuery = useQuery({
    queryKey: queryKeys.stocktake.departments(),
    queryFn: () =>
      unwrapResult(commands.listDepartments(), { source: "commands", cmd: "list_departments" }),
  });
  const lastCompletedQuery = useLastCompletedStocktake();
  const itemsQuery = useStocktakeItems(activeStocktakeId, effectiveSearch);
  const findMutation = useFindStocktakeItem();
  const updateMutation = useUpdateCount();
  const completeMutation = useCompleteStocktake();

  const isCompleting = completeMutation.isPending;
  const itemsData = itemsQuery.data;
  const progress = itemsData?.progress ?? { total_items: 0, counted_items: 0, uncounted_items: 0 };

  useEffect(() => {
    if (!itemsQuery.isError || !isStocktakeNotInProgressError(itemsQuery.error)) return;
    setErrorMessage(STOCKTAKE_NOT_IN_PROGRESS_MESSAGE);
    void refreshStocktakeStateAfterConflict(queryClient);
  }, [itemsQuery.error, itemsQuery.isError, queryClient]);

  function updateSearch(updater: (prev: StocktakeSearch) => StocktakeSearch) {
    setEffectiveSearch((prev) => updater(prev));
    onSearchChange(updater);
  }

  async function handleStart() {
    if (isStarting) return;
    setErrorMessage(null);
    setIsStarting(true);
    try {
      await unwrapResult(commands.startStocktake(), {
        source: "commands",
        cmd: "start_stocktake",
      });
      await invalidateByContract(queryClient, invalidationContract.stocktakeStart());
    } catch (error) {
      if (isInvokeError(error) && error.cmdError.kind === "stocktake_in_progress") {
        await refreshStocktakeStateAfterConflict(queryClient);
        return;
      }
      setErrorMessage(describeError(error));
    } finally {
      setIsStarting(false);
    }
  }

  async function handleCompleteConfirm(forceFill: boolean) {
    if (activeStocktakeId === null) return;
    setErrorMessage(null);
    setIsConfirmOpen(false);
    try {
      const result = await completeMutation.mutateAsync({
        stocktakeId: activeStocktakeId,
        forceFill,
      });
      setLastStocktakeSnapshot(lastCompletedQuery.data);
      setCompletedResult(result);
      await invalidateByContract(queryClient, invalidationContract.stocktakeComplete());
    } catch (error) {
      if (isStocktakeNotInProgressError(error)) {
        setErrorMessage(STOCKTAKE_NOT_IN_PROGRESS_MESSAGE);
        await refreshStocktakeStateAfterConflict(queryClient);
        return;
      }
      // validation エラー（force_fill 未入力超過等）は一覧を invalidate し、
      // 次回の確定操作で最新の uncounted_items に基づいた判定ができるようにする
      void refreshStocktakeItemsAfterValidation(queryClient);
      setErrorMessage(describeError(error));
    }
  }

  if (completedResult !== null) {
    return <StocktakeResultPage result={completedResult} lastStocktake={lastStocktakeSnapshot} />;
  }

  return (
    <div className="min-h-screen space-y-6 p-6">
      <PageHeader
        title="棚卸し"
        subtitle="商品コードまたはJANを読み取り、実際の在庫数を入力します"
      />

      {errorMessage !== null ? (
        <Alert variant="destructive">
          <AlertTitle>操作できませんでした</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {stocktakeStatus.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : stocktakeStatus.isError ? (
        <Alert variant="destructive">
          <AlertTitle>棚卸し状態を読み込めませんでした</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{describeError(stocktakeStatus.error)}</p>
            <Button type="button" variant="outline" onClick={() => void stocktakeStatus.refetch()}>
              <RotateCcw />
              再試行
            </Button>
          </AlertDescription>
        </Alert>
      ) : activeStocktakeId === null ? (
        <StocktakeStartPanel
          lastStocktake={lastCompletedQuery.data}
          isLoadingLast={lastCompletedQuery.isLoading}
          isStarting={isStarting}
          onStart={() => void handleStart()}
        />
      ) : (
        <div className="space-y-6">
          <StocktakeProgressHeader
            startedAt={stocktakeStatus.activeStocktake?.started_at ?? ""}
            progress={progress}
          />

          {itemsQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : null}

          {itemsQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>棚卸し一覧を読み込めませんでした</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>もう一度読み込んでください。</p>
                <Button type="button" variant="outline" onClick={() => void itemsQuery.refetch()}>
                  <RotateCcw />
                  再試行
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <StocktakeCountEntry
            stocktakeId={activeStocktakeId}
            disabled={isCompleting}
            findMutation={findMutation}
            updateMutation={updateMutation}
            onError={setErrorMessage}
            onUpdated={() =>
              void invalidateByContract(queryClient, invalidationContract.stocktakeCountUpdate())
            }
          />

          <StocktakeItemList
            items={itemsData?.items ?? []}
            departments={departmentsQuery.data ?? []}
            search={effectiveSearch}
            disabled={isCompleting}
            totalCount={itemsData?.total_count ?? 0}
            onSearchChange={updateSearch}
          />

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={isCompleting}
              onClick={() => {
                setIsConfirmOpen(true);
              }}
            >
              {isCompleting ? <Loader2 className="animate-spin" /> : <ClipboardCheck />}
              棚卸しを確定する
            </Button>
          </div>

          {isCompleting ? (
            <p className="text-sm text-muted-foreground" role="status">
              確定しています
            </p>
          ) : null}

          <StocktakeCompleteDialog
            open={isConfirmOpen}
            uncountedItems={progress.uncounted_items}
            isCompleting={isCompleting}
            onOpenChange={setIsConfirmOpen}
            onConfirm={(forceFill) => void handleCompleteConfirm(forceFill)}
          />
        </div>
      )}
    </div>
  );
}

interface StocktakeStartPanelProps {
  lastStocktake: LastStocktakeSummary | null | undefined;
  isLoadingLast: boolean;
  isStarting: boolean;
  onStart: () => void;
}

export function StocktakeStartPanel({
  lastStocktake,
  isLoadingLast,
  isStarting,
  onStart,
}: StocktakeStartPanelProps) {
  return (
    <FormSection
      title="棚卸しの開始"
      description="開始すると、現在の商品マスタから棚卸し対象を作成します"
    >
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">前回の棚卸し</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingLast ? (
              <Skeleton className="h-5 w-72" />
            ) : (
              <p>{formatLastStocktake(lastStocktake)}</p>
            )}
          </CardContent>
        </Card>
        <Button type="button" onClick={onStart} disabled={isStarting}>
          {isStarting ? <Loader2 className="animate-spin" /> : <ClipboardCheck />}
          棚卸しを開始する
        </Button>
      </div>
    </FormSection>
  );
}

interface StocktakeProgressHeaderProps {
  startedAt: string;
  progress: { total_items: number; counted_items: number; uncounted_items: number };
}

export function StocktakeProgressHeader({ startedAt, progress }: StocktakeProgressHeaderProps) {
  const percent =
    progress.total_items > 0 ? (progress.counted_items / progress.total_items) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            棚卸し中（開始日: {formatCountedAt(startedAt)}）
          </h2>
          <p className="text-sm text-muted-foreground">
            入力済み {progress.counted_items} / 全 {progress.total_items}
          </p>
        </div>
        <Badge variant="secondary">未入力 {progress.uncounted_items}</Badge>
      </div>
      <Progress value={percent} aria-label="棚卸し進捗" />
    </div>
  );
}

interface StocktakeCountEntryProps {
  stocktakeId: number;
  disabled: boolean;
  findMutation: ReturnType<typeof useFindStocktakeItem>;
  updateMutation: ReturnType<typeof useUpdateCount>;
  onError: (message: string | null) => void;
  onUpdated: () => void;
}

export function StocktakeCountEntry({
  stocktakeId,
  disabled,
  findMutation,
  updateMutation,
  onError,
  onUpdated,
}: StocktakeCountEntryProps) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [selectedItem, setSelectedItem] = useState<StocktakeItemDetail | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [targetMessage, setTargetMessage] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ProductWithRelations[]>([]);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    codeInputRef.current?.focus();
  }, []);

  function selectItem(item: StocktakeItemDetail) {
    setSelectedItem(item);
    setQuantity(item.actual_count === null ? "" : String(item.actual_count));
    setCandidates([]);
    setTargetMessage(null);
    window.setTimeout(() => quantityInputRef.current?.focus(), 0);
  }

  async function resolveItem() {
    const trimmed = code.trim();
    if (trimmed.length === 0 || disabled) return;
    setFieldError(null);
    setTargetMessage(null);
    setCandidates([]);
    onError(null);
    try {
      const item = await findMutation.mutateAsync({ stocktakeId, code: trimmed });
      if (item !== null) {
        selectItem(item);
        return;
      }
      // 商品コード/JAN の完全一致で見つからない場合、商品名検索にフォールバックする（UI-10-D2/§73.5）
      const products = await unwrapResult(
        commands.searchProducts({ ...PRODUCT_NAME_SEARCH_QUERY, keyword: trimmed }),
        { source: "commands", cmd: "search_products" },
      );
      if (products.items.length === 0) {
        setSelectedItem(null);
        setQuantity("");
        setTargetMessage(
          "この商品は棚卸しの対象にありません。商品コードまたはJANを確認してください。新しく登録した商品は自動で追加されます",
        );
        return;
      }
      if (products.items.length === 1) {
        const resolved = await findMutation.mutateAsync({
          stocktakeId,
          code: products.items[0].product_code,
        });
        if (resolved !== null) selectItem(resolved);
        return;
      }
      setCandidates(products.items);
    } catch (error) {
      onError(describeError(error));
    }
  }

  async function selectCandidate(productCode: string) {
    if (disabled) return;
    onError(null);
    try {
      const resolved = await findMutation.mutateAsync({ stocktakeId, code: productCode });
      if (resolved !== null) selectItem(resolved);
    } catch (error) {
      onError(describeError(error));
    }
  }

  async function saveCount() {
    if (selectedItem === null || disabled) return;
    const actualCount = Number(quantity);
    if (!Number.isInteger(actualCount) || actualCount < 0) {
      setFieldError("0以上の数値を入力してください");
      return;
    }
    setFieldError(null);
    onError(null);
    try {
      await updateMutation.mutateAsync({
        stocktakeItemId: selectedItem.id,
        actualCount,
      });
      setCode("");
      setQuantity("");
      setSelectedItem(null);
      onUpdated();
      window.setTimeout(() => codeInputRef.current?.focus(), 0);
    } catch (error) {
      if (isStocktakeNotInProgressError(error)) {
        onError(STOCKTAKE_NOT_IN_PROGRESS_MESSAGE);
        void refreshStocktakeStateAfterConflict(queryClient);
        return;
      }
      onError(describeError(error));
    }
  }

  return (
    <FormSection
      title="カウント入力"
      description="商品コードまたはJANを読み取り、実際の数を保存します"
    >
      <fieldset
        disabled={disabled}
        className="grid gap-4 disabled:opacity-70 md:grid-cols-[1fr_auto]"
      >
        <div className="space-y-2">
          <Label htmlFor="stocktake-code">商品を検索・スキャン</Label>
          <Input
            id="stocktake-code"
            ref={codeInputRef}
            value={code}
            placeholder="商品コード・JAN・商品名を入力"
            onChange={(event) => {
              setCode(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter") {
                event.preventDefault();
                void resolveItem();
              }
            }}
          />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="outline" onClick={() => void resolveItem()}>
            {findMutation.isPending ? <Loader2 className="animate-spin" /> : <Search />}
            対象を確認
          </Button>
        </div>
      </fieldset>

      {targetMessage !== null ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {targetMessage}
        </p>
      ) : null}

      {candidates.length > 0 ? (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-muted-foreground">候補から商品を選んでください</p>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品コード</TableHead>
                  <TableHead>商品名</TableHead>
                  <TableHead>部門</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => (
                  <TableRow key={candidate.product_code}>
                    <TableCell className="font-medium">{candidate.product_code}</TableCell>
                    <TableCell>{candidate.name}</TableCell>
                    <TableCell>{candidate.department_name}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        disabled={disabled}
                        onClick={() => void selectCandidate(candidate.product_code)}
                      >
                        選択
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {selectedItem !== null ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_12rem_auto]">
          <div>
            <p className="font-medium">{selectedItem.name}</p>
            <p className="text-sm text-muted-foreground">
              {selectedItem.product_code} / {selectedItem.department_name} / 現在在庫{" "}
              {selectedItem.current_stock}
            </p>
            {selectedItem.actual_count !== null ? (
              <p className="text-sm text-muted-foreground">入力済みの数を上書きできます</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="stocktake-actual-count">実際の数</Label>
            <Input
              id="stocktake-actual-count"
              ref={quantityInputRef}
              value={quantity}
              inputMode="numeric"
              disabled={disabled}
              onChange={(event) => {
                setQuantity(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveCount();
                }
              }}
            />
            {fieldError !== null ? (
              <p className="text-sm text-destructive" role="alert">
                {fieldError}
              </p>
            ) : null}
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              disabled={disabled || updateMutation.isPending}
              onClick={() => void saveCount()}
            >
              {updateMutation.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              数を保存
            </Button>
          </div>
        </div>
      ) : null}
    </FormSection>
  );
}

interface StocktakeItemListProps {
  items: StocktakeItemDetail[];
  departments: { id: number; name: string }[];
  search: StocktakeSearch;
  disabled: boolean;
  totalCount: number;
  onSearchChange: (updater: (prev: StocktakeSearch) => StocktakeSearch) => void;
}

export function StocktakeItemList({
  items,
  departments,
  search,
  disabled,
  totalCount,
  onSearchChange,
}: StocktakeItemListProps) {
  const page = search.page ?? 1;
  const pageCount = Math.max(1, Math.ceil(totalCount / 200));

  return (
    <FormSection
      title="棚卸し一覧"
      description="一覧は進捗確認用です。カウント入力は上の入力欄で行います"
    >
      <div className="flex flex-wrap items-center gap-4">
        <DepartmentFilter
          options={departments}
          selected={search.dept ?? null}
          disabled={disabled}
          idPrefix="stocktake-dept-filter"
          onChange={(dept) => {
            onSearchChange((prev) => ({ ...prev, dept: dept ?? undefined, page: 1 }));
          }}
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="stocktake-uncounted-only"
            checked={search.counted_only === false}
            disabled={disabled}
            onCheckedChange={(checked) => {
              onSearchChange((prev) => ({
                ...prev,
                counted_only: checked === true ? false : undefined,
                page: 1,
              }));
            }}
          />
          <Label htmlFor="stocktake-uncounted-only">未入力のみ表示</Label>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="この条件に一致する商品がありません"
          description="部門フィルタまたは未入力のみ表示を解除してください"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>商品コード</TableHead>
              <TableHead>商品名</TableHead>
              <TableHead>部門</TableHead>
              <TableHead className="text-right">現在在庫</TableHead>
              <TableHead className="text-right">実際の数</TableHead>
              <TableHead className="text-right">差異</TableHead>
              <TableHead>最終カウント</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.product_code}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.department_name}</TableCell>
                <TableCell className="text-right">{item.current_stock}</TableCell>
                <TableCell className="text-right">{item.actual_count ?? "未入力"}</TableCell>
                <TableCell className="text-right">
                  {formatListDifference(computeListDifference(item))}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatCountedAt(item.counted_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || page <= 1}
          onClick={() => {
            onSearchChange((prev) => ({ ...prev, page: Math.max(1, page - 1) }));
          }}
        >
          前へ
        </Button>
        <span className="text-sm text-muted-foreground">
          {page} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || page >= pageCount}
          onClick={() => {
            onSearchChange((prev) => ({ ...prev, page: page + 1 }));
          }}
        >
          次へ
        </Button>
      </div>
    </FormSection>
  );
}

interface StocktakeCompleteDialogProps {
  open: boolean;
  uncountedItems: number;
  isCompleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (forceFill: boolean) => void;
}

export function StocktakeCompleteDialog({
  open,
  uncountedItems,
  isCompleting,
  onOpenChange,
  onConfirm,
}: StocktakeCompleteDialogProps) {
  const hasUncounted = uncountedItems > 0;
  const warningTitle = "確定すると取り消せません";
  const bodyText = hasUncounted
    ? `${String(uncountedItems)}件が未入力のまま残っています。確定すると、この${String(uncountedItems)}件は現在の在庫数で棚卸しされます。`
    : "入力した内容で棚卸しを確定します。";
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {hasUncounted ? "未入力の商品があります" : "棚卸しの確定"}
          </AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            {warningTitle}。{bodyText}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Alert className="border-warning bg-warning-soft text-warning-strong">
          <AlertTriangle />
          <AlertTitle>{warningTitle}</AlertTitle>
          <AlertDescription>{bodyText}</AlertDescription>
        </Alert>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCompleting}>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            disabled={isCompleting}
            onClick={() => {
              onConfirm(hasUncounted);
            }}
          >
            確定する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface StocktakeResultPageProps {
  result: StocktakeResult;
  lastStocktake: LastStocktakeSummary | null | undefined;
}

export function StocktakeResultPage({ result, lastStocktake }: StocktakeResultPageProps) {
  const adjustedItems = useMemo(() => result.adjusted_items, [result.adjusted_items]);
  return (
    <div className="min-h-screen space-y-6 p-6">
      <PageHeader title="棚卸し結果" />
      <Card>
        <CardHeader>
          <CardTitle>仕入原価総額</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{formatYen(result.total_cost)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {lastStocktake
              ? `前回の棚卸し（${formatCountedAt(lastStocktake.completed_at)}）`
              : "前回の棚卸し"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base font-semibold">
            {lastStocktake
              ? `仕入原価総額 ${formatYen(lastStocktake.total_cost)}`
              : "前回の記録はありません"}
          </p>
        </CardContent>
      </Card>

      <FormSection title="差異のあった商品">
        {adjustedItems.length === 0 ? (
          <p>差異はありませんでした</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品コード</TableHead>
                <TableHead>商品名</TableHead>
                <TableHead className="text-right">システム在庫</TableHead>
                <TableHead className="text-right">実際の数</TableHead>
                <TableHead className="text-right">差異</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustedItems.map((item) => (
                <TableRow key={item.product_code}>
                  <TableCell>{item.product_code}</TableCell>
                  <TableCell>{item.product_name}</TableCell>
                  <TableCell className="text-right">{item.system_stock}</TableCell>
                  <TableCell className="text-right">{item.actual_count}</TableCell>
                  <TableCell className="text-right">{item.difference}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </FormSection>

      <FormSection title="整合性チェック">
        {result.integrity_result === null ? (
          <p>整合性チェックは実行できませんでした</p>
        ) : (
          <p>
            {result.integrity_result.checked_count}件を確認しました。不整合{" "}
            {result.integrity_result.mismatch_count}件
          </p>
        )}
      </FormSection>
    </div>
  );
}
