import api from './api';
import { apiFetch } from './apiClient';

const BASE_PATH = '/nodos-sitios';
const API_URL = BASE_PATH;

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const extractData = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if ('data' in payload) {
    return payload.data;
  }

  return payload;
};

export const getAll = async () => {
  const response = await api.get(BASE_PATH);
  return extractData(response.data);
};

export const getByNodo = async (nodoId) => {
  const response = await api.get(`${BASE_PATH}/${nodoId}`);
  return extractData(response.data);
};

const executeMutation = async (url, options, fallbackMessage) => {
  const response = await apiFetch(url, {
    ...options,
    headers: { ...JSON_HEADERS, ...(options.headers ?? {}) },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: fallbackMessage }));
    throw new Error(errorData.message || fallbackMessage);
  }

  const data = await response.json();
  return extractData(data);
};

export const assign = async ({ nodoId, sitiosIds } = {}) => {
  const payload = {
    nodoId: Number(nodoId),
    sitiosIds: Array.isArray(sitiosIds)
      ? sitiosIds.map((id) => Number(id)).filter((id) => Number.isInteger(id))
      : [],
  };

  return executeMutation(
    API_URL,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    'Error al crear la asignación'
  );
};

export const unassign = async (payload) =>
  executeMutation(
    API_URL,
    {
      method: 'DELETE',
      body: JSON.stringify(payload ?? {}),
    },
    'Error al eliminar la asignación'
  );

export default {
  getAll,
  getByNodo,
  assign,
  unassign,
};
