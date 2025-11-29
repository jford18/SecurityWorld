import apiClient from './apiClient';

export interface TipoEquipoAfectado {
  id: number;
  nombre: string;
  descripcion?: string | null;
}

type RawTipoEquipoAfectado = {
  id?: unknown;
  ID?: unknown;
  nombre?: unknown;
  NOMBRE?: unknown;
  descripcion?: unknown;
  DESCRIPCION?: unknown;
};

type MaybeWrappedResponse = RawTipoEquipoAfectado[] | { data?: unknown };

const mapItem = (item: RawTipoEquipoAfectado): TipoEquipoAfectado | null => {
  const idValue = Number(item.id ?? item.ID);
  const nombreValue = item.nombre ?? item.NOMBRE;
  const descripcionValue = item.descripcion ?? item.DESCRIPCION;

  if (!Number.isFinite(idValue)) {
    return null;
  }

  const nombre =
    typeof nombreValue === 'string'
      ? nombreValue
      : nombreValue != null
      ? String(nombreValue)
      : '';

  if (!nombre) {
    return null;
  }

  const descripcion =
    typeof descripcionValue === 'string'
      ? descripcionValue
      : descripcionValue != null
      ? String(descripcionValue)
      : null;

  return { id: idValue, nombre, descripcion };
};

const normalizeResponse = (payload: MaybeWrappedResponse): TipoEquipoAfectado[] => {
  const rawData = Array.isArray(payload) ? payload : (payload?.data as unknown);

  if (!Array.isArray(rawData)) {
    return [];
  }

  return rawData
    .map((item) => mapItem(item) as TipoEquipoAfectado | null)
    .filter((item): item is TipoEquipoAfectado => item !== null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
};

export const getAllTipoEquipoAfectado = async (): Promise<TipoEquipoAfectado[]> => {
  const { data } = await apiClient.get<MaybeWrappedResponse>('/catalogo-tipo-equipo-afectado');
  return normalizeResponse(data);
};

export default { getAllTipoEquipoAfectado };
