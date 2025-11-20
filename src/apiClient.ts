import axios from 'axios';
import { API_BASE_URL, buildApiUrl } from './lib/apiConfig';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  if (config.url) {
    config.url = buildApiUrl(config.url);
  }
  return config;
});

export default apiClient;

export const apiFetch = async (path: string, options: RequestInit = {}) => {
  const url = path.startsWith('http')
    ? path
    : buildApiUrl(path.startsWith('/') ? path : `/${path}`);

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  return response;
};
