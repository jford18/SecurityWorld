// NEW: Servicio especializado para consumir el backend de catálogo tipo problema.
import type { CatalogoTipoProblema } from '../types';

const jsonContentType = 'application/json';
const CATALOGO_TIPO_PROBLEMA_ENDPOINT = '/api/catalogo-tipo-problema';

// FIX: Se valida el header Content-Type antes de intentar parsear JSON y evitar "Unexpected token".
const parseJsonSafe = async (response: Response) => {
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes(jsonContentType)) {
    return response.json();
  }

  return { message: 'Respuesta inválida del servidor' };
};

const handleResponse = async (response: Response) => {
  const body = await parseJsonSafe(response);
  if (response.ok) {
    return body;
  }

  const message =
    body && typeof body === 'object' && 'message' in body && body.message
      ? String(body.message)
      : 'Error al comunicarse con el servidor';
  throw new Error(message);
};

export type CatalogoTipoProblemaPayload = {
  descripcion: string;
};

export const fetchCatalogoTiposProblema = async (): Promise<CatalogoTipoProblema[]> => {
  const response = await fetch(CATALOGO_TIPO_PROBLEMA_ENDPOINT, {
    headers: { Accept: jsonContentType },
  });
  const payload = await handleResponse(response);
  if (payload && Array.isArray(payload.data)) {
    return payload.data as CatalogoTipoProblema[];
  }
  if (Array.isArray(payload)) {
    return payload as CatalogoTipoProblema[];
  }
  return [];
};

export const createCatalogoTipoProblema = async (payload: CatalogoTipoProblemaPayload) => {
  const response = await fetch(CATALOGO_TIPO_PROBLEMA_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const updateCatalogoTipoProblema = async (
  id: number,
  payload: CatalogoTipoProblemaPayload,
) => {
  const response = await fetch(`${CATALOGO_TIPO_PROBLEMA_ENDPOINT}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const deleteCatalogoTipoProblema = async (id: number) => {
  const response = await fetch(`${CATALOGO_TIPO_PROBLEMA_ENDPOINT}/${id}`, {
    method: 'DELETE',
    headers: { Accept: jsonContentType },
  });
  return handleResponse(response);
};
