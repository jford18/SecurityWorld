import api from './api';

export interface DashboardFallosTecnicosKpis {
  fallos_reportados: number;
  t_prom_solucion_dias: number;
  pct_pendientes: number;
  pct_resueltos: number;
}

export interface PendientesPorDepartamento {
  departamento: string;
  total: number;
}

export interface PendientesPorProblemaHacienda {
  problema_label: string;
  hacienda: string;
  total: number;
}

export interface TablaClientesRow {
  cliente: string;
  t_prom_solucion_dias: number | null;
  fallos_pendientes: number;
  fallos_resueltos: number;
  porc_resueltos: number;
}

export interface TendenciaPendientesRow {
  mes: string;
  num_fallos: number;
  pct_tg: number;
}

export interface FiltroItem {
  id: number;
  nombre: string;
}

export interface DashboardFallosTecnicosFiltersData {
  clientes: FiltroItem[];
  haciendas: FiltroItem[];
  problemas: FiltroItem[];
  meses: string[];
}

export interface DashboardFallosTecnicosResponse {
  kpis: DashboardFallosTecnicosKpis;
  pendientes_por_departamento: PendientesPorDepartamento[];
  pendientes_por_problema_hacienda: PendientesPorProblemaHacienda[];
  tabla_clientes: TablaClientesRow[];
  tendencia_pendientes_mes: TendenciaPendientesRow[];
  filtros: DashboardFallosTecnicosFiltersData;
}

export interface DashboardFallosTecnicosParams {
  clienteIds?: number[];
  clienteId?: number | null;
  reportadoCliente?: string | boolean | null;
  haciendaId?: number | null;
  mes?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  problemaId?: number | null;
  consolaId?: number | null;
  signal?: AbortSignal;
}

export const fetchDashboardFallosTecnicosResumen = async (
  params: DashboardFallosTecnicosParams,
): Promise<DashboardFallosTecnicosResponse> => {
  const queryParams: Record<string, string> = {};

  if (params.clienteIds && params.clienteIds.length > 0) {
    queryParams.CLIENTE_IDS = params.clienteIds.join(',');
  }

  if (params.clienteId) {
    queryParams.cliente_id = String(params.clienteId);
  }

  if (params.reportadoCliente !== undefined && params.reportadoCliente !== null && params.reportadoCliente !== '') {
    queryParams.reportado_cliente = String(params.reportadoCliente);
  }

  if (params.haciendaId) {
    queryParams.HACIENDA_ID = String(params.haciendaId);
  }

  if (params.mes) {
    queryParams.MES = params.mes;
  }

  if (params.fechaDesde !== undefined && params.fechaDesde !== null) {
    queryParams.fecha_desde = params.fechaDesde;
  }

  if (params.fechaHasta !== undefined && params.fechaHasta !== null) {
    queryParams.fecha_hasta = params.fechaHasta;
  }

  if (params.problemaId) {
    queryParams.PROBLEMA_ID = String(params.problemaId);
  }

  if (params.consolaId) {
    queryParams.CONSOLA_ID = String(params.consolaId);
  }

  const { data } = await api.get<DashboardFallosTecnicosResponse>(
    '/dashboard/fallos-tecnicos/resumen',
    {
      params: queryParams,
      signal: params.signal,
    },
  );

  return data;
};
