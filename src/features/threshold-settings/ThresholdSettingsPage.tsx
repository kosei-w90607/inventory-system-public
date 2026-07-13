// src/features/threshold-settings/ThresholdSettingsPage.tsx
//
// UI-11a 閾値設定（在庫少の基準）画面本体。
// 設計: docs/function-design/69-ui-threshold-settings.md（UI-11a-D1〜D7）
//
// - この画面が所有する app_settings key は stock_low_threshold /
//   stock_low_threshold_fabric の 2 件のみ（UI-11a-D1）。
// - 保存は単一の「保存する」ボタン。dirty な key のみ順次 updateSetting し、
//   確認ダイアログは挟まない（UI-11a-D2、可逆操作のため）。
// - 検証は整数 1〜99999。CMD/BIZ 側にはバリデーションを追加しない（UI-11a-D3）。
// - 保存成功後は settings query + 在庫少判定を参照する query（ホームサマリ / 在庫照会）を
//   invalidate する（UI-11a-D4、§69.10）。
// - operator 向け表示名は「在庫少の基準」で統一する（UI-11a-D6）。

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/patterns/PageHeader";
import { FormSection } from "@/components/patterns/FormSection";
import { queryKeys } from "@/lib/query-keys";

import {
  THRESHOLD_FIELD_LABELS,
  THRESHOLD_FIELD_ORDER,
  isReadableThresholdValue,
  type ThresholdField,
} from "./lib/extract-thresholds";
import { thresholdSettingsSchema, isThresholdField } from "./lib/threshold-form-schema";
import { useThresholdSettings } from "./hooks/useThresholdSettings";
import { useSaveThresholds, type ThresholdSaveEntry } from "./hooks/useSaveThresholds";

const UNREADABLE_VALUE_MESSAGE = "現在の設定値が読み取れません。正しい値を入力して保存してください";

type ThresholdFormState = Record<ThresholdField, string>;

const EMPTY_VALUES: ThresholdFormState = {
  stockLowThreshold: "",
  stockLowThresholdFabric: "",
};

