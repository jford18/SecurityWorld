import apiClient from './apiClient';
import { getCurrentUserIdFromStorage } from '../utils/currentUser';
import {
  CatalogoDepartamento,
  CatalogoNodo,
  TechnicalFailure,
  TechnicalFailureCatalogs,
  FailureDurationResponse,
  FailureHistory,
} from '../types';

type RequestContext = {
  roleId?: number | null;
  roleName?: string | null;
};

export interface TechnicalFailurePayload {
  id?: string;
  fecha: string;
  hora?: string;
  equipo_afectado: string;
  descripcion_fallo: string;
  responsable: string;
  deptResponsable?: string;
  departamentoResponsableId?: string | number | null;
  tipoProblema?: string;
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
  usuarioId?: number | string | null;
  ultimoUsuarioEditoId?: number | string | null;
  responsable_verificacion_cierre_id?: number | string | null;
  reportadoCliente?: boolean;
  affectationType?: string;
  tipo_afectacion?: string;
  horaFallo?: string;
  // NEW: Campo combinado en formato ISO para fecha y hora del fallo.
  fechaHoraFallo?: string;
  camara?: string;
  cliente?: string | null;
  sitio_id?: number | string | null;
  tipo_equipo_afectado_id?: number | string | null;
}

export type SitioAsociado = {
  id: number;
  codigo?: string;
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
  const { data } = await apiClient.get<TechnicalFailure[] | { data?: TechnicalFailure[] }>('/fallos');
  return normalizeFallosResponse(data);
};

export const fetchFallos = getFallos;

const buildRoleHeaders = (context?: RequestContext) => {
  const headers: Record<string, string> = {};

  if (context?.roleName) {
    headers['x-role-name'] = context.roleName;
  }

  if (context?.roleId != null) {
    headers['x-role-id'] = String(context.roleId);
  }

  return headers;
};

export const createFallo = async (
  payload: TechnicalFailurePayload,
  context?: RequestContext,
): Promise<TechnicalFailure> => {
  const usuarioId = getCurrentUserIdFromStorage();

  console.log('[fallosService.createFallo] payload:', payload);
  console.log('[fallosService.createFallo] usuarioId que se enviará:', usuarioId);

  const body = {
    ...payload,
    usuarioId,
  };

  console.log('[fallosService.createFallo] body final que se envía a /fallos:', body);

  try {
    const { data } = await apiClient.post<TechnicalFailure>('/fallos', body, {
      headers: buildRoleHeaders(context),
    });
    return data;
  } catch (error: any) {
    console.error('[fallosService.createFallo] error:', error?.response?.data || error);
    throw error;
  }
};

export const updateFallo = async (
  id: string,
  payload: TechnicalFailurePayload,
  context?: RequestContext,
): Promise<TechnicalFailure> => {
  const { data } = await apiClient.put<TechnicalFailure>(`/fallos/${id}`, payload, {
    headers: buildRoleHeaders(context),
  });
  return data;
};

export const guardarCambiosFallo = async (
  id: string,
  payload: { departamento_id?: number | string | null; novedad_detectada?: string | null },
  context?: RequestContext,
) => {
  const ultimoUsuarioEditoId = getCurrentUserIdFromStorage();

  console.log("[fallosService.updateSupervisor] payload original:", payload);

  const body = {
    ...payload,
    ultimoUsuarioEditoId,
  };

  console.log(
    "[fallosService.updateSupervisor] ultimoUsuarioEditoId que se envía:",
    body.ultimoUsuarioEditoId,
  );
  console.log(
    "[fallosService.updateSupervisor] body final que se envía al backend:",
    body,
  );

  const { data } = await apiClient.patch<TechnicalFailure>(
    `/fallos/${id}/guardar-cambios`,
    body,
    {
      headers: buildRoleHeaders(context),
    },
  );

  return data;
};

