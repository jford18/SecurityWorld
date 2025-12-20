import api from './api';
import { IntrusionConsolidadoFilters } from './intrusionesService';

export interface InformeEventosResponse {
  resumen: {
    total_eventos: number;
    eventos_autorizados: number;
    eventos_no_autorizados: number;
    porc_autorizados: number | null;
    porc_no_autorizados: number | null;
    sitios_con_eventos: number;
    t_prom_reaccion_min: number | null;
  } | null;
  porTipo: Array<{
    tipo: string;
    n_eventos: number;
    n_sitios_con_evento: number;
  }>;
  porDia: Array<{
    fecha: string;
    n_eventos: number;
  }>;
  porDiaSemanaTipo: Array<{
    dia_semana: number;
    tipo_intrusion: string;
    n_eventos: number;
  }>;
  porHoraTipo: Array<{
    hora: number;
    tipo_intrusion: string;
    n_eventos: number;
  }>;
}

export interface EventoPorSitio {
  sitio_id: number | null;
  sitio_nombre: string;
  latitud: number | null;
  longitud: number | null;
  total_eventos: number;
}

const buildQueryString = (filters: IntrusionConsolidadoFilters) => {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.append(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const getInformeMensualEventos = async (
  filters: IntrusionConsolidadoFilters
): Promise<InformeEventosResponse> => {
  const queryString = buildQueryString(filters);
  const response = await api.get(`/reportes/eventos-mensual${queryString}`);
  return response.data;
};

export const getEventosPorSitio = async (
  filters: IntrusionConsolidadoFilters
): Promise<EventoPorSitio[]> => {
  const queryString = buildQueryString(filters);
  const response = await api.get(`/reportes/informe-eventos/eventos-por-sitio${queryString}`);

  return response.data;
};
