import api from './api';
import apiClient from './apiClient';

const USUARIOS_ENDPOINT = '/usuarios';
const EXCEL_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DEFAULT_ERROR_MESSAGE = 'Error al comunicarse con el servidor';

export type UsuarioPayload = {
  nombre_usuario: string;
  contrasena: string;
  nombre_completo?: string;
};

export type UsuarioUpdatePayload = {
  nombre_usuario: string;
  nombre_completo: string;
  activo: boolean;
  contrasena?: string;
};

type ApiEnvelope<T> = T | { data: T };

type AxiosErrorLike = {
  isAxiosError?: boolean;
  message?: string;
  response?: {
    data?: unknown;
  };
};

type UsuarioResponse = {
  id: number;
  nombre_usuario: string;
  nombre_completo: string | null;
  activo: boolean;
  fecha_creacion: string;
};

type UsuarioExportQueryParamsInput = Record<
  string,
  string | number | boolean | undefined | null
>;

type UsuariosExportFile = {
  blob: Blob;
  filename: string;
};

const hasDataProperty = <T>(payload: ApiEnvelope<T>): payload is { data: T } => {
  return typeof payload === 'object' && payload !== null && 'data' in payload;
};

const unwrapResponse = <T>(payload: ApiEnvelope<T>): T => {
  if (hasDataProperty(payload)) {
    return payload.data;
  }
  return payload as T;
};

const normalizeUsuariosList = (payload: ApiEnvelope<UsuarioResponse[]>): UsuarioResponse[] => {
  const unwrapped = unwrapResponse(payload);
  return Array.isArray(unwrapped) ? unwrapped : [];
};

const isAxiosError = (error: unknown): error is AxiosErrorLike => {
  return Boolean(error) && typeof error === 'object' && 'isAxiosError' in (error as Record<string, unknown>);
};

const extractErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const responseData = error.response?.data as { message?: string; error?: string } | string | undefined;
    if (typeof responseData === 'string') {
      return responseData || error.message || DEFAULT_ERROR_MESSAGE;
    }

    return responseData?.message || responseData?.error || error.message || DEFAULT_ERROR_MESSAGE;
  }

  if (error instanceof Error) {
    return error.message || DEFAULT_ERROR_MESSAGE;
  }

  return DEFAULT_ERROR_MESSAGE;
};

const parseContentDispositionFilename = (contentDisposition?: string): string | null => {
  if (!contentDisposition) return null;

  const filenameMatch =
    contentDisposition.match(/filename\*=UTF-8''([^;]+)/i) ||
    contentDisposition.match(/filename="?([^\";]+)"?/i);

  if (!filenameMatch?.[1]) return null;

  const decoded = decodeURIComponent(filenameMatch[1]);
  return decoded.replace(/[/\\]/g, '').trim();
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
  params?: UsuarioExportQueryParamsInput
): Record<string, string | number | boolean> | undefined => {
  if (!params) {
    return undefined;
  }

  const entries = Object.entries(params).reduce<Record<string, string | number | boolean>>(
    (acc, [key, value]) => {
      if (value === undefined || value === null) {
        return acc;
      }

      if (typeof value === 'string') {
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

export const getUsuarios = async (): Promise<UsuarioResponse[]> => {
  try {
    const response = await api.get<ApiEnvelope<UsuarioResponse[]>>(USUARIOS_ENDPOINT);
    return normalizeUsuariosList(response.data);
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
};

export const createUsuario = async (payload: UsuarioPayload): Promise<UsuarioResponse> => {
  try {
    const response = await api.post<ApiEnvelope<UsuarioResponse>>(USUARIOS_ENDPOINT, payload);
    return unwrapResponse(response.data);
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
};

export const updateUsuario = async (
  id: number,
  payload: UsuarioUpdatePayload
): Promise<UsuarioResponse> => {
  try {
    const response = await api.put<ApiEnvelope<UsuarioResponse>>(`${USUARIOS_ENDPOINT}/${id}`, payload);
    return unwrapResponse(response.data);
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
};

export const deleteUsuario = async (id: number): Promise<void> => {
  try {
    await api.delete(`${USUARIOS_ENDPOINT}/${id}`);
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
};

export const exportUsuariosExcel = async (
  params?: UsuarioExportQueryParamsInput
): Promise<UsuariosExportFile> => {
  const sanitized = sanitizeParams(params);
  const response = await apiClient.get<Blob>(`${USUARIOS_ENDPOINT}/export`, {
    params: sanitized,
    responseType: 'blob',
    headers: {
      Accept: EXCEL_MIME_TYPE,
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });

  const contentType = String(response.headers?.['content-type'] || '');
  const blob = response.data;

  if (!contentType.includes('spreadsheetml.sheet')) {
    const message = await resolveExportErrorMessage(
      blob,
      'No se pudo exportar usuarios'
    );
    throw new Error(message);
  }

  if (!blob || blob.size === 0) {
    throw new Error('Export inválido: archivo vacío');
  }

  const filename =
    parseContentDispositionFilename(response.headers?.['content-disposition']) ||
    `usuarios_${Date.now()}.xlsx`;

  return { blob, filename };
};
