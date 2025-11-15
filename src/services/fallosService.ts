import api from '../apiClient';
import {
  CatalogoDepartamento,
  CatalogoNodo,
  TechnicalFailure,
  TechnicalFailureCatalogs,
} from '../types';

export interface TechnicalFailurePayload {
  id?: string;
  fecha: string;
  equipo_afectado: string;
  descripcion_fallo: string;
  responsable: string;
  deptResponsable?: string;
  departamentoResponsableId?: string | number | null;
  tipoProblema?: string;
  tipoEquipo?: string;
  tipoProblemaEquipo?: string;
  nodo?: string;
  sitio?: string;
  consola?: string | null;
  fechaResolucion?: string;
  horaResolucion?: string;
  fechaHoraResolucion?: string;
  verificacionApertura?: string;
  verificacionAperturaId?: string | number | null;
  verificacionCierre?: string;
  verificacionCierreId?: string | number | null;
  novedadDetectada?: string;
  reportadoCliente?: boolean;
  affectationType?: string;
  horaFallo?: string;
  // NEW: Campo combinado en formato ISO para fecha y hora del fallo.
  fechaHoraFallo?: string;
  camara?: string;
  cliente?: string | null;
  sitio_id?: number | string | null;
  ultimo_usuario_edito_id?: number | null;
}

export type SitioAsociado = {
  id?: number;
  nombre: string;
};

type MaybeArrayResponse<T> = T[] | { data?: unknown };

const normalizeArrayResponse = <T>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === 'object') {
    const maybeData = (payload as { data?: unknown }).data;
    if (Array.isArray(maybeData)) {
      return maybeData as T[];
    }
  }

  return [];
};

const normalizeFallosResponse = (payload: unknown): TechnicalFailure[] => {
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

const mapNodo = (item: unknown): CatalogoNodo | null => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const idValue = (item as { id?: unknown }).id;
  const nameValue = (item as { nombre?: unknown }).nombre;
  const parsedId = Number(idValue);
  const nombre = typeof nameValue === 'string' ? nameValue : nameValue != null ? String(nameValue) : '';

  if (!Number.isFinite(parsedId) || !nombre) {
    return null;
  }

  return { id: parsedId, nombre };
};

export const getFallos = async (): Promise<TechnicalFailure[]> => {
  const { data } = await api.get<TechnicalFailure[] | { data?: TechnicalFailure[] }>('/api/fallos');
  return normalizeFallosResponse(data);
};

export const fetchFallos = getFallos;

export const createFallo = async (
  payload: TechnicalFailurePayload
): Promise<TechnicalFailure> => {
  const { data } = await api.post<TechnicalFailure>('/api/fallos', payload);
  return data;
};

export const updateFallo = async (
  id: string,
  payload: TechnicalFailurePayload
): Promise<TechnicalFailure> => {
  const { data } = await api.put<TechnicalFailure>(`/api/fallos/${id}`, payload);
  return data;
};

export const getCatalogos = async (): Promise<TechnicalFailureCatalogs> => {
  const { data } = await api.get<TechnicalFailureCatalogs>('/api/catalogos');
  return data;
};

export const fetchCatalogos = getCatalogos;

export const getNodos = async (): Promise<CatalogoNodo[]> => {
  const { data } = await api.get<MaybeArrayResponse<CatalogoNodo>>('/api/nodos');
  const nodos = normalizeArrayResponse<CatalogoNodo>(data)
    .map(mapNodo)
    .filter((nodo): nodo is CatalogoNodo => nodo !== null);

  return nodos;
};

export const getNodoSitio = async (nodoId: string | number): Promise<SitioAsociado> => {
  const { data } = await api.get<SitioAsociado>(`/api/nodos/${nodoId}/sitio`);
  return data;
};

export const getDepartamentos = async (): Promise<CatalogoDepartamento[]> => {
  const catalogos = await getCatalogos();
  return catalogos.departamentos;
};

export const getUsuarios = async () => {
  const { data } = await api.get('/api/usuarios');
  return Array.isArray(data) ? data : [];
};

export const getConsolas = async () => {
  const { data } = await api.get('/api/consolas');
  return Array.isArray(data) ? data : [];
};
