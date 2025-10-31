import { API_BASE_URL } from './api';

const jsonContentType = 'application/json';

// FIX: Validamos tipo de contenido antes de intentar parsear la respuesta del backend.
const handleResponse = async (response: Response) => {
  const contentType = response.headers.get('content-type');
  if (!response.ok) {
    throw new Error(`Error del servidor (${response.status})`);
  }
  if (!contentType || !contentType.includes(jsonContentType)) {
    throw new Error('Respuesta inválida del servidor');
  }
  return response.json();
};

export type ConsolaPayload = {
  nombre: string;
};

// NEW: Servicio para consultar el listado de consolas en el backend /api/consolas.
export const getConsolas = async () => {
  const response = await fetch(`${API_BASE_URL}/api/consolas`, {
    headers: { Accept: jsonContentType },
  });
  return handleResponse(response);
};

// NEW: Servicio para crear una consola garantizando cuerpo JSON y validaciones del backend.
export const createConsola = async (payload: ConsolaPayload) => {
  const response = await fetch(`${API_BASE_URL}/api/consolas`, {
    method: 'POST',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

// NEW: Servicio para actualizar solo el nombre de la consola especificada por id.
export const updateConsola = async (id: number, payload: ConsolaPayload) => {
  const response = await fetch(`${API_BASE_URL}/api/consolas/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

// NEW: Servicio para eliminar una consola y devolver respuestas de error si ocurren conflictos.
export const deleteConsola = async (id: number) => {
  const response = await fetch(`${API_BASE_URL}/api/consolas/${id}`, {
    method: 'DELETE',
    headers: { Accept: jsonContentType },
  });
  return handleResponse(response);
};
