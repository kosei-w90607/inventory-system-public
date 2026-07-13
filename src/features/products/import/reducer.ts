import type { ProductImportAction, ProductImportState } from "./types";

function updateOverwriteCodes(codes: string[], productCode: string, checked: boolean): string[] {
  if (checked) {
    if (codes.includes(productCode)) return codes;
    return [...codes, productCode];
  }
  return codes.filter((code) => code !== productCode);
}

export function productImportReducer(
  state: ProductImportState,
  action: ProductImportAction,
): ProductImportState {
  if (action.type === "reset") {
    return { status: "idle" };
  }

  switch (state.status) {
    case "idle":
      if (action.type === "select_file") {
        return { status: "previewing", filename: action.filename };
      }
      return state;

    case "previewing":
      if (action.type === "preview_succeeded") {
        return {
          status: "preview",
          filename: state.filename,
          preview: action.preview,
          overwriteCodes: [],
        };
      }
      if (action.type === "preview_failed") {
        return {
          status: "error",
          error: action.error,
          recoverTo: "idle",
          previousState: state,
        };
      }
      return state;

    case "preview":
      if (action.type === "toggle_overwrite") {
        return {
          ...state,
          overwriteCodes: updateOverwriteCodes(
            state.overwriteCodes,
            action.productCode,
            action.checked,
          ),
        };
      }
      if (action.type === "commit_requested") {
        return {
          status: "committing",
          filename: state.filename,
          preview: state.preview,
          overwriteCodes: state.overwriteCodes,
          targetRows: action.targetRows,
        };
      }
      if (action.type === "select_file") {
        return { status: "previewing", filename: action.filename };
      }
      return state;

    case "committing":
      if (action.type === "commit_succeeded") {
        return { status: "result", result: action.result };
      }
      if (action.type === "commit_failed") {
        return {
          status: "error",
          error: action.error,
          recoverTo: action.recoverTo,
          previousState:
            action.recoverTo === "preview"
              ? {
                  status: "preview",
                  filename: state.filename,
                  preview: state.preview,
                  overwriteCodes: state.overwriteCodes,
                }
              : state,
        };
      }
      return state;

    case "result":
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

export const PRODUCT_IMPORT_INITIAL_STATE: ProductImportState = { status: "idle" };
