import { describe, expect, it } from "vitest";
import { navigation } from "./navigation";

describe("navigation config REQ-902", () => {
  it("marks ui-11c active at /settings/logs", () => {
    const item = navigation.flatMap((area) => area.items).find((entry) => entry.id === "ui-11c");
    expect(item).toMatchObject({ status: "active", to: "/settings/logs" });
  });
});
