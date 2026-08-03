import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockProductWithRelations } from "@/features/products/lib/test-fixtures";
import { commands } from "@/lib/bindings";
import { DisposalPage } from "./DisposalPage";

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
    listDisposals: vi.fn(),
    searchProducts: vi.fn(),
    createDisposal: vi.fn(),
  },
}));

const mockListDisposals = vi.mocked(commands.listDisposals);
const mockSearchProducts = vi.mocked(commands.searchProducts);
const mockCreateDisposal = vi.mocked(commands.createDisposal);
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
      <DisposalPage />
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
  vi.stubGlobal("scrollTo", vi.fn());
  mockListDisposals.mockResolvedValue({
    status: "ok",
    data: { items: [], total_count: 0, page: 1, per_page: 10 },
  });
  mockSearchProducts.mockResolvedValue({
    status: "ok",
    data: {
      items: [
        makeMockProductWithRelations({
          product_code: "DP-001",
          name: "廃棄商品",
          cost_price: 120,
        }),
      ],
      total_count: 1,
      page: 1,
      per_page: 10,
    },
  });
  mockCreateDisposal.mockResolvedValue({
    status: "ok",
    data: { record_id: 1, created: true, idempotent_replay: false, stock_warnings: [] },
  });
});

describe("DisposalPage unsaved guard (UI-USW-D1/D3 / SPEC-UISN-2)", () => {
  it("UI-05 T13: 日付差分または明細でdirtyになり、保存結果では非blockになる", async () => {
    const user = userEvent.setup();
    const { rerenderPage } = renderPage();

    const dateInput = await screen.findByLabelText("廃棄日");
    const initialDate = (dateInput as HTMLInputElement).value;
    const search = screen.getByLabelText("廃棄・破損商品検索");
    expect(shouldBlockCurrentNavigation()).toBe(false);
    await user.clear(dateInput);
    await user.type(dateInput, "2026-08-02");
    expect(shouldBlockCurrentNavigation()).toBe(true);
    await user.clear(dateInput);
    await user.type(dateInput, initialDate);
    expect(shouldBlockCurrentNavigation()).toBe(false);

    await user.type(search, "DP-001{enter}");
    await screen.findByText("DP-001");
    expect(shouldBlockCurrentNavigation()).toBe(true);
    blockerStatus = "blocked";
    rerenderPage();
    expect(await screen.findByText("編集内容が保存されていません")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "編集を続ける" }));
    rerenderPage();
    await user.click(screen.getByRole("button", { name: "廃棄・破損を保存" }));

    await waitFor(() => {
      expect(mockCreateDisposal).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByText("編集内容が保存されていません")).not.toBeInTheDocument();
    });
    expect(shouldBlockCurrentNavigation()).toBe(false);
  });
});
