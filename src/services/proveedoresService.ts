import api from "./api";
import apiClient from "./apiClient";

const PROVEEDORES_ENDPOINT = "/proveedores";
const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type ProveedorQueryParams = Record<string, string | number | boolean>;
type ProveedorQueryParamsInput = Record<
  string,
  string | number | boolean | undefined | null
>;

type ProveedoresExportFile = {
  blob: Blob;
  filename: string;
};

export type ProveedorPayload = {
  nombre: string;
  identificacion?: string;
  telefono?: string;
  direccion?: string;
  activo?: boolean;
};

const normalizeListPayload = (payload: unknown): any[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data: unknown }).data)
  ) {
    return (payload as { data: any[] }).data;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "rows" in payload &&
    Array.isArray((payload as { rows: unknown }).rows)
  ) {
    return (payload as { rows: any[] }).rows;
  }

  return [];
};

const parseContentDispositionFilename = (contentDisposition?: string): string | null => {
  if (!contentDisposition) return null;

  const filenameMatch =
    contentDisposition.match(/filename\*=UTF-8''([^;]+)/i) ||
    contentDisposition.match(/filename="?([^\";]+)"?/i);

  if (!filenameMatch?.[1]) return null;

  const decoded = decodeURIComponent(filenameMatch[1]);
  return decoded.replace(/[/\\]/g, "").trim();
};

const resolveExportErrorMessage = async (
  payload: Blob,
  fallback: string
): Promise<string> => {
  try {
    const text = await payload.text();
    if (!text) return fallback;
    const parsed = JSON.parse(text) as { mensaje?: string; message?: string };
    return parsed?.mensaje || parsed?.message || text || fallback;
  } catch (error) {
    return fallback;
  }
};

const sanitizeParams = (
  params?: ProveedorQueryParamsInput
): ProveedorQueryParams | undefined => {
  if (!params) {
    return undefined;
  }

  const entries = Object.entries(params).reduce<ProveedorQueryParams>(
    (acc, [key, value]) => {
      if (value === undefined || value === null) {
        return acc;
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return acc;
        }
        acc[key] = trimmed;
        return acc;
      }

      acc[key] = value;
      return acc;
    },
    {}
  );

  return Object.keys(entries).length > 0 ? entries : undefined;
};

const buildRequestConfig = (params?: ProveedorQueryParamsInput) => {
  const sanitized = sanitizeParams(params);
  return sanitized ? { params: sanitized } : undefined;
};

export const getProveedores = async (params?: ProveedorQueryParamsInput) => {
  const config = buildRequestConfig(params);
  const response = config
    ? await api.get(PROVEEDORES_ENDPOINT, config)
    : await api.get(PROVEEDORES_ENDPOINT);
  return normalizeListPayload(response?.data);
};

export const getProveedorById = async (id: number) => {
  const response = await api.get(`${PROVEEDORES_ENDPOINT}/${id}`);
  return response?.data;
};

export const createProveedor = async (payload: ProveedorPayload) => {
  const response = await api.post(PROVEEDORES_ENDPOINT, payload);
  return response?.data;
};

export const updateProveedor = async (
  id: number,
  payload: ProveedorPayload
) => {
  const response = await api.put(`${PROVEEDORES_ENDPOINT}/${id}`, payload);
  return response?.data;
};

export const deleteProveedor = async (id: number) => {
  const response = await api.delete(`${PROVEEDORES_ENDPOINT}/${id}`);
  return response?.data;
};

export const exportProveedoresExcel = async (
  params?: ProveedorQueryParamsInput
): Promise<ProveedoresExportFile> => {
  const sanitized = sanitizeParams(params);
  const response = await apiClient.get<Blob>(
    `${PROVEEDORES_ENDPOINT}/export`,
    {
      params: sanitized,
      responseType: "blob",
      headers: {
        Accept: EXCEL_MIME_TYPE,
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    }
  );

  const contentType = String(response.headers?.["content-type"] || "");
  const blob = response.data;

  if (!contentType.includes("spreadsheetml.sheet")) {
    const message = await resolveExportErrorMessage(
      blob,
      "No se pudo exportar proveedores"
    );
    throw new Error(message);
  }

  if (!blob || blob.size === 0) {
    throw new Error("Export inválido: archivo vacío");
  }

  const filename =
    parseContentDispositionFilename(response.headers?.["content-disposition"]) ||
    `proveedores_${Date.now()}.xlsx`;

  return { blob, filename };
};

export default {
  getProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  exportProveedoresExcel,
};
