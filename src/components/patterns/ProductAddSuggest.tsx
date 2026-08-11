import {
  cloneElement,
  useState,
  type ChangeEvent,
  type CompositionEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
} from "react";

import { Button } from "@/components/ui/button";
import { isComposedDigitsOnly, normalizeComposedDigits } from "./normalizeComposedDigits";
import type { ProductAddSuggestController } from "./useProductAddSuggest";

type SuggestInputProps = InputHTMLAttributes<HTMLInputElement>;

export interface ProductAddSuggestProps {
  controller: ProductAddSuggestController;
  onComposedDigitsCommit?: (normalized: string) => void;
  children: ReactElement<SuggestInputProps>;
}

export function ProductAddSuggest({
  controller,
  onComposedDigitsCommit,
  children,
}: ProductAddSuggestProps) {
  const [suppressNextEnter, setSuppressNextEnter] = useState(false);
  const childOnChange = children.props.onChange;
  const childOnKeyDown = children.props.onKeyDown;
  const childOnCompositionEnd = children.props.onCompositionEnd;
  const childOnBlur = children.props.onBlur;
  const activeOptionId =
    controller.activeIndex === null ? undefined : controller.getOptionId(controller.activeIndex);
  const remainingCount = Math.max(controller.totalCount - controller.suggestions.length, 0);

  const input = cloneElement(children, {
    role: "combobox",
    "aria-expanded": controller.isOpen,
    "aria-controls": controller.listboxId,
    "aria-activedescendant": activeOptionId,
    autoComplete: children.props.autoComplete ?? "off",
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      setSuppressNextEnter(false);
      const input = event.currentTarget;
      const nextValue = (event.nativeEvent as InputEvent).isComposing
        ? input.value
        : normalizeComposedDigits(input.value);
      input.value = nextValue;
      childOnChange?.(event);
      controller.onInputChange(nextValue);
    },
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.nativeEvent.isComposing) {
        childOnKeyDown?.(event);
        return;
      }
      if (suppressNextEnter) {
        setSuppressNextEnter(false);
        if (event.key === "Enter") {
          event.preventDefault();
          return;
        }
      }
      const handled = controller.onInputKeyDown(event);
      if (!handled) childOnKeyDown?.(event);
    },
    onCompositionEnd: (event: CompositionEvent<HTMLInputElement>) => {
      childOnCompositionEnd?.(event);
      const composedValue = event.currentTarget.value;
      if (!isComposedDigitsOnly(composedValue) || controller.isLocked()) return;

      const normalized = normalizeComposedDigits(composedValue);
      const input = event.currentTarget;
      input.value = normalized;
      const changeEvent = {
        ...event,
        type: "change",
        target: input,
        currentTarget: input,
      } as unknown as ChangeEvent<HTMLInputElement>;
      childOnChange?.(changeEvent);
      controller.onInputChange(normalized);
      controller.invalidateAndClose();
      setSuppressNextEnter(true);
      onComposedDigitsCommit?.(normalized);
    },
    onBlur: (event: FocusEvent<HTMLInputElement>) => {
      childOnBlur?.(event);
      controller.onInputBlur();
    },
  });

  return (
    <div className="relative">
      {input}
      {controller.isOpen ? (
        <div
          id={controller.listboxId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {controller.suggestions.map((product, index) => {
            const isActive = controller.activeIndex === index;
            return (
              <Button
                key={product.product_code}
                id={controller.getOptionId(index)}
                type="button"
                variant="ghost"
                role="option"
                tabIndex={-1}
                aria-selected={isActive}
                className={`grid h-auto w-full grid-cols-[minmax(7rem,auto)_minmax(0,1fr)_minmax(6rem,auto)] items-center gap-3 rounded-none px-3 py-2 text-left text-sm ${
                  isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"
                }`}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  controller.selectSuggestion(product);
                }}
              >
                <span className="font-medium">{product.product_code}</span>
                <span className="min-w-0 truncate">{product.name}</span>
                <span className="truncate text-muted-foreground">{product.department_name}</span>
              </Button>
            );
          })}
          {remainingCount > 0 ? (
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              ほか {remainingCount} 件（候補未選択で Enter: 従来の検索）
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export type { ProductAddSuggestController } from "./useProductAddSuggest";
