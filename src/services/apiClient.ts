import axios from "axios";

export const API_BASE_URL = "/api";

const FRONTEND_SOURCE_REGEX = /(\/(?:src)\/|\\src\\|\.(?:ts|tsx|js|jsx)$)/i;

const assertValidEndpoint = (path: string) => {
  const candidate = path.trim();

  if (FRONTEND_SOURCE_REGEX.test(candidate)) {
    throw new Error(
      `Invalid API path "${candidate}": frontend source files cannot be requested over HTTP.`,
    );
  }
};

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  assertValidEndpoint(path);

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const sanitizedPath = normalizedPath.startsWith("/api/")
    ? normalizedPath.substring(4)
    : normalizedPath === "/api"
    ? "/"
    : normalizedPath;
  const url = `${API_BASE_URL}${sanitizedPath}`;

  const mergedHeaders = new Headers(options.headers ?? undefined);
  const hasBody = options.body !== undefined;

  if (hasBody && !mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: mergedHeaders,
  });

  return response;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export default apiClient;
