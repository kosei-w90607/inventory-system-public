import { ALargeSmall } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useDisplayScale } from "./useDisplayScale";

// UI-12: 全画面共通の表示サイズ操作。
// H-6 feedback の「商品コードが小さい」を、画面横断の WebView zoom として扱う。
export function DisplayScaleControl() {
  const { displayScale, setDisplayScale, options } = useDisplayScale();

  return (
    <div className="shrink-0 border-t border-border bg-muted/80 px-3 py-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <ALargeSmall className="size-4 stroke-[1.5]" aria-hidden="true" />
        <span id="display-scale-label">表示サイズ</span>
      </div>
      <Select value={displayScale} onValueChange={setDisplayScale}>
        <SelectTrigger
          id="display-scale-select"
          aria-labelledby="display-scale-label"
          size="sm"
          className="h-9 w-full bg-background text-sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
