import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";

export interface SortableHeaderProps<T extends string> {
  column: T;
  label: string;
  sortBy: T | null;
  sortDir: "asc" | "desc";
  onClick: (column: T) => void;
  align?: "left" | "right";
}

export function SortableHeader<T extends string>({
  column,
  label,
  sortBy,
  sortDir,
  onClick,
  align = "left",
}: SortableHeaderProps<T>) {
  const isActive = sortBy === column;
  const indicator = isActive ? (sortDir === "asc" ? "▲" : "▼") : "";
  const alignClass = align === "right" ? "text-right" : "";
  const ariaSort: "ascending" | "descending" | "none" = isActive
    ? sortDir === "asc"
      ? "ascending"
      : "descending"
    : "none";
  return (
    <TableHead className={alignClass} aria-sort={ariaSort}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-mx-3 h-auto gap-1 px-3 py-0 font-medium hover:bg-transparent hover:text-foreground"
        onClick={() => {
          onClick(column);
        }}
      >
        {label} <span aria-hidden="true">{indicator}</span>
      </Button>
    </TableHead>
  );
}
