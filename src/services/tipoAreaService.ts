import api from './api';

const API_URL = '/api/tipo-area';

type TipoArea = {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
};

export type TipoAreaPayload = {
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
};

type ApiEnvelope<T> = T | { data: T };

const hasDataProp = (payload: unknown): payload is { data: unknown } => {
  return typeof payload === 'object' && payload !== null && 'data' in payload;
};

const unwrapDataContainer = <T>(payload: ApiEnvelope<T>): T => {
  if (hasDataProp(payload)) {
    return payload.data as T;
  }

  return payload as T;
};

const normalizeListResponse = (payload: ApiEnvelope<TipoArea[]>): TipoArea[] => {
  const normalized = unwrapDataContainer(payload);
  return Array.isArray(normalized) ? normalized : [];
};

export const getAllTipoArea = async (): Promise<TipoArea[]> => {
  const response = await api.get<ApiEnvelope<TipoArea[]>>(API_URL);
  return normalizeListResponse(response.data);
};

export const getTipoAreaById = async (id: number | string): Promise<TipoArea | null> => {
  const response = await api.get<ApiEnvelope<TipoArea | null>>(`${API_URL}/${id}`);
  return unwrapDataContainer(response.data);
};

export const createTipoArea = async (data: TipoAreaPayload): Promise<TipoArea> => {
  const response = await api.post<ApiEnvelope<TipoArea>>(API_URL, data);
  return unwrapDataContainer(response.data);
};

export const updateTipoArea = async (id: number | string, data: TipoAreaPayload): Promise<TipoArea> => {
  const response = await api.put<ApiEnvelope<TipoArea>>(`${API_URL}/${id}`, data);
  return unwrapDataContainer(response.data);
};

export const deleteTipoArea = async (id: number | string): Promise<void> => {
  await api.delete(`${API_URL}/${id}`);
};
