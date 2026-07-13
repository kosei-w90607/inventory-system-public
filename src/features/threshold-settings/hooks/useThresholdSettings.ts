// src/features/threshold-settings/hooks/useThresholdSettings.ts
//
// getSettings を包む useQuery + 所有 2 key 抽出（69 §69.4 / §69.5 ステップ1）。

import { useQuery } from "@tanstack/react-query";

import { commands } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";
import { queryKeys } from "@/lib/query-keys";

import { extractThresholds, type ThresholdValues } from "../lib/extract-thresholds";

export function useThresholdSettings() {
  return useQuery<ThresholdValues>({
    queryKey: queryKeys.thresholdSettings.settings(),
    queryFn: async () => {
      const settings = await unwrapResult(commands.getSettings(), {
        source: "commands",
        cmd: "get_settings",
      });
      return extractThresholds(settings);
    },
  });
}
