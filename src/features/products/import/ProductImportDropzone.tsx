import { FilePicker, type PickedFile } from "@/components/FilePicker";

export interface ProductImportDropzoneProps {
  onFileSelect: (file: PickedFile) => void;
  disabled?: boolean;
}

export function ProductImportDropzone({
  onFileSelect,
  disabled = false,
}: ProductImportDropzoneProps) {
  return (
    <FilePicker
      accept=".csv,.txt"
      ariaLabel="ファイルを選択（商品マスタCSV）"
      buttonLabel="ファイルを選択"
      dialogFilterName="CSV / TXT"
      dropLabel="商品マスタCSVをドラッグ&ドロップ"
      maxSizeLabel="上限 20MB"
      className="min-h-72"
      disabled={disabled}
      onSelect={onFileSelect}
    />
  );
}
