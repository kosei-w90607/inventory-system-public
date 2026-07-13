export type InventoryRecordType =
  | "all"
  | "receiving_record"
  | "return_record"
  | "manual_sale"
  | "disposal_record";
export type InventoryRecordStatus = "all" | "active";

export interface InventoryRecordsSearch {
  recordType?: InventoryRecordType;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  recordId?: number;
  departmentId?: number;
  status?: InventoryRecordStatus;
  page?: number;
}

const validRecordTypes = new Set<InventoryRecordType>([
  "all",
  "receiving_record",
  "return_record",
  "manual_sale",
  "disposal_record",
]);
const validStatuses = new Set<InventoryRecordStatus>(["all", "active"]);

export function normalizeInventoryRecordsSearch(
  search: InventoryRecordsSearch,
): Required<Pick<InventoryRecordsSearch, "recordType" | "status" | "page">> &
  Pick<InventoryRecordsSearch, "dateFrom" | "dateTo" | "q" | "recordId" | "departmentId"> {
  const recordId =
    Number.isInteger(search.recordId) && search.recordId !== undefined && search.recordId > 0
      ? search.recordId
      : undefined;
  const departmentId =
    Number.isInteger(search.departmentId) &&
    search.departmentId !== undefined &&
    search.departmentId > 0
      ? search.departmentId
      : undefined;
  const page =
    Number.isInteger(search.page) && search.page !== undefined && search.page > 0 ? search.page : 1;

  return {
    recordType:
      search.recordType !== undefined && validRecordTypes.has(search.recordType)
        ? search.recordType
        : "all",
    status: search.status !== undefined && validStatuses.has(search.status) ? search.status : "all",
    dateFrom: search.dateFrom?.match(/^\d{4}-\d{2}-\d{2}$/) ? search.dateFrom : undefined,
    dateTo: search.dateTo?.match(/^\d{4}-\d{2}-\d{2}$/) ? search.dateTo : undefined,
    q: search.q?.trim() ? search.q.trim() : undefined,
    recordId,
    departmentId,
    page,
  };
}

export function formatRecordStatus(status: string): string {
  if (status === "active") return "有効";
  if (status === "canceled") return "取消済み";
  if (status === "corrected") return "訂正済み";
  return status;
}

export function formatRecordType(recordType: string): string {
  if (recordType === "receiving_record") return "入庫";
  if (recordType === "return_record") return "返品・交換";
  if (recordType === "manual_sale") return "手動販売出庫";
  if (recordType === "disposal_record") return "廃棄・破損";
  return recordType;
}

export function formatDateTime(value: string): string {
  return value.replace("T", " ");
}

export function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}
