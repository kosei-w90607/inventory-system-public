import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { FilePicker } from "./FilePicker";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(),
}));

const mockOpen = vi.mocked(open);
const mockReadFile = vi.mocked(readFile);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FilePicker (D-054)", () => {
  it("REQ-104: native dialog で CSV bytes・filename・size を単一契約として返す", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    mockOpen.mockResolvedValue("C:\\synthetic\\products.csv");
    mockReadFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

    render(
      <FilePicker
        accept=".csv,.txt"
        ariaLabel="商品マスタCSVを選択"
        buttonLabel="ファイルを選択"
        dialogFilterName="CSV / TXT"
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: "商品マスタCSVを選択" }));

    expect(mockOpen).toHaveBeenCalledWith({
      multiple: false,
      filters: [{ name: "CSV / TXT", extensions: ["csv", "txt"] }],
    });
    expect(mockReadFile).toHaveBeenCalledWith("C:\\synthetic\\products.csv");
    expect(onSelect).toHaveBeenCalledWith({
      bytes: new Uint8Array([1, 2, 3]),
      filename: "products.csv",
      size: 3,
    });
    expect(screen.getByRole("button", { name: "商品マスタCSVを選択" })).toHaveTextContent(
      "ファイルを選択",
    );
  });

  it("REQ-401: native dialog の cancel は state 通知を行わない", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    mockOpen.mockResolvedValue(null);

    render(
      <FilePicker
        accept=".csv,.txt"
        ariaLabel="商品別CSVを選択"
        buttonLabel="ファイルを選択"
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: "商品別CSVを選択" }));

    expect(mockReadFile).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("REQ-104: native dialog の read failure は選択済み state を更新せず通知する", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onError = vi.fn();
    mockOpen.mockResolvedValue("C:\\synthetic\\unreadable.csv");
    mockReadFile.mockRejectedValue(new Error("read denied"));

    render(
      <FilePicker
        accept=".csv,.txt"
        ariaLabel="商品マスタCSVを選択"
        buttonLabel="ファイルを選択"
        onSelect={onSelect}
        onError={onError}
      />,
    );

    await user.click(screen.getByRole("button", { name: "商品マスタCSVを選択" }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("ファイルの選択または読み取りに失敗しました");
  });

  it("REQ-401: drop 経路でも同じ bytes・filename・size を返す", async () => {
    const onSelect = vi.fn();
    render(
      <FilePicker
        accept=".csv,.txt"
        ariaLabel="商品別CSVを選択"
        buttonLabel="ファイルを選択"
        dropLabel="CSV / TXT ファイルをドラッグ&ドロップ"
        onSelect={onSelect}
      />,
    );
    const dropzone = screen.getByTestId("file-picker-dropzone");
    const file = new File(["synthetic"], "sales.csv", { type: "text/csv" });

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith({
        bytes: new Uint8Array([115, 121, 110, 116, 104, 101, 116, 105, 99]),
        filename: "sales.csv",
        size: 9,
      });
    });
  });

  it("REQ-202: image accept・上限表示・disabled・accessible label を維持する", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <FilePicker
        accept="image/*"
        ariaLabel="レシート画像"
        buttonLabel="画像を選択"
        id="receipt-image"
        helperText="jpg / png / gif / webp"
        maxSizeLabel="上限 10MB"
        disabled
        onSelect={onSelect}
      />,
    );

    const button = screen.getByRole("button", { name: "レシート画像" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("id", "receipt-image");
    expect(button).toHaveAttribute("data-accept", "image/*");
    expect(screen.getByText("jpg / png / gif / webp")).toBeInTheDocument();
    expect(screen.getByText("上限 10MB")).toBeInTheDocument();

    await user.click(button);
    expect(mockOpen).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
