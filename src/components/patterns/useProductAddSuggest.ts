import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { commands, type ProductWithRelations } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";

const DEBOUNCE_MS = 200;
const PER_PAGE = 5;

const PRODUCT_SEARCH_QUERY = {
  department_id: null,
  is_discontinued: false,
  sort_key: "ProductCode" as const,
  sort_order: "Asc" as const,
  page: 1,
  per_page: PER_PAGE,
};

export interface UseProductAddSuggestOptions {
  value: string;
  isLocked: () => boolean;
  onSelect: (product: ProductWithRelations) => void | Promise<void>;
}

export interface ProductAddSuggestController {
  suggestions: ProductWithRelations[];
  totalCount: number;
  activeIndex: number | null;
  listboxId: string;
  isOpen: boolean;
  isLocked: () => boolean;
  getOptionId: (index: number) => string;
  onInputChange: (value: string) => void;
  onInputBlur: () => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => boolean;
  selectSuggestion: (product: ProductWithRelations) => void;
  invalidateAndClose: () => void;
}

export function useProductAddSuggest({
  value,
  isLocked,
  onSelect,
}: UseProductAddSuggestOptions): ProductAddSuggestController {
  const id = useId();
  const listboxId = `${id}-product-add-suggest-listbox`;
  const [suggestions, setSuggestions] = useState<ProductWithRelations[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);
  const latestValueRef = useRef(value);
  const notifiedValueRef = useRef(value);
  const isLockedRef = useRef(isLocked);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    latestValueRef.current = value;
    isLockedRef.current = isLocked;
    onSelectRef.current = onSelect;
  }, [isLocked, onSelect, value]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const closeVisualState = useCallback(() => {
    setSuggestions([]);
    setTotalCount(0);
    setActiveIndex(null);
  }, []);

  const invalidateAndClose = useCallback(() => {
    generationRef.current += 1;
    clearTimer();
    closeVisualState();
  }, [clearTimer, closeVisualState]);

  const loadSuggestions = useCallback(
    async (query: string, generation: number) => {
      if (isLockedRef.current()) return;
      try {
        const result = await unwrapResult(
          commands.searchProducts({ ...PRODUCT_SEARCH_QUERY, keyword: query }),
          { source: "commands", cmd: "search_products" },
        );
        if (
          generation !== generationRef.current ||
          query !== latestValueRef.current ||
          isLockedRef.current()
        ) {
          return;
        }
        setActiveIndex(null);
        if (result.items.length === 0) {
          setSuggestions([]);
          setTotalCount(0);
          return;
        }
        setSuggestions(result.items);
        setTotalCount(result.total_count);
      } catch {
        if (
          generation === generationRef.current &&
          query === latestValueRef.current &&
          !isLockedRef.current()
        ) {
          closeVisualState();
        }
      }
    },
    [closeVisualState],
  );

  const onInputChange = useCallback(
    (nextValue: string) => {
      notifiedValueRef.current = nextValue;
      latestValueRef.current = nextValue;
      generationRef.current += 1;
      const generation = generationRef.current;
      clearTimer();
      closeVisualState();
      if (nextValue.length < 1 || isLockedRef.current()) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void loadSuggestions(nextValue, generation);
      }, DEBOUNCE_MS);
    },
    [clearTimer, closeVisualState, loadSuggestions],
  );

  const selectSuggestion = useCallback(
    (product: ProductWithRelations) => {
      invalidateAndClose();
      void onSelectRef.current(product);
    },
    [invalidateAndClose],
  );

  const onInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): boolean => {
      if (event.nativeEvent.isComposing) return false;

      if (event.key === "ArrowDown") {
        if (suggestions.length === 0) return false;
        event.preventDefault();
        setActiveIndex((current) => {
          if (current === null) return 0;
          return Math.min(current + 1, suggestions.length - 1);
        });
        return true;
      }

      if (event.key === "ArrowUp") {
        if (suggestions.length === 0) return false;
        event.preventDefault();
        setActiveIndex((current) => {
          if (current === null) return suggestions.length - 1;
          return Math.max(current - 1, 0);
        });
        return true;
      }

      if (event.key === "Escape") {
        const hadVisibleState = suggestions.length > 0 || activeIndex !== null;
        invalidateAndClose();
        if (hadVisibleState) event.preventDefault();
        return hadVisibleState;
      }

      if (event.key === "Tab") {
        invalidateAndClose();
        return false;
      }

      if (event.key === "Enter") {
        const active = activeIndex === null ? undefined : suggestions[activeIndex];
        if (active !== undefined) {
          event.preventDefault();
          selectSuggestion(active);
          return true;
        }
        invalidateAndClose();
      }

      return false;
    },
    [activeIndex, invalidateAndClose, selectSuggestion, suggestions],
  );

  useEffect(() => {
    if (value === notifiedValueRef.current) return;
    notifiedValueRef.current = value;
    clearTimer();
    closeVisualState();
  }, [clearTimer, closeVisualState, value]);

  const locked = isLocked();
  useEffect(() => {
    if (locked) invalidateAndClose();
  }, [invalidateAndClose, locked]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      clearTimer();
    };
  }, [clearTimer]);

  const getIsLocked = useCallback(() => isLockedRef.current(), []);
  const getOptionId = useCallback(
    (index: number) => `${listboxId}-option-${String(index)}`,
    [listboxId],
  );

  return {
    suggestions,
    totalCount,
    activeIndex,
    listboxId,
    isOpen: suggestions.length > 0 && value.length > 0 && !locked,
    isLocked: getIsLocked,
    getOptionId,
    onInputChange,
    onInputBlur: invalidateAndClose,
    onInputKeyDown,
    selectSuggestion,
    invalidateAndClose,
  };
}
