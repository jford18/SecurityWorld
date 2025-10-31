import { API_BASE_URL } from './api';

const jsonContentType = 'application/json';

// FIX: Función auxiliar que garantiza la lectura segura de JSON para evitar "Unexpected token '<'".
const parseJsonSafe = async (response: Response) => {
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes(jsonContentType)) {
    return response.json();
  }

  return { message: 'Respuesta inválida del servidor' } as const;
};

const handleResponse = async (response: Response) => {
  if (response.ok) {
    return parseJsonSafe(response);
  }

  const errorBody = await parseJsonSafe(response);
  const message =
    (errorBody && typeof errorBody === 'object' && 'message' in errorBody && errorBody.message) ||
    'Error al comunicarse con el servidor';
  throw new Error(String(message));
};

export type UsuarioRolPayload = {
  usuario_id: number;
  rol_id: number;
};

// NEW: Recupera todas las asignaciones entre usuarios y roles con agrupación por usuario.
export const fetchUsuarioRoles = async () => {
  const response = await fetch(`${API_BASE_URL}/api/usuario-roles`, {
    headers: { Accept: jsonContentType },
  });
  return handleResponse(response);
};

// NEW: Recupera únicamente los roles de un usuario específico utilizando la API centralizada.
export const fetchRolesPorUsuario = async (usuarioId: number) => {
  if (!Number.isInteger(usuarioId)) {
    throw new Error('Identificador de usuario inválido');
  }

  const response = await fetch(`${API_BASE_URL}/api/usuario-roles/${usuarioId}`, {
    headers: { Accept: jsonContentType },
  });
  return handleResponse(response);
};

// NEW: Obtiene el catálogo de roles disponibles para asignar.
export const fetchRolesDisponibles = async () => {
  const response = await fetch(`${API_BASE_URL}/api/roles`, {
    headers: { Accept: jsonContentType },
  });
  return handleResponse(response);
};

// NEW: Asigna un rol a un usuario validando datos antes de enviar la solicitud.
export const asignarRol = async ({ usuario_id, rol_id }: UsuarioRolPayload) => {
  if (!Number.isInteger(usuario_id) || !Number.isInteger(rol_id)) {
    throw new Error('Datos incompletos');
  }

  const response = await fetch(`${API_BASE_URL}/api/usuario-roles`, {
    method: 'POST',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify({ usuario_id, rol_id }),
  });

  return handleResponse(response);
};

// NEW: Elimina la relación usuario-rol validando que ambos identificadores sean correctos.
export const eliminarRol = async (usuarioId: number, rolId: number) => {
  if (!Number.isInteger(usuarioId) || !Number.isInteger(rolId)) {
    throw new Error('Datos incompletos');
  }

  const response = await fetch(`${API_BASE_URL}/api/usuario-roles/${usuarioId}/${rolId}`, {
    method: 'DELETE',
    headers: { Accept: jsonContentType },
  });

  return handleResponse(response);
};
