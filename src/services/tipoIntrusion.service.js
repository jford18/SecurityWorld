import api from './api';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const BASE_PATH = '/api/tipo-intrusion';
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

export const getAll = async (params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.search) {
    searchParams.set('search', params.search);
  }
  if (params.page) {
    searchParams.set('page', params.page);
  }
  if (params.limit) {
    searchParams.set('limit', params.limit);
  }

  const queryString = searchParams.toString();
  const url = queryString ? `${BASE_PATH}?${queryString}` : BASE_PATH;
  const response = await api.get(url);
  return extractData(response.data);
};

export const getById = async (id) => {
  const response = await api.get(`${BASE_PATH}/${id}`);
  return extractData(response.data);
};

export const create = async (payload) => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload ?? {}),
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error al crear el tipo de intrusión' }));
    throw new Error(errorData.message || 'Error al crear el tipo de intrusión');
  }

  const data = await response.json();
  return extractData(data);
};

export const update = async (id, payload) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload ?? {}),
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error al actualizar el tipo de intrusión' }));
    throw new Error(errorData.message || 'Error al actualizar el tipo de intrusión');
  }

  const data = await response.json();
  return extractData(data);
};

export const remove = async (id) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error al desactivar el tipo de intrusión' }));
    throw new Error(errorData.message || 'Error al desactivar el tipo de intrusión');
  }

  const data = await response.json();
  return extractData(data);
};
