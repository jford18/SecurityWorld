import api from './api';
import type { DashboardUptimeFilters, DashboardUptimeResponse } from './dashboardUptimeCamarasService';

export const fetchDashboardUptimeCamarasManual = async (
  params: DashboardUptimeFilters,
): Promise<DashboardUptimeResponse> => {
  const queryParams: Record<string, string> = {
    from: params.from,
    to: params.to,
  };

  if (params.haciendaId) {
    queryParams.hacienda_id = String(params.haciendaId);
  }

  if (params.clienteId) {
    queryParams.cliente_id = String(params.clienteId);
  }

  if (params.reportadoCliente !== null && params.reportadoCliente !== undefined) {
    queryParams.reportado_cliente = String(params.reportadoCliente);
  }

  queryParams.all = 'true';

  const { data } = await api.get<DashboardUptimeResponse & { data?: DashboardUptimeResponse['detalle'] }>(
    '/dashboards/uptime-camaras-manual',
    {
      params: queryParams,
    },
  );

  return {
    ...data,
    detalle: data.detalle ?? data.data ?? [],
  };
};
