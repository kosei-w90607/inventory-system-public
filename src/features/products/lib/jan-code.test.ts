// REQ-101 / REQ-402: UI-01b-D17/D18 JAN core contract.

import { describe, expect, it } from "vitest";

import { normalizeJanCodeCandidate, suggestPluTarget, validateJanCode } from "./jan-code";

describe("JAN code helper (UI-01b-D17/D18)", () => {
  it("REQ-101 normalizes a trimmed whole fullwidth digit candidate", () => {
    expect(normalizeJanCodeCandidate(" ４９０１２３４５６７８８７ ")).toBe("4901234567887");
    expect(normalizeJanCodeCandidate(" ４９０A１２３ ")).toBe("４９０A１２３");
  });

  it("REQ-101 validates EAN-13 golden profile and rejects wrong check digit", () => {
    expect(validateJanCode("4901234567887")).toBeNull();
    expect(validateJanCode("4901234567890")).toBe(
      "JANコードのチェックディジットが一致しません。入力値を確認してください",
    );
  });

  it("REQ-101 validates EAN-8 golden profile with index zero weight three", () => {
    expect(validateJanCode("96385074")).toBeNull();
    expect(validateJanCode("49123456")).toBeNull();
    expect(validateJanCode("49123457")).toBe(
      "JANコードのチェックディジットが一致しません。入力値を確認してください",
    );
  });

  it("REQ-101 rejects non ASCII and lengths other than eight or thirteen", () => {
    for (const value of [
      "1234567",
      "123456789",
      "123456789012",
      "12345678901234",
      "490123456788A",
      "４９０１２３４５６７８８７",
    ]) {
      expect(validateJanCode(value)).toBe("JANコードは13桁または8桁で入力してください");
    }
  });

  it("REQ-402 suggests PLU target after JAN candidate normalization", () => {
    const cases: [string | null, boolean][] = [
      [null, false],
      ["4901234567887", true],
      ["96385074", false],
      ["４９０１２３４５６７８８７", true],
      [" 4901234567887 ", true],
      [" ４９０１２３４５６７８８７ ", true],
      ["490123456788A", false],
      ["123456789012", false],
      ["12345678901234", false],
    ];

    for (const [value, expected] of cases) {
      expect(suggestPluTarget(value)).toBe(expected);
    }
  });
});
