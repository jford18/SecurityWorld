const createInterceptorManager = () => {
  const handlers = [];

  return {
    use(onFulfilled, onRejected) {
      handlers.push({ onFulfilled, onRejected });
      return handlers.length - 1;
    },
    eject(id) {
      if (handlers[id]) {
        handlers[id] = null;
      }
    },
    async runFulfilled(input) {
      let result = input;
      for (const handler of handlers) {
        if (!handler || typeof handler.onFulfilled !== "function") {
          continue;
        }
        try {
          const value = handler.onFulfilled(result);
          result = (await Promise.resolve(value)) ?? result;
        } catch (error) {
          if (typeof handler.onRejected === "function") {
            const recovered = handler.onRejected(error);
            result = (await Promise.resolve(recovered)) ?? result;
            continue;
          }
          throw error;
        }
      }
      return result;
    },
    async runRejected(error) {
      let currentError = error;
      for (const handler of handlers) {
        if (!handler || typeof handler.onRejected !== "function") {
          continue;
        }
        try {
          const value = handler.onRejected(currentError);
          const maybeResolved = await Promise.resolve(value);
          if (maybeResolved !== undefined) {
            return maybeResolved;
          }
        } catch (err) {
          currentError = err;
        }
      }
      throw currentError;
    },
  };
};

const createAxiosInstance = (defaults = {}) => {
  const instanceDefaults = {
    baseURL: defaults.baseURL || "",
    headers: defaults.headers ? { ...defaults.headers } : {},
    withCredentials: Boolean(defaults.withCredentials),
  };

  const requestInterceptors = createInterceptorManager();
  const responseInterceptors = createInterceptorManager();

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
    let requestConfig = {
      url,
      method,
      data,
      headers: { ...instanceDefaults.headers, ...(config.headers || {}) },
      params: config.params,
      baseURL: config.baseURL || instanceDefaults.baseURL,
      withCredentials: config.withCredentials ?? instanceDefaults.withCredentials,
    };

    requestConfig = await requestInterceptors.runFulfilled(requestConfig);

    const finalURL = buildURL(
      requestConfig.baseURL,
      requestConfig.url || url,
      requestConfig.params
    );

    const fetchConfig = {
      method: requestConfig.method || method,
      headers: { ...requestConfig.headers },
    };

    if (data !== undefined) {
      if (!fetchConfig.headers["Content-Type"]) {
        fetchConfig.headers["Content-Type"] = "application/json";
      }
      fetchConfig.body = typeof requestConfig.data === "string" ? requestConfig.data : JSON.stringify(requestConfig.data);
    }

    if (requestConfig.withCredentials) {
      fetchConfig.credentials = "include";
    }

    const response = await fetch(finalURL, fetchConfig);
    const text = await response.text();
    let parsed;

    try {
      parsed = text ? JSON.parse(text) : null;
    } catch (error) {
      parsed = text;
    }

    let axiosResponse = {
      data: parsed,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      config: requestConfig,
    };

    if (!response.ok) {
      const error = new Error(`Request failed with status code ${response.status}`);
      error.response = axiosResponse;
      error.config = requestConfig;
      error.isAxiosError = true;
      const maybeHandled = await responseInterceptors.runRejected(error);
      return maybeHandled;
    }

    axiosResponse = await responseInterceptors.runFulfilled(axiosResponse);
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
    request: (config) =>
      request(config.method || "GET", config.url, config.data, config),
    create: (config) => createAxiosInstance({ ...instanceDefaults, ...(config || {}) }),
    interceptors: {
      request: {
        use: (...args) => requestInterceptors.use(...args),
        eject: (id) => requestInterceptors.eject(id),
      },
      response: {
        use: (...args) => responseInterceptors.use(...args),
        eject: (id) => responseInterceptors.eject(id),
      },
    },
  };

  return instance;
};

const axios = createAxiosInstance();

export default axios;
export const create = axios.create;
