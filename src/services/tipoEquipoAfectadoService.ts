import api from './api';

const BASE_PATH = '/catalogo-tipo-equipo-afectado';

export type TipoEquipoAfectado = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
};

export type TipoEquipoAfectadoPayload = {
  nombre: string;
  descripcion?: string;
  activo: boolean;
};

export type TipoEquipoAfectadoListResponse = {
  data: TipoEquipoAfectado[];
  total: number;
  page: number;
  limit: number;
};

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

export async function getAllTipoEquipoAfectado(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<TipoEquipoAfectadoListResponse> {
  const response = await api.get<ApiEnvelope<TipoEquipoAfectadoListResponse | TipoEquipoAfectado[]>>(BASE_PATH, { params });
  const data = unwrap(response.data);

  if (Array.isArray(data)) {
    return {
      data,
      total: data.length,
      page: 1,
      limit: data.length,
    };
  }

  const records = Array.isArray((data as { data?: unknown })?.data)
    ? ((data as { data?: TipoEquipoAfectado[] }).data ?? [])
    : Array.isArray((data as { items?: unknown })?.items)
      ? ((data as { items?: TipoEquipoAfectado[] }).items ?? [])
      : [];

  const total = Number((data as { total?: unknown })?.total ?? records.length) || records.length;
  const pageValue = (data as { page?: unknown })?.page;
  const limitValue = (data as { limit?: unknown })?.limit ?? (data as { pageSize?: unknown })?.pageSize;

  const page = Number.isFinite(Number(pageValue)) ? Number(pageValue) : params?.page ?? 0;
  const limit = Number.isFinite(Number(limitValue))
    ? Number(limitValue)
    : params?.limit ?? records.length;

  return { data: records, total, page, limit };
}

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
