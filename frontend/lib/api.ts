import axios from 'axios';
import { auth } from './firebase';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://api.llmo-saas.com';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

apiClient.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken(true);
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      }
    }
    return Promise.reject(error);
  }
);
