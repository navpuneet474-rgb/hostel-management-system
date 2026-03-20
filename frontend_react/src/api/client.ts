import axios from "axios";
import { API_CONFIG } from "../config";

const getCsrfToken = (): string => {
  const token = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("csrftoken="))
    ?.split("=")[1];
  return token ?? "";
};

export const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  withCredentials: true,
  headers: API_CONFIG.DEFAULT_HEADERS,
});

let csrfInitPromise: Promise<void> | null = null;

const ensureCsrfCookie = async (): Promise<void> => {
  if (getCsrfToken()) return;
  if (!csrfInitPromise) {
    csrfInitPromise = api.get(API_CONFIG.ENDPOINTS.AUTH.CSRF).then(() => undefined).finally(() => {
      csrfInitPromise = null;
    });
  }
  await csrfInitPromise;
};

api.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toLowerCase();
  if (["post", "put", "patch", "delete"].includes(method)) {
    await ensureCsrfCookie();
  }

  config.headers = config.headers ?? {};
  config.headers["X-CSRFToken"] = getCsrfToken();
  return config;
});
