const baseURL = import.meta.env.VITE_API_BASE_URL ?? "";

type RequestOptions = RequestInit & { body?: unknown };

type ApiResponse<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
};

const buildUrl = (path: string) => {
  if (/^https?:/i.test(path)) {
    return path;
  }

  if (!baseURL) {
    return path;
  }

  if (path.startsWith("/")) {
    return `${baseURL}${path}`;
  }

  return `${baseURL}/${path}`;
};

const parseBody = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
};

const request = async <T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> => {
  const { body, headers, ...rest } = options;
  const init: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    ...rest,
  };

  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(buildUrl(path), init);
  let data: T | null = null;

  try {
    data = await parseBody(response);
  } catch (error) {
    console.error("No se pudo interpretar la respuesta JSON del API:", error);
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
};

const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

export default api;
