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
  sustraccionPersonal?: boolean | string;
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
  tipo_intrusion: string | null;
  hacienda_id: number | null;
  hacienda_nombre: string | null;
  sitio_id: number | null;
  sitio_nombre: string | null;
  total_eventos: number;
}

export interface EventosDashboardPorDiaRow {
  periodo: number;
  total: number;
}

export interface EventosDashboardPorSitioRow {
  sitio_id: number | null;
  sitio_nombre: string | null;
  sitio_descripcion?: string | null;
  total: number;
}

export interface EventosDashboardResponse {
  total: number;
  porDia: EventosDashboardPorDiaRow[];
  porSitio: EventosDashboardPorSitioRow[];
}

export interface TiempoLlegadaDashboardRow {
  sitio: string | null;
  sitio_descripcion?: string | null;
  minutos: number;
}

export interface ResumenProtocoloEventoRow {
  sitio_descripcion: string | null;
  nombre_sitio: string | null;
  fecha_intrusion: string | null;
  hora_intrusion: string | null;
  primera_comunicacion: string | null;
  resultado_fuerza_reaccion: string | null;
  tiempo_llegada_min: number | null;
  conclusion_evento: string | null;
}

export interface EventosNoAutorizadosDashboardResponse {
  total: number;
  tiempoLlegada: TiempoLlegadaDashboardRow[];
  resumen: ResumenProtocoloEventoRow[];
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
    tipo_intrusion: row?.tipo_intrusion ?? null,
    hacienda_id: row?.hacienda_id ?? null,
    hacienda_nombre: row?.hacienda_nombre ?? null,
    sitio_id: row?.sitio_id ?? null,
    sitio_nombre: row?.sitio_nombre ?? null,
    total_eventos: Number(row?.total_eventos) || 0,
  }));
};

export const getDashboardEventosNoAutorizados = async (
  params: IntrusionConsolidadoFilters
): Promise<EventosNoAutorizadosDashboardResponse> => {
  try {
    const queryString = buildQueryString(params);
    console.log('[INTRUSIONES][SERVICE][NO_AUTORIZADOS] request params:', params);
    const { data } = await apiClient.get<EventosNoAutorizadosDashboardResponse>(
      `/intrusiones/eventos-no-autorizados/dashboard${queryString}`
    );

    const total = Number(data?.total) || 0;

    const tiempoLlegada = Array.isArray(data?.tiempoLlegada)
      ? data.tiempoLlegada.map((row) => ({
          sitio_descripcion: row?.sitio_descripcion ?? null,
          sitio: row?.sitio_descripcion ?? row?.sitio ?? null,
          minutos:
            row?.minutos === null || row?.minutos === undefined ? 0 : Number(row.minutos),
        }))
      : [];

    const resumen = Array.isArray(data?.resumen)
      ? data.resumen.map((row) => ({
          sitio_descripcion: row?.sitio_descripcion ?? row?.nombre_sitio ?? null,
          nombre_sitio: row?.nombre_sitio ?? row?.sitio_descripcion ?? null,
          fecha_intrusion: row?.fecha_intrusion ?? null,
          hora_intrusion: row?.hora_intrusion ?? null,
          primera_comunicacion: row?.primera_comunicacion ?? null,
          resultado_fuerza_reaccion: row?.resultado_fuerza_reaccion ?? null,
          tiempo_llegada_min:
            row?.tiempo_llegada_min === null || row?.tiempo_llegada_min === undefined
              ? null
              : Number(row.tiempo_llegada_min),
          conclusion_evento: row?.conclusion_evento ?? null,
        }))
      : [];

    const parsed = { total, tiempoLlegada, resumen };
    return parsed;
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number; data?: { message?: string; detail?: string } } };
    console.log('[INTRUSIONES][SERVICE][NO_AUTORIZADOS] error:', axiosError?.response?.status, axiosError?.response?.data);
    const backendMessage = axiosError?.response?.data?.message;
    const backendDetail = axiosError?.response?.data?.detail;
    const combinedMessage = [backendMessage, backendDetail].filter(Boolean).join(': ');
    const finalMessage = combinedMessage || 'No se pudo cargar el dashboard de eventos no autorizados.';

    throw new Error(finalMessage);
  }
};

export const getDashboardEventosAutorizados = async (
  params: IntrusionConsolidadoFilters
): Promise<EventosDashboardResponse> => {
  try {
    const queryString = buildQueryString(params);
    const { data } = await apiClient.get<EventosDashboardResponse>(
      `/intrusiones/eventos-autorizados/dashboard${queryString}`
    );

    const total = Number(data?.total) || 0;
    const porDia = Array.isArray(data?.porDia)
      ? data.porDia
          .map((row) => ({
            periodo: row?.periodo === null || row?.periodo === undefined ? 0 : Number(row.periodo),
            total: Number(row?.total) || 0,
          }))
          .filter((row) => Number.isFinite(row.periodo))
      : [];

    const porSitio = Array.isArray(data?.porSitio)
      ? data.porSitio.map((row) => ({
          sitio_id: row?.sitio_id === null || row?.sitio_id === undefined ? null : Number(row.sitio_id),
          sitio_descripcion: row?.sitio_descripcion ?? null,
          sitio_nombre: row?.sitio_nombre ?? row?.sitio_descripcion ?? null,
          total: Number(row?.total) || 0,
        }))
      : [];

    return { total, porDia, porSitio };
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number; data?: { message?: string; detail?: string } } };
    console.log('[INTRUSIONES][SERVICE] error:', axiosError?.response?.status, axiosError?.response?.data);

    const status = axiosError?.response?.status;
    const backendMessage = axiosError?.response?.data?.message || 'Error al cargar dashboard autorizados';
    const backendDetail = axiosError?.response?.data?.detail;

    if (status === 400) {
      throw new Error(backendMessage);
    }

    const combinedMessage = [backendMessage, backendDetail].filter(Boolean).join(': ');
    const finalMessage = combinedMessage || 'No se pudo cargar el dashboard de eventos autorizados.';

    throw new Error(finalMessage);
  }
};

export const createIntrusion = async (
  payload: IntrusionPayload
): Promise<Intrusion> => {
  try {
    const { data } = await apiClient.post<Intrusion>('/intrusiones', payload);
    const normalized = normalizeIntrusion(data);
    if (!normalized) {
      throw new Error('Respuesta inesperada al crear la intrusión.');
    }
    return normalized;
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: unknown; status?: number } };
    console.log('[INTRUSIONES][SERVICE] error:', axiosError?.response?.status, axiosError?.response?.data);
    const backendMessage = (() => {
      const data = axiosError?.response?.data as
        | { message?: string; mensaje?: string; error?: string }
        | undefined;

      return data?.message || data?.mensaje || data?.error;
    })();

    const errorMessage = backendMessage || (error as Error)?.message || 'Error al crear la intrusión.';
    throw new Error(errorMessage);
  }
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
