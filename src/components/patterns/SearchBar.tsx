// src/components/patterns/SearchBar.tsx
//
// 共通検索バー。commit 型（debounceMs 未指定）と live 型（debounceMs 指定）を切り替える。
// - commit 型: draft local state + Enter/ボタンで onSearchChange(draft.trim()) を呼ぶ（trim あり）
// - live 型: debounce onChange + Enter で即時 flush（trim なし）
// - 両モードとも Enter keydown に isComposing ガード付き（IME 変換確定の Enter を除外）
// 設計: docs/function-design/59-ui-shared-patterns.md §59.5
// catalog: docs/design-system/02-component-catalog.md ⑨ 検索 + フィルタ

import * as React from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SearchBarProps {
  value: string;
  onSearchChange: (value: string) => void;
  debounceMs?: number;
  label?: string;
  id?: string;
  placeholder?: string;
  ariaLabel?: string;
  showSubmitButton?: boolean;
  type?: string;
  wrapperClassName?: string;
  inputClassName?: string;
}

// ---------------------------------------------------------------------------
// commit 型（debounceMs 未指定）— ProductSearchBar の挙動
// ---------------------------------------------------------------------------

function CommitSearchBar({
  value,
  onSearchChange,
  label,
  id,
  placeholder,
  ariaLabel,
  showSubmitButton,
  type,
  wrapperClassName,
  inputClassName,
}: Omit<SearchBarProps, "debounceMs">) {
  const [draft, setDraft] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const inputId = id ?? "search-input";
  const inputAriaLabel = ariaLabel ?? "商品検索";
  const inputPlaceholder = placeholder ?? "商品コード・商品名・JANで検索";
  const inputLabel = label ?? "検索";
  const showButton = showSubmitButton !== false;
  const inputType = type ?? "text";
  const wrapperClass = wrapperClassName ?? "flex min-w-[18rem] flex-1 items-center gap-2";

  const commit = () => {
    onSearchChange(draft.trim());
  };

  return (
    <div className={wrapperClass}>
      <Label htmlFor={inputId} className="shrink-0 text-muted-foreground">
        {inputLabel}
      </Label>
      <Input
        ref={inputRef}
        id={inputId}
        type={inputType}
        value={draft}
        aria-label={inputAriaLabel}
        placeholder={inputPlaceholder}
        className={inputClassName}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          // IME 変換確定の Enter は検索発火しない
          // （memory: feedback-ime-composition-keydown-exclusion）
          if (event.nativeEvent.isComposing) {
            return;
          }
          if (event.key === "Enter") {
            commit();
          }
        }}
      />
      {showButton && (
        <Button type="button" variant="outline" onClick={commit}>
          <Search aria-hidden="true" />
          検索
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// live 型（debounceMs 指定）— stock SearchBar の挙動
// ---------------------------------------------------------------------------

function LiveSearchBar({
  value,
  onSearchChange,
  debounceMs,
  placeholder,
  ariaLabel,
  type,
  inputClassName,
}: Omit<SearchBarProps, "label" | "id" | "showSubmitButton" | "wrapperClassName"> & {
  debounceMs: number;
}) {
  const [text, setText] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  React.useEffect(() => {
    setText(value);
  }, [value]);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const inputAriaLabel = ariaLabel ?? "商品検索";
  const inputPlaceholder = placeholder ?? "商品コード・商品名・JANで検索";
  const inputType = type ?? "search";
  const inputClass = inputClassName ?? "max-w-md";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setText(next);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      onSearchChange(next);
    }, debounceMs);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // IME 変換確定の Enter は検索発火しない
    // （memory: feedback-ime-composition-keydown-exclusion）
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      onSearchChange(text);
    }
  }

  return (
    <Input
      ref={inputRef}
      type={inputType}
      value={text}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={inputPlaceholder}
      aria-label={inputAriaLabel}
      className={inputClass}
    />
  );
}

// ---------------------------------------------------------------------------
// エントリーポイント: debounceMs の有無で型を切り替える
// ---------------------------------------------------------------------------

export function SearchBar({ debounceMs, ...rest }: SearchBarProps) {
  if (debounceMs !== undefined) {
    return <LiveSearchBar {...rest} debounceMs={debounceMs} />;
  }
  return <CommitSearchBar {...rest} />;
}
