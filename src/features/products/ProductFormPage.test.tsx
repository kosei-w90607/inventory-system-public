// src/features/products/ProductFormPage.test.tsx

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { commands } from "@/lib/bindings";
import { d052InvalidationOracle, expectExactInvalidations } from "@/test/invalidation-oracle";
import { toast } from "sonner";
import {
  makeMockDepartment,
  makeMockProductWithRelations,
  makeMockSupplier,
} from "./lib/test-fixtures";
import { ProductFormPage } from "./ProductFormPage";

vi.mock("@/lib/bindings", () => ({
  commands: {
    listDepartments: vi.fn(),
    listSuppliers: vi.fn(),
    getProduct: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    toggleDiscontinue: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

const mockToastSuccess = vi.mocked(toast.success);

const mockListDepartments = vi.mocked(commands.listDepartments);
const mockListSuppliers = vi.mocked(commands.listSuppliers);
const mockGetProduct = vi.mocked(commands.getProduct);
const mockCreateProduct = vi.mocked(commands.createProduct);
const mockUpdateProduct = vi.mocked(commands.updateProduct);
const mockToggleDiscontinue = vi.mocked(commands.toggleDiscontinue);

function renderWithClient(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return {
    queryClient: qc,
    ...render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>),
  };
}

beforeEach(() => {
  mockListDepartments.mockReset();
  mockListSuppliers.mockReset();
  mockGetProduct.mockReset();
  mockCreateProduct.mockReset();
  mockUpdateProduct.mockReset();
  mockToggleDiscontinue.mockReset();
  mockToastSuccess.mockReset();
});

describe("ProductFormPage (UI-01b)", () => {
  it("blocks create submit when JAN is blank and department has no code_prefix", async () => {
    const user = userEvent.setup();
    mockListDepartments.mockResolvedValue({
      status: "ok",
      data: [makeMockDepartment({ id: 2, name: "通常部門", code_prefix: null })],
    });
    mockListSuppliers.mockResolvedValue({ status: "ok", data: [] });

    renderWithClient(<ProductFormPage mode="create" onNavigateToList={vi.fn()} />);

    await user.type(await screen.findByLabelText(/^商品名/), "テスト商品");
    await user.selectOptions(screen.getByLabelText(/^部門/), "2");
    await user.clear(screen.getByLabelText(/^売価/));
    await user.type(screen.getByLabelText(/^売価/), "500");
    await user.clear(screen.getByLabelText(/^原価/));
    await user.type(screen.getByLabelText(/^原価/), "300");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(await screen.findByText(/独自コード発番対象/)).toBeInTheDocument();
    expect(mockCreateProduct).not.toHaveBeenCalled();
  });

  it("allows no-supplier create when supplier options fail", async () => {
    const user = userEvent.setup();
    const onNavigateToList = vi.fn();
    mockListDepartments.mockResolvedValue({
      status: "ok",
      data: [makeMockDepartment({ id: 1, code_prefix: "Y" })],
    });
    mockListSuppliers.mockResolvedValue({
      status: "error",
      error: { kind: "internal", message: "取引先取得失敗", field: null },
    });
    mockCreateProduct.mockResolvedValue({
      status: "ok",
      data: { product_code: "Y-0001", warnings: [] },
    });

    const { queryClient } = renderWithClient(
      <ProductFormPage
        mode="create"
        returnTo="/products?q=布"
        onNavigateToList={onNavigateToList}
      />,
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await user.type(await screen.findByLabelText(/^商品名/), "テスト商品");
    await user.selectOptions(screen.getByLabelText(/^部門/), "1");
    await user.clear(screen.getByLabelText(/^売価/));
    await user.type(screen.getByLabelText(/^売価/), "500");
    await user.clear(screen.getByLabelText(/^原価/));
    await user.type(screen.getByLabelText(/^原価/), "300");
    await user.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => {
      expect(mockCreateProduct).toHaveBeenCalledWith(
        expect.objectContaining({ supplier_id: null }),
      );
    });
    await waitFor(() => {
      expect(onNavigateToList).toHaveBeenCalledWith("/products?q=%E5%B8%83");
    });
    // UI-01b-D14: 保存成功 toast（id 固定）
    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.stringContaining("Y-0001"),
      expect.objectContaining({ id: "product-save-success" }),
    );
    expectExactInvalidations(invalidateSpy.mock.calls, d052InvalidationOracle.productCreate());
  });

  it("blocks save when department options fail", async () => {
    mockListDepartments.mockResolvedValue({
      status: "error",
      error: { kind: "internal", message: "部門取得失敗", field: null },
    });
    mockListSuppliers.mockResolvedValue({ status: "ok", data: [] });

    renderWithClient(<ProductFormPage mode="create" onNavigateToList={vi.fn()} />);

    expect(await screen.findByText("部門候補を取得できませんでした")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登録する" })).toBeDisabled();
  });

  it("shows recovery when edit target is not found", async () => {
    const user = userEvent.setup();
    const onNavigateToList = vi.fn();
    mockListDepartments.mockResolvedValue({ status: "ok", data: [makeMockDepartment()] });
    mockListSuppliers.mockResolvedValue({ status: "ok", data: [] });
    mockGetProduct.mockResolvedValue({
      status: "error",
      error: { kind: "not_found", message: "商品が見つかりません", field: null },
    });

    renderWithClient(
      <ProductFormPage
        mode="edit"
        productCode="P-MISSING"
        returnTo="/products?page=2"
        onNavigateToList={onNavigateToList}
      />,
    );

    expect(await screen.findByText("商品が見つかりません")).toBeInTheDocument();
    expect(screen.getByText("商品一覧へ戻って、もう一度選択してください。")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "一覧へ戻る" }));

    expect(onNavigateToList).toHaveBeenCalledWith("/products?page=2");
  });

  it("edit save sends only supported changed fields and preserves form on duplicate error", async () => {
    const user = userEvent.setup();
    mockListDepartments.mockResolvedValue({ status: "ok", data: [makeMockDepartment()] });
    mockListSuppliers.mockResolvedValue({ status: "ok", data: [makeMockSupplier({ id: 1 })] });
    mockGetProduct.mockResolvedValue({
      status: "ok",
      data: makeMockProductWithRelations({ product_code: "P-001", name: "変更前" }),
    });
    mockUpdateProduct.mockResolvedValue({
      status: "error",
      error: { kind: "duplicate", message: "この商品コードは既に使用されています", field: null },
    });

    const { queryClient } = renderWithClient(
      <ProductFormPage mode="edit" productCode="P-001" onNavigateToList={vi.fn()} />,
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const name = await screen.findByLabelText(/^商品名/);
    await user.clear(name);
    await user.type(name, "変更後");
    await user.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(mockUpdateProduct).toHaveBeenCalledWith("P-001", { name: "変更後" });
    });
    expect(await screen.findByText("この商品コードは既に使用されています")).toBeInTheDocument();
    expect(screen.getByDisplayValue("変更後")).toBeInTheDocument();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("D-052-C2a update success invalidates the exact independent oracle set", async () => {
    const user = userEvent.setup();
    const onNavigateToList = vi.fn();
    mockListDepartments.mockResolvedValue({ status: "ok", data: [makeMockDepartment()] });
    mockListSuppliers.mockResolvedValue({ status: "ok", data: [] });
    mockGetProduct.mockResolvedValue({
      status: "ok",
      data: makeMockProductWithRelations({ product_code: "P-001", name: "変更前" }),
    });
    mockUpdateProduct.mockResolvedValue({ status: "ok", data: { warnings: [] } });

    const { queryClient } = renderWithClient(
      <ProductFormPage mode="edit" productCode="P-001" onNavigateToList={onNavigateToList} />,
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const name = await screen.findByLabelText(/^商品名/);
    await user.clear(name);
    await user.type(name, "変更後");
    await user.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(onNavigateToList).toHaveBeenCalled();
      expectExactInvalidations(
        invalidateSpy.mock.calls,
        d052InvalidationOracle.productUpdate("P-001"),
      );
    });
  });

  it("D-052-C2b discontinue toggle invalidates the same exact update oracle set", async () => {
    const user = userEvent.setup();
    mockListDepartments.mockResolvedValue({ status: "ok", data: [makeMockDepartment()] });
    mockListSuppliers.mockResolvedValue({ status: "ok", data: [] });
    mockGetProduct.mockResolvedValue({
      status: "ok",
      data: makeMockProductWithRelations({ product_code: "P-001", name: "廃番対象" }),
    });
    mockToggleDiscontinue.mockResolvedValue({ status: "ok", data: true });

    const { queryClient } = renderWithClient(
      <ProductFormPage mode="edit" productCode="P-001" onNavigateToList={vi.fn()} />,
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(await screen.findByRole("button", { name: "廃番にする" }));
    await user.click(screen.getByRole("button", { name: "廃番にする" }));

    await waitFor(() => {
      expect(mockToggleDiscontinue).toHaveBeenCalledWith("P-001");
      expectExactInvalidations(
        invalidateSpy.mock.calls,
        d052InvalidationOracle.productUpdate("P-001"),
      );
    });
  });

  it("D-052-C2b restore toggle invalidates the same exact update oracle set", async () => {
    const user = userEvent.setup();
    mockListDepartments.mockResolvedValue({ status: "ok", data: [makeMockDepartment()] });
    mockListSuppliers.mockResolvedValue({ status: "ok", data: [] });
    mockGetProduct.mockResolvedValue({
      status: "ok",
      data: makeMockProductWithRelations({
        product_code: "P-001",
        name: "復帰対象",
        is_discontinued: true,
      }),
    });
    mockToggleDiscontinue.mockResolvedValue({ status: "ok", data: false });

    const { queryClient } = renderWithClient(
      <ProductFormPage mode="edit" productCode="P-001" onNavigateToList={vi.fn()} />,
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await user.click(await screen.findByRole("button", { name: "表示に戻す" }));

    await waitFor(() => {
      expect(mockToggleDiscontinue).toHaveBeenCalledWith("P-001");
      expectExactInvalidations(
        invalidateSpy.mock.calls,
        d052InvalidationOracle.productUpdate("P-001"),
      );
    });
  });
});
