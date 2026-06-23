import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://llmo.fact-ally.com/api';

// Access token held in memory — never persisted to localStorage
let _accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

function getStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}

apiClient.interceptors.request.use((config) => {
  if (_accessToken) config.headers.Authorization = `Bearer ${_accessToken}`;
  const sessionId = getStorage('session_id');
  if (sessionId) config.headers['X-Session-Id'] = sessionId;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        // No body — refresh_token sent automatically as httpOnly cookie
        const res = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        const { access_token } = res.data;
        setAccessToken(access_token);
        original.headers.Authorization = `Bearer ${access_token}`;
        return apiClient(original);
      } catch {
        // Refresh failed — clear in-memory token; auth-context will redirect
        setAccessToken(null);
        if (typeof window !== 'undefined') localStorage.removeItem('session_id');
      }
    }
    return Promise.reject(error);
  },
);
