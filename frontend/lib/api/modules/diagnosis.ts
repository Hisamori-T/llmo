import { apiClient } from '@/lib/api';

export interface DiagnosisCreatePayload {
  company_name: string;
  industry: string;
  location?: string;
  keywords?: string[];
}

export const diagnosisApi = {
  create: (payload: DiagnosisCreatePayload) => apiClient.post('/diagnoses', payload),
  list: () => apiClient.get('/diagnoses'),
  get: (id: string) => apiClient.get(`/diagnoses/${id}`),
};
