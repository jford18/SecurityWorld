import api from './api';
import type { Hacienda } from '../types';

export type HaciendaPayload = {
  nombre: string;
  direccion?: string;
  activo?: boolean;
};

export const fetchHaciendas = async (): Promise<Hacienda[]> => {
  const { data } = await api.get('/haciendas');
  return data;
};

export const createHacienda = async (payload: HaciendaPayload) => {
  const { data } = await api.post('/haciendas', payload);
  return data;
};

export const updateHacienda = async (
  id: number,
  payload: HaciendaPayload,
) => {
  const { data } = await api.put(`/haciendas/${id}`, payload);
  return data;
};

export const deleteHacienda = async (id: number) => {
  const { data } = await api.delete(`/haciendas/${id}`);
  return data;
};
