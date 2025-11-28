import apiClient, { apiFetch } from './apiClient';

const jsonContentType = 'application/json';
const ENDPOINT = '/consolas';

const handleResponse = async (response: Response) => {
  if (response.status === 204 || response.status === 304) {
    return [];
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes(jsonContentType)) {
    throw new Error('Respuesta inválida del servidor');
  }

  const data = await response.json();
  return data;
};

export type ConsolaPayload = {
  nombre: string;
};

export interface Consola {
  id: number;
  nombre: string;
  fecha_creacion: string;
}

let cachedConsolas: Consola[] | null = null;

const getAll = async (): Promise<Consola[]> => {
  const { data } = await apiClient.get(ENDPOINT);
  const payload = data;

  const rawData = Array.isArray(payload) ? payload : payload?.data;

  if (!Array.isArray(rawData)) {
    throw new Error('Formato de respuesta inválido al obtener consolas');
  }

  const parsed = rawData.map((item: any) => ({
    id: item.id,
    nombre: item.nombre,
    fecha_creacion: item.fecha_creacion ?? '',
  }));

  cachedConsolas = parsed;
  return parsed;
};

export const getConsolas = getAll;

const normalizeName = (value: string | null | undefined) =>
  (value ?? '')
    .toString()
    .trim()
    .toLowerCase();

export const resolveConsolaIdByName = async (
  nombre: string | null | undefined
): Promise<number | null> => {
  if (!nombre) {
    return null;
  }

  const normalizedTarget = normalizeName(nombre);

  if (cachedConsolas === null) {
    try {
      cachedConsolas = await getAll();
    } catch (error) {
      console.error('No se pudieron cargar las consolas para filtrado:', error);
      cachedConsolas = [];
    }
  }

  const match = cachedConsolas.find(
    (consola) => normalizeName(consola.nombre) === normalizedTarget
  );

  return match?.id ?? null;
};

// NEW: Servicio para crear una consola garantizando cuerpo JSON y validaciones del backend.
export const createConsola = async (payload: ConsolaPayload) => {
  const response = await apiFetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`);
  }
  return handleResponse(response);
};

// NEW: Servicio para actualizar solo el nombre de la consola especificada por id.
export const updateConsola = async (id: number, payload: ConsolaPayload) => {
  const response = await apiFetch(`${ENDPOINT}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`);
  }
  return handleResponse(response);
};

// NEW: Servicio para eliminar una consola y devolver respuestas de error si ocurren conflictos.
export const deleteConsola = async (id: number) => {
  const response = await apiFetch(`${ENDPOINT}/${id}`, {
    method: 'DELETE',
    headers: { Accept: jsonContentType },
  });
  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`);
  }
  return handleResponse(response);
};

export default {
  getAll,
  createConsola,
  updateConsola,
  deleteConsola,
};
