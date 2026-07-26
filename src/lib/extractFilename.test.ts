import { describe, expect, it } from "vitest";

import { extractFilename } from "./extractFilename";

describe("extractFilename", () => {
  it("returns a name without separators unchanged", () => {
    expect(extractFilename("data.csv")).toBe("data.csv");
  });

  it("extracts basename from a POSIX path", () => {
    expect(extractFilename("/home/user/data.csv")).toBe("data.csv");
  });

  it("extracts basename from a Windows path", () => {
    expect(extractFilename("C:\\Users\\Owner\\data.csv")).toBe("data.csv");
  });

  it("uses the last separator when both separator styles appear", () => {
    expect(extractFilename("/mnt/c/Users\\subdir\\data.csv")).toBe("data.csv");
  });

  it("returns an empty string when the input ends with a separator", () => {
    expect(extractFilename("/path/")).toBe("");
  });
});
