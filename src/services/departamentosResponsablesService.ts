import api from './api';

export type DepartamentoResponsable = {
  id: number;
  nombre: string;
};

export type DepartamentoResponsablePayload = {
  nombre: string;
};

const API_URL = '/v1/departamentos-responsables';

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

export const getAllDepartamentosResponsables = async (): Promise<DepartamentoResponsable[]> => {
  const response = await api.get<ApiEnvelope<DepartamentoResponsable[]>>(API_URL);
  const data = unwrap(response.data);
  return Array.isArray(data) ? data : [];
};

export const getDepartamentoResponsableById = async (
  id: number | string,
): Promise<DepartamentoResponsable | null> => {
  const response = await api.get<ApiEnvelope<DepartamentoResponsable | null>>(`${API_URL}/${id}`);
  return unwrap(response.data);
};

export const createDepartamentoResponsable = async (
  payload: DepartamentoResponsablePayload,
): Promise<DepartamentoResponsable> => {
  const response = await api.post<ApiEnvelope<DepartamentoResponsable>>(API_URL, payload);
  return unwrap(response.data);
};

export const updateDepartamentoResponsable = async (
  id: number | string,
  payload: DepartamentoResponsablePayload,
): Promise<DepartamentoResponsable> => {
  const response = await api.put<ApiEnvelope<DepartamentoResponsable>>(`${API_URL}/${id}`, payload);
  return unwrap(response.data);
};

export const deleteDepartamentoResponsable = async (id: number | string): Promise<void> => {
  await api.delete(`${API_URL}/${id}`);
};
