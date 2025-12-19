import api from "./api";
import apiClient from "./apiClient";

const CLIENTES_ENDPOINT = "/clientes";
const EXCEL_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface ClienteResumen {
  id: number;
  nombre: string;
}

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

export const getClientesActivos = async (): Promise<ClienteResumen[]> => {
  const { data } = await api.get<ClienteResumen[] | { data?: ClienteResumen[] }>(
    `${CLIENTES_ENDPOINT}/activos`
  );

  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data?: ClienteResumen[] }).data ?? [];
  }

  return [];
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

const extractMessageFromText = (text: string): string | null => {
  if (!text || typeof text !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    const message = (parsed as any)?.message ?? (parsed as any)?.error;
    const detail = (parsed as any)?.detail;

    if (message && detail) {
      return `${message}. Detalle: ${detail}`;
    }

    if (message) {
      return message;
    }

    if (detail) {
      return detail;
    }
  } catch (parseError) {
    if (text.trim().length > 0) {
      return text.trim();
    }
    return (parseError as Error)?.message ?? null;
  }

  return null;
};

const extractErrorFromBlob = async (blob?: Blob | null): Promise<string | null> => {
  if (!blob) {
    return null;
  }

  try {
    const text = await blob.text();
    return extractMessageFromText(text);
  } catch (error) {
    return (error as Error)?.message ?? null;
  }
};

const parseContentDispositionFilename = (headerValue?: string): string | null => {
  if (!headerValue || typeof headerValue !== "string") {
    return null;
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch (error) {
      return utf8Match[1];
    }
  }

  const asciiMatch = headerValue.match(/filename="?([^";]+)"?/i);
  return asciiMatch?.[1] ?? null;
};

const normalizeHeaderValue = (value: unknown): string =>
  typeof value === "string" ? value.toLowerCase() : "";

const resolveExportErrorMessage = async (error: unknown): Promise<string> => {
  if (error && typeof error === "object" && "response" in error) {
    const responseData = (error as { response?: { data?: unknown } }).response?.data;

    if (responseData instanceof Blob) {
      const parsedMessage = await extractErrorFromBlob(responseData);
      if (parsedMessage) {
        return parsedMessage;
      }
    }
  }

  return buildExportErrorMessage(error);
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

export const exportPersonasClientesExcel = async (): Promise<{
  blob: Blob;
  filename: string;
}> => {
  try {
    const response = await apiClient.get<Blob>(
      `${CLIENTES_ENDPOINT}/export-personas`,
      {
        responseType: "blob",
        headers: {
          Accept: EXCEL_MIME_TYPE,
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      }
    );

    const contentType = normalizeHeaderValue(response.headers?.["content-type"]);

    if (!contentType.includes("spreadsheetml.sheet")) {
      const backendError = await extractErrorFromBlob(response.data);
      throw new Error(backendError ?? EXPORT_ERROR_MESSAGE);
    }

    const filename =
      parseContentDispositionFilename(response.headers?.["content-disposition"] as string) ??
      "CLIENTES_PERSONAS.xlsx";

    const blob = new Blob([response.data], {
      type: contentType || EXCEL_MIME_TYPE,
    });

    if (!blob || blob.size === 0) {
      throw new Error("Export inválido: archivo vacío");
    }

    return { blob, filename };
  } catch (error) {
    const errorMessage = await resolveExportErrorMessage(error);
    throw new Error(errorMessage);
  }
};
