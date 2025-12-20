import apiClient from './apiClient';
import { Intrusion, IntrusionConsolidadoRow } from '../types';

export interface IntrusionPayload {
  fecha_evento?: string;
  fecha_reaccion?: string | null;
  fecha_reaccion_fuera?: string | null;
  ubicacion?: string;
  tipo?: string;
  estado?: string;
  descripcion?: string;
  llego_alerta?: boolean;
  medio_comunicacion_id?: number | null;
  conclusion_evento_id?: number | null;
  sustraccion_material?: boolean;
  sitio_id?: number | null;
  fuerza_reaccion_id?: number | null;
  persona_id?: number | null;
}

const normalizeFechaValue = (value: unknown): string | null => {
  if (!value && value !== 0) {
    return null;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const asDate = new Date(value as string);
  return Number.isNaN(asDate.getTime()) ? null : asDate.toISOString();
};

const normalizeIntrusion = (payload: unknown): Intrusion | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const base = payload as {
    id?: unknown;
    fecha_evento?: unknown;
    fecha_reaccion?: unknown;
    fecha_reaccion_fuera?: unknown;
    ubicacion?: unknown;
    sitio_id?: unknown;
    sitio_nombre?: unknown;
    tipo?: unknown;
    estado?: unknown;
    descripcion?: unknown;
    llego_alerta?: unknown;
    medio_comunicacion_id?: unknown;
    medio_comunicacion_descripcion?: unknown;
    conclusion_evento_id?: unknown;
    conclusion_evento_descripcion?: unknown;
    sustraccion_material?: unknown;
    fuerza_reaccion_id?: unknown;
    fuerza_reaccion_descripcion?: unknown;
    persona_id?: unknown;
    personal_identificado?: unknown;
  };

  const id = Number(base.id);
  const fechaEvento = normalizeFechaValue(base.fecha_evento);
  const fechaReaccion = normalizeFechaValue(base.fecha_reaccion);
  const fechaReaccionFuera = normalizeFechaValue(base.fecha_reaccion_fuera);

  if (!Number.isFinite(id) || !fechaEvento) {
    return null;
  }

  const medioIdValue =
    base.medio_comunicacion_id === null || base.medio_comunicacion_id === undefined
      ? null
      : Number(base.medio_comunicacion_id);
  const medioComunicacionId =
    medioIdValue === null || Number.isNaN(medioIdValue) ? null : medioIdValue;

  const conclusionIdValue =
    base.conclusion_evento_id === null || base.conclusion_evento_id === undefined
      ? null
      : Number(base.conclusion_evento_id);
  const conclusionEventoId =
    conclusionIdValue === null || Number.isNaN(conclusionIdValue) ? null : conclusionIdValue;
  const sitioIdValue =
    base.sitio_id === null || base.sitio_id === undefined || base.sitio_id === ''
      ? null
      : Number(base.sitio_id);
  const sitioId =
    sitioIdValue === null || Number.isNaN(sitioIdValue) ? null : sitioIdValue;
  const fuerzaReaccionValue =
    base.fuerza_reaccion_id === null || base.fuerza_reaccion_id === undefined
      ? null
      : Number(base.fuerza_reaccion_id);
  const fuerzaReaccionId =
    fuerzaReaccionValue === null || Number.isNaN(fuerzaReaccionValue)
      ? null
      : fuerzaReaccionValue;
  const personaIdValue =
    base.persona_id === null || base.persona_id === undefined
      ? null
      : Number(base.persona_id);
  const personaId =
    personaIdValue === null || Number.isNaN(personaIdValue)
      ? null
      : personaIdValue;

  return {
    id,
    fecha_evento: fechaEvento,
    fecha_reaccion: fechaReaccion,
    fecha_reaccion_fuera: fechaReaccionFuera,
    ubicacion: base.ubicacion == null ? '' : String(base.ubicacion),
    sitio_id: sitioId,
    sitio_nombre:
      base.sitio_nombre == null ? null : String(base.sitio_nombre),
    tipo: base.tipo == null ? '' : String(base.tipo),
    estado: base.estado == null ? '' : String(base.estado),
    descripcion: base.descripcion == null ? null : String(base.descripcion),
    llego_alerta:
      typeof base.llego_alerta === 'boolean' ? base.llego_alerta : Boolean(base.llego_alerta),
    medio_comunicacion_id: medioComunicacionId,
    medio_comunicacion_descripcion:
      base.medio_comunicacion_descripcion == null
        ? null
        : String(base.medio_comunicacion_descripcion),
    conclusion_evento_id: conclusionEventoId,
    conclusion_evento_descripcion:
      base.conclusion_evento_descripcion == null
        ? null
        : String(base.conclusion_evento_descripcion),
    sustraccion_material:
      typeof base.sustraccion_material === 'boolean'
        ? base.sustraccion_material
        : Boolean(base.sustraccion_material),
    fuerza_reaccion_id: fuerzaReaccionId,
    fuerza_reaccion_descripcion:
      base.fuerza_reaccion_descripcion == null
        ? null
        : String(base.fuerza_reaccion_descripcion),
    persona_id: personaId,
    personal_identificado:
      base.personal_identificado == null
        ? null
        : String(base.personal_identificado),
  };
};

