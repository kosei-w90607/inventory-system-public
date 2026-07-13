import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ProductImportDropzoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function ProductImportDropzone({
  onFileSelect,
  disabled = false,
}: ProductImportDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFileSelect(file);
    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!disabled) setIsDragOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    const file = event.dataTransfer.files.item(0);
    if (file) onFileSelect(file);
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
        isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <Upload className="size-9 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-medium">商品マスタCSVをドラッグ&ドロップ</p>
        <p className="text-xs text-muted-foreground">上限 20MB</p>
      </div>
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
        aria-label="商品マスタCSVを選択"
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
}
