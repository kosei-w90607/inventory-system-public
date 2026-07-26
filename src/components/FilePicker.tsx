import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { Upload } from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { extractFilename } from "@/lib/extractFilename";
import { cn } from "@/lib/utils";

export interface PickedFile {
  bytes: Uint8Array;
  filename: string;
  size: number;
}

export interface FilePickerProps {
  id?: string;
  accept: string;
  ariaLabel: string;
  buttonLabel: string;
  onSelect: (file: PickedFile) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  dropEnabled?: boolean;
  dropLabel?: string;
  helperText?: string;
  maxSizeLabel?: string;
  dialogFilterName?: string;
  buttonIcon?: ReactNode;
  className?: string;
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];
const READ_ERROR_MESSAGE = "ファイルの選択または読み取りに失敗しました";

function extensionsFromAccept(accept: string): string[] {
  if (accept === "image/*") return IMAGE_EXTENSIONS;
  return accept
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.startsWith(".") && value.length > 1)
    .map((value) => value.slice(1));
}

export function FilePicker({
  id,
  accept,
  ariaLabel,
  buttonLabel,
  onSelect,
  onError,
  disabled = false,
  dropEnabled = true,
  dropLabel = "ファイルをドラッグ&ドロップ",
  helperText,
  maxSizeLabel,
  dialogFilterName = "ファイル",
  buttonIcon,
  className,
}: FilePickerProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  function reportReadError() {
    if (onError !== undefined) onError(READ_ERROR_MESSAGE);
    else toast.error(READ_ERROR_MESSAGE);
  }

  async function chooseFile() {
    if (disabled) return;
    try {
      const extensions = extensionsFromAccept(accept);
      const path: string | null = await open({
        multiple: false,
        ...(extensions.length > 0 ? { filters: [{ name: dialogFilterName, extensions }] } : {}),
      });
      if (path === null) return;
      const bytes = await readFile(path);
      onSelect({
        bytes,
        filename: extractFilename(path),
        size: bytes.byteLength,
      });
    } catch {
      reportReadError();
    }
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    if (event.dataTransfer.files.length === 0) return;
    const file = event.dataTransfer.files[0];
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      onSelect({ bytes, filename: extractFilename(file.name), size: file.size });
    } catch {
      reportReadError();
    }
  }

  const button = (
    <Button
      id={id}
      type="button"
      variant="outline"
      aria-label={ariaLabel}
      data-accept={accept}
      disabled={disabled}
      onClick={() => void chooseFile()}
    >
      {buttonIcon}
      {buttonLabel}
    </Button>
  );

  if (!dropEnabled) return button;

  return (
    <div
      data-testid="file-picker-dropzone"
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragOver(false);
      }}
      onDrop={(event) => void handleDrop(event)}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
        isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <Upload className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">{dropLabel}</p>
      {helperText !== undefined ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
      {button}
      {maxSizeLabel !== undefined ? (
        <p className="text-xs text-muted-foreground">{maxSizeLabel}</p>
      ) : null}
    </div>
  );
}
