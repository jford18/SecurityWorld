import api from './api';

export interface LoginResponse {
  usuario_id: number;
  nombre_usuario: string;
  rol_id: number;
  rol_nombre: string;
  token: string;
  requirePasswordChange: boolean;
}

export const login = async (
  nombre_usuario: string,
  contrasena: string
): Promise<LoginResponse> => {
  const { data } = await api.post('/login', { nombre_usuario, contrasena });
  return {
    usuario_id: Number(data.usuario_id),
    nombre_usuario: data.nombre_usuario,
    rol_id: Number(data.rol_id),
    rol_nombre: data.rol_nombre,
    token: data.token,
    requirePasswordChange: Boolean(data.requirePasswordChange),
  };
};

export const changePassword = async (nuevaContrasena: string) => {
  const { data } = await api.post('/auth/cambiar-clave', { nuevaContrasena });
  return data as { success: boolean; message: string };
};
