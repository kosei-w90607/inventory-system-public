// src/features/csv-import/components/ErrorRowsTable.tsx
//
// PreviewStep 内で展開可能な ErrorSummary 表示。最大 100 件、超過時は末尾に「他 N 件...」表示。
// 設計: docs/function-design/55-ui-csv-import.md §55.5 ErrorRowsTable 描画ロジック

import { useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ErrorSummary } from "@/lib/bindings";
import { formatErrorRow } from "../lib/formatErrorRow";

export interface ErrorRowsTableProps {
  errorSummary: ErrorSummary;
}

/// errorSummary.items を Accordion + Table で表示。`error_type` 4 値で Badge variant 色分け。
/// `normalized_jan === null` のセルは「(不明)」表示 (§55.5 ErrorRow 表)。
/// trigger は件数表示ではなく明示的な操作文言で開閉を示し、chevron は文言隣接に置く
/// (§55.5、非 IT operator が展開可能な操作部と認識できなかった owner L3 起源)。
export function ErrorRowsTable({ errorSummary }: ErrorRowsTableProps) {
  const { count, items } = errorSummary;
  const remaining = count - items.length;
  const [openValue, setOpenValue] = useState("");
  const countLabel = count.toLocaleString();

  return (
    <Accordion type="single" collapsible value={openValue} onValueChange={setOpenValue}>
      <AccordionItem value="errors">
        <AccordionTrigger className="justify-start gap-2">
          {openValue === "errors"
            ? `エラー詳細を閉じる（${countLabel}件）`
            : `エラー詳細を見る（${countLabel}件）`}
        </AccordionTrigger>
        <AccordionContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">行</TableHead>
                <TableHead className="w-32">種別</TableHead>
                <TableHead>JAN</TableHead>
                <TableHead>商品名</TableHead>
                <TableHead className="w-20">数量</TableHead>
                <TableHead className="w-24">金額</TableHead>
                <TableHead>メッセージ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => {
                const display = formatErrorRow(row.error_type);
                return (
                  <TableRow key={row.line_no}>
                    <TableCell>{row.line_no}</TableCell>
                    <TableCell>
                      <Badge variant={display.variant}>{display.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {row.normalized_jan ?? <span className="text-muted-foreground">(不明)</span>}
                    </TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>
                      <code className="text-xs">{row.raw_quantity}</code>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{row.raw_amount}</code>
                    </TableCell>
                    <TableCell>{row.error_message}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {remaining > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              他 {remaining.toLocaleString()} 件は CSV ログを参照
            </p>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
