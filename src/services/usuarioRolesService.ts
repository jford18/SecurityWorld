import type { AxiosResponse } from 'axios';
import api from './api';
import { API_BASE_URL } from './apiClient';

const ROLES_ENDPOINT = '/roles';
const USUARIO_ROLES_ENDPOINT = '/usuario-roles';
const DEFAULT_ERROR_MESSAGE = 'Error al comunicarse con el servidor';

const EXPORT_USUARIOS_ROLES_ENDPOINT = '/usuarios-roles/export-excel';

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

  async exportUsuariosRolesExcel(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}${EXPORT_USUARIOS_ROLES_ENDPOINT}`, {
        credentials: 'include',
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
      });

      if (!response.ok) {
        throw new Error('No se pudo generar el archivo de exportación');
      }

      const blob = await response.blob();

      const preparedBlob = new Blob([blob], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(preparedBlob);
      const link = document.createElement('a');
      const now = new Date();
      const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      link.href = url;
      link.download = `usuarios_roles_${yyyymmdd}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      throw new Error(extractErrorMessage(error));
    }
  },
};

export default usuarioRolesService;
