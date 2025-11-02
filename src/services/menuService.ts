import { API_BASE_URL } from './api';

const jsonContentType = 'application/json';
const API_URL = `${API_BASE_URL}/api/menus`;
const AUTH_API_URL = `${API_BASE_URL}/api/auth`;

const ensureJsonResponse = async <T = unknown>(response: Response): Promise<T> => {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes(jsonContentType)) {
    throw new Error('Respuesta inválida del servidor');
  }
  return response.json() as Promise<T>;
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

export interface MenuPermitido {
  id: number;
  nombre: string;
  icono: string | null;
  ruta: string;
  seccion: string | null;
  orden: number | null;
}

export const getMenusByRol = async (rolId: number) => {
  const response = await fetch(`${AUTH_API_URL}/menus/${rolId}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    await handleError(response);
  }

  return ensureJsonResponse<MenuPermitido[]>(response);
};

export const getMenus = async () => {
  const response = await fetch(API_URL, { cache: 'no-store' });
  if (!response.ok) {
    await handleError(response);
  }
  return ensureJsonResponse(response);
};

export const createMenu = async (payload: MenuPayload) => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await handleError(response);
  }

  return ensureJsonResponse(response);
};

export const updateMenu = async (id: number, payload: MenuPayload) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await handleError(response);
  }

  return ensureJsonResponse(response);
};

export const deleteMenu = async (id: number) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: 'DELETE',
    headers: { Accept: jsonContentType },
  });

  if (!response.ok) {
    await handleError(response);
  }

  return ensureJsonResponse(response);
};
