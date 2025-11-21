import api from './api';
import { apiFetch } from './apiClient';

const JSON_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const BASE_PATH = '/conclusion-evento';

const extractData = <T>(payload: unknown): T | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if ('data' in payload && (payload as { data?: unknown }).data !== undefined) {
    return (payload as { data: T }).data;
  }

  return payload as T;
};

export type ConclusionEventoDTO = {
  id: number;
  descripcion: string;
  activo: boolean;
  fecha_creacion: string;
};

export type ConclusionEventoPayload = {
  descripcion: string;
  activo?: boolean;
};

const buildQueryParams = (search?: string) => {
  const trimmed = typeof search === 'string' ? search.trim() : '';
  if (!trimmed) {
    return undefined;
  }

  return { search: trimmed };
};

export const getAll = async (search?: string) => {
  const response = await api.get(BASE_PATH, {
    params: buildQueryParams(search),
  });
  return (extractData<ConclusionEventoDTO[]>(response.data) ?? []) as ConclusionEventoDTO[];
};

export const getById = async (id: number | string) => {
  const response = await api.get(`${BASE_PATH}/${id}`);
  return extractData<ConclusionEventoDTO>(response.data);
};

const performJsonRequest = async <T>(
  url: string,
  options: RequestInit,
  fallbackMessage: string
) => {
  const response = await apiFetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: fallbackMessage }));
    throw new Error(errorData.message || fallbackMessage);
  }

  const data = await response.json();
  return extractData<T>(data);
};

export const create = async (payload: ConclusionEventoPayload) =>
  performJsonRequest<ConclusionEventoDTO>(
    BASE_PATH,
    {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload ?? {}),
    },
    'Error al crear la conclusión del evento'
  );

export const update = async (id: number | string, payload: ConclusionEventoPayload) =>
  performJsonRequest<ConclusionEventoDTO>(
    `${BASE_PATH}/${id}`,
    {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload ?? {}),
    },
    'Error al actualizar la conclusión del evento'
  );

export const remove = async (id: number | string) =>
  performJsonRequest(
    `${BASE_PATH}/${id}`,
    {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    },
    'Error al desactivar la conclusión del evento'
  );
