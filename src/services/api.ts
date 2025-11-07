import axios from 'axios';

// NEW: Punto único para obtener la URL base del backend y reutilizarla en los servicios.
// FIX: Si la variable de entorno no está definida (como ocurría en la vista de Supervisor),
//      se utiliza por defecto el puerto 3000 del backend para evitar llamadas a 5173.
const fallbackBaseURL = 'http://localhost:3000';
const resolvedBaseURL = import.meta.env.VITE_API_URL || fallbackBaseURL;
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
