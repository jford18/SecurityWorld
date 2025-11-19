import api from './api';

export interface InformeEventosResponse {
  resumen: {
    total_eventos: number;
    porcentaje_autorizados: number | null;
    porcentaje_no_autorizados: number | null;
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

export const getInformeMensualEventos = async (
  fechaInicio: string,
  fechaFin: string
): Promise<InformeEventosResponse> => {
  const response = await api.get('/api/reportes/eventos-mensual', {
    params: { fechaInicio, fechaFin },
  });
  return response.data;
};
