import { API_BASE_URL } from './api';

const jsonContentType = 'application/json';

const ensureJsonResponse = async (response: Response) => {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes(jsonContentType)) {
    throw new Error('Respuesta inválida del servidor');
  }
  return response.json();
};

const handleError = async (response: Response) => {
  try {
    const data = await ensureJsonResponse(response);
    if (data && typeof data === 'object' && 'message' in data) {
      const maybeMessage = (data as { message?: unknown }).message;
      if (typeof maybeMessage === 'string' && maybeMessage.trim() !== '') {
        throw new Error(maybeMessage);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message !== 'Respuesta inválida del servidor') {
      throw error;
    }
  }
  throw new Error(`Error HTTP ${response.status}`);
};

export type RolMenuItem = {
  menu_id: number;
  nombre: string;
  icono: string | null;
  ruta: string | null;
  seccion: string | null;
  orden: number | null;
  menu_activo: boolean;
  asignado: boolean;
};

export type SaveRolMenuPayload = {
  menu_id: number;
  activo: boolean;
};

export const getMenusByRol = async (rolId: number) => {
  if (!Number.isInteger(rolId) || rolId <= 0) {
    throw new Error('Identificador de rol inválido');
  }

  const response = await fetch(`${API_BASE_URL}/api/rol-menu/${rolId}`, {
    headers: { Accept: jsonContentType },
  });

  if (!response.ok) {
    await handleError(response);
  }

  return ensureJsonResponse(response) as Promise<RolMenuItem[]>;
};

export const saveRolMenus = async (rolId: number, menus: SaveRolMenuPayload[]) => {
  if (!Number.isInteger(rolId) || rolId <= 0) {
    throw new Error('Identificador de rol inválido');
  }

  const response = await fetch(`${API_BASE_URL}/api/rol-menu`, {
    method: 'POST',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify({ rol_id: rolId, menus }),
  });

  if (!response.ok) {
    await handleError(response);
  }

  return ensureJsonResponse(response) as Promise<{ message: string }>;
};
