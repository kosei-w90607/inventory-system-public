import type { DailyReportImportAction, DailyReportImportState } from "./types";

export function dailyReportImportReducer(
  state: DailyReportImportState,
  action: DailyReportImportAction,
): DailyReportImportState {
  if (action.type === "reset") return { status: "idle" };

  switch (state.status) {
    case "idle":
      if (action.type === "select_files") {
        return { status: "parsing", filenames: action.filenames };
      }
      return state;
    case "parsing":
      if (action.type === "parse_succeeded") {
        return {
          status: "preview",
          preview: action.preview,
          previewToken: action.previewToken,
          filenames: state.filenames,
        };
      }
      if (action.type === "parse_failed") {
        return {
          status: "error",
          error: action.error,
          recoverTo: "idle",
          previousState: state,
        };
      }
      return state;
    case "preview":
      if (action.type === "confirm_import") {
        return {
          status: "importing",
          preview: state.preview,
          previewToken: state.previewToken,
          overwriteConfirmed: action.overwriteConfirmed,
          filenames: state.filenames,
        };
      }
      if (action.type === "select_files") {
        return { status: "parsing", filenames: action.filenames };
      }
      return state;
    case "importing":
      if (action.type === "import_succeeded") {
        return { status: "result", result: action.result, reportDate: action.reportDate };
      }
      if (action.type === "import_failed") {
        return {
          status: "error",
          error: action.error,
          recoverTo: action.recoverTo,
          previousState:
            action.recoverTo === "preview"
              ? {
                  status: "preview",
                  preview: state.preview,
                  previewToken: state.previewToken,
                  filenames: state.filenames,
                }
              : state,
        };
      }
      return state;
    case "result":
      if (action.type === "rollback_succeeded") return { status: "idle" };
      return state;
    case "error":
      if (action.type === "dismiss_error") {
        if (state.recoverTo === "preview" && state.previousState.status === "preview") {
          return state.previousState;
        }
        return { status: "idle" };
      }
      return state;
  }
}
