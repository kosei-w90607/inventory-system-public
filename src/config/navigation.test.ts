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

describe("navigation config sidebar pending links", () => {
  it("test_navigation_req101_ui01b_active_at_products_new", () => {
    // REQ-101: 商品登録画面への operator 到達導線
    const item = navigation
      .flatMap((area) => area.items)
      .find((entry) => entry.id === "ui-01b-new");
    expect(item).toMatchObject({ status: "active", to: "/products/new" });
  });

  it("test_navigation_req302_ui06b_active_deep_link_low_stock", () => {
    // REQ-302: 在庫少一覧は UI-06a の low_stock filter へ deep-link する
    const items = navigation.flatMap((area) => area.items);
    expect(items.find((entry) => entry.id === "ui-06b")).toMatchObject({
      status: "active",
      to: "/stock",
      search: { status: "low_stock" },
      activeMatch: { searchKey: "status", is: "low_stock" },
    });
    expect(items.find((entry) => entry.id === "ui-06a")).toMatchObject({
      activeMatch: { searchKey: "status", isNot: "low_stock" },
    });
  });

  it("test_navigation_all_items_no_pending_status", () => {
    expect(navigation.flatMap((area) => area.items)).not.toContainEqual(
      expect.objectContaining({ status: "pending" }),
    );
  });
});
