/** Responses list filters, shared by the Responses page and the CSV export. */
export type ResponseDataFilter = "live" | "test" | "all";
export type ResponseStatusFilter = "all" | "completed" | "incomplete";

export interface ResponseFilters {
  q: string;
  data: ResponseDataFilter;
  status: ResponseStatusFilter;
  page: number;
}

export const RESPONSES_PAGE_SIZE = 50;

export function parseResponseFilters(params: URLSearchParams, defaultData: ResponseDataFilter): ResponseFilters {
  const data = params.get("data");
  const status = params.get("status");
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    q: (params.get("q") ?? "").trim().slice(0, 200),
    data: data === "live" || data === "test" || data === "all" ? data : defaultData,
    status: status === "completed" || status === "incomplete" ? status : "all",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Search params for the given filters (omits defaults; never includes the page unless > 1). */
export function filtersToSearch(f: Partial<ResponseFilters>): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.data) p.set("data", f.data);
  if (f.status && f.status !== "all") p.set("status", f.status);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}
