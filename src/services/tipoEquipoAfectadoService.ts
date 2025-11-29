import api from './api';

const ENDPOINT = '/catalogo-tipo-equipo-afectado';

export interface TipoEquipoAfectado {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  fecha_creacion: string;
}

export interface TipoEquipoAfectadoPayload {
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
}

export interface TipoEquipoAfectadoListResponse {
  items: TipoEquipoAfectado[];
  total: number;
  page: number;
  pageSize: number;
}

const unwrap = <T>(payload: T | { data: T }): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

const mapItem = (item: any): TipoEquipoAfectado => ({
  id: Number(item?.id) || 0,
  nombre: item?.nombre ?? '',
  descripcion: item?.descripcion ?? null,
  activo: Boolean(item?.activo),
  fecha_creacion: item?.fecha_creacion ?? '',
});

const normalizeList = (payload: unknown): TipoEquipoAfectadoListResponse => {
  const unwrapped = unwrap(payload as any);

  if (unwrapped && typeof unwrapped === 'object' && 'items' in (unwrapped as any)) {
    const { items, total, page, pageSize } = unwrapped as {
      items?: any[];
      total?: number;
      page?: number;
      pageSize?: number;
    };

    const normalizedItems = Array.isArray(items) ? items.map(mapItem) : [];
    return {
      items: normalizedItems,
      total: typeof total === 'number' ? total : normalizedItems.length,
      page: typeof page === 'number' ? page : 1,
      pageSize:
        typeof pageSize === 'number' && pageSize > 0
          ? pageSize
          : normalizedItems.length || 10,
    };
  }

  const fallbackItems = Array.isArray(unwrapped) ? unwrapped.map(mapItem) : [];
  return {
    items: fallbackItems,
    total: fallbackItems.length,
    page: 1,
    pageSize: fallbackItems.length || 10,
  };
};

const sanitizeParams = (
  params?: Record<string, string | number | boolean | undefined | null>
) => {
  if (!params) return undefined;

  const sanitizedEntries = Object.entries(params).reduce<Record<string, string | number | boolean>>(
    (acc, [key, value]) => {
      if (value === undefined || value === null) return acc;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return acc;
        acc[key] = trimmed;
        return acc;
      }
      if (typeof value === 'number' && Number.isNaN(value)) return acc;
      acc[key] = value;
      return acc;
    },
    {}
  );

  return Object.keys(sanitizedEntries).length > 0 ? sanitizedEntries : undefined;
};

export const getAllTipoEquipoAfectado = async (
  params?: Record<string, string | number | boolean | null | undefined>
): Promise<TipoEquipoAfectadoListResponse> => {
  const sanitized = sanitizeParams(params);
  const response = sanitized
    ? await api.get(ENDPOINT, { params: sanitized })
    : await api.get(ENDPOINT);
  return normalizeList(response.data);
};

export const getTipoEquipoAfectadoById = async (
  id: number | string
): Promise<TipoEquipoAfectado | null> => {
  const response = await api.get(`${ENDPOINT}/${id}`);
  const payload = unwrap<TipoEquipoAfectado | null>(response.data as any);
  return payload ? mapItem(payload) : null;
};

export const createTipoEquipoAfectado = async (
  data: TipoEquipoAfectadoPayload
): Promise<TipoEquipoAfectado> => {
  const response = await api.post(ENDPOINT, data);
  return mapItem(unwrap(response.data as any));
};

export const updateTipoEquipoAfectado = async (
  id: number | string,
  data: TipoEquipoAfectadoPayload
): Promise<TipoEquipoAfectado> => {
  const response = await api.put(`${ENDPOINT}/${id}`, data);
  return mapItem(unwrap(response.data as any));
};

export const deleteTipoEquipoAfectado = async (id: number | string): Promise<void> => {
  await api.delete(`${ENDPOINT}/${id}`);
};

export default {
  getAllTipoEquipoAfectado,
  getTipoEquipoAfectadoById,
  createTipoEquipoAfectado,
  updateTipoEquipoAfectado,
  deleteTipoEquipoAfectado,
};
