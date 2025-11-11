import api from './api';

export const getTiposArea = async () => {
  const response = await api.get('/api/tipo-area');
  return response.data;
};

export const getTipoArea = async (id) => {
  const response = await api.get(`/api/tipo-area/${id}`);
  return response.data;
};

export const createTipoArea = async (tipoArea) => {
  const response = await api.post('/api/tipo-area', tipoArea);
  return response.data;
};

export const updateTipoArea = async (id, tipoArea) => {
  const response = await api.put(`/api/tipo-area/${id}`, tipoArea);
  return response.data;
};

export const deleteTipoArea = async (id) => {
  const response = await api.delete(`/api/tipo-area/${id}`);
  return response.data;
};
