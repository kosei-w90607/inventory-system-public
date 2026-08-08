// REQ-204 / UI-05-D15,D16 / SPEC-SUGGEST-D7,D10: ProductAddSuggest 配線 W4/W6/W8。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockProductWithRelations } from "@/features/products/lib/test-fixtures";
import { commands } from "@/lib/bindings";
import { DisposalPage } from "./DisposalPage";

vi.mock("@/hooks/useUnsavedChangesWarning", () => ({
  useUnsavedChangesWarning: () => ({
    isBlocked: false,
    continueEditing: vi.fn(),
    discardAndProceed: vi.fn(),
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() } }));
vi.mock("@/lib/bindings", () => ({
  commands: {
    listDisposals: vi.fn(),
    searchProducts: vi.fn(),
    createDisposal: vi.fn(),
  },
}));

const mockSearchProducts = vi.mocked(commands.searchProducts);
const mockCreateDisposal = vi.mocked(commands.createDisposal);
const mockInvalidateAndClose = vi.hoisted(() => vi.fn());

vi.mock("@/components/patterns/useProductAddSuggest", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/patterns/useProductAddSuggest")>();
  return {
    ...actual,
    useProductAddSuggest: (...args: Parameters<typeof actual.useProductAddSuggest>) => {
      const controller = actual.useProductAddSuggest(...args);
      return {
        ...controller,
        invalidateAndClose: () => {
          mockInvalidateAndClose();
          controller.invalidateAndClose();
        },
      };
    },
  };
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DisposalPage />
    </QueryClientProvider>,
  );
}
function result(items: ReturnType<typeof makeMockProductWithRelations>[], perPage: number) {
  return {
    status: "ok" as const,
    data: { items, total_count: items.length, page: 1, per_page: perPage },
  };
}

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
  vi.mocked(commands.listDisposals).mockResolvedValue({
    status: "ok",
    data: { items: [], total_count: 0, page: 1, per_page: 10 },
  });
  mockSearchProducts.mockReset();
  mockCreateDisposal.mockReset();
  mockInvalidateAndClose.mockReset();
});

describe("DisposalPage ProductAddSuggest (UI-05-D15/D16)", () => {
  it("W4/W6: live候補を既存addProductへ委譲し保存eventでlock refと同時にcloseする", async () => {
    mockSearchProducts.mockResolvedValueOnce(
      result(
        [
          makeMockProductWithRelations({ product_code: "DP-L1", name: "廃棄候補A" }),
          makeMockProductWithRelations({ product_code: "DP-L2", name: "廃棄候補B" }),
        ],
        5,
      ),
    );
    renderPage();
    fireEvent.change(await screen.findByLabelText("廃棄・破損商品検索"), {
      target: { value: "廃棄候補" },
    });
    const firstList = await screen.findByRole("listbox");
    fireEvent.click(within(firstList).getByRole("option", { name: /DP-L1.*廃棄候補A/ }));
    expect(await screen.findByText("廃棄候補A")).toBeInTheDocument();

    mockSearchProducts.mockResolvedValueOnce(
      result(
        [
          makeMockProductWithRelations({ product_code: "DP-P1", name: "保存前候補A" }),
          makeMockProductWithRelations({ product_code: "DP-P2", name: "保存前候補B" }),
        ],
        5,
      ),
    );
    fireEvent.change(screen.getByLabelText("廃棄・破損商品検索"), { target: { value: "保存前" } });
    await screen.findByRole("listbox");
    mockCreateDisposal.mockReturnValue(
      new Promise(() => {
        // 保存中 lock を観測するため、意図的に未解決のままにする。
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "廃棄・破損を保存" }));
    expect(mockInvalidateAndClose).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(mockCreateDisposal).toHaveBeenCalledOnce();
    });
    expect(mockInvalidateAndClose.mock.invocationCallOrder[0]).toBeLessThan(
      mockCreateDisposal.mock.invocationCallOrder[0],
    );
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("W8: activeなしEnterは既存commit検索を実行する", async () => {
    const user = userEvent.setup();
    mockSearchProducts.mockResolvedValue(
      result([makeMockProductWithRelations({ product_code: "DP-E1", name: "Enter廃棄商品" })], 10),
    );
    renderPage();
    await user.type(await screen.findByLabelText("廃棄・破損商品検索"), "DP-E1{Enter}");
    expect(await screen.findByText("Enter廃棄商品")).toBeInTheDocument();
    expect(mockSearchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: "DP-E1", per_page: 10 }),
    );
  });

  it("W16: compositionendは正規化済み引数で検索しlock中は発火しない", async () => {
    mockSearchProducts.mockResolvedValueOnce(
      result([makeMockProductWithRelations({ product_code: "DP-C1", name: "合成入力商品" })], 10),
    );
    renderPage();

    fireEvent.compositionEnd(await screen.findByLabelText("廃棄・破損商品検索"), {
      target: { value: "４５６７８" },
    });
    await waitFor(() => {
      expect(mockSearchProducts).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: "45678", per_page: 10 }),
      );
    });
    expect(await screen.findByText("合成入力商品")).toBeInTheDocument();

    mockCreateDisposal.mockReturnValue(
      new Promise(() => {
        // lock 中の compositionend を観測するため、意図的に未解決のままにする。
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "廃棄・破損を保存" }));
    await waitFor(() => {
      expect(mockCreateDisposal).toHaveBeenCalledOnce();
    });
    mockSearchProducts.mockClear();

    const lockedInput = screen.getByLabelText("廃棄・破損商品検索");
    fireEvent.compositionEnd(lockedInput, {
      target: { value: "５６７８９" },
    });

    expect(lockedInput).toHaveValue("５６７８９");
    expect(mockSearchProducts).not.toHaveBeenCalled();
  });
});
