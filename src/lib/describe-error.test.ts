import { describe, expect, it } from "vitest";

import type { CmdError } from "./bindings";
import { describeError } from "./describe-error";
import { InvokeError } from "./invoke";

function invokeError(cmdError: CmdError): InvokeError {
  return new InvokeError(cmdError, { source: "commands", cmd: "synthetic_command" });
}

describe("describeError (REQ-700 / UI-ERR-D1)", () => {
  it("shows the internal message, independently transcribed error ID, and diagnostic guidance", () => {
    const error = invokeError({
      kind: "internal",
      message: "バックアップ一覧の取得でエラーが発生しました",
      field: null,
      error_id: "E-20260726-153021-a1b2",
    });

    expect(describeError(error)).toBe(
      "バックアップ一覧の取得でエラーが発生しました（エラーID: E-20260726-153021-a1b2）。詳細は診断ログに記録されています。",
    );
  });

  it("omits only the ID clause for an older internal payload without error_id", () => {
    const error = invokeError({
      kind: "internal",
      message: "バックアップ一覧の取得でエラーが発生しました",
      field: null,
      error_id: null,
    });

    expect(describeError(error)).toBe(
      "バックアップ一覧の取得でエラーが発生しました。詳細は診断ログに記録されています。",
    );
  });

  it.each(["validation", "export_error", "unknown_kind"])(
    "passes through the message for %s",
    (kind) => {
      const error = invokeError({
        kind,
        message: "独立転記した利用者向けメッセージ",
        field: null,
        error_id: null,
      });

      expect(describeError(error)).toBe("独立転記した利用者向けメッセージ");
    },
  );

  it("uses the caller fallback for a non-command error", () => {
    expect(describeError(new Error("raw browser detail"), "処理を完了できませんでした")).toBe(
      "処理を完了できませんでした",
    );
  });
});
