import api from './api';

export type TipoServicioDTO = {
  ID: number;
  NOMBRE: string;
  DESCRIPCION: string | null;
  ACTIVO: boolean;
  FECHA_CREACION: string;
};

export type TipoServicioPayload = {
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
};

const BASE_URL = '/tipos-servicio';

type ApiEnvelope<T> = T | { data: T } | { status: string; message?: string; data?: T };

const unwrapData = <T>(payload: ApiEnvelope<T>): T => {
  if (payload && typeof payload === 'object' && 'data' in payload && (payload as { data?: unknown }).data !== undefined) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

export const getTiposServicio = async (): Promise<TipoServicioDTO[]> => {
  const response = await api.get<ApiEnvelope<TipoServicioDTO[]>>(BASE_URL);
  const data = unwrapData(response.data);
  return Array.isArray(data) ? data : [];
};

export const getTipoServicioById = async (id: number | string): Promise<TipoServicioDTO> => {
  const response = await api.get<ApiEnvelope<TipoServicioDTO>>(`${BASE_URL}/${id}`);
  return unwrapData(response.data);
};

export const createTipoServicio = async (
  payload: TipoServicioPayload
): Promise<TipoServicioDTO> => {
  const response = await api.post<ApiEnvelope<TipoServicioDTO>>(BASE_URL, payload);
  return unwrapData(response.data);
};

export const updateTipoServicio = async (
  id: number | string,
  payload: TipoServicioPayload
): Promise<TipoServicioDTO> => {
  const response = await api.put<ApiEnvelope<TipoServicioDTO>>(`${BASE_URL}/${id}`, payload);
  return unwrapData(response.data);
};

export const toggleTipoServicioActivo = async (
  id: number | string
): Promise<TipoServicioDTO> => {
  const response = await api.patch<ApiEnvelope<TipoServicioDTO>>(`${BASE_URL}/${id}/activo`);
  return unwrapData(response.data);
};
