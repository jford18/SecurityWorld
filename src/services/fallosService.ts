import api from "@/api";
import {
  TechnicalFailure,
  TechnicalFailureCatalogs,
  CatalogoDepartamento,
  CatalogoTipoProblema,
  CatalogoResponsable,
  CatalogoNodo,
  CatalogoDispositivo,
  SitioPorConsola,
} from "@/types";

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

const toStringValue = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

const toOptionalString = (value: unknown): string | undefined => {
  const normalized = toStringValue(value).trim();
  return normalized ? normalized : undefined;
};

const transformFallo = (raw: any): TechnicalFailure => ({
  id: String(raw?.id ?? ""),
  fecha: toStringValue(raw?.fecha ?? raw?.fecha_fallo ?? ""),
  equipo_afectado: toStringValue(raw?.equipo_afectado ?? raw?.equipo ?? ""),
  descripcion_fallo: toStringValue(raw?.descripcion_fallo ?? raw?.descripcion ?? ""),
  responsable: toStringValue(raw?.responsable ?? raw?.usuario ?? ""),
  estado: toOptionalString(raw?.estado ?? raw?.estatus),
  deptResponsable: toOptionalString(
    raw?.deptResponsable ?? raw?.departamento ?? raw?.departamento_responsable
  ),
  consola: toOptionalString(raw?.consola ?? raw?.consola_nombre),
  fechaResolucion: toOptionalString(raw?.fechaResolucion ?? raw?.fecha_resolucion),
  horaResolucion: toOptionalString(raw?.horaResolucion ?? raw?.hora_resolucion),
  verificacionApertura: toOptionalString(
    raw?.verificacionApertura ?? raw?.verificacion_apertura
  ),
  verificacionCierre: toOptionalString(
    raw?.verificacionCierre ?? raw?.verificacion_cierre
  ),
  novedadDetectada: toOptionalString(raw?.novedadDetectada ?? raw?.novedad_detectada),
});

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const mapDepartamentos = (items: unknown): CatalogoDepartamento[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: toNumber((item as any)?.id),
      nombre: toStringValue((item as any)?.nombre).trim(),
    }))
    .filter((item) => Boolean(item.nombre));
};

const mapTiposProblema = (items: unknown): CatalogoTipoProblema[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: toNumber((item as any)?.id),
      descripcion: toStringValue((item as any)?.descripcion).trim(),
    }))
    .filter((item) => Boolean(item.descripcion));
};

const mapResponsables = (items: unknown): CatalogoResponsable[] => {
  if (!Array.isArray(items)) return [];
  return (items as any[])
    .map((item) => {
      const nombre = toStringValue((item as any)?.nombre ?? (item as any)?.nombre_usuario).trim();
      if (!nombre) {
        return null;
      }
      return {
        id: toNumber((item as any)?.id),
        nombre,
      };
    })
    .filter((item): item is CatalogoResponsable => Boolean(item));
};

const mapNodos = (items: unknown): CatalogoNodo[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: toNumber((item as any)?.id),
      nombre: toStringValue((item as any)?.nombre).trim(),
    }))
    .filter((item) => Boolean(item.nombre));
};

const mapDispositivos = (items: unknown): CatalogoDispositivo[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: toNumber((item as any)?.id),
      nombre: toStringValue((item as any)?.nombre).trim(),
      estado: toOptionalString((item as any)?.estado),
    }))
    .filter((item) => Boolean(item.nombre));
};

const mapSitios = (items: unknown): SitioPorConsola[] => {
  if (!Array.isArray(items)) return [];
  return (items as any[])
    .map((item) => {
      const sitio = toStringValue((item as any)?.sitio).trim();
      const cliente = toStringValue((item as any)?.cliente).trim();
      const consola = toStringValue((item as any)?.consola).trim();

      if (!sitio || !consola) {
        return null;
      }

      return { sitio, cliente, consola };
    })
    .filter((item): item is SitioPorConsola => Boolean(item));
};

const mapStringArray = (items: unknown): string[] => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => toStringValue(item).trim()).filter(Boolean);
};

const mapNodoCliente = (items: unknown): { nodo: string; cliente: string }[] => {
  if (!Array.isArray(items)) return [];
  return (items as any[])
    .map((item) => ({
      nodo: toStringValue((item as any)?.nodo).trim(),
      cliente: toStringValue((item as any)?.cliente).trim(),
    }))
    .filter((item) => item.nodo && item.cliente);
};

export const getFallos = async (): Promise<TechnicalFailure[]> => {
  const res = await api.get<TechnicalFailure[]>("/api/fallos");

  if (!res.ok) {
    throw new Error("Error al obtener los fallos técnicos");
  }

  const data = Array.isArray(res.data) ? res.data : [];
  return data.map(transformFallo);
};

export const createFallo = async (
  payload: TechnicalFailurePayload
): Promise<TechnicalFailure> => {
  const res = await api.post<TechnicalFailure>("/api/fallos", payload);

  if (!res.ok) {
    throw new Error("Error al crear el fallo técnico");
  }

  return transformFallo(res.data ?? {});
};

export const updateFallo = async (
  id: string,
  payload: TechnicalFailurePayload
): Promise<TechnicalFailure> => {
  const numericId = Number(id);
  const fallbackId = Number.isNaN(numericId) ? id : numericId;

  const res = await api.put<TechnicalFailure>(
    `/api/fallos/${fallbackId}`,
    payload
  );

  if (!res.ok) {
    throw new Error("Error al actualizar el fallo técnico");
  }

  return transformFallo(res.data ?? {});
};

export const deleteFallo = async (id: string | number) => {
  const numericId = Number(id);
  const fallbackId = Number.isNaN(numericId) ? id : numericId;
  const res = await api.delete<{ mensaje?: string }>(
    `/api/fallos/${fallbackId}`
  );

  if (!res.ok) {
    throw new Error("Error al eliminar el fallo técnico");
  }

  return res.data;
};

export const getCatalogos = async (): Promise<TechnicalFailureCatalogs> => {
  const res = await api.get<any>("/api/catalogos");

  if (!res.ok) {
    throw new Error("Error al obtener los catálogos de fallos técnicos");
  }

  const data = res.data ?? {};

  return {
    departamentos: mapDepartamentos(data.departamentos),
    tiposProblema: mapTiposProblema(data.tiposProblema),
    responsablesVerificacion: mapResponsables(
      data.responsablesVerificacion
    ),
    nodos: mapNodos(data.nodos),
    nodoCliente: mapNodoCliente(data.nodoCliente),
    tiposEquipo: mapStringArray(data.tiposEquipo),
    tiposProblemaEquipo: mapStringArray(data.tiposProblemaEquipo),
    dispositivos: mapDispositivos(data.dispositivos),
    sitiosPorConsola: mapSitios(data.sitiosPorConsola),
  };
};
