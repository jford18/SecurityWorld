import api from './api';
import apiClient from './apiClient';

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

const resolveExportErrorMessage = async (
  payload: Blob,
  fallback: string
): Promise<string> => {
  try {
    const text = await payload.text();
    if (!text) return fallback;
    const parsed = JSON.parse(text) as { mensaje?: string; message?: string };
    return parsed?.mensaje || parsed?.message || text || fallback;
  } catch (error) {
    return fallback;
  }
};

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

export type LogeoTurnoExportFile = {
  blob: Blob;
  filename: string;
};

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

export const exportReporteLogeosTurnosExcel = async (
  filters: LogeoTurnoFilters
): Promise<LogeoTurnoExportFile> => {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (key === 'page' || key === 'limit') {
      return;
    }
    if (value === undefined || value === null || value === '') {
      return;
    }
    params.append(key, String(value));
  });

  const queryString = params.toString();
  const response = await apiClient.get<Blob>(
    `/reportes/logeos-turnos/export${queryString ? `?${queryString}` : ''}`,
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
      'No se pudo exportar el reporte de logeos por turno.'
    );
    throw new Error(message);
  }

  if (!blob || blob.size === 0) {
    throw new Error('Export inválido: archivo vacío');
  }

  const filename =
    parseContentDispositionFilename(response.headers?.['content-disposition']) ||
    `logeos_turnos_${Date.now()}.xlsx`;

  return { blob, filename };
};
