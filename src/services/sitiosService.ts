import api from './api';

const BASE_PATH = '/sitios';

export interface Sitio {
  id: number;
  nombre: string;
  descripcion: string | null;
  servidor?: string | null;
  ubicacion: string | null;
  link_mapa: string | null;
  latitud: number | null;
  longitud: number | null;
  activo: boolean;
  fecha_creacion?: string;
  cliente_id?: number | null;
  cliente_nombre?: string | null;
  clienteId?: number | null;
  clienteNombre?: string | null;
  hacienda_id?: number | null;
  hacienda_nombre?: string | null;
  haciendaId?: number | null;
  haciendaNombre?: string | null;
  tipo_area_id?: number | null;
  tipo_area_nombre?: string | null;
  tipo_area_descripcion?: string | null;
  tipoAreaId?: number | null;
  tipoAreaNombre?: string | null;
  tipoAreaDescripcion?: string | null;
  consola_id?: number | null;
  consola_nombre?: string | null;
  consolaId?: number | null;
  consolaNombre?: string | null;
}

export interface SitioPayload {
  nombre: string;
  descripcion?: string | null;
  servidor?: string | null;
  ubicacion?: string | null;
  activo?: boolean;
  link_mapa?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  clienteId: number;
  haciendaId?: number | null;
  tipoAreaId?: number | null;
  consolaId?: number | null;
}

export interface GetSitiosParams
  extends Record<string, string | number | boolean | number[] | undefined | null> {
  soloDisponibles?: boolean;
  sitioActualId?: number | number[];
  consolaId?: number | null;
  clienteId?: number | string;
  haciendaId?: number | string | null;
}

export const getSitios = async (params?: GetSitiosParams) => {
  const normalizedParams = params
    ? Object.entries(params).reduce<Record<string, string | number | boolean>>((acc, [key, value]) => {
        if (value === undefined || value === null) {
          return acc;
        }

        if (Array.isArray(value)) {
          acc[key] = value.join(',');
        } else {
          acc[key] = value;
        }

        return acc;
      }, {})
    : undefined;

  const response = await api.get<Sitio[]>(BASE_PATH, { params: normalizedParams });
  return response.data;
};

export const getSitio = async (id: number) => {
  const response = await api.get<Sitio>(`${BASE_PATH}/${id}`);
  return response.data;
};

export const createSitio = async (payload: SitioPayload) => {
  const response = await api.post<Sitio>(BASE_PATH, payload);
  return response.data;
};

export const updateSitio = async (id: number, payload: SitioPayload) => {
  const response = await api.put<Sitio>(`${BASE_PATH}/${id}`, payload);
  return response.data;
};

export const deleteSitio = async (id: number) => {
  const response = await api.delete(`${BASE_PATH}/${id}`);
  return response.data;
};
