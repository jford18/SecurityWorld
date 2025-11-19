import apiClient from '../apiClient';
import { Intrusion } from '../types';

export interface IntrusionPayload {
  fecha_evento?: string;
  fecha_reaccion?: string | null;
  ubicacion?: string;
  tipo?: string;
  estado?: string;
  descripcion?: string;
  llego_alerta?: boolean;
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
    ubicacion?: unknown;
    tipo?: unknown;
    estado?: unknown;
    descripcion?: unknown;
    llego_alerta?: unknown;
  };

  const id = Number(base.id);
  const fechaEvento = normalizeFechaValue(base.fecha_evento);
  const fechaReaccion = normalizeFechaValue(base.fecha_reaccion);

  if (!Number.isFinite(id) || !fechaEvento) {
    return null;
  }

  return {
    id,
    fecha_evento: fechaEvento,
    fecha_reaccion: fechaReaccion,
    ubicacion: base.ubicacion == null ? '' : String(base.ubicacion),
    tipo: base.tipo == null ? '' : String(base.tipo),
    estado: base.estado == null ? '' : String(base.estado),
    descripcion: base.descripcion == null ? null : String(base.descripcion),
    llego_alerta:
      typeof base.llego_alerta === 'boolean' ? base.llego_alerta : Boolean(base.llego_alerta),
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

export const fetchIntrusiones = async (): Promise<Intrusion[]> => {
  const { data } = await apiClient.get<Intrusion[] | { data?: Intrusion[] }>('/intrusiones');
  return normalizeIntrusionArray(data);
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
