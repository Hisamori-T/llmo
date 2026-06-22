import { apiClient } from '@/lib/api';

export const reportingApi = {
  create: (diagnosisId: string, type: 'simple' | 'detailed' = 'simple') =>
    apiClient.post('/reports', { diagnosis_id: diagnosisId, type }),
  list: () => apiClient.get('/reports'),
  share: (reportId: string) => apiClient.post(`/reports/${reportId}/share`),
  downloadUrl: (reportId: string) => `/reports/${reportId}/download`,
};
