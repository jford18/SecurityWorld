import api from './api';

const ROL_MENU_ENDPOINT = '/rol-menu';

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

const isAxiosErrorLike = (error: unknown): error is AxiosErrorLike =>
  Boolean(error) && typeof error === 'object' && 'isAxiosError' in (error as Record<string, unknown>);

const resolveRequestError = (error: unknown): Error => {
  if (isAxiosErrorLike(error)) {
    const data = error.response?.data;
    if (data) {
      const serverMessage = data.message ?? data.error;
      if (typeof serverMessage === 'string' && serverMessage.trim() !== '') {
        return new Error(serverMessage);
      }
    }
    const axiosMessage = typeof error.message === 'string' ? error.message : '';
    if (axiosMessage.trim() !== '') {
      return new Error(axiosMessage);
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('Error al procesar la solicitud de Roles ↔ Menús');
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

  try {
    const { data } = await api.get<RolMenuItem[]>(`${ROL_MENU_ENDPOINT}/${rolId}`);
    return data;
  } catch (error) {
    throw resolveRequestError(error);
  }
};

export const saveRolMenus = async (rolId: number, menus: SaveRolMenuPayload[]) => {
  if (!Number.isInteger(rolId) || rolId <= 0) {
    throw new Error('Identificador de rol inválido');
  }

  try {
    const { data } = await api.post<{ message: string }>(ROL_MENU_ENDPOINT, {
      rol_id: rolId,
      menus,
    });
    return data;
  } catch (error) {
    throw resolveRequestError(error);
  }
};

export const deleteRolMenu = async (id: number) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Identificador de asignación inválido');
  }

  try {
    const { data } = await api.delete<{ message: string }>(`${ROL_MENU_ENDPOINT}/${id}`);
    return data;
  } catch (error) {
    throw resolveRequestError(error);
  }
};
