import api from './api';

export interface LogeoTurnoRow {
  id_log: number;
  fecha_logeo: string;
  hora_logeo: string;
  turno: string;
  usuario: string | null;
  consola: string | null;
}

export interface LogeoTurnoFilters {
  fecha_desde: string;
  fecha_hasta: string;
  turno?: 'DIURNO' | 'NOCTURNO' | '';
  consola_id?: number | '';
  usuario?: string;
  page?: number;
  limit?: number;
}

export const getReporteLogeosTurnos = async (filters: LogeoTurnoFilters) => {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    params.append(key, String(value));
  });

  const queryString = params.toString();
  const response = await api.get(`/reportes/logeos-turnos${queryString ? `?${queryString}` : ''}`);

  return response.data as { data: LogeoTurnoRow[]; total: number };
};
