import { API_BASE_URL } from './api';

const jsonContentType = 'application/json';

// FIX: Función auxiliar para validar si la respuesta contiene JSON antes de intentar parsearla.
const parseJsonSafe = async (response: Response) => {
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes(jsonContentType)) {
    return response.json();
  }

  // FIX: Evitamos el error "Unexpected token '<'" retornando un objeto estándar cuando la respuesta no es JSON.
  return { message: 'Respuesta inválida del servidor' };
};

const handleResponse = async (response: Response) => {
  if (response.ok) {
    return parseJsonSafe(response);
  }

  const errorBody = await parseJsonSafe(response);
  const errorMessage =
    (errorBody && typeof errorBody === 'object' && 'message' in errorBody && errorBody.message) ||
    'Error al comunicarse con el servidor';
  throw new Error(String(errorMessage));
};

export type UsuarioPayload = {
  nombre_usuario: string;
  contrasena_plana: string;
  nombre_completo?: string;
};

export type UsuarioUpdatePayload = {
  nombre_completo: string;
  activo: boolean;
};

export const getUsuarios = async () => {
  // NEW: Recupera la lista de usuarios desde el backend asegurando ruta /api/usuarios.
  const response = await fetch(`${API_BASE_URL}/api/usuarios`, {
    headers: { Accept: jsonContentType },
  });
  return handleResponse(response);
};

export const createUsuario = async (payload: UsuarioPayload) => {
  const response = await fetch(`${API_BASE_URL}/api/usuarios`, {
    method: 'POST',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const updateUsuario = async (id: number, payload: UsuarioUpdatePayload) => {
  const response = await fetch(`${API_BASE_URL}/api/usuarios/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const deleteUsuario = async (id: number) => {
  const response = await fetch(`${API_BASE_URL}/api/usuarios/${id}`, {
    method: 'DELETE',
    headers: { Accept: jsonContentType },
  });
  return handleResponse(response);
};