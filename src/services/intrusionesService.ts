import apiClient from './apiClient';
import { Intrusion, IntrusionConsolidadoRow, IntrusionHcQueueRow } from '../types';

export interface IntrusionPayload {
  origen?: string;
  hik_alarm_evento_id?: number | null;
  fecha_evento?: string;
  fecha_reaccion?: string | null;
  fecha_reaccion_enviada?: string | null;
  fecha_llegada_fuerza_reaccion?: string | null;
  fecha_reaccion_fuera?: string | null;
  no_llego_alerta?: boolean;
  completado?: boolean;
  fecha_completado?: string | null;
  necesita_protocolo?: boolean;
  ubicacion?: string;
  tipo?: string;
  estado?: string;
  descripcion?: string;
  llego_alerta?: boolean;
  medio_comunicacion_id?: number | null;
  conclusion_evento_id?: number | null;
  material_sustraido_id?: number | null;
  sitio_id?: number | null;
  fuerza_reaccion_id?: number | null;
  persona_id?: number | null;
}

const normalizeFechaValue = (value: unknown): string | null => {
  if (!value && value !== 0) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    const seconds = String(value.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  const asString = String(value).trim();
  return asString ? asString : null;
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
    material_sustraido_id?: unknown;
    material_sustraido?: unknown;
    fuerza_reaccion_id?: unknown;
    fuerza_reaccion_descripcion?: unknown;
    persona_id?: unknown;
    personal_identificado?: unknown;
  };

  const id = Number(base.id);
  const fechaEvento = normalizeFechaValue(base.fecha_evento);
  const fechaReaccion = normalizeFechaValue(base.fecha_reaccion);
  const fechaReaccionEnviada = normalizeFechaValue(base.fecha_reaccion_enviada);
  const fechaLlegadaFuerzaReaccion = normalizeFechaValue(
    base.fecha_llegada_fuerza_reaccion ?? base.fecha_reaccion_fuera
  );

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
  const hikAlarmEventoIdValue =
    base.hik_alarm_evento_id === null || base.hik_alarm_evento_id === undefined
      ? null
      : Number(base.hik_alarm_evento_id);
  const hikAlarmEventoId =
    hikAlarmEventoIdValue === null || Number.isNaN(hikAlarmEventoIdValue)
      ? null
      : hikAlarmEventoIdValue;
  const noLlegoAlerta =
    typeof (base as { no_llego_alerta?: unknown }).no_llego_alerta === 'boolean'
      ? (base as { no_llego_alerta: boolean }).no_llego_alerta
      : (base as { llego_alerta?: unknown }).llego_alerta !== undefined
      ? !Boolean((base as { llego_alerta?: unknown }).llego_alerta)
      : false;
  const completado = typeof (base as { completado?: unknown }).completado === 'boolean'
    ? (base as { completado: boolean }).completado
    : Boolean((base as { completado?: unknown }).completado);

  const materialSustraidoIdValue =
    base.material_sustraido_id === null || base.material_sustraido_id === undefined
      ? null
      : Number(base.material_sustraido_id);
  const materialSustraidoId =
    materialSustraidoIdValue === null || Number.isNaN(materialSustraidoIdValue)
      ? null
      : materialSustraidoIdValue;

  return {
    id,
    origen: base.origen == null ? null : String(base.origen),
    hik_alarm_evento_id: hikAlarmEventoId,
    fecha_evento: fechaEvento,
    fecha_reaccion: fechaReaccion,
    fecha_reaccion_enviada: fechaReaccionEnviada,
    fecha_llegada_fuerza_reaccion: fechaLlegadaFuerzaReaccion,
    fecha_reaccion_fuera: fechaLlegadaFuerzaReaccion,
    no_llego_alerta: noLlegoAlerta,
    completado,
    fecha_completado: normalizeFechaValue((base as { fecha_completado?: unknown }).fecha_completado),
    necesita_protocolo: typeof (base as { necesita_protocolo?: unknown }).necesita_protocolo === 'boolean'
      ? (base as { necesita_protocolo: boolean }).necesita_protocolo
      : Boolean((base as { necesita_protocolo?: unknown }).necesita_protocolo),
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
    material_sustraido_id: materialSustraidoId,
    material_sustraido:
      base.material_sustraido == null ? null : String(base.material_sustraido),
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

export interface IntrusionesHcFilters {
  page?: number;
  rowsPerPage?: number;
  search?: string;
  consolaId?: number | string;
}

export interface IntrusionesHcResponse {
  data: IntrusionHcQueueRow[];
  total: number;
}

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
  fechaDesde?: string | Date | null;
  fechaHasta?: string | Date | null;
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

export interface IntrusionConsolidadoExportFile {
  blob: Blob;
  filename: string;
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

const EXCEL_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const parseContentDispositionFilename = (contentDisposition?: string): string | null => {
  if (!contentDisposition) return null;

  const filenameMatch =
    contentDisposition.match(/filename\*=UTF-8''([^;]+)/i) ||
    contentDisposition.match(/filename="?([^\";]+)"?/i);

  if (!filenameMatch?.[1]) return null;

  const decoded = decodeURIComponent(filenameMatch[1]);
  return decoded.replace(/[/\\]/g, '').trim();
};

const resolveExportErrorMessage = async (payload: Blob, fallback: string): Promise<string> => {
  try {
    const text = await payload.text();
    if (!text) return fallback;
    const parsed = JSON.parse(text) as { mensaje?: string; message?: string };
    return parsed?.mensaje || parsed?.message || text || fallback;
  } catch (error) {
    return fallback;
  }
};

const buildQueryString = (params: IntrusionConsolidadoFilters) => {
  const searchParams = new URLSearchParams();

  const normalizeValue = (value: unknown) => {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    return value;
  };

  Object.entries(params).forEach(([key, value]) => {
    const normalizedValue = normalizeValue(value);

    if (normalizedValue === undefined || normalizedValue === null || normalizedValue === '') {
      return;
    }

    searchParams.append(key, String(normalizedValue));
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
    const normalizedValue = value instanceof Date
      ? (Number.isNaN(value.getTime()) ? null : value.toISOString())
      : value;

    if (normalizedValue === undefined || normalizedValue === null || normalizedValue === '') {
      return;
    }

    searchParams.append(key, String(normalizedValue));
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
): Promise<IntrusionConsolidadoExportFile> => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (key === 'page' || key === 'limit') {
      return;
    }

    const normalizedValue = value instanceof Date
      ? (Number.isNaN(value.getTime()) ? null : value.toISOString())
      : value;

    if (normalizedValue === undefined || normalizedValue === null || normalizedValue === '') {
      return;
    }

    searchParams.append(key, String(normalizedValue));
  });

  const query = searchParams.toString();
  const response = await apiClient.get<Blob>(
    `/intrusiones/consolidado/export${query ? `?${query}` : ''}`,
    {
      responseType: 'blob',
      headers: {
        Accept: EXCEL_MIME_TYPE,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    }
  );

  const contentType = String(response.headers?.['content-type'] || '');
  const blob = response.data;

  if (!contentType.includes('spreadsheetml.sheet')) {
    const message = await resolveExportErrorMessage(
      blob,
      'No se pudo exportar el consolidado de intrusiones.'
    );
    throw new Error(message);
  }

  if (!blob || blob.size === 0) {
    throw new Error('Export inválido: archivo vacío');
  }

  const filename =
    parseContentDispositionFilename(response.headers?.['content-disposition']) ||
    `consolidado_intrusiones_${Date.now()}.xlsx`;

  return { blob, filename };
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
    const payloadToSend: IntrusionPayload = { ...payload };
    const hasHikAlarmEventoId =
      payload.hik_alarm_evento_id !== undefined && payload.hik_alarm_evento_id !== null;

    if (hasHikAlarmEventoId) {
      payloadToSend.no_llego_alerta = false;
      payloadToSend.origen = payloadToSend.origen ?? 'HC';
    }

    const { data } = await apiClient.post<Intrusion>('/intrusiones', payloadToSend);
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

export const fetchIntrusionesEncoladasHc = async (
  params: IntrusionesHcFilters = {}
): Promise<IntrusionesHcResponse> => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.append(key, String(value));
  });

  const query = searchParams.toString();

  const { data } = await apiClient.get<IntrusionesHcResponse>(
    `/intrusiones/encolados-hc${query ? `?${query}` : ''}`
  );

  const payload = data as Partial<IntrusionesHcResponse> & { data?: unknown };
  const parsedData = Array.isArray(payload.data)
    ? (payload.data as IntrusionHcQueueRow[]).map((item) => ({
        ...item,
        trigger_event: item?.trigger_event ?? null,
        source: item?.source ?? null,
        alarm_acknowledgment_time: item?.alarm_acknowledgment_time ?? null,
      }))
    : [];

  return { data: parsedData, total: payload.total ?? parsedData.length };
};

export const openIntrusionDesdeHc = async (
  hikAlarmEventoId: number | string
): Promise<number> => {
  const url = `/intrusiones/hc/${hikAlarmEventoId}/abrir`;
  console.log('[SERVICE] POST abrir HC url=', url, 'hikId=', hikAlarmEventoId);
  const { data } = await apiClient.post<{ id?: number | string }>(url);
  console.log('[SERVICE] POST abrir HC response=', (data as unknown) ?? null);

  const parsedId = Number((data as { id?: unknown }).id);
  if (!Number.isInteger(parsedId)) {
    throw new Error('No se pudo abrir la intrusión encolada.');
  }

  return parsedId;
};
