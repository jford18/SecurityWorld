import api from './api';

const BASE_PATH = '/api/sitios';

export interface Sitio {
  id: number;
  nombre: string;
  descripcion: string | null;
  ubicacion: string | null;
  activo: boolean;
  fecha_creacion?: string;
}

export interface SitioPayload {
  nombre: string;
  descripcion?: string | null;
  ubicacion?: string | null;
  activo?: boolean;
}

export const getSitios = async () => {
  const response = await api.get<Sitio[]>(BASE_PATH);
  return response.data;
};

export const getSitio = async (id: number) => {
  const response = await api.get<Sitio>(`${BASE_PATH}/${id}`);
  return response.data;
};

export const createSitio = async (payload: SitioPayload) => {
  const response = await api.post<Sitio>(BASE_PATH, payload);
  return response.data;
};

export const updateSitio = async (id: number, payload: SitioPayload) => {
  const response = await api.put<Sitio>(`${BASE_PATH}/${id}`, payload);
  return response.data;
};

export const deleteSitio = async (id: number) => {
  const response = await api.delete(`${BASE_PATH}/${id}`);
  return response.data;
};
