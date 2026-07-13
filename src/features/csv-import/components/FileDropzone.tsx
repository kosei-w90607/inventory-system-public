// src/features/csv-import/components/FileDropzone.tsx
//
// plain <input type="file"> + drag&drop ハンドラの簡易ファイル選択。
// UI_TECH_STACK §6.5.4 暫定例外。plugin-dialog 移行は Phase 3 で別 PR まとめ。
// 設計: docs/function-design/55-ui-csv-import.md §55.1 / §55.4 (ファイル選択 / drag&drop)

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

/// CSV / TXT ファイルのドラッグ&ドロップ + ボタン経由のファイル選択。
/// disabled 時はクリック / drop を無視。視覚的にも 50% 透過。
export function FileDropzone({ onFileSelect, disabled = false }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    // 同一ファイルの再選択を許すため value をリセット
    e.target.value = "";
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFileSelect(files[0]);
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 transition-colors",
        isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <Upload className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">CSV / TXT ファイルをドラッグ&ドロップ</p>
      <p className="text-xs text-muted-foreground">または</p>
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        ファイルを選択
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt"
        className="sr-only"
        onChange={handleChange}
        disabled={disabled}
      />
      <p className="text-xs text-muted-foreground">上限 20MB</p>
    </div>
  );
}
