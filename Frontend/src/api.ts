import axios from "axios";

export const API_BASE_URL: string = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";
export const SOCKET_URL: string = import.meta.env.VITE_SOCKET_URL || "http://127.0.0.1:5000";

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("medconnect_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("medconnect_token");
      localStorage.removeItem("medconnect_user");
      if (window.location.pathname !== "/") window.history.replaceState({}, "", "/");
    }
    return Promise.reject(error);
  },
);

export default API;
