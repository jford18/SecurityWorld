import { API_BASE_URL } from './api';

const jsonContentType = 'application/json';

const handleResponse = async (response: Response) => {
  if (response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes(jsonContentType)) {
      return response.json();
    }
    return { message: 'Respuesta inválida del servidor' };
  }

  const errorBody = await response.json().catch(() => ({ message: 'Error al comunicarse con el servidor' }));
  const errorMessage = errorBody?.message || 'Error desconocido';
  throw new Error(errorMessage);
};

export interface HaciendaRecord {
  id: number;
  nombre: string;
  direccion: string | null;
  activo: boolean;
  fecha_creacion: string;
}

export interface HaciendaListResponse {
  data: HaciendaRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface HaciendaSingleResponse {
  data: HaciendaRecord;
}

export interface HaciendaFilters {
  page?: number;
  limit?: number;
  q?: string;
  activo?: "true" | "false";
}

export interface HaciendaPayload {
  nombre: string;
  direccion?: string | null;
  activo?: boolean;
}

const buildQueryString = (params?: HaciendaFilters) => {
  if (!params) return '';
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      query.append(key, String(value));
    }
  });
  return `?${query.toString()}`;
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': jsonContentType,
    Accept: jsonContentType,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const getHaciendas = async (params?: HaciendaFilters) => {
  const queryString = buildQueryString(params);
  const response = await fetch(`${API_BASE_URL}/api/hacienda${queryString}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const getHacienda = async (id: number) => {
  const response = await fetch(`${API_BASE_URL}/api/hacienda/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const createHacienda = async (payload: HaciendaPayload) => {
  const response = await fetch(`${API_BASE_URL}/api/hacienda`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const updateHacienda = async (id: number, payload: HaciendaPayload) => {
  const response = await fetch(`${API_BASE_URL}/api/hacienda/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const deleteHacienda = async (id: number) => {
  const response = await fetch(`${API_BASE_URL}/api/hacienda/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};
