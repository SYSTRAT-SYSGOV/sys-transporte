import { useQuery } from "@tanstack/react-query";

import { api } from "../api/client";
import type { Page } from "../api/types";

export type QueryParams = Record<
  string,
  string | number | boolean | undefined | null
>;

export function buildQuery(params: QueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function usePagedList<T>(
  key: string,
  path: string,
  params: QueryParams,
) {
  const query = buildQuery(params);
  return useQuery({
    queryKey: [key, "list", query],
    queryFn: () => api<Page<T>>(`${path}${query}`),
  });
}

export function useOptions<T>(key: string, path: string) {
  return useQuery({
    queryKey: [key, "options"],
    queryFn: () => api<Page<T>>(`${path}?per_page=100&is_active=true`),
  });
}

export function useArray<T>(key: string, path: string) {
  return useQuery({
    queryKey: [key, "array"],
    queryFn: () => api<T[]>(path),
  });
}
