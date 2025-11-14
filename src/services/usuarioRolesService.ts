import type { AxiosResponse } from 'axios';
import api from './api';

const ROLES_ENDPOINT = '/api/roles';
const USUARIO_ROLES_ENDPOINT = '/api/usuario-roles';
const DEFAULT_ERROR_MESSAGE = 'Error al comunicarse con el servidor';

type ApiEnvelope<T> = T | { data: T };

type AxiosErrorLike = {
  isAxiosError?: boolean;
  message?: string;
  response?: {
    data?: unknown;
  };
};

export type UsuarioRolPayload = {
  usuario_id: number;
  rol_id: number;
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

const resolveRequest = async <T>(request: Promise<AxiosResponse<ApiEnvelope<T>>>): Promise<T> => {
  try {
    const response = await request;
    return unwrapResponse(response.data);
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
};

const usuarioRolesService = {
  async getRolesDisponibles<T = unknown>(): Promise<T> {
    return resolveRequest<T>(api.get(ROLES_ENDPOINT));
  },

  async getAsignaciones<T = unknown>(): Promise<T> {
    return resolveRequest<T>(api.get(USUARIO_ROLES_ENDPOINT));
  },

  async getRolesPorUsuario<T = unknown>(usuarioId: number): Promise<T> {
    return resolveRequest<T>(api.get(`${USUARIO_ROLES_ENDPOINT}/${usuarioId}`));
  },

  async asignarRol<T = unknown>(payload: UsuarioRolPayload): Promise<T> {
    return resolveRequest<T>(api.post(USUARIO_ROLES_ENDPOINT, payload));
  },

  async eliminarAsignacion<T = unknown>(usuarioId: number, rolId: number): Promise<T> {
    return resolveRequest<T>(api.delete(`${USUARIO_ROLES_ENDPOINT}/${usuarioId}/${rolId}`));
  },
};

export default usuarioRolesService;
