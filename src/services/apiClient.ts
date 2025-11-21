import axios from "axios";

const envBase = import.meta.env.VITE_API_URL?.trim();

// Si no hay VITE_API_URL, usamos '/api' como ruta relativa (pensando en proxy/reverse proxy)
export const API_BASE_URL = envBase || "/api";

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
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
