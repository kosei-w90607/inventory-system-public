import { describe, expect, it } from "vitest";

import { formatMovementQuantity, formatMovementType } from "./movement-formatters";

describe("movement-formatters (REQ-303)", () => {
  it("REQ-303: formatMovementQuantity returns sign and Japanese label", () => {
    expect(formatMovementQuantity(5)).toEqual({ value: "+5", label: "増加" });
    expect(formatMovementQuantity(-3)).toEqual({ value: "-3", label: "減少" });
    expect(formatMovementQuantity(0)).toEqual({ value: "0", label: "変動なし" });
  });

  it("REQ-303: formatMovementType maps known types and preserves unknown values", () => {
    expect(formatMovementType("receiving")).toBe("入庫");
    expect(formatMovementType("sale_auto")).toBe("POS売上");
    expect(formatMovementType("future_type")).toBe("future_type");
  });
});
