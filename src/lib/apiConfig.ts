const rawBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  `${window.location.protocol}//${window.location.host}/api`;

const normalizeBaseUrl = (value: string) => {
  const trimmed = value.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${window.location.origin}${normalizedPath}`;
};

export const API_BASE_URL = normalizeBaseUrl(rawBaseUrl);

const isFullUrl = (value: string) => /^https?:\/\//i.test(value);

export const buildApiUrl = (path: string) => {
  if (isFullUrl(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseEndsWithApi = API_BASE_URL.endsWith("/api");
  const pathStartsWithApi = normalizedPath.startsWith("/api");
  const sanitizedPath = baseEndsWithApi && pathStartsWithApi
    ? normalizedPath.replace(/^\/api/, "") || "/"
    : normalizedPath;

  return `${API_BASE_URL}${sanitizedPath}`;
};

