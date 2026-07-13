import { createFileRoute } from "@tanstack/react-router";
import { ProductImportPage } from "@/features/products/ProductImportPage";

export const Route = createFileRoute("/products/import")({
  component: ProductImportPage,
});
