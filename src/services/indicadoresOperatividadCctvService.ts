import api from './api';

export interface OperatividadFilters {
  fechaDesde: string;
  fechaHasta: string;
  cliente?: string;
  haciendaSitio?: string;
  area?: string;
  name?: string;
}

export interface OperatividadResumen {
  total_camaras: number;
  camaras_online: number;
  camaras_offline: number;
  tiempo_disponible_horas: number;
  total_hours_online: number;
  total_hours_offline: number;
  uptime_pct: number;
  times_offline: number;
}

export interface OperatividadDetalleRow {
  cliente: string;
  hacienda_sitio: string;
  area: string;
  name: string;
  network_status: string;
  auto_check_time: string;
  total_hours_offline: number;
  total_hours_online: number;
  times_offline: number;
  uptime_pct: number;
}

export interface OperatividadUptimeClienteRow {
  cliente: string;
  total_camaras: number;
  total_hours_offline: number;
  total_hours_online: number;
  times_offline: number;
  uptime_pct: number;
}

export interface OperatividadUptimeDiaRow {
  day: string;
  total_camaras: number;
  total_hours_offline: number;
  total_hours_online: number;
  uptime_pct: number;
}

export interface OperatividadReincidenciaRow {
  name: string;
  cliente: string;
  hacienda_sitio: string;
  area: string;
  times_offline_7d: number;
}

export interface OperatividadFiltrosResponse {
  cliente: string[];
  haciendaSitio: string[];
  area: string[];
  cameraName: string[];
}

const toParams = (filters: OperatividadFilters) => ({
  fechaDesde: filters.fechaDesde,
  fechaHasta: filters.fechaHasta,
  ...(filters.cliente ? { cliente: filters.cliente } : {}),
  ...(filters.haciendaSitio ? { haciendaSitio: filters.haciendaSitio } : {}),
  ...(filters.area ? { area: filters.area } : {}),
  ...(filters.name ? { name: filters.name } : {}),
});

export const getOperatividadFiltros = async (filters: OperatividadFilters) => {
  const { data } = await api.get<OperatividadFiltrosResponse>('/dashboards/operatividad-cctv/filtros', {
    params: toParams(filters),
  });
  return data;
};

export const getOperatividadResumen = async (filters: OperatividadFilters) => {
  const { data } = await api.get<OperatividadResumen>('/dashboards/operatividad-cctv/resumen', {
    params: toParams(filters),
  });
  return data;
};

export const getOperatividadDetalle = async (filters: OperatividadFilters) => {
  const { data } = await api.get<OperatividadDetalleRow[]>('/dashboards/operatividad-cctv/detalle', {
    params: toParams(filters),
  });
  return data;
};

export const getOperatividadUptimeCliente = async (filters: OperatividadFilters) => {
  const { data } = await api.get<OperatividadUptimeClienteRow[]>('/dashboards/operatividad-cctv/uptime-cliente', {
    params: toParams(filters),
  });
  return data;
};

export const getOperatividadUptimeDia = async (filters: OperatividadFilters) => {
  const { data } = await api.get<OperatividadUptimeDiaRow[]>('/dashboards/operatividad-cctv/uptime-dia', {
    params: toParams(filters),
  });
  return data;
};

export const getOperatividadReincidencia = async (filters: OperatividadFilters) => {
  const { data } = await api.get<OperatividadReincidenciaRow[]>('/dashboards/operatividad-cctv/reincidencia', {
    params: toParams(filters),
  });
  return data;
};

export const exportOperatividadExcel = async (filters: OperatividadFilters) => {
  const response = await api.get('/dashboards/operatividad-cctv/export-excel', {
    params: toParams(filters),
    responseType: 'blob',
  });

  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `indicadores_operatividad_cctv_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
