import axios from 'axios';
import { TechnicalFailure, TechnicalFailureCatalogs } from '../types';

const http = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface TechnicalFailurePayload {
  id?: string;
  fecha: string;
  equipo_afectado: string;
  descripcion_fallo: string;
  responsable: string;
  deptResponsable?: string;
  tipoProblema?: string;
  tipoEquipo?: string;
  tipoProblemaEquipo?: string;
  nodo?: string;
  sitio?: string;
  consola?: string | null;
  fechaResolucion?: string;
  horaResolucion?: string;
  verificacionApertura?: string;
  verificacionCierre?: string;
  novedadDetectada?: string;
  reportadoCliente?: boolean;
  affectationType?: string;
  horaFallo?: string;
  // NEW: Campo combinado en formato ISO para fecha y hora del fallo.
  fechaHoraFallo?: string;
  camara?: string;
  cliente?: string | null;
}

const normalizeFallosResponse = (
  payload: unknown
): TechnicalFailure[] => {
  if (Array.isArray(payload)) {
    return payload as TechnicalFailure[];
  }

  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: TechnicalFailure[] }).data;
  }

  console.error('Respuesta inesperada al obtener fallos técnicos:', payload);
  return [];
};

export const fetchFallos = async (): Promise<TechnicalFailure[]> => {
  const response = await http.get('/fallos');
  return normalizeFallosResponse(response.data);
};

export const createFallo = async (
  payload: TechnicalFailurePayload
): Promise<TechnicalFailure> => {
  const response = await http.post<TechnicalFailure>('/fallos', payload);
  return response.data;
};

export const updateFallo = async (
  id: string,
  payload: TechnicalFailurePayload
): Promise<TechnicalFailure> => {
  const response = await http.put<TechnicalFailure>(`/fallos/${id}`, payload);
  return response.data;
};

export const fetchCatalogos = async (): Promise<TechnicalFailureCatalogs> => {
  const response = await http.get<TechnicalFailureCatalogs>('/catalogos');
  return response.data;
};
