import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListSkeleton } from "./ListSkeleton";

describe("ListSkeleton (UI-14)", () => {
  it("ListSkeleton は指定行数の skeleton 行を描画し読み込み中を示す", () => {
    const { container } = render(<ListSkeleton rows={3} />);

    expect(container.querySelectorAll('[data-slot="list-skeleton-row"]')).toHaveLength(3);
    expect(screen.getByRole("status", { name: "一覧を読み込み中" })).toBeInTheDocument();
  });
});
