import api from './api';
import { API_BASE_URL } from './api';

const jsonContentType = 'application/json';
const API_URL = `${API_BASE_URL}/api/consolas`;

const handleResponse = async (response: Response) => {
  if (response.status === 204 || response.status === 304) {
    return [];
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes(jsonContentType)) {
    throw new Error('Respuesta inválida del servidor');
  }

  const data = await response.json();
  return data;
};

export type ConsolaPayload = {
  nombre: string;
};

const getAll = async () => {
  const response = await api.get('/consolas');
  return response.data;
};

export const getConsolas = getAll;

// NEW: Servicio para crear una consola garantizando cuerpo JSON y validaciones del backend.
export const createConsola = async (payload: ConsolaPayload) => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`);
  }
  return handleResponse(response);
};

// NEW: Servicio para actualizar solo el nombre de la consola especificada por id.
export const updateConsola = async (id: number, payload: ConsolaPayload) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`);
  }
  return handleResponse(response);
};

// NEW: Servicio para eliminar una consola y devolver respuestas de error si ocurren conflictos.
export const deleteConsola = async (id: number) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: 'DELETE',
    headers: { Accept: jsonContentType },
  });
  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`);
  }
  return handleResponse(response);
};

export default {
  getAll,
  createConsola,
  updateConsola,
  deleteConsola,
};
