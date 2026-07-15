import { describe, expect, it } from "vitest";
import { navigation } from "./navigation";

describe("navigation config REQ-902", () => {
  it("marks ui-11c active at /settings/logs", () => {
    const item = navigation.flatMap((area) => area.items).find((entry) => entry.id === "ui-11c");
    expect(item).toMatchObject({ status: "active", to: "/settings/logs" });
  });
});

describe("navigation config REQ-904", () => {
  it("test_navigation_req904_ui13_active_at_settings_integrity", () => {
    // REQ-904: 在庫整合性検証画面への operator 到達導線
    const item = navigation.flatMap((area) => area.items).find((entry) => entry.id === "ui-13");
    expect(item).toMatchObject({ status: "active", to: "/settings/integrity" });
  });
});
