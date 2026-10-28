export class ApiError extends Error {
  status: number;
  errors: { field: string; message: string }[];

  constructor(
    status: number,
    message: string,
    errors: { field: string; message: string }[] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

const ACCESS_KEY = "transport.access_token";
const REFRESH_KEY = "transport.refresh_token";

export const session = {
  access: () => localStorage.getItem(ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY),
  save(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

type ErrorBody = {
  title?: string;
  detail?: string;
  errors?: { field: string; message: string }[];
};

async function send(
  path: string,
  init: RequestInit,
  token?: string | null,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`/api/v1${path}`, { ...init, headers });
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
  }
  if (!response.ok) {
    const problem = (body ?? {}) as ErrorBody;
    throw new ApiError(
      response.status,
      problem.detail ??
        problem.title ??
        `Falha na requisição (${response.status})`,
      problem.errors ?? [],
    );
  }
  return body as T;
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshing) {
    return refreshing;
  }
  const token = session.refresh();
  if (!token) {
    return false;
  }
  refreshing = (async () => {
    try {
      const response = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: token }),
      });
      if (!response.ok) {
        return false;
      }
      const data = (await response.json()) as {
        access_token: string;
        refresh_token: string;
      };
      session.save(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await send(path, init, session.access());
  if (response.status === 401 && !path.startsWith("/auth/login")) {
    const renewed = await refreshSession();
    if (renewed) {
      response = await send(path, init, session.access());
    }
  }
  if (response.status === 401) {
    session.clear();
  }
  return parse<T>(response);
}

export async function downloadCsv(
  path: string,
  fallbackName: string,
): Promise<void> {
  const response = await send(path, { method: "GET" }, session.access());
  if (!response.ok) {
    await parse(response);
    return;
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const name = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function jsonBody(body: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(body) };
}
