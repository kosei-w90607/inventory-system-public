import { describe, expect, it } from "vitest";

import { buildSaveImageRequest, getAllowedReceiptExtension } from "./receipt-image";

describe("receipt image helper (UI-03 / REQ-202)", () => {
  it("REQ-202 detects supported image extensions", () => {
    expect(getAllowedReceiptExtension("receipt.JPG")).toBe("jpg");
    expect(getAllowedReceiptExtension("receipt.webp")).toBe("webp");
    expect(getAllowedReceiptExtension("receipt.bmp")).toBeNull();
  });

  it("REQ-202 builds saveReceiptImage request from a File", async () => {
    const file = new File(["receipt"], "receipt.png", { type: "image/png" });

    const request = await buildSaveImageRequest(file);

    expect(request.extension).toBe("png");
    expect(request.image_base64).toBe("cmVjZWlwdA==");
  });
});
