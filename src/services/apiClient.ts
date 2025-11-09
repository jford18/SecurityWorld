import axios from "axios";

type AxiosWithCancel = typeof axios & {
  Cancel?: new (message?: string) => Error;
  isCancel?: (value: unknown) => boolean;
};

const axiosWithCancel = axios as AxiosWithCancel;

if (typeof axiosWithCancel.Cancel !== 'function') {
  class AxiosCancelError extends Error {
    constructor(message?: string) {
      super(message);
      this.name = "CanceledError";
      Object.defineProperty(this, "__CANCEL__", {
        value: true,
        enumerable: false,
        configurable: false,
      });
    }
  }

  axiosWithCancel.Cancel = AxiosCancelError;
}

if (typeof axiosWithCancel.isCancel !== 'function') {
  axiosWithCancel.isCancel = (value: unknown): value is Error =>
    Boolean(value && typeof value === "object" && (value as { __CANCEL__?: boolean }).__CANCEL__);
}

const CancelError = axiosWithCancel.Cancel!;
const isCancel = axiosWithCancel.isCancel!;

const apiClient = axios.create({
  baseURL: "http://localhost:3000",
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (!token || token === "fake-jwt-token" || token.trim() === "") {
    console.warn(
      "[API WARNING] Token JWT no válido o ausente. Petición cancelada:",
      config.url,
    );
    throw new CancelError("Petición cancelada por token inválido");
  }

  const headers = { ...(config.headers ?? {}) };
  headers.Authorization = `Bearer ${token}`;
  config.headers = headers;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isCancel(error)) {
      return Promise.reject({ message: "Petición cancelada: token inválido" });
    }
    if (error.response?.status === 401) {
      console.warn(
        "[API WARNING] Token expirado o no autorizado, redirigiendo al login...",
      );
      // Puedes usar window.location = "/login" si aplica
    }
    return Promise.reject(error);
  },
);

export default apiClient;
