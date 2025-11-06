import axios from 'axios';

// NEW: Punto único para obtener la URL base del backend y reutilizarla en los servicios.
const resolvedBaseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const API_BASE_URL = resolvedBaseURL.replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = config.headers.Authorization || `Bearer ${token}`;
  }

  return config;
});

export default api;
