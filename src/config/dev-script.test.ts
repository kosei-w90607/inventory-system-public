import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";

describe("development scripts", () => {
  it("REQ-206 keeps generated TanStack route tree fresh before Vite dev starts", () => {
    // New file routes are consumed through src/routeTree.gen.ts, which is intentionally ignored.
    // Native L3 starts with npm run tauri dev -> beforeDevCommand -> npm run dev.
    expect(packageJson.scripts.dev).toMatch(/^npm run generate:routes && vite$/);
  });
});