export const cerrarFallo = async (
  id: string,
  payload: {
    fecha_resolucion: string;
    hora_resolucion: string;
    novedad_detectada?: string | null;
    responsable_verificacion_cierre_id?: number | string | null;
  },
  context?: RequestContext,
) => {
  const ultimoUsuarioEditoId = getCurrentUserIdFromStorage();

  const body = {
    ...payload,
    ultimoUsuarioEditoId,
    responsable_verificacion_cierre_id:
      (payload as any).responsable_verificacion_cierre_id ??
      (payload as any).responsableVerificacionCierreId ??
      null,
  };

  console.log("[fallosService.cerrarFallo] payload original:", payload);
  console.log(
    "[fallosService.cerrarFallo] ultimoUsuarioEditoId que se envía:",
    body.ultimoUsuarioEditoId,
  );
  console.log(
    "[fallosService.cerrarFallo] responsable_verificacion_cierre_id que se envía:",
    body.responsable_verificacion_cierre_id,
  );
  console.log("[fallosService.cerrarFallo] body final que se envía al backend:", body);

  try {
    const { data } = await apiClient.post<TechnicalFailure>(`/fallos/${id}/cerrar`, body, {
      headers: buildRoleHeaders(context),
    });

    return data;
  } catch (error: any) {
    console.error(
      "[fallosService.cerrarFallo] Error en llamada al backend:",
      error?.response?.data || error,
    );
    throw error;
  }
};

export const getFalloDuration = async (
  id: string,
  context?: RequestContext,
): Promise<FailureDurationResponse> => {
  const { data } = await apiClient.get<FailureDurationResponse>(`/fallos/${id}/duracion`, {
    headers: buildRoleHeaders(context),
  });
  return data;
};

export const getFalloHistorial = async (
  id: string,
  context?: RequestContext,
): Promise<FailureHistory> => {
  const { data } = await apiClient.get<FailureHistory>(`/fallos/${id}/historial`, {
    headers: buildRoleHeaders(context),
  });
  return data;
};

export const deleteFallo = async (id: string, context?: RequestContext) => {
  const { data } = await apiClient.delete<{ mensaje?: string }>(`/fallos/${id}`, {
    headers: buildRoleHeaders(context),
  });
  return data;
};

export const getCatalogos = async (): Promise<TechnicalFailureCatalogs> => {
  const { data } = await apiClient.get<TechnicalFailureCatalogs>('/catalogos');
  return data;
};

export const fetchCatalogos = getCatalogos;

export const getNodos = async (): Promise<CatalogoNodo[]> => {
  const { data } = await apiClient.get<MaybeArrayResponse<CatalogoNodo>>('/nodos');
  const nodos = normalizeArrayResponse<CatalogoNodo>(data)
    .map(mapNodo)
    .filter((nodo): nodo is CatalogoNodo => nodo !== null);

  return nodos;
};

export const getNodoSitios = async (
  nodoId: string | number,
): Promise<SitioAsociado[]> => {
  const { data } = await apiClient.get<SitioAsociado[]>(`/nodos/${nodoId}/sitio`);
  if (Array.isArray(data)) {
    return data.map((item) => ({
      ...item,
      id: Number(item.id),
    })).filter((item) => Number.isFinite(item.id));
  }

  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    const { data: nestedData } = data as { data: SitioAsociado[] };
    return nestedData
      .map((item) => ({
        ...item,
        id: Number(item.id),
      }))
      .filter((item) => Number.isFinite(item.id));
  }

  return [];
};

export const getDepartamentos = async (): Promise<CatalogoDepartamento[]> => {
  const catalogos = await getCatalogos();
  return catalogos.departamentos;
};

export const getUsuarios = async () => {
  const { data } = await apiClient.get('/usuarios');
  return Array.isArray(data) ? data : [];
};

export const getConsolas = async () => {
  const { data } = await apiClient.get('/consolas');
  return Array.isArray(data) ? data : [];
};
