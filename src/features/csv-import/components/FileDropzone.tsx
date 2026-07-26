import { FilePicker, type PickedFile } from "@/components/FilePicker";

export interface FileDropzoneProps {
  onFileSelect: (file: PickedFile) => void;
  disabled?: boolean;
}

export function FileDropzone({ onFileSelect, disabled = false }: FileDropzoneProps) {
  return (
    <FilePicker
      accept=".csv,.txt"
      ariaLabel="ファイルを選択（商品別CSV）"
      buttonLabel="ファイルを選択"
      dialogFilterName="CSV / TXT"
      dropLabel="CSV / TXT ファイルをドラッグ&ドロップ"
      helperText="または"
      maxSizeLabel="上限 20MB"
      className="p-12"
      disabled={disabled}
      onSelect={onFileSelect}
    />
  );
}
