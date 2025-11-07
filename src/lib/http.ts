export async function apiFetch(path: string, init: RequestInit = {}) {
  const base = "http://localhost:3000";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = path.startsWith("http") ? path : `${base}${normalizedPath}`;

  if (url.includes("/api/")) {
    console.warn("[Frontend][ALERTA] Ruta incorrecta detectada:", url, new Error().stack);
  }

  const method = init.method ?? "GET";
  console.info("[Frontend][HTTP]", method, url);
  const res = await fetch(url, init);
  console.info("[Frontend][RESPUESTA]", res.status, url);
  return res;
}
