import api from './api';

export interface UptimeKpis {
  dias: number;
  camaras: number;
  t_disponible_h: number;
  t_caido_h: number;
  uptime_pct: number;
}

export interface UptimeDetalleRow {
  mes: number;
  id: string;
  camara?: string;
  sitio_afectado_final: string;
  fecha_fallo: string;
  hora_fallo: string;
  fecha_recuperacion: string;
  hora_recuperacion: string;
  tiempo_offline_h: number;
  n_camaras: number;
  hacienda: string;
}

export interface DashboardUptimeResponse {
  kpis: UptimeKpis;
  detalle: UptimeDetalleRow[];
}

export interface DashboardUptimeFilters {
  from: string;
  to: string;
  haciendaId?: number | null;
}

export const fetchDashboardUptimeCamaras = async (
  params: DashboardUptimeFilters,
): Promise<DashboardUptimeResponse> => {
  const queryParams: Record<string, string> = {
    from: params.from,
    to: params.to,
  };

  if (params.haciendaId) {
    queryParams.hacienda_id = String(params.haciendaId);
  }

  queryParams.all = 'true';

  const { data } = await api.get<DashboardUptimeResponse>('/dashboards/uptime-camaras', {
    params: queryParams,
  });

  return data;
};
