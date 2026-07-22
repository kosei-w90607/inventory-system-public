// src/features/products/ProductFormPage.tsx
//
// UI-01b 商品登録・修正 page。

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/patterns/PageHeader";
import {
  commands,
  type ProductUpdateRequest_Deserialize,
  type ProductWithRelations,
} from "@/lib/bindings";
import { invalidateByContract, invalidationContract } from "@/lib/invalidation-contract";
import { isInvokeError, toCmdError, unwrapResult } from "@/lib/invoke";
import { queryKeys } from "@/lib/query-keys";
import { ProductForm } from "./components/ProductForm";
import { useProductFormOptions } from "./hooks/useProductFormOptions";
import {
  buildCreateProductRequest,
  buildUpdateProductRequest,
  createProductFormDefaults,
  productToFormValues,
  type ProductFormValues,
} from "./lib/product-form-request";
import { sanitizeProductListReturnTo } from "./lib/return-to";

export interface ProductFormPageProps {
  mode: "create" | "edit";
  productCode?: string;
  returnTo?: string;
  onNavigateToList: (returnTo: string) => void;
}

export function ProductFormPage({
  mode,
  productCode,
  returnTo,
  onNavigateToList,
}: ProductFormPageProps) {
  const queryClient = useQueryClient();
  const safeReturnTo = sanitizeProductListReturnTo(returnTo);
  const { departmentsQuery, suppliersQuery, departments, suppliers } = useProductFormOptions();
  const [values, setValues] = useState<ProductFormValues>(createProductFormDefaults);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ProductFormValues, string>>>(
    {},
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [posSyncTouched, setPosSyncTouched] = useState(false);
  const [pluTargetTouched, setPluTargetTouched] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<ProductWithRelations | null>(null);

  const productQuery = useQuery({
    queryKey: queryKeys.productForm.product(productCode ?? ""),
    queryFn: () =>
      unwrapResult(commands.getProduct(productCode ?? ""), {
        source: "commands",
        cmd: "get_product",
      }),
    enabled: mode === "edit" && productCode !== undefined,
    staleTime: 0,
    gcTime: 5 * 60_000,
    retry: 0,
  });

  useEffect(() => {
    if (mode === "create") {
      setValues(createProductFormDefaults);
      setCurrentProduct(null);
      setPluTargetTouched(false);
      return;
    }
    if (productQuery.data !== undefined) {
      setCurrentProduct(productQuery.data);
      setValues(productToFormValues(productQuery.data));
      setPluTargetTouched(false);
    }
  }, [mode, productQuery.data]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const built = buildCreateProductRequest(values, departments);
      setFormErrors(built.errors);
      if (built.request === null) throw new Error("validation");
      return unwrapResult(commands.createProduct(built.request), {
        source: "commands",
        cmd: "create_product",
      });
    },
    onSuccess: async (result) => {
      setSaveError(null);
      // UI-01b-D14: 保存成功 toast は navigate より前に発火する
      toast.success(
        `商品「${values.name.trim()}」を登録しました（商品コード: ${result.product_code}）`,
        {
          id: "product-save-success",
          duration: 5000,
        },
      );
      await invalidateByContract(queryClient, invalidationContract.productCreate());
      onNavigateToList(safeReturnTo);
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "validation") return;
      const cmdError = isInvokeError(error) ? error.cmdError : toCmdError(error);
      setSaveError(cmdError.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (currentProduct === null || productCode === undefined) {
        throw new Error("商品が見つかりません");
      }
      const built = buildUpdateProductRequest(values, currentProduct);
      setFormErrors(built.errors);
      if (built.request === null) throw new Error("validation");
      return unwrapResult(
        commands.updateProduct(productCode, built.request as ProductUpdateRequest_Deserialize),
        {
          source: "commands",
          cmd: "update_product",
        },
      );
    },
    onSuccess: async () => {
      setSaveError(null);
      // UI-01b-D14: 保存成功 toast は navigate より前に発火する
      toast.success(`商品「${values.name.trim()}」を保存しました`, {
        id: "product-save-success",
        duration: 5000,
      });
      await invalidateByContract(
        queryClient,
        invalidationContract.productUpdate(productCode ?? ""),
      );
      onNavigateToList(safeReturnTo);
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "validation") return;
      const cmdError = isInvokeError(error) ? error.cmdError : toCmdError(error);
      setSaveError(cmdError.message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (productCode === undefined) throw new Error("商品が見つかりません");
      return unwrapResult(commands.toggleDiscontinue(productCode), {
        source: "commands",
        cmd: "toggle_discontinue",
      });
    },
    onSuccess: async () => {
      await productQuery.refetch();
      await invalidateByContract(
        queryClient,
        invalidationContract.productUpdate(productCode ?? ""),
      );
    },
    onError: (error) => {
      const cmdError = isInvokeError(error) ? error.cmdError : toCmdError(error);
      setSaveError(cmdError.message);
    },
  });

  const title = mode === "create" ? "商品登録" : "商品修正";
  const supplierWarning = suppliersQuery.isError
    ? "取引先を指定しない登録・保存は続行できます。"
    : null;
  const saveDisabled = departmentsQuery.isError || departmentsQuery.isLoading;

  if (mode === "edit" && productQuery.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (mode === "edit" && productQuery.isError) {
    return (
      <div className="space-y-4 p-6">
        <PageHeader title={title} />
        <Alert variant="destructive">
          <AlertTitle>商品が見つかりません</AlertTitle>
          <AlertDescription>商品一覧へ戻って、もう一度選択してください。</AlertDescription>
        </Alert>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onNavigateToList(safeReturnTo);
          }}
        >
          一覧へ戻る
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader title={title} />
      {departmentsQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>部門候補を取得できませんでした</AlertTitle>
          <AlertDescription>部門は必須項目のため、この状態では保存できません。</AlertDescription>
        </Alert>
      ) : null}
      <ProductForm
        mode={mode}
        values={values}
        departments={departments}
        suppliers={suppliers}
        errors={formErrors}
        saveError={saveError}
        supplierWarning={supplierWarning}
        productCodeLabel={currentProduct?.product_code}
        productName={currentProduct?.name}
        isDiscontinued={currentProduct?.is_discontinued ?? false}
        isSaving={createMutation.isPending || updateMutation.isPending}
        isTogglePending={toggleMutation.isPending}
        saveDisabled={saveDisabled}
        posSyncTouched={posSyncTouched}
        pluTargetTouched={pluTargetTouched}
        showPluTargetEnableNote={currentProduct?.plu_target === false && values.pluTarget}
        onValuesChange={setValues}
        onPosSyncTouchedChange={setPosSyncTouched}
        onPluTargetTouchedChange={setPluTargetTouched}
        onSubmit={() => {
          setSaveError(null);
          if (mode === "create") {
            createMutation.mutate();
          } else {
            updateMutation.mutate();
          }
        }}
        onCancel={() => {
          onNavigateToList(safeReturnTo);
        }}
        onToggleDiscontinue={() => {
          toggleMutation.mutate();
        }}
      />
    </div>
  );
}
