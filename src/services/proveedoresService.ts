import api from "./api";

const PROVEEDORES_ENDPOINT = "/proveedores";

type ProveedorQueryParams = Record<string, string | number | boolean>;
type ProveedorQueryParamsInput = Record<
  string,
  string | number | boolean | undefined | null
>;

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

export default {
  getProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor,
};
