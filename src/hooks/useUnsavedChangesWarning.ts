import { useBlocker } from "@tanstack/react-router";

export interface UnsavedChangesWarning {
  isBlocked: boolean;
  continueEditing: () => void;
  discardAndProceed: () => void;
}

/// UI-USW-D1: feature-local な dirty 判定を TanStack Router の resolver 型 blocker と
/// beforeunload へ接続する。破棄確認の表示は共通 UnsavedChangesDialog が担う。
export function useUnsavedChangesWarning(isDirty: boolean): UnsavedChangesWarning {
  const blocker = useBlocker({
    shouldBlockFn: () => isDirty,
    withResolver: true,
    enableBeforeUnload: () => isDirty,
  });

  return {
    isBlocked: blocker.status === "blocked",
    continueEditing: () => {
      if (blocker.status === "blocked") blocker.reset();
    },
    discardAndProceed: () => {
      if (blocker.status === "blocked") blocker.proceed();
    },
  };
}