function FieldError({ message }: { message: string | undefined }) {
  return message === undefined ? null : (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

export function ThresholdSettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useThresholdSettings();
  const saveMutation = useSaveThresholds();

  const [hasHydrated, setHasHydrated] = useState(false);
  const [values, setValues] = useState<ThresholdFormState>(EMPTY_VALUES);
  const [savedValues, setSavedValues] = useState<ThresholdFormState>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<ThresholdField, string>>>({});
  const [saveAlertMessage, setSaveAlertMessage] = useState<string | null>(null);

  // 画面表示時（§69.5 ステップ1）: 取得値から 2 key を初期値にする。
  // 非数値の既存値（DB 直接操作等）は空欄 + 回復 FieldError にする（§69.7）。
  useEffect(() => {
    if (!settingsQuery.data || hasHydrated) return;

    const nextValues: ThresholdFormState = { ...settingsQuery.data };
    const nextErrors: Partial<Record<ThresholdField, string>> = {};

    for (const field of THRESHOLD_FIELD_ORDER) {
      if (!isReadableThresholdValue(nextValues[field])) {
        nextValues[field] = "";
        nextErrors[field] = UNREADABLE_VALUE_MESSAGE;
      }
    }

    setValues(nextValues);
    setSavedValues(nextValues);
    setErrors(nextErrors);
    setHasHydrated(true);
  }, [settingsQuery.data, hasHydrated]);

  const isDirty = THRESHOLD_FIELD_ORDER.some((field) => values[field] !== savedValues[field]);

  function handleChange(field: ThresholdField, next: string) {
    setValues((prev) => ({ ...prev, [field]: next }));
  }

  function handleSubmit() {
    if (saveMutation.isPending) return;

    const parsed = thresholdSettingsSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Partial<Record<ThresholdField, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (isThresholdField(field) && !(field in nextErrors)) {
          nextErrors[field] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSaveAlertMessage(null);

    // BIZ 側 list_low_stock の parse::<i64>() は前後空白を受け付けないため、
    // 保存・dirty 判定・保存済み値・toast は検証と同じ trim 済み値に統一する
    // （Spec Contract: 整数 1〜99999 のみ保存可能）。
    const submittedValues: ThresholdFormState = {
      stockLowThreshold: values.stockLowThreshold.trim(),
      stockLowThresholdFabric: values.stockLowThresholdFabric.trim(),
    };
    setValues(submittedValues);

    const dirtyFields = THRESHOLD_FIELD_ORDER.filter(
      (field) => submittedValues[field] !== savedValues[field],
    );
    if (dirtyFields.length === 0) return;

    const entries: ThresholdSaveEntry[] = dirtyFields.map((field) => ({
      field,
      value: submittedValues[field],
    }));

    saveMutation.mutate(
      { entries },
      {
        onSuccess: (result) => {
          if (result.failedField === null) {
            setSavedValues(submittedValues);
            setSaveAlertMessage(null);
            void queryClient.invalidateQueries({
              queryKey: queryKeys.thresholdSettings.settings(),
            });
            void queryClient.invalidateQueries({ queryKey: queryKeys.lowStock(false) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.stockInquiryRoot() });
            toast.success(
              `在庫少の基準を保存しました（一般商品: ${submittedValues.stockLowThreshold}個以下 / 生地: ${submittedValues.stockLowThresholdFabric}cm以下）`,
              { id: "threshold-save-success" },
            );
            return;
          }

          const failedField = result.failedField;
          setSavedValues((prev) => {
            const next = { ...prev };
            for (const field of result.succeededFields) {
              next[field] = submittedValues[field];
            }
            return next;
          });
          void settingsQuery.refetch();

          if (result.succeededFields.length > 0) {
            const succeededField = result.succeededFields[0];
            const message = `${THRESHOLD_FIELD_LABELS[failedField]}の保存に失敗しました。${THRESHOLD_FIELD_LABELS[succeededField]}は保存済みです。もう一度保存してください`;
            setSaveAlertMessage(message);
          } else {
            const message = "保存に失敗しました。もう一度保存してください";
            setSaveAlertMessage(message);
            toast.error(message);
          }
        },
        onError: () => {
          const message = "保存に失敗しました。もう一度保存してください";
          setSaveAlertMessage(message);
          toast.error(message);
        },
      },
    );
  }

  const showForm = !settingsQuery.isError && hasHydrated;

  return (
    <div className="min-h-screen space-y-6 p-6">
      <PageHeader
        title="在庫少の基準"
        subtitle="在庫がこの数以下になったら「在庫少」としてお知らせします"
      />

      {settingsQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>設定を読み込めませんでした</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>もう一度読み込んでください。</p>
            <Button type="button" variant="outline" onClick={() => void settingsQuery.refetch()}>
              <RotateCcw />
              再試行
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!settingsQuery.isError && !hasHydrated ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : null}

      {showForm ? (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          {saveAlertMessage !== null ? (
            <Alert variant="destructive">
              <AlertTitle>保存できませんでした</AlertTitle>
              <AlertDescription>{saveAlertMessage}</AlertDescription>
            </Alert>
          ) : null}

          <fieldset disabled={saveMutation.isPending} className="space-y-6 disabled:opacity-70">
            <FormSection
              title="在庫少の基準"
              description="保存すると、ホームと在庫照会の在庫少の判定にすぐ反映されます"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="stock-low-threshold">一般商品の基準（必須）</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="stock-low-threshold"
                      className="max-w-32"
                      inputMode="numeric"
                      value={values.stockLowThreshold}
                      onChange={(event) => {
                        handleChange("stockLowThreshold", event.target.value);
                      }}
                    />
                    <span className="text-sm text-muted-foreground">個</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    在庫がこの個数以下になったら在庫少（初期値: 3個）
                  </p>
                  <FieldError message={errors.stockLowThreshold} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="stock-low-threshold-fabric">生地の基準（必須）</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="stock-low-threshold-fabric"
                      className="max-w-32"
                      inputMode="numeric"
                      value={values.stockLowThresholdFabric}
                      onChange={(event) => {
                        handleChange("stockLowThresholdFabric", event.target.value);
                      }}
                    />
                    <span className="text-sm text-muted-foreground">cm</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    在庫がこの長さ以下になったら在庫少（初期値: 500cm = 5m）
                  </p>
                  <FieldError message={errors.stockLowThresholdFabric} />
                </div>
              </div>
            </FormSection>

            <div className="flex justify-end border-t pt-4">
              <Button type="submit" disabled={!isDirty || saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                保存する
              </Button>
            </div>
          </fieldset>
        </form>
      ) : null}
    </div>
  );
}
