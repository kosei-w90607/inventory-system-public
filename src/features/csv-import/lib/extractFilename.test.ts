// src/features/csv-import/lib/extractFilename.test.ts
//
// extractFilename 純関数の unit test。
// 設計: docs/function-design/55-ui-csv-import.md §55.1
// Phase 1 7-7a Vitest 初期化、option A 純関数 only test の 1 file (5 ケース)

import { describe, it, expect } from "vitest";
import { extractFilename } from "./extractFilename";

/// File object factory (happy-dom が browser File API を提供)。
function mockFile(name: string): File {
  return new File([], name);
}

describe("extractFilename", () => {
  it("returns basename when File.name has no separator", () => {
    expect(extractFilename(mockFile("data.csv"))).toBe("data.csv");
  });

  it("extracts basename from POSIX path (/ separator)", () => {
    expect(extractFilename(mockFile("/home/user/data.csv"))).toBe("data.csv");
  });

  it("extracts basename from Windows path (\\ separator)", () => {
    expect(extractFilename(mockFile("C:\\Users\\Owner\\data.csv"))).toBe("data.csv");
  });

  it("extracts basename when both / and \\ appear (uses last of either)", () => {
    expect(extractFilename(mockFile("/mnt/c/Users\\subdir\\data.csv"))).toBe("data.csv");
  });

  it("returns empty string when File.name ends with separator", () => {
    expect(extractFilename(mockFile("/path/"))).toBe("");
  });
});
