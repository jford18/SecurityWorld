import api from './api';
import apiClient, { apiFetch } from './apiClient';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const BASE_PATH = '/nodos';
const API_URL = BASE_PATH;
const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXPORT_ERROR_MESSAGE = 'No se pudo exportar nodos';

const parseContentDispositionFilename = (headerValue) => {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch (error) {
      return utf8Match[1];
    }
  }

  const asciiMatch = headerValue.match(/filename="?([^";]+)"?/i);
  return asciiMatch?.[1] ?? null;
};

const extractMessageFromText = (text) => {
  if (!text || typeof text !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    const message = parsed?.message ?? parsed?.error;
    const detail = parsed?.detail;

    if (message && detail) {
      return `${message}. Detalle: ${detail}`;
    }

    return message ?? detail ?? null;
  } catch (error) {
    return text.trim() || error?.message || null;
  }
};

const extractErrorFromBlob = async (blob) => {
  if (!blob) return null;

  try {
    const text = await blob.text();
    return extractMessageFromText(text);
  } catch (error) {
    return error?.message ?? null;
  }
};

const normalizeHeaderValue = (value) =>
  typeof value === 'string' ? value.toLowerCase() : '';

const resolveExportErrorMessage = async (error) => {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = error.response;
    const data = response?.data;

    if (data instanceof Blob) {
      const parsedMessage = await extractErrorFromBlob(data);
      if (parsedMessage) return parsedMessage;
    }

    const message = data?.message ?? data?.error;
    const detail = data?.detail;

    if (message && detail) {
      return `${message}. Detalle: ${detail}`;
    }

    if (message) {
      return message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return EXPORT_ERROR_MESSAGE;
};

const extractData = (response) => {
  if (!response || typeof response !== 'object') {
    return null;
  }

  if ('data' in response) {
    return response.data;
  }

  return response;
};

export const getAll = async () => {
  const response = await api.get(BASE_PATH);
  return extractData(response.data);
};

export const getById = async (id) => {
  const response = await api.get(`${BASE_PATH}/${id}`);
  return extractData(response.data);
};

export const create = async (payload) => {
  const response = await apiFetch(API_URL, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload ?? {}),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error al crear el nodo' }));
    throw new Error(errorData.message || 'Error al crear el nodo');
  }

  const data = await response.json();
  return extractData(data);
};

export const update = async (id, payload) => {
  const response = await apiFetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload ?? {}),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error al actualizar el nodo' }));
    throw new Error(errorData.message || 'Error al actualizar el nodo');
  }

  const data = await response.json();
  return extractData(data);
};

export const deleteNodo = async (id) => {
  const response = await apiFetch(`${API_URL}/${id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error al eliminar el nodo' }));
    throw new Error(errorData.message || 'Error al eliminar el nodo');
  }

  const data = await response.json();
  return extractData(data);
};

export const exportNodosExcel = async () => {
  try {
    const response = await apiClient.get(`${BASE_PATH}/export-excel`, {
      responseType: 'blob',
      headers: {
        Accept: EXCEL_MIME_TYPE,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });

    const contentType = normalizeHeaderValue(response.headers?.['content-type']);

    if (!contentType.includes('spreadsheetml.sheet')) {
      const backendError = await extractErrorFromBlob(response.data);
      throw new Error(backendError || EXPORT_ERROR_MESSAGE);
    }

    const filename =
      parseContentDispositionFilename(response.headers?.['content-disposition']) ||
      `NODOS_${Date.now()}.xlsx`;

    const blob = new Blob([response.data], {
      type: contentType || EXCEL_MIME_TYPE,
    });

    if (!blob || blob.size === 0) {
      throw new Error('Export inválido: archivo vacío');
    }

    return { blob, filename };
  } catch (error) {
    const message = await resolveExportErrorMessage(error);
    throw new Error(message);
  }
};
