// src/components/patterns/DepartmentFilter.tsx
//
// 全画面共通部門フィルタ（shadcn Select 単一選択）。
// DepartmentOption は patterns/ 内で定義し、各 feature は import して利用する。
// 設計: docs/function-design/59-ui-shared-patterns.md §59.3
// catalog: docs/design-system/02-component-catalog.md ⑨ 検索 + フィルタ

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_VALUE = "__all__";

/** 部門フィルタの選択肢（各 feature から import して利用する）。 */
export interface DepartmentOption {
  id: number;
  name: string;
}

export interface DepartmentFilterProps {
  options: DepartmentOption[];
  selected: number | null;
  onChange: (deptId: number | null) => void;
  /** フィルタを無効化する（候補ロード中など）。省略時は false */
  disabled?: boolean;
  /**
   * 「すべて選択」の表示文言。省略時は「すべての部門」。
   * daily-sales は意図的差分②として「すべての部門」へ移行（D-B4）。
   */
  allLabel?: string;
  /** SelectTrigger の幅クラス（例: "w-[10rem]" / "w-[11rem]"）。省略時は "w-[10rem]" */
  widthClass?: string;
  /** SelectTrigger / label の id prefix（例: "dept-filter" / "product-dept-filter"）。省略時は "dept-filter" */
  idPrefix?: string;
}

/**
 * 部門フィルタ。呼び出し側で widthClass / idPrefix を渡すことで各画面の DOM を維持する。
 *
 * 意図的差分②（D-B4）: daily-sales の placeholder「すべて」→「すべての部門」は
 * 呼び出し側で allLabel を渡さず既定値を採用することで実現する。
 */
export function DepartmentFilter({
  options,
  selected,
  onChange,
  disabled = false,
  allLabel = "すべての部門",
  widthClass = "w-[10rem]",
  idPrefix = "dept-filter",
}: DepartmentFilterProps) {
  const value = selected === null ? ALL_VALUE : String(selected);
  const triggerId = idPrefix;
  const labelId = `${idPrefix}-label`;

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-muted-foreground" htmlFor={triggerId} id={labelId}>
        部門
      </label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          onChange(v === ALL_VALUE ? null : Number(v));
        }}
      >
        <SelectTrigger id={triggerId} className={widthClass}>
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={String(opt.id)}>
              {opt.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
