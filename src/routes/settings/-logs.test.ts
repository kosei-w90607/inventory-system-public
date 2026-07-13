import { describe, expect, it } from "vitest";
import { operationLogsSearchSchema } from "./logs";

describe("UI-11c REQ-902 route search", () => {
  it("drops malformed dates and invalid pages while preserving an unknown operation type", () => {
    expect(
      operationLogsSearchSchema.parse({
        start_date: "2026/07/11",
        end_date: "not-a-date",
        operation_type: "future_type",
        page: "0",
      }),
    ).toEqual({ operation_type: "future_type" });
  });

  it("round-trips valid search values", () => {
    expect(
      operationLogsSearchSchema.parse({
        start_date: "2026-07-01",
        end_date: "2026-07-11",
        operation_type: "backup_create",
        page: "3",
      }),
    ).toEqual({
      start_date: "2026-07-01",
      end_date: "2026-07-11",
      operation_type: "backup_create",
      page: 3,
    });
  });

  it("round-trips the largest positive page accepted by the u32 command wire", () => {
    expect(operationLogsSearchSchema.parse({ page: String(0xffff_ffff) })).toEqual({
      page: 0xffff_ffff,
    });
  });

  it("round-trips explicit one-sided and fully-cleared date states", () => {
    expect(operationLogsSearchSchema.parse({ start_date: "2026-07-01" })).toEqual({
      start_date: "2026-07-01",
    });
    expect(operationLogsSearchSchema.parse({ end_date: "2026-07-11" })).toEqual({
      end_date: "2026-07-11",
    });
    expect(operationLogsSearchSchema.parse({ start_date: "", end_date: "" })).toEqual({
      start_date: "",
      end_date: "",
    });
  });
});
