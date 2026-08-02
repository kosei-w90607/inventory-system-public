import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { MovementRecord } from "@/lib/bindings";
import { renderWithRouter } from "@/test/render-with-router";
import { MovementTable } from "./MovementTable";

function makeMovement(overrides: Partial<MovementRecord> = {}): MovementRecord {
  return {
    id: 1,
    product_code: "BT0002",
    movement_type: "receiving",
    quantity: 5,
    stock_after: 12,
    reference_type: "receiving_record",
    reference_id: 42,
    source: { label: "入庫記録 #42", route: "/inventory/receiving/records/42" },
    note: "初回入庫",
    created_at: "2026-06-27T10:11:12",
    ...overrides,
  };
}

describe("MovementTable (REQ-303 / REQ-207)", () => {
  it("REQ-303: movement rows show type quantity stock source and note", async () => {
    renderWithRouter(<MovementTable movements={[makeMovement()]} />);

    const row = (await screen.findByText("入庫記録 #42")).closest("tr");
    if (row === null) throw new Error("movement row not found");

    expect(within(row).getByText("2026-06-27 10:11:12")).toBeInTheDocument();
    expect(within(row).getByText("入庫")).toBeInTheDocument();
    expect(within(row).getByText("+5")).toBeInTheDocument();
    expect(within(row).getByText("増加")).toBeInTheDocument();
    expect(within(row).getByText("12")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "入庫記録 #42" })).toHaveAttribute(
      "href",
      "/inventory/receiving/records/42",
    );
    expect(within(row).getByText("初回入庫")).toBeInTheDocument();
  });

  it("REQ-207: sourceなしのmovementは元記録なしとして表示する", async () => {
    renderWithRouter(
      <MovementTable
        movements={[
          makeMovement({
            id: 2,
            source: null,
            reference_type: null,
            reference_id: null,
            note: null,
          }),
        ]}
      />,
    );

    const row = (await screen.findByText("元記録なし")).closest("tr");
    if (row === null) throw new Error("movement row not found");
    expect(within(row).queryByRole("link")).not.toBeInTheDocument();
    expect(within(row).getByText("—")).toBeInTheDocument();
  });

  it("REQ-207: returnToを元記録リンクに付けてmovement検索状態を保持する", async () => {
    const user = userEvent.setup();
    const { router } = renderWithRouter(
      <MovementTable
        movements={[
          makeMovement({
            source: { label: "廃棄・破損 #7", route: "/inventory/disposal/records/7" },
          }),
        ]}
        returnTo="/stock/BT0002/movements?type=disposal&page=2"
      />,
    );

    const sourceLink = await screen.findByRole("link", { name: "廃棄・破損 #7" });
    expect(sourceLink).toHaveAttribute(
      "href",
      "/inventory/disposal/records/7?returnTo=%2Fstock%2FBT0002%2Fmovements%3Ftype%3Ddisposal%26page%3D2",
    );

    // C3/C4: href assertion だけでなく click による実 SPA 遷移を証明する
    // (X3 mutation: runtime 代表を生 <a> に戻した場合に red 化する)。
    await user.click(sourceLink);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/inventory/disposal/records/7");
    });
    expect(router.state.location.search).toEqual({
      returnTo: "/stock/BT0002/movements?type=disposal&page=2",
    });
  });
});
