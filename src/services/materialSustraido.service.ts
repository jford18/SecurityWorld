import api from './api';

const BASE_PATH = '/material-sustraido';

const extractData = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if ('data' in payload && (payload as { data?: unknown }).data !== undefined) {
    return (payload as { data: unknown }).data;
  }

  return payload;
};

export type MaterialSustraidoDTO = {
  id: number;
  descripcion: string;
  estado?: boolean | null;
};

export const getAll = async (options?: {
  search?: string;
  estado?: boolean;
  limit?: number;
  page?: number;
}) => {
  const params: Record<string, unknown> = {};

  if (options?.search && options.search.trim()) {
    params.search = options.search.trim();
  }

  if (options?.estado !== undefined) {
    params.estado = options.estado;
  }

  if (options?.limit !== undefined) {
    params.limit = options.limit;
  }

  if (options?.page !== undefined) {
    params.page = options.page;
  }

  const response = await api.get(BASE_PATH, { params });
  return extractData(response.data) as MaterialSustraidoDTO[];
};
