import api from "./api";
import apiClient from "./apiClient";

const CLIENTES_ENDPOINT = "/clientes";

export type ClientePayload = {
  nombre: string;
  identificacion: string;
  direccion?: string;
  tipo_servicio_id: number;
  activo?: boolean;
};

type ClienteQueryParams = Record<string, string | number | boolean>;
type ClienteQueryParamsInput = Record<
  string,
  string | number | boolean | undefined | null
>;

const EXPORT_ERROR_MESSAGE = "No se pudo exportar personas por cliente";

const normalizeClientesPayload = (payload: unknown): any[] => {
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
  params?: ClienteQueryParamsInput
): ClienteQueryParams | undefined => {
  if (!params) {
    return undefined;
  }

  const entries = Object.entries(params).reduce<ClienteQueryParams>(
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

const buildExportErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "response" in error) {
    const responseData = (error as { response?: { data?: any } }).response?.data;
    const message = responseData?.message;
    const detail = responseData?.detail;

    if (message && detail) {
      return `${message}. Detalle: ${detail}`;
    }

    if (message) {
      return message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return EXPORT_ERROR_MESSAGE;
};

const buildRequestConfig = (params?: ClienteQueryParamsInput) => {
  const sanitized = sanitizeParams(params);
  return sanitized ? { params: sanitized } : undefined;
};

export const getAllClientes = async (
  params?: ClienteQueryParamsInput
): Promise<any[]> => {
  const config = buildRequestConfig(params);
  const response = config
    ? await api.get(CLIENTES_ENDPOINT, config)
    : await api.get(CLIENTES_ENDPOINT);
  return normalizeClientesPayload(response?.data);
};

export const createCliente = async (
  payload: ClientePayload
): Promise<any> => {
  const response = await api.post(CLIENTES_ENDPOINT, payload);
  return response?.data;
};

export const updateCliente = async (
  id: string | number,
  payload: ClientePayload
): Promise<any> => {
  const response = await api.put(`${CLIENTES_ENDPOINT}/${id}`, payload);
  return response?.data;
};

export const exportPersonasClientesExcel = async (): Promise<Blob> => {
  try {
    const response = await apiClient.get<ArrayBuffer>(
      `${CLIENTES_ENDPOINT}/export-personas`,
      {
        responseType: "arraybuffer",
        headers: {
          Accept:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      }
    );

    const blob = new Blob([response.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    if (!blob || blob.size === 0) {
      throw new Error("Export inválido: archivo vacío");
    }

    return blob;
  } catch (error) {
    throw new Error(buildExportErrorMessage(error));
  }
};
