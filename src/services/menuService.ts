import { apiFetch } from '../lib/http';

const jsonContentType = 'application/json';

const buildAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
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

const ensureJsonResponse = async (response: Response) => {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes(jsonContentType)) {
    throw new Error('Respuesta inválida del servidor');
  }
  return response.json();
};

const handleError = async (response: Response) => {
  let message = `Error HTTP ${response.status}`;
  try {
    const data = await response.json();
    if (data && typeof data === 'object' && 'message' in data) {
      const maybeMessage = (data as { message?: unknown }).message;
      if (typeof maybeMessage === 'string' && maybeMessage.trim() !== '') {
        message = maybeMessage;
      }
    }
  } catch (_error) {
    // ignore JSON parsing errors, we already have a fallback message
  }
  throw new Error(message);
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
  const authHeaders = buildAuthHeaders();
  const searchParams = new URLSearchParams();
  const resolvedUserId = parseNumber(userId) ?? getStoredUserId();
  const resolvedRoleId = parseNumber(roleId);

  if (resolvedUserId !== null) {
    searchParams.set('usuario_id', String(resolvedUserId));
  }

  if (resolvedRoleId !== null) {
    searchParams.set('rol_id', String(resolvedRoleId));
  }

  const path = searchParams.toString() ? `/menus?${searchParams.toString()}` : '/menus';

  const response = await apiFetch(path, {
    cache: 'no-store',
    headers: {
      ...authHeaders,
      Accept: jsonContentType,
    },
  });
  if (!response.ok) {
    await handleError(response);
  }
  return ensureJsonResponse(response);
};

export const createMenu = async (payload: MenuPayload) => {
  const authHeaders = buildAuthHeaders();
  const response = await apiFetch('/menus', {
    method: 'POST',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
      ...authHeaders,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await handleError(response);
  }

  return ensureJsonResponse(response);
};

export const updateMenu = async (id: number, payload: MenuPayload) => {
  const authHeaders = buildAuthHeaders();
  const response = await apiFetch(`/menus/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
      ...authHeaders,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await handleError(response);
  }

  return ensureJsonResponse(response);
};

export const deleteMenu = async (id: number) => {
  const authHeaders = buildAuthHeaders();
  const response = await apiFetch(`/menus/${id}`, {
    method: 'DELETE',
    headers: { Accept: jsonContentType, ...authHeaders },
  });

  if (!response.ok) {
    await handleError(response);
  }

  return ensureJsonResponse(response);
};