const normalizeIntrusionArray = (payload: unknown): Intrusion[] => {
  if (Array.isArray(payload)) {
    return payload
      .map(normalizeIntrusion)
      .filter((item): item is Intrusion => item !== null);
  }

  if (payload && typeof payload === 'object') {
    const maybeData = (payload as { data?: unknown }).data;
    if (Array.isArray(maybeData)) {
      return maybeData
        .map(normalizeIntrusion)
        .filter((item): item is Intrusion => item !== null);
    }
  }

  return [];
};

export interface IntrusionConsolidadoFilters {
  fechaDesde?: string;
  fechaHasta?: string;
  clienteId?: number | string;
  haciendaId?: number | string;
  sitioId?: number | string;
  tipoIntrusionId?: number | string;
  tipoIntrusion?: string;
  llegoAlerta?: boolean | string;
  personalId?: number | string;
  page?: number;
  limit?: number;
}

export interface IntrusionConsolidadoResponse {
  data: IntrusionConsolidadoRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IntrusionConsolidadoExportResponse {
  data: IntrusionConsolidadoRow[];
  total: number;
}

export interface EventoPorHaciendaSitioRow {
  hacienda_id: number | null;
  hacienda_nombre: string | null;
  sitio_id: number | null;
  sitio_nombre: string | null;
  total_eventos: number;
}

const buildQueryString = (params: IntrusionConsolidadoFilters) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.append(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const fetchIntrusiones = async (): Promise<Intrusion[]> => {
  const { data } = await apiClient.get<Intrusion[] | { data?: Intrusion[] }>('/intrusiones');
  return normalizeIntrusionArray(data);
};

export const fetchIntrusionesConsolidado = async (
  params: IntrusionConsolidadoFilters
): Promise<IntrusionConsolidadoResponse> => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.append(key, String(value));
  });

  const query = searchParams.toString();
  const { data } = await apiClient.get<IntrusionConsolidadoResponse>(
    `/intrusiones/consolidado${query ? `?${query}` : ''}`
  );

  const payload = data as Partial<IntrusionConsolidadoResponse> & {
    data?: unknown;
  };

  return {
    data: Array.isArray(payload.data)
      ? (payload.data as IntrusionConsolidadoRow[])
      : [],
    total: payload.total ?? 0,
    page: payload.page ?? 1,
    pageSize: payload.pageSize ?? params.limit ?? 0,
  };
};

export const exportIntrusionesConsolidado = async (
  params: IntrusionConsolidadoFilters
): Promise<IntrusionConsolidadoExportResponse> => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (key === 'page' || key === 'limit') {
      return;
    }

    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.append(key, String(value));
  });

  const query = searchParams.toString();
  const { data } = await apiClient.get<IntrusionConsolidadoExportResponse>(
    `/intrusiones/consolidado/export${query ? `?${query}` : ''}`
  );

  const payload = data as Partial<IntrusionConsolidadoExportResponse> & {
    data?: unknown;
  };

  const parsedData = Array.isArray(payload.data)
    ? (payload.data as IntrusionConsolidadoRow[])
    : [];

  return {
    data: parsedData,
    total: payload.total ?? parsedData.length,
  };
};

export const getEventosPorHaciendaSitio = async (
  params: IntrusionConsolidadoFilters
): Promise<EventoPorHaciendaSitioRow[]> => {
  const queryString = buildQueryString(params);
  const { data } = await apiClient.get<EventoPorHaciendaSitioRow[]>(
    `/intrusiones/eventos-por-hacienda-sitio${queryString}`
  );

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => ({
    hacienda_id: row?.hacienda_id ?? null,
    hacienda_nombre: row?.hacienda_nombre ?? null,
    sitio_id: row?.sitio_id ?? null,
    sitio_nombre: row?.sitio_nombre ?? null,
    total_eventos: Number(row?.total_eventos) || 0,
  }));
};

export const createIntrusion = async (
  payload: IntrusionPayload
): Promise<Intrusion> => {
  const { data } = await apiClient.post<Intrusion>('/intrusiones', payload);
  const normalized = normalizeIntrusion(data);
  if (!normalized) {
    throw new Error('Respuesta inesperada al crear la intrusión.');
  }
  return normalized;
};

export const updateIntrusion = async (
  id: number | string,
  payload: IntrusionPayload
): Promise<Intrusion> => {
  const { data } = await apiClient.put<Intrusion>(`/intrusiones/${id}`, payload);
  const normalized = normalizeIntrusion(data);
  if (!normalized) {
    throw new Error('Respuesta inesperada al actualizar la intrusión.');
  }
  return normalized;
};

export const deleteIntrusion = async (id: number): Promise<unknown> => {
  const response = await apiClient.delete(`/intrusiones/${id}`);
  return response.data;
};
