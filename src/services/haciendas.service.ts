import api from './api';

export interface HaciendaResumen {
  id: number;
  nombre: string;
}

export const getHaciendasActivas = async (): Promise<HaciendaResumen[]> => {
  const { data } = await api.get<HaciendaResumen[] | { data?: HaciendaResumen[] }>(
    '/haciendas/activas'
  );

  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data?: HaciendaResumen[] }).data ?? [];
  }

  return [];
};

