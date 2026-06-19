export type Plan = 'starter' | 'pro' | 'enterprise';
export type UserRole = 'admin' | 'editor' | 'viewer';
export type DiagnosisStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  plan: Plan;
  orgId: string;
  role: UserRole;
  monthlyCreditsUsed: number;
  monthlyCreditsLimit: number;
  createdAt: string;
}

export interface Session {
  sessionId: string;
  browserName: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  ipAddress: string;
  lastActivity: string;
  createdAt: string;
  status: 'active' | 'revoked';
  isCurrent?: boolean;
}

export interface Diagnosis {
  id: string;
  orgId: string;
  companyName: string;
  industry: string;
  location?: string;
  keywords: string[];
  status: DiagnosisStatus;
  scores: {
    aiAwareness: number;
    brandRecognition: number;
    contentQuality: number;
    competitorGap: number;
  };
  findings: Finding[];
  recommendations: string[];
  createdAt: string;
  completedAt?: string;
}

export interface Finding {
  category: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
}

export interface Report {
  id: string;
  diagnosisId: string;
  type: 'simple' | 'detailed';
  pdfUrl?: string;
  shareToken?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  amount: number;
  status: 'paid' | 'open' | 'void';
  date: string;
  pdfUrl?: string;
}

export interface BillingInfo {
  planName: string;
  planId: Plan;
  billingCycle: 'monthly' | 'yearly';
  monthlyAmount: number;
  nextBillingDate: string;
  breakdown: {
    basePlan: number;
    additionalAccounts: number;
    extraCredits: number;
    phase3Runs: number;
    discount: number;
  };
  invoices: Invoice[];
}

export interface MultipleConnectionInfo {
  existingSession: {
    browser: string;
    device: string;
    lastActivity: string;
  };
  newSessionInfo: {
    browser: string;
    device: string;
  };
  isDeviceDifferent: boolean;
}
