export interface OperationLogsSearch {
  start_date?: string;
  end_date?: string;
  operation_type?: string;
  page?: number;
}

export interface NormalizedOperationLogsSearch {
  start_date?: string;
  end_date?: string;
  operation_type?: string;
  page: number;
}

function localDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${String(year)}-${month}-${day}`;
}

export function normalizeOperationLogsSearch(
  search: OperationLogsSearch,
  now = new Date(),
): NormalizedOperationLogsSearch {
  const hasExplicitDateState = search.start_date !== undefined || search.end_date !== undefined;
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  const normalizeDate = (value: string | undefined) => (value === "" ? undefined : value);
  return {
    start_date: hasExplicitDateState ? normalizeDate(search.start_date) : localDate(start),
    end_date: hasExplicitDateState ? normalizeDate(search.end_date) : localDate(now),
    operation_type: search.operation_type === "" ? undefined : search.operation_type,
    page: search.page && search.page > 0 ? search.page : 1,
  };
}
