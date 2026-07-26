import type { CmdError } from "./bindings";
import { isCmdError, isInvokeError } from "./invoke";

function extractCmdError(error: unknown): CmdError | null {
  if (isInvokeError(error)) return error.cmdError;
  if (isCmdError(error)) return error;
  return null;
}

/**
 * UI-ERR-D1 / REQ-700: CmdError の利用者向け表示を共通化する。
 * restore_* の recovery 文言は 68 §68.7 が所有するため呼び出し側で扱う。
 */
export function describeError(error: unknown, fallback?: string): string {
  const cmdError = extractCmdError(error);
  if (cmdError) {
    if (cmdError.kind !== "internal") return cmdError.message;
    const idClause = cmdError.error_id ? `（エラーID: ${cmdError.error_id}）` : "";
    return `${cmdError.message}${idClause}。詳細は診断ログに記録されています。`;
  }
  if (fallback !== undefined) return fallback;
  if (error instanceof Error) return error.message;
  return String(error);
}
