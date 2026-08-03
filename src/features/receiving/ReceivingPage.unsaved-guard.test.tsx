import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeMockProductWithRelations,
  makeMockSupplier,
} from "@/features/products/lib/test-fixtures";
import { commands } from "@/lib/bindings";
import { ReceivingPage } from "./ReceivingPage";

interface TestBlockerOptions {
  shouldBlockFn: () => boolean;
}

const mockUseBlocker = vi.hoisted(() =>
  vi.fn((options: TestBlockerOptions) =>
    options.shouldBlockFn()
      ? { status: "blocked" as const, reset: vi.fn(), proceed: vi.fn() }
      : { status: "idle" as const },
  ),
);

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useBlocker: mockUseBlocker,
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));
vi.mock("@/lib/bindings", () => ({
  commands: {
    listSuppliers: vi.fn(),
    listReceivings: vi.fn(),
    searchProducts: vi.fn(),
    createReceiving: vi.fn(),
  },
}));

const mockListSuppliers = vi.mocked(commands.listSuppliers);
const mockListReceivings = vi.mocked(commands.listReceivings);
const mockSearchProducts = vi.mocked(commands.searchProducts);
const mockCreateReceiving = vi.mocked(commands.createReceiving);
let blockerStatus: "idle" | "blocked" = "idle";

function shouldBlockCurrentNavigation(): boolean {
  const calls = mockUseBlocker.mock.calls;
  return calls[calls.length - 1][0].shouldBlockFn();
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  const page = () => (
    <QueryClientProvider client={queryClient}>
      <ReceivingPage />
    </QueryClientProvider>
  );
  const view = render(page());
  return {
    ...view,
    rerenderPage: () => {
      view.rerender(page());
    },
  };
}

beforeEach(() => {
  blockerStatus = "idle";
  mockUseBlocker.mockImplementation(() =>
    blockerStatus === "blocked"
      ? {
          status: "blocked" as const,
          reset: vi.fn(() => {
            blockerStatus = "idle";
          }),
          proceed: vi.fn(),
        }
      : { status: "idle" as const },
  );
  mockListSuppliers.mockResolvedValue({
    status: "ok",
    data: [makeMockSupplier({ id: 1, name: "テスト商事" })],
  });
  mockListReceivings.mockResolvedValue({
    status: "ok",
    data: { items: [], total_count: 0, page: 1, per_page: 10 },
  });
  mockSearchProducts.mockResolvedValue({
    status: "ok",
    data: {
      items: [makeMockProductWithRelations({ product_code: "RC-001", name: "入庫商品" })],
      total_count: 1,
      page: 1,
      per_page: 10,
    },
  });
  mockCreateReceiving.mockResolvedValue({
    status: "ok",
    data: { record_id: 1, created: true, idempotent_replay: false, stock_warnings: [] },
  });
});

describe("ReceivingPage unsaved guard (UI-USW-D1/D3 / SPEC-UISN-2)", () => {
  it("UI-02 T10: 入力差分または明細でdirtyになり、保存結果では非blockになる", async () => {
    const user = userEvent.setup();
    const { rerenderPage } = renderPage();

    const search = await screen.findByLabelText("入庫商品検索");
    const note = screen.getByLabelText("備考");
    expect(shouldBlockCurrentNavigation()).toBe(false);

    await user.type(note, "検品済み");
    expect(shouldBlockCurrentNavigation()).toBe(true);
    await user.clear(note);
    expect(shouldBlockCurrentNavigation()).toBe(false);

    await user.type(search, "RC-001{enter}");
    await screen.findByText("RC-001");
    expect(shouldBlockCurrentNavigation()).toBe(true);
    blockerStatus = "blocked";
    rerenderPage();
    expect(await screen.findByText("編集内容が保存されていません")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "編集を続ける" }));
    rerenderPage();
    await user.click(screen.getByRole("button", { name: "入庫を保存" }));

    await waitFor(() => {
      expect(mockCreateReceiving).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByText("編集内容が保存されていません")).not.toBeInTheDocument();
    });
    expect(shouldBlockCurrentNavigation()).toBe(false);
  });
});
