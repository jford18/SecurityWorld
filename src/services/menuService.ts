import api from './api';

const jsonContentType = 'application/json';

type ApiErrorResponse = {
  message?: string;
  error?: string;
};

type AxiosErrorLike = Error & {
  response?: {
    data?: ApiErrorResponse;
  };
  isAxiosError?: boolean;
};

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const getStoredUserId = (): number | null => {
  const storedUser = localStorage.getItem('usuario');
  if (!storedUser) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedUser) as { id?: unknown };
    return parseNumber(parsed.id);
  } catch (error) {
    console.warn('[Menus] No se pudo leer usuario almacenado', error);
    return null;
  }
};

type GetMenusOptions = {
  roleId?: number | null;
  userId?: number | null;
};

const isAxiosErrorLike = (error: unknown): error is AxiosErrorLike =>
  Boolean(error) && typeof error === 'object' && 'isAxiosError' in (error as Record<string, unknown>);

const resolveRequestError = (error: unknown): Error => {
  if (isAxiosErrorLike(error)) {
    const data = error.response?.data;
    const messageFromServer = data?.message ?? data?.error ?? '';
    if (typeof messageFromServer === 'string' && messageFromServer.trim() !== '') {
      return new Error(messageFromServer);
    }
    if (typeof error.message === 'string' && error.message.trim() !== '') {
      return new Error(error.message);
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('Error al procesar la solicitud de menús');
};

const buildRequestHeaders = (hasBody = false): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: jsonContentType,
  };

  if (hasBody) {
    headers['Content-Type'] = jsonContentType;
  }

  const token = localStorage.getItem('token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

export type MenuPayload = {
  nombre: string;
  icono?: string | null;
  ruta: string;
  seccion?: string | null;
  orden?: number | null;
  activo?: boolean;
};

export const getMenus = async (options: GetMenusOptions = {}) => {
  const { roleId = null, userId = null } = options;
  const resolvedUserId = parseNumber(userId) ?? getStoredUserId();
  const resolvedRoleId = parseNumber(roleId);
  const params: Record<string, number> = {};

  if (resolvedUserId !== null) {
    params.usuario_id = resolvedUserId;
  }

  if (resolvedRoleId !== null) {
    params.rol_id = resolvedRoleId;
  }

  try {
    const { data } = await api.get('/menus', {
      params: Object.keys(params).length ? params : undefined,
      headers: buildRequestHeaders(),
    });
    return data;
  } catch (error) {
    throw resolveRequestError(error);
  }
};

export const createMenu = async (payload: MenuPayload) => {
  try {
    const { data } = await api.post('/menus', payload, {
      headers: buildRequestHeaders(true),
    });
    return data;
  } catch (error) {
    throw resolveRequestError(error);
  }
};

export const updateMenu = async (id: number, payload: MenuPayload) => {
  try {
    const { data } = await api.put(`/menus/${id}`, payload, {
      headers: buildRequestHeaders(true),
    });
    return data;
  } catch (error) {
    throw resolveRequestError(error);
  }
};

export const deleteMenu = async (id: number) => {
  try {
    const { data } = await api.delete(`/menus/${id}`, {
      headers: buildRequestHeaders(),
    });
    return data;
  } catch (error) {
    throw resolveRequestError(error);
  }
};
