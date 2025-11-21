import { API_BASE_URL } from "../services/apiClient";

export async function apiFetch(path: string, init: RequestInit = {}) {
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
