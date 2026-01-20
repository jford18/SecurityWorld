import api from './api';
import { apiFetch } from './apiClient';

const JSON_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const BASE_PATH = '/material-sustraido';
const API_URL = BASE_PATH;

export interface MaterialSustraido {
  id: number;
  descripcion: string;
  estado: boolean;
}

export interface MaterialSustraidoPayload {
  descripcion: string;
  estado?: boolean;
}

interface ListResponse {
  data: MaterialSustraido[];
  total: number;
}

const unwrapList = (payload: unknown): ListResponse => {
  if (!payload || typeof payload !== 'object') {
    return { data: [], total: 0 };
  }

  if ('data' in payload && 'total' in payload) {
    const listPayload = payload as { data?: MaterialSustraido[]; total?: number };
    return {
      data: Array.isArray(listPayload.data) ? listPayload.data : [],
      total: typeof listPayload.total === 'number' ? listPayload.total : 0,
    };
  }

  if ('data' in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (nested && typeof nested === 'object' && 'data' in nested && 'total' in nested) {
      const nestedPayload = nested as { data?: MaterialSustraido[]; total?: number };
      return {
        data: Array.isArray(nestedPayload.data) ? nestedPayload.data : [],
        total: typeof nestedPayload.total === 'number' ? nestedPayload.total : 0,
      };
    }
  }

  return { data: [], total: 0 };
};

const extractData = <T>(response: unknown): T | null => {
  if (!response || typeof response !== 'object') {
    return null;
  }

  if ('data' in response) {
    return (response as { data: T }).data;
  }

  return response as T;
};

export const getAll = async (params: {
  search?: string;
  page?: number;
  limit?: number;
  estado?: boolean;
} = {}): Promise<ListResponse> => {
  const response = await api.get(BASE_PATH, { params });
  return unwrapList(response.data);
};

export const getById = async (id: number | string) => {
  const response = await api.get(`${BASE_PATH}/${id}`);
  return extractData(response.data);
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

export const update = async (id: number | string, payload: MaterialSustraidoPayload) => {
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
