import { apiClient } from '@/lib/api';

export const usersApi = {
  getMe: () => apiClient.get('/users/me'),
  updateMe: (data: { display_name?: string }) => apiClient.patch('/users/me', data),
  getDashboard: () => apiClient.get('/users/dashboard'),
  inviteTeamMember: (email: string) => apiClient.post('/users/team/invite', { email }),
};
