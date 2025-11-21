import api from './api';
import { apiFetch } from './apiClient';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const BASE_PATH = '/nodos';
const API_URL = BASE_PATH;

const extractData = (response) => {
  if (!response || typeof response !== 'object') {
    return null;
  }

  if ('data' in response) {
    return response.data;
  }

  return response;
};

export const getAll = async () => {
  const response = await api.get(BASE_PATH);
  return extractData(response.data);
};

export const getById = async (id) => {
  const response = await api.get(`${BASE_PATH}/${id}`);
  return extractData(response.data);
};

export const create = async (payload) => {
  const response = await apiFetch(API_URL, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload ?? {}),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error al crear el nodo' }));
    throw new Error(errorData.message || 'Error al crear el nodo');
  }

  const data = await response.json();
  return extractData(data);
};

export const update = async (id, payload) => {
  const response = await apiFetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload ?? {}),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error al actualizar el nodo' }));
    throw new Error(errorData.message || 'Error al actualizar el nodo');
  }

  const data = await response.json();
  return extractData(data);
};

export const remove = async (id) => {
  const response = await apiFetch(`${API_URL}/${id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error al desactivar el nodo' }));
    throw new Error(errorData.message || 'Error al desactivar el nodo');
  }

  const data = await response.json();
  return extractData(data);
};
