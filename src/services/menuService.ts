import api from './api';

export type MenuPayload = {
  nombre: string;
  icono?: string | null;
  ruta: string;
  seccion?: string | null;
  orden?: number | null;
  activo?: boolean;
};

type GetMenusOptions = {
  roleId?: number | null;
  userId?: number | null;
};

export const getMenusForManagement = async () => {
  const { data } = await api.get('/menus');
  return data;
};

export const getMenus = async (options: GetMenusOptions = {}) => {
  const { roleId = null, userId = null } = options;
  const params: Record<string, number> = {};

  if (userId !== null) {
    params.usuario_id = userId;
  }

  if (roleId !== null) {
    params.rol_id = roleId;
  }

  const { data } = await api.get('/menus', {
    params: Object.keys(params).length ? params : undefined,
  });

  return data;
};

export const createMenu = async (data: MenuPayload) => api.post('/menus', data);

export const updateMenu = async (id: number, data: MenuPayload) => api.put(`/menus/${id}`, data);

export const deleteMenu = async (id: number) => api.delete(`/menus/${id}`);
