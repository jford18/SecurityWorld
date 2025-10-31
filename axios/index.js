const createAxiosInstance = (defaults = {}) => {
  const instanceDefaults = {
    baseURL: defaults.baseURL || "",
    headers: defaults.headers ? { ...defaults.headers } : {},
  };

  const buildURL = (baseURL, url, params) => {
    const hasProtocol = /^https?:/i.test(url);
    const joinedBase = hasProtocol ? url : `${baseURL || ""}${url.startsWith("/") ? url : `/${url}`}`;

    if (!params) {
      return joinedBase;
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      searchParams.append(key, String(value));
    });

    const queryString = searchParams.toString();
    if (!queryString) {
      return joinedBase;
    }

    return `${joinedBase}${joinedBase.includes("?") ? "&" : "?"}${queryString}`;
  };

  const request = async (method, url, data, config = {}) => {
    const finalConfig = {
      headers: { ...instanceDefaults.headers, ...(config.headers || {}) },
      params: config.params,
      baseURL: config.baseURL || instanceDefaults.baseURL,
    };

    const finalURL = buildURL(finalConfig.baseURL, url, finalConfig.params);

    const fetchConfig = {
      method,
      headers: { ...finalConfig.headers },
    };

    if (data !== undefined) {
      if (!fetchConfig.headers["Content-Type"]) {
        fetchConfig.headers["Content-Type"] = "application/json";
      }
      fetchConfig.body = typeof data === "string" ? data : JSON.stringify(data);
    }

    const response = await fetch(finalURL, fetchConfig);
    const text = await response.text();
    let parsed;

    try {
      parsed = text ? JSON.parse(text) : null;
    } catch (error) {
      parsed = text;
    }

    const axiosResponse = {
      data: parsed,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      config: finalConfig,
    };

    if (!response.ok) {
      const error = new Error(`Request failed with status code ${response.status}`);
      error.response = axiosResponse;
      error.config = finalConfig;
      error.isAxiosError = true;
      throw error;
    }

    return axiosResponse;
  };

  const instance = {
    defaults: instanceDefaults,
    get: (url, config) => request("GET", url, undefined, config),
    delete: (url, config) => request("DELETE", url, undefined, config),
    head: (url, config) => request("HEAD", url, undefined, config),
    options: (url, config) => request("OPTIONS", url, undefined, config),
    post: (url, data, config) => request("POST", url, data, config),
    put: (url, data, config) => request("PUT", url, data, config),
    patch: (url, data, config) => request("PATCH", url, data, config),
    request: (config) => request(config.method || "GET", config.url, config.data, config),
    create: (config) => createAxiosInstance({ ...instanceDefaults, ...(config || {}) }),
  };

  return instance;
};

const axios = createAxiosInstance();

export default axios;
export const create = axios.create;
