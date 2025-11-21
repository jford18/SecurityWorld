import api from './api';
import { apiFetch } from './apiClient';

const JSON_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const BASE_PATH = '/medio-comunicacion';

const extractData = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if ('data' in payload && (payload as { data?: unknown }).data !== undefined) {
    return (payload as { data: unknown }).data;
  }

  return payload;
};

export interface MedioComunicacionDTO {
  id: number;
  descripcion: string;
  fecha_creacion: string;
}

export const getAllMediosComunicacion = async (search?: string) => {
  const response = await api.get(BASE_PATH, {
    params: search?.trim() ? { search: search.trim() } : undefined,
  });
  return extractData(response.data) as MedioComunicacionDTO[];
};

export const getMedioComunicacionById = async (id: number) => {
  const response = await api.get(`${BASE_PATH}/${id}`);
  return extractData(response.data) as MedioComunicacionDTO;
};

const performJsonRequest = async (
  url: string,
  options: RequestInit,
  fallbackMessage: string
) => {
  const response = await apiFetch(url, {
    ...options,
    headers: options.headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: fallbackMessage }));
    throw new Error(errorData.message || fallbackMessage);
  }

  const data = await response.json();
  return extractData(data);
};

export const createMedioComunicacion = async (payload: { descripcion: string }) =>
  performJsonRequest(
    BASE_PATH,
    {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload ?? {}),
    },
    'Error al crear el medio de comunicación'
  );

export const updateMedioComunicacion = async (id: number, payload: { descripcion: string }) =>
  performJsonRequest(
    `${BASE_PATH}/${id}`,
    {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload ?? {}),
    },
    'Error al actualizar el medio de comunicación'
  );

export const deleteMedioComunicacion = async (id: number) =>
  performJsonRequest(
    `${BASE_PATH}/${id}`,
    {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    },
    'Error al eliminar el medio de comunicación'
  );
