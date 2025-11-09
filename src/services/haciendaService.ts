import api from './api';

const BASE_PATH = '/api/hacienda';

export interface HaciendaRecord {
  id: number;
  nombre: string;
  direccion: string | null;
  activo: boolean;
  fecha_creacion: string;
}

export interface HaciendaListResponse {
  data: HaciendaRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface HaciendaSingleResponse {
  data: HaciendaRecord;
}

export interface HaciendaFilters {
  page?: number;
  limit?: number;
  q?: string;
  activo?: 'true' | 'false';
}

export interface HaciendaPayload {
  nombre: string;
  direccion?: string | null;
  activo?: boolean;
}

export const getHaciendas = async (filters: HaciendaFilters = {}) => {
  const params: Record<string, string | number | boolean> = {};

  if (typeof filters.page === 'number') {
    params.page = filters.page;
  }
  if (typeof filters.limit === 'number') {
    params.limit = filters.limit;
  }
  if (filters.q) {
    params.q = filters.q;
  }
  if (filters.activo === 'true' || filters.activo === 'false') {
    params.activo = filters.activo;
  }

  const response = await api.get<HaciendaListResponse>(BASE_PATH, { params });
  return response.data;
};

export const getHacienda = async (id: number) => {
  const response = await api.get<HaciendaSingleResponse>(`${BASE_PATH}/${id}`);
  return response.data;
};

export const createHacienda = async (payload: HaciendaPayload) => {
  const response = await api.post<HaciendaSingleResponse>(BASE_PATH, payload);
  return response.data;
};

export const updateHacienda = async (id: number, payload: HaciendaPayload) => {
  const response = await api.put<HaciendaSingleResponse>(`${BASE_PATH}/${id}`, payload);
  return response.data;
};

export const deleteHacienda = async (id: number) => {
  const response = await api.delete<HaciendaSingleResponse>(`${BASE_PATH}/${id}`);
  return response.data;
};
