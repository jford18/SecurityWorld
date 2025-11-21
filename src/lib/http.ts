import { API_BASE_URL } from "../services/apiClient";

const FRONTEND_SOURCE_REGEX = /(\/(?:src)\/|\\src\\|\.(?:ts|tsx|js|jsx)$)/i;

const assertValidEndpoint = (path: string) => {
  const candidate = path.trim();

  if (FRONTEND_SOURCE_REGEX.test(candidate)) {
    throw new Error(
      `Invalid API path "${candidate}": frontend source files cannot be requested over HTTP.`,
    );
  }
};

export async function apiFetch(path: string, init: RequestInit = {}) {
  assertValidEndpoint(path);

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${normalizedPath}`;

  const method = init.method ?? "GET";
  console.info("[Frontend][HTTP]", method, url);

  const res = await fetch(url, {
    credentials: init.credentials ?? "include",
    ...init,
  });

  console.info("[Frontend][RESPUESTA]", res.status, url);
  return res;
}
