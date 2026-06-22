import { apiClient } from '@/lib/api';

export const sessionsApi = {
  getSessions: () => apiClient.get('/users/sessions'),
  revokeSession: (sessionId: string) => apiClient.delete(`/users/sessions/${sessionId}`),
};
