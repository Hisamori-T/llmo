export type Plan = 'starter' | 'pro' | 'enterprise';
export type UserRole = 'admin' | 'editor' | 'viewer';

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

export interface ExistingSession {
  browser_name: string;
  browser_version: string;
  os: string;
  ip_address: string;
  last_activity: string;
}

export interface MultipleConnectionInfo {
  existingSession: ExistingSession;
}

export interface Organization {
  id: string;
  name: string;
  plan: Plan;
  monthlyCreditsLimit: number;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  email: string;
  displayName?: string;
  role: UserRole;
  createdAt: string;
}
