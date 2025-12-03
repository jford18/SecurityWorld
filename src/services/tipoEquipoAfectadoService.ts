import api from './apiClient';

const BASE_PATH = '/catalogo-tipo-equipo-afectado';

export interface TipoEquipoAfectado {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  fecha_creacion: string;
}

export type TipoEquipoAfectadoPayload = {
  nombre: string;
  descripcion?: string;
  activo: boolean;
};

interface ListResponse {
  data: TipoEquipoAfectado[];
  total: number;
}

type ApiEnvelope<T> =
  | T
  | { data?: T }
  | { status?: string; message?: string; data?: T };

const hasDataProp = (payload: unknown): payload is { data: unknown } => {
  return typeof payload === 'object' && payload !== null && 'data' in payload;
};

const unwrap = <T>(payload: ApiEnvelope<T>): T => {
  if (hasDataProp(payload)) {
    return (payload as { data: T }).data ?? (payload as unknown as T);
  }

  return payload as T;
};

export const getAllTipoEquipoAfectado = async (params: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ListResponse> => {
  const response = await api.get(BASE_PATH, { params });

  // El backend devuelve { data: [...], total: number }
  const payload = response.data ?? {};

  return {
    data: payload.data ?? [],
    total: payload.total ?? 0,
  };
};

export async function getTipoEquipoAfectado(id: number): Promise<TipoEquipoAfectado | null> {
  const response = await api.get<ApiEnvelope<TipoEquipoAfectado | null>>(`${BASE_PATH}/${id}`);
  return unwrap(response.data);
}

export async function createTipoEquipoAfectado(
  payload: TipoEquipoAfectadoPayload,
): Promise<TipoEquipoAfectado> {
  const response = await api.post<ApiEnvelope<TipoEquipoAfectado>>(BASE_PATH, payload);
  return unwrap(response.data);
}

export async function updateTipoEquipoAfectado(
  id: number,
  payload: TipoEquipoAfectadoPayload,
): Promise<TipoEquipoAfectado> {
  const response = await api.put<ApiEnvelope<TipoEquipoAfectado>>(`${BASE_PATH}/${id}`, payload);
  return unwrap(response.data);
}

export async function deleteTipoEquipoAfectado(id: number): Promise<void> {
  await api.delete(`${BASE_PATH}/${id}`);
}
