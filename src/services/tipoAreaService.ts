import { API_BASE_URL } from './api';

const API_URL = `${API_BASE_URL}/api/v1/tipo-area`;

const headers = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

export const getAllTipoArea = async () => {
  const response = await fetch(API_URL, { headers });
  if (!response.ok) {
    throw new Error('Error al obtener los tipos de área');
  }
  return response.json();
};

export const getTipoAreaById = async (id) => {
  const response = await fetch(`${API_URL}/${id}`, { headers });
  if (!response.ok) {
    throw new Error('Error al obtener el tipo de área');
  }
  return response.json();
};

export const createTipoArea = async (data) => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Error al crear el tipo de área');
  }
  return response.json();
};

export const updateTipoArea = async (id, data) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Error al actualizar el tipo de área');
  }
  return response.json();
};

export const deleteTipoArea = async (id) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    throw new Error('Error al eliminar el tipo de área');
  }
  return response.json();
};
