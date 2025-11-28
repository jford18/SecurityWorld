import api from './api';

const USUARIOS_ENDPOINT = '/usuarios';
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
