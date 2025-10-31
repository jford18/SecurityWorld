export interface AxiosRequestConfig {
  url?: string;
  method?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  data?: any;
}

export interface AxiosResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: AxiosRequestConfig;
}

export interface AxiosInstance {
  defaults: {
    baseURL: string;
    headers: Record<string, string>;
  };
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  head<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  options<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  create(config?: AxiosRequestConfig): AxiosInstance;
}

declare const axios: AxiosInstance;

export default axios;
export const create: AxiosInstance["create"];
