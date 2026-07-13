import * as React from "react";

import { cn } from "@/lib/utils";

export const segmentedControlListClass =
  "inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground";

export const segmentedControlItemClass =
  "relative inline-flex h-[calc(100%-1px)] flex-none appearance-none items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-all focus-visible:border-stone-300 focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";

export const segmentedControlActiveClass =
  "border-stone-300 bg-stone-300 font-semibold text-stone-950 hover:bg-stone-300 hover:text-stone-950";

export const segmentedControlInactiveClass = "text-foreground/60 hover:text-foreground";

export type SegmentedControlOption<TValue extends string> = Readonly<{
  value: TValue;
  label: React.ReactNode;
  disabled?: boolean;
}>;

export interface SegmentedControlProps<TValue extends string> {
  ariaLabel: string;
  value: TValue;
  options: readonly SegmentedControlOption<TValue>[];
  onValueChange: (value: TValue) => void;
  className?: string;
  itemClassName?: string;
}

export function SegmentedControl<TValue extends string>({
  ariaLabel,
  value,
  options,
  onValueChange,
  className,
  itemClassName,
}: SegmentedControlProps<TValue>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn(segmentedControlListClass, className)}>
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            data-state={isActive ? "active" : "inactive"}
            disabled={option.disabled}
            className={cn(
              segmentedControlItemClass,
              isActive ? segmentedControlActiveClass : segmentedControlInactiveClass,
              itemClassName,
            )}
            onClick={() => {
              if (!isActive && !option.disabled) {
                onValueChange(option.value);
              }
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
