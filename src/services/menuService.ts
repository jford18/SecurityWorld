import { API_BASE_URL } from './api';

const jsonContentType = 'application/json';
const API_URL = `${API_BASE_URL}/menus`;

const buildAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
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

export const getMenus = async () => {
  const authHeaders = buildAuthHeaders();
  const response = await fetch(API_URL, {
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
  const response = await fetch(API_URL, {
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
  const response = await fetch(`${API_URL}/${id}`, {
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
  const response = await fetch(`${API_URL}/${id}`, {
    method: 'DELETE',
    headers: { Accept: jsonContentType, ...authHeaders },
  });

  if (!response.ok) {
    await handleError(response);
  }

  return ensureJsonResponse(response);
};
