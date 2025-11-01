import axios from 'axios';
import { TechnicalFailure, TechnicalFailureCatalogs } from '../types';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const http = axios.create({
  baseURL,
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

export const fetchFallos = async (): Promise<TechnicalFailure[]> => {
  const response = await http.get<TechnicalFailure[]>('/fallos');
  return response.data;
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
