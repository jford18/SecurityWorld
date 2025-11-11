import api from './api';

const API_URL = '/api/v1/tipo-area';

export const getAllTipoArea = async () => {
  const response = await api.get(API_URL);
  return response.data;
};

export const getTipoAreaById = async (id) => {
  const response = await api.get(`${API_URL}/${id}`);
  return response.data;
};

export const createTipoArea = async (data) => {
  const response = await api.post(API_URL, data);
  return response.data;
};

export const updateTipoArea = async (id, data) => {
  const response = await api.put(`${API_URL}/${id}`, data);
  return response.data;
};

export const deleteTipoArea = async (id) => {
  const response = await api.delete(`${API_URL}/${id}`);
  return response.data;
};
