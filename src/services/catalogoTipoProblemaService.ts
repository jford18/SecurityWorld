// Servicio especializado para consumir el backend de catálogo tipo problema utilizando el cliente común.
import type { CatalogoTipoProblema } from '../types';
import api from './api';

const BASE_PATH = '/api/v1/catalogo-tipo-problema';

export type CatalogoTipoProblemaPayload = {
  descripcion: string;
};

type ApiEnvelope<T> = T | { data: T } | { status?: string; message?: string; data?: T };

const hasDataProp = (payload: unknown): payload is { data: unknown } => {
  return typeof payload === 'object' && payload !== null && 'data' in payload;
};

const unwrap = <T>(payload: ApiEnvelope<T>): T => {
  if (hasDataProp(payload)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

export const fetchCatalogoTiposProblema = async (): Promise<CatalogoTipoProblema[]> => {
  const response = await api.get<ApiEnvelope<CatalogoTipoProblema[]>>(BASE_PATH);
  const data = unwrap(response.data);
  return Array.isArray(data) ? data : [];
};

export const getCatalogoTipoProblema = async (id: number | string): Promise<CatalogoTipoProblema | null> => {
  const response = await api.get<ApiEnvelope<CatalogoTipoProblema | null>>(`${BASE_PATH}/${id}`);
  return unwrap(response.data);
};

export const createCatalogoTipoProblema = async (
  payload: CatalogoTipoProblemaPayload,
): Promise<CatalogoTipoProblema> => {
  const response = await api.post<ApiEnvelope<CatalogoTipoProblema>>(BASE_PATH, payload);
  return unwrap(response.data);
};

export const updateCatalogoTipoProblema = async (
  id: number | string,
  payload: CatalogoTipoProblemaPayload,
): Promise<CatalogoTipoProblema> => {
  const response = await api.put<ApiEnvelope<CatalogoTipoProblema>>(`${BASE_PATH}/${id}`, payload);
  return unwrap(response.data);
};

export const deleteCatalogoTipoProblema = async (id: number | string): Promise<void> => {
  await api.delete(`${BASE_PATH}/${id}`);
};
