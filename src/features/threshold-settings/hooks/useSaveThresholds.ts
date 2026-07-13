// src/features/threshold-settings/hooks/useSaveThresholds.ts
//
// dirty な key のみ順次 updateSetting する（UI-11a-D2）。呼び出し元（ThresholdSettingsPage）が
// entries の順序（THRESHOLD_FIELD_ORDER）と対象（dirty key のみ）を決めて渡す。
// 途中の key が失敗した時点で以降は試行しない。「保存済み」と事実に反する表示をしないため、
// どこまで進んだかを succeededFields / failedField として呼び出し元に返す（69 §69.8）。

import { useMutation } from "@tanstack/react-query";

import { commands } from "@/lib/bindings";
import { type InvokeError, unwrapResult } from "@/lib/invoke";

import { THRESHOLD_SETTING_KEY_BY_FIELD, type ThresholdField } from "../lib/extract-thresholds";

export interface ThresholdSaveEntry {
  field: ThresholdField;
  value: string;
}

export interface ThresholdSaveRequest {
  entries: ThresholdSaveEntry[];
}

export interface ThresholdSaveResult {
  succeededFields: ThresholdField[];
  failedField: ThresholdField | null;
}

export function useSaveThresholds() {
  return useMutation<ThresholdSaveResult, InvokeError, ThresholdSaveRequest>({
    mutationFn: async ({ entries }) => {
      const succeededFields: ThresholdField[] = [];
      let failedField: ThresholdField | null = null;

      for (const entry of entries) {
        try {
          await unwrapResult(
            commands.updateSetting({
              key: THRESHOLD_SETTING_KEY_BY_FIELD[entry.field],
              value: entry.value,
            }),
            { source: "commands", cmd: "update_setting" },
          );
          succeededFields.push(entry.field);
        } catch {
          failedField = entry.field;
          break;
        }
      }

      return { succeededFields, failedField };
    },
  });
}
