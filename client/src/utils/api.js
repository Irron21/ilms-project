import axios from 'axios';

const DEFAULT_BASE = 'http://localhost:4000/api';
const envBase = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_BASE_URL : null;
const baseURL = envBase && envBase.trim() !== '' ? envBase : DEFAULT_BASE;

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      const evt = new Event('session-expired');
      window.dispatchEvent(evt);
    }
    return Promise.reject(error);
  }
);

export default api;
