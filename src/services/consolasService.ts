import api from './api';

const BASE_PATH = '/api/consolas';

export type ConsolaPayload = {
  nombre: string;
};

export const getConsolas = async () => {
  const response = await api.get(BASE_PATH);
  return response.data;
};

export const createConsola = async (payload: ConsolaPayload) => {
  const response = await api.post(BASE_PATH, payload);
  return response.data;
};

export const updateConsola = async (id: number, payload: ConsolaPayload) => {
  const response = await api.put(`${BASE_PATH}/${id}`, payload);
  return response.data;
};

export const deleteConsola = async (id: number) => {
  const response = await api.delete(`${BASE_PATH}/${id}`);
  return response.data;
};
