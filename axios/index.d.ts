export interface AxiosRequestConfig {
  url?: string;
  method?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  data?: any;
  withCredentials?: boolean;
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
    withCredentials: boolean;
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
  interceptors: {
    request: {
      use(
        onFulfilled: (config: AxiosRequestConfig) => AxiosRequestConfig | Promise<AxiosRequestConfig>,
        onRejected?: (error: any) => AxiosRequestConfig | Promise<AxiosRequestConfig>,
      ): number;
      eject(id: number): void;
    };
    response: {
      use(
        onFulfilled: <T = any>(response: AxiosResponse<T>) => AxiosResponse<T> | Promise<AxiosResponse<T>>,
        onRejected?: (error: any) => any,
      ): number;
      eject(id: number): void;
    };
  };
}

declare const axios: AxiosInstance;

export default axios;
export const create: AxiosInstance["create"];
