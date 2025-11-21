import axios from "axios";

const envBase = import.meta.env.VITE_API_URL?.trim();

// Si no hay VITE_API_URL, usamos '/api' como ruta relativa (pensando en proxy/reverse proxy)
export const API_BASE_URL = envBase || "/api";

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
  const url = `${API_BASE_URL}${normalizedPath}`;

  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  return response;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

export default apiClient;
