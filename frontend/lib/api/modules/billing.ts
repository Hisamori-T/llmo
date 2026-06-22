import { apiClient } from '@/lib/api';

export const billingApi = {
  getInfo: () => apiClient.get('/billing/info'),
  createCheckout: (planId: string, billingCycle: 'monthly' | 'yearly' = 'monthly') =>
    apiClient.post('/billing/checkout', { plan_id: planId, billing_cycle: billingCycle }),
  buyCredits: (credits: number) => apiClient.post('/billing/credits', { credits }),
  openPortal: () => apiClient.post('/billing/portal'),
};
