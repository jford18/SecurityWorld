import { API_BASE_URL } from './api';

const jsonContentType = 'application/json';
const API_URL = `${API_BASE_URL}/api/usuario_consolas`;

const handleResponse = async (response: Response) => {
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes(jsonContentType);

  if (!isJson) {
    throw new Error('Respuesta inválida del servidor');
  }

  const payload = await response.json();

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && 'message' in payload && payload.message) ||
      'Error al comunicarse con el servidor';
    throw new Error(String(message));
  }

  return payload;
};

export const fetchAsignaciones = async () => {
  const response = await fetch(API_URL, {
    headers: { Accept: jsonContentType },
  });
  return handleResponse(response);
};

export const createAsignacion = async (data: { usuario_id: number; consola_id: number }) => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': jsonContentType,
      Accept: jsonContentType,
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const deleteAsignacion = async (usuario_id: number, consola_id: number) => {
  const response = await fetch(`${API_URL}/${usuario_id}/${consola_id}`, {
    method: 'DELETE',
    headers: { Accept: jsonContentType },
  });
  return handleResponse(response);
};
