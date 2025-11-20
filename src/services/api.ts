import axios from "axios";
import { API_BASE_URL, buildApiUrl } from "../lib/apiConfig";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (config.url) {
    config.url = buildApiUrl(config.url);
  }

  const token = localStorage.getItem('token');

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = config.headers.Authorization || `Bearer ${token}`;
  }

  return config;
});

export default api;
