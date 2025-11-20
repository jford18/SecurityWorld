import api from './api';
import { apiFetch } from '../apiClient';

const JSON_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const BASE_PATH = '/api/cargo';
const API_URL = BASE_PATH;

const extractData = <T>(response: unknown): T | null => {
  if (!response || typeof response !== 'object') {
    return null;
  }

  if ('data' in response) {
    return (response as { data: T }).data;
  }

  return response as T;
};

const buildQuery = (search?: string) => {
  const trimmed = typeof search === 'string' ? search.trim() : '';
  if (!trimmed) {
    return '';
  }

  const params = new URLSearchParams();
  params.set('search', trimmed);
  return `?${params.toString()}`;
};

export const getAll = async (search?: string) => {
  const query = buildQuery(search);
  const response = await api.get(`${BASE_PATH}${query}`);
  return extractData(response.data);
};

export const getById = async (id: number | string) => {
  const response = await api.get(`${BASE_PATH}/${id}`);
  return extractData(response.data);
};

export interface CargoPayload {
  descripcion: string;
  activo?: boolean;
}

export const create = async (payload: CargoPayload) => {
  const response = await apiFetch(API_URL, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload ?? {}),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: 'Error al crear el cargo' }));
    throw new Error(errorData.message || 'Error al crear el cargo');
  }

  const data = await response.json();
  return extractData(data);
};

export const update = async (id: number | string, payload: CargoPayload) => {
  const response = await apiFetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload ?? {}),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: 'Error al actualizar el cargo' }));
    throw new Error(errorData.message || 'Error al actualizar el cargo');
  }

  const data = await response.json();
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
      .catch(() => ({ message: 'Error al desactivar el cargo' }));
    throw new Error(errorData.message || 'Error al desactivar el cargo');
  }

  const data = await response.json();
  return extractData(data);
};
