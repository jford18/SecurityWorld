import apiClient from "@/services/apiClient";

const BASE_PATH = "/api/hacienda";

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
  activo?: "true" | "false";
}

export interface HaciendaPayload {
  nombre: string;
  direccion?: string | null;
  activo?: boolean;
}

export const getHaciendas = (params?: HaciendaFilters) =>
  apiClient.get<HaciendaListResponse>(BASE_PATH, { params });

export const getHacienda = (id: number) =>
  apiClient.get<HaciendaSingleResponse>(`${BASE_PATH}/${id}`);

export const createHacienda = (payload: HaciendaPayload) =>
  apiClient.post<HaciendaSingleResponse>(BASE_PATH, payload);

export const updateHacienda = (id: number, payload: HaciendaPayload) =>
  apiClient.put<HaciendaSingleResponse>(`${BASE_PATH}/${id}`, payload);

export const deleteHacienda = (id: number) =>
  apiClient.delete<HaciendaSingleResponse>(`${BASE_PATH}/${id}`);
