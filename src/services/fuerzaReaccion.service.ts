import api from './api';
import { apiFetch } from '../apiClient';

const JSON_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const BASE_PATH = '/api/fuerza-reaccion';
const API_URL = BASE_PATH;

type ApiResponse<T> = {
  status: 'success' | 'error';
  message: string;
  data?: T;
};

const extractData = <T>(response: ApiResponse<T> | T | null): T | null => {
  if (!response || typeof response !== 'object') {
    return (response as T) ?? null;
  }

  if ('data' in response && response.data !== undefined) {
    return response.data as T;
  }

  return response as T;
};

export const getAll = async (search?: string) => {
  const params = search && search.trim().length > 0 ? { search } : undefined;
  const response = await api.get(BASE_PATH, { params });
  return extractData(response.data) ?? [];
};

export const getById = async (id: number | string) => {
  const response = await api.get(`${BASE_PATH}/${id}`);
  return extractData(response.data);
};

export const create = async (payload: { descripcion: string; activo?: boolean }) => {
  const response = await apiFetch(API_URL, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload ?? {}),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error al crear la fuerza de reacción' }));
    throw new Error(errorData.message || 'Error al crear la fuerza de reacción');
  }

  const data = (await response.json()) as ApiResponse<unknown>;
  return extractData(data);
};

export const update = async (
  id: number | string,
  payload: { descripcion?: string; activo?: boolean }
) => {
  const response = await apiFetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload ?? {}),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: 'Error al actualizar la fuerza de reacción' }));
    throw new Error(errorData.message || 'Error al actualizar la fuerza de reacción');
  }

  const data = (await response.json()) as ApiResponse<unknown>;
  return extractData(data);
};

export const remove = async (id: number | string) => {
  const response = await apiFetch(`${API_URL}/${id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: 'Error al desactivar la fuerza de reacción' }));
    throw new Error(errorData.message || 'Error al desactivar la fuerza de reacción');
  }

  const data = (await response.json()) as ApiResponse<unknown>;
  return extractData(data);
};
