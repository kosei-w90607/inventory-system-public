import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPrefixedIdempotencyKey,
  getLocalDateString as getSharedLocalDateString,
  parseRequiredSafeInteger,
} from "./request-helpers";
import {
  buildReceivingRequest,
  createReceivingIdempotencyKey,
  getLocalDateString as getReceivingLocalDateString,
} from "@/features/receiving/lib/receiving-request";
import {
  buildManualSaleRequest,
  createManualSaleIdempotencyKey,
  getLocalDateString as getManualSaleLocalDateString,
} from "@/features/manual-sale/lib/manual-sale-request";
import {
  buildDisposalRequest,
  createDisposalIdempotencyKey,
  getLocalDateString as getDisposalLocalDateString,
} from "@/features/disposal/lib/disposal-request";
import {
  buildReturnExchangeRequest,
  createReturnExchangeIdempotencyKey,
  getLocalDateString as getReturnExchangeLocalDateString,
} from "@/features/return-exchange/lib/return-exchange-request";

// Traceability: REQ-201 REQ-202 REQ-203 REQ-204

const REQUEST_MODULES = [
  {
    repoPath: "src/features/receiving/lib/receiving-request.ts",
    integerCallCount: 2,
  },
  {
    repoPath: "src/features/manual-sale/lib/manual-sale-request.ts",
    integerCallCount: 2,
  },
  {
    repoPath: "src/features/disposal/lib/disposal-request.ts",
    integerCallCount: 4,
  },
  {
    repoPath: "src/features/return-exchange/lib/return-exchange-request.ts",
    integerCallCount: 1,
  },
] as const;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("request builder shared primitives", () => {
  it("builds prefixed keys through UUID and fallback branches", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-uuid" });
    expect(createPrefixedIdempotencyKey("receiving")).toBe("receiving-fixed-uuid");

    vi.stubGlobal("crypto", {});
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    expect(createPrefixedIdempotencyKey("manual-sale")).toBe("manual-sale-1700000000000-9");
  });

  it("formats the local calendar rather than UTC getters", () => {
    const dateWithConflictingGetters = {
      getFullYear: () => 2026,
      getMonth: () => 0,
      getDate: () => 2,
      getUTCFullYear: () => 1999,
      getUTCMonth: () => 11,
      getUTCDate: () => 31,
    } as Date;

    expect(getSharedLocalDateString(dateWithConflictingGetters)).toBe("2026-01-02");
  });

  it("accepts only trimmed ASCII safe integers at the inclusive minimum", () => {
    expect(parseRequiredSafeInteger(" 0 ", 0)).toBe(0);
    expect(parseRequiredSafeInteger("1", 1)).toBe(1);
    expect(parseRequiredSafeInteger(String(Number.MAX_SAFE_INTEGER), 0)).toBe(
      Number.MAX_SAFE_INTEGER,
    );

    for (const [value, min] of [
      ["", 0],
      ["-1", 0],
      ["1.0", 0],
      ["1e2", 0],
      ["１", 0],
      ["0", 1],
      [String(Number.MAX_SAFE_INTEGER + 1), 0],
    ] as const) {
      expect(parseRequiredSafeInteger(value, min), `${value} / min ${String(min)}`).toBeNull();
    }
  });

  it("keeps all feature prefixes and local date named exports", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-uuid" });

    expect(createReceivingIdempotencyKey()).toBe("receiving-fixed-uuid");
    expect(createManualSaleIdempotencyKey()).toBe("manual-sale-fixed-uuid");
    expect(createDisposalIdempotencyKey()).toBe("disposal-fixed-uuid");
    expect(createReturnExchangeIdempotencyKey()).toBe("return-fixed-uuid");

    const date = new Date(2026, 0, 2);
    expect([
      getReceivingLocalDateString(date),
      getManualSaleLocalDateString(date),
      getDisposalLocalDateString(date),
      getReturnExchangeLocalDateString(date),
    ]).toEqual(["2026-01-02", "2026-01-02", "2026-01-02", "2026-01-02"]);
  });

  it("keeps quantity at min 1 and monetary fields at min 0 in every builder", () => {
    const receiving = buildReceivingRequest(
      {
        supplierId: null,
        receivingDate: "2026-07-29",
        note: "",
        rows: [
          {
            productCode: "RC-001",
            productName: "商品",
            stockUnit: "pcs",
            quantity: "1",
            costPrice: "0",
          },
        ],
      },
      "receiving-key",
    );
    expect(receiving.request?.items).toEqual([
      { product_code: "RC-001", quantity: 1, cost_price: 0 },
    ]);

    const manualSale = buildManualSaleRequest(
      {
        saleDate: "2026-07-29",
        reason: "other",
        note: "",
        rows: [
          {
            productCode: "MS-001",
            productName: "商品",
            departmentName: "部門",
            stockUnit: "pcs",
            currentStockQuantity: 1,
            unitPrice: 0,
            quantity: "1",
            amount: "0",
          },
        ],
      },
      "manual-sale-key",
      null,
    );
    expect(manualSale.request?.items).toEqual([{ product_code: "MS-001", quantity: 1, amount: 0 }]);

    const disposal = buildDisposalRequest(
      {
        disposalDate: "2026-07-29",
        rows: [
          {
            rowId: "row-1",
            productCode: "DP-001",
            productName: "商品",
            departmentName: "部門",
            stockUnit: "pcs",
            currentStockQuantity: 1,
            defaultCostPrice: 0,
            disposalType: "damage",
            quantity: "1",
            costPrice: "0",
            reason: "破損",
          },
        ],
      },
      "disposal-key",
    );
    expect(disposal.request?.items).toEqual([
      {
        product_code: "DP-001",
        disposal_type: "damage",
        quantity: 1,
        cost_price: 0,
        reason: "破損",
      },
    ]);

    const returned = buildReturnExchangeRequest(
      {
        returnDate: "2026-07-29",
        returnType: "return",
        registerProcessed: false,
        note: "",
        rows: [
          {
            productCode: "RT-001",
            productName: "商品",
            departmentName: "部門",
            stockUnit: "pcs",
            currentStockQuantity: 1,
            direction: "in",
            quantity: "1",
          },
        ],
      },
      "return-key",
      { receiptImagePath: null },
    );
    expect(returned.request?.items).toEqual([
      { product_code: "RT-001", direction: "in", quantity: 1 },
    ]);

    const receivingBelowMin = buildReceivingRequest(
      {
        supplierId: null,
        receivingDate: "2026-07-29",
        note: "",
        rows: [
          {
            productCode: "RC-001",
            productName: "商品",
            stockUnit: "pcs",
            quantity: "0",
            costPrice: "-1",
          },
        ],
      },
      "receiving-key",
    );
    expect(receivingBelowMin.errors.rows?.["RC-001"]).toBe(
      "数量は1以上の整数で入力してください / 原価は0以上の整数で入力してください",
    );

    const manualSaleBelowMin = buildManualSaleRequest(
      {
        saleDate: "2026-07-29",
        reason: "other",
        note: "",
        rows: [
          {
            productCode: "MS-001",
            productName: "商品",
            departmentName: "部門",
            stockUnit: "pcs",
            currentStockQuantity: 1,
            unitPrice: 0,
            quantity: "0",
            amount: "-1",
          },
        ],
      },
      "manual-sale-key",
      null,
    );
    expect(manualSaleBelowMin.errors.rows?.["MS-001"]).toBe(
      "数量は1以上の整数で入力してください / 販売金額は0以上の整数で入力してください",
    );

    const disposalBelowMin = buildDisposalRequest(
      {
        disposalDate: "2026-07-29",
        rows: [
          {
            rowId: "row-1",
            productCode: "DP-001",
            productName: "商品",
            departmentName: "部門",
            stockUnit: "pcs",
            currentStockQuantity: 1,
            defaultCostPrice: 0,
            disposalType: "damage",
            quantity: "0",
            costPrice: "-1",
            reason: "破損",
          },
        ],
      },
      "disposal-key",
    );
    expect(disposalBelowMin.errors.rows?.["row-1"]).toBe(
      "数量は1以上の整数で入力してください / 原価は0以上の整数で入力してください",
    );

    const returnBelowMin = buildReturnExchangeRequest(
      {
        returnDate: "2026-07-29",
        returnType: "return",
        registerProcessed: false,
        note: "",
        rows: [
          {
            productCode: "RT-001",
            productName: "商品",
            departmentName: "部門",
            stockUnit: "pcs",
            currentStockQuantity: 1,
            direction: "in",
            quantity: "0",
          },
        ],
      },
      "return-key",
      { receiptImagePath: null },
    );
    expect(returnBelowMin.errors.rows?.["RT-001:in"]).toBe("数量は1以上の整数で入力してください");
  });

  it("keeps the three primitive implementations out of feature request modules", () => {
    for (const { repoPath, integerCallCount } of REQUEST_MODULES) {
      const source = readFileSync(join(process.cwd(), repoPath), "utf8");

      expect(source, repoPath).toContain('from "@/lib/request-helpers"');
      expect(source.match(/\bcreatePrefixedIdempotencyKey\(/g), repoPath).toHaveLength(1);
      expect(source.match(/\bparseRequiredSafeInteger\(/g), repoPath).toHaveLength(
        integerCallCount,
      );
      expect(source, repoPath).not.toMatch(
        /\brandomUUID\b|\bgetFullYear\b|\bgetMonth\b|\bgetDate\b|Number\.isSafeInteger/,
      );
    }
  });
});
