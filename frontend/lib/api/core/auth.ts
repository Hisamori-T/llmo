import { apiClient } from '@/lib/api';

export const authApi = {
  signup: (idToken: string, agencyName: string, displayName = '') =>
    apiClient.post('/auth/signup', {
      id_token: idToken,
      agency_name: agencyName,
      display_name: displayName,
    }),

  login: (idToken: string, force = false) =>
    apiClient.post('/auth/login', { id_token: idToken, force }),

  logout: (sessionId: string) =>
    apiClient.post('/auth/logout', { session_id: sessionId }),
};
