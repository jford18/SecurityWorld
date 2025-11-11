import { API_BASE_URL } from './api';
import type { Hacienda } from '../types';

const jsonContentType = 'application/json';

const parseJsonSafe = async (response: Response) => {
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes(jsonContentType)) {
    return response.json();
  }
  return { message: 'Respuesta inválida del servidor' };
};

const handleResponse = async (response: Response) => {
  const body = await parseJsonSafe(response);
  if (response.ok) {
    return body;
  }
  const message =
    body && typeof body === 'object' && 'message' in body && body.message
      ? String(body.message)
      : 'Error al comunicarse con el servidor';
  throw new Error(message);
};

export type HaciendaPayload = {
  nombre: string;
  direccion?: string;
  activo?: boolean;
};

export const fetchHaciendas = async (): Promise<Hacienda[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/hacienda`, {
    headers: { Accept: jsonContentType },
  });
  return handleResponse(response);
};

export const createHacienda = async (payload: HaciendaPayload) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/hacienda`, {
    method: 'POST',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const updateHacienda = async (
  id: number,
  payload: HaciendaPayload,
) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/hacienda/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const deleteHacienda = async (id: number) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/hacienda/${id}`, {
    method: 'DELETE',
    headers: { Accept: jsonContentType },
  });
  // DELETE might not return a body, so handle it differently
  if (response.ok) {
    return { message: 'Hacienda eliminada correctamente' };
  }
  return handleResponse(response);
};
