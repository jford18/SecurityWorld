import api from './api';
import { apiFetch } from './apiClient';

const JSON_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const BASE_PATH = '/material-sustraido';
const API_URL = BASE_PATH;

const extractData = <T>(payload: unknown): T | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if ('data' in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
};

export type MaterialSustraidoDTO = {
  id: number;
  descripcion: string;
  estado?: boolean | null;
};

export type MaterialSustraidoPayload = {
  descripcion: string;
  estado?: boolean;
};

export type MaterialSustraidoListResponse = {
  data: MaterialSustraidoDTO[];
  total: number;
};

export const getAll = async (options?: {
  search?: string;
  estado?: boolean;
  limit?: number;
  page?: number;
}): Promise<MaterialSustraidoListResponse> => {
  const params: Record<string, unknown> = {};

  if (options?.search && options.search.trim()) {
    params.search = options.search.trim();
  }

  if (options?.estado !== undefined) {
    params.estado = options.estado;
  }

  if (options?.limit !== undefined) {
    params.limit = options.limit;
  }

  if (options?.page !== undefined) {
    params.page = options.page;
  }

  const response = await api.get(BASE_PATH, { params });
  const payload = response.data ?? {};
  const data = (payload as { data?: MaterialSustraidoDTO[] }).data ?? [];
  const total = (payload as { total?: number }).total ?? 0;

  return { data, total };
};

export const create = async (payload: MaterialSustraidoPayload) => {
  const response = await apiFetch(API_URL, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload ?? {}),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: 'Error al crear el material sustraído' }));
    throw new Error(errorData.message || 'Error al crear el material sustraído');
  }

  const data = await response.json();
  return extractData(data);
};

export const update = async (
  id: number | string,
  payload: MaterialSustraidoPayload
) => {
  const response = await apiFetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload ?? {}),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: 'Error al actualizar el material sustraído' }));
    throw new Error(errorData.message || 'Error al actualizar el material sustraído');
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
      .catch(() => ({ message: 'Error al desactivar el material sustraído' }));
    throw new Error(errorData.message || 'Error al desactivar el material sustraído');
  }

  const data = await response.json();
  return extractData(data);
};
