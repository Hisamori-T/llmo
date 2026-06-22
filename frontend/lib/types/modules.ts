import type { Plan } from './core';

export type DiagnosisStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DiagnosisScores {
  aiAwareness: number;
  brandRecognition: number;
  contentQuality: number;
  competitorGap: number;
}

export interface Finding {
  category: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
}

export interface Diagnosis {
  id: string;
  orgId: string;
  companyName: string;
  industry: string;
  location?: string;
  keywords: string[];
  status: DiagnosisStatus;
  scores: DiagnosisScores;
  findings: Finding[];
  recommendations: string[];
  createdAt: string;
  completedAt?: string;
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
