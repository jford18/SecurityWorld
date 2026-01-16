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

  queryParams.all = 'true';

  const { data } = await api.get<DashboardUptimeResponse>('/dashboards/uptime-camaras-manual', {
    params: queryParams,
  });

  return data;
};
