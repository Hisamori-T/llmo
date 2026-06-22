import axios from 'axios';
import { auth } from './firebase';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://llmo.fact-ally.com/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Wait for Firebase Auth to initialize before returning currentUser
function getAuthUser(): Promise<import('firebase/auth').User | null> {
  return new Promise((resolve) => {
    const user = auth.currentUser;
    if (user !== undefined) {
      resolve(user);
      return;
    }
    // Firebase not yet initialized — wait for first auth state
    const unsub = auth.onAuthStateChanged((u) => {
      unsub();
      resolve(u);
    });
  });
}

apiClient.interceptors.request.use(async (config) => {
  const user = await getAuthUser();
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  const sessionId = typeof window !== 'undefined' ? localStorage.getItem('session_id') : null;
  if (sessionId) {
    config.headers['X-Session-Id'] = sessionId;
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
  },
);
