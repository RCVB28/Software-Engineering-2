import type {
  Administrator,
  Alert,
  AlertInput,
  AlertPreference,
  AuditEntry,
  AuthToken,
  Barangay,
  Consent,
  DeliveryRecord,
  EmergencyReport,
  PhoneNumber,
  RecipientPreview,
  ReportInput,
  ReportStatus,
  ResidentProfile,
  ResidentRole,
  UserSummary
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
const TOKEN_KEY = 'se2.accessToken';
const USER_KEY = 'se2.user';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: string[]
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser(): UserSummary | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserSummary;
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserSummary | null): void {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.message ?? 'Request failed',
      payload?.code,
      payload?.details
    );
  }
  return payload as T;
}

export const api = {
  auth: {
    adminLogin: (email: string, password: string) =>
      request<AuthToken>('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      }),
    residentGoogle: (idToken: string, profile: {
      barangayId?: string;
      role?: ResidentRole;
      buildingTag?: string;
      displayName?: string;
    } = {}) =>
      request<AuthToken>('/auth/resident/google', {
        method: 'POST',
        body: JSON.stringify({ idToken, ...profile })
      }),
    me: () => request<UserSummary>('/auth/me')
  },
  barangays: {
    list: () => request<Barangay[]>('/barangays')
  },
  residents: {
    profile: () => request<ResidentProfile>('/residents/me'),
    updateProfile: (input: Partial<Pick<ResidentProfile, 'displayName' | 'role' | 'barangayId' | 'buildingTag'>>) =>
      request<ResidentProfile>('/residents/me', {
        method: 'PATCH',
        body: JSON.stringify(input)
      }),
    phones: () => request<PhoneNumber[]>('/residents/me/phones'),
    addPhone: (number: string, isPrimary = false) =>
      request<PhoneNumber>('/residents/me/phones', {
        method: 'POST',
        body: JSON.stringify({ number, isPrimary })
      }),
    removePhone: (phoneId: string) =>
      request<void>(`/residents/me/phones/${phoneId}`, { method: 'DELETE' }),
    consent: () => request<Consent>('/residents/me/consent'),
    setConsent: (granted: boolean, policyVersion: string) =>
      request<Consent>('/residents/me/consent', {
        method: 'PUT',
        body: JSON.stringify({ granted, policyVersion })
      }),
    preferences: () => request<AlertPreference[]>('/residents/me/preferences'),
    setPreferences: (preferences: AlertPreference[]) =>
      request<AlertPreference[]>('/residents/me/preferences', {
        method: 'PUT',
        body: JSON.stringify(preferences)
      }),
    announcements: () => request<Alert[]>('/residents/me/announcements'),
    reports: () => request<EmergencyReport[]>('/residents/me/reports')
  },
  alerts: {
    list: () => request<Alert[]>('/admin/alerts'),
    create: (input: AlertInput) =>
      request<Alert>('/admin/alerts', { method: 'POST', body: JSON.stringify(input) }),
    get: (alertId: string) => request<Alert>(`/admin/alerts/${alertId}`),
    update: (alertId: string, input: Partial<AlertInput>) =>
      request<Alert>(`/admin/alerts/${alertId}`, {
        method: 'PATCH',
        body: JSON.stringify(input)
      }),
    recipients: (alertId: string) =>
      request<RecipientPreview>(`/admin/alerts/${alertId}/recipients`),
    confirm: (alertId: string) =>
      request<Alert>(`/admin/alerts/${alertId}/confirm`, { method: 'POST' }),
    deliveries: (alertId: string) =>
      request<DeliveryRecord[]>(`/admin/alerts/${alertId}/deliveries`)
  },
  reports: {
    submit: (input: ReportInput) =>
      request<EmergencyReport>('/reports', { method: 'POST', body: JSON.stringify(input) }),
    adminList: (status?: ReportStatus) =>
      request<EmergencyReport[]>(`/admin/reports${status ? `?status=${status}` : ''}`),
    adminGet: (reportId: string) => request<EmergencyReport>(`/admin/reports/${reportId}`),
    updateStatus: (reportId: string, status: ReportStatus) =>
      request<EmergencyReport>(`/admin/reports/${reportId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      }),
    escalate: (reportId: string, content: string) =>
      request<Alert>(`/admin/reports/${reportId}/escalate`, {
        method: 'POST',
        body: JSON.stringify({ content })
      })
  },
  admins: {
    list: () => request<Administrator[]>('/admin/administrators'),
    create: (input: {
      email: string;
      password: string;
      role: Administrator['role'];
      displayName?: string;
      barangayId?: string;
    }) =>
      request<Administrator>('/admin/administrators', {
        method: 'POST',
        body: JSON.stringify(input)
      }),
    update: (adminId: string, input: Partial<Administrator> & { password?: string }) =>
      request<Administrator>(`/admin/administrators/${adminId}`, {
        method: 'PATCH',
        body: JSON.stringify(input)
      })
  },
  audit: {
    list: (filters: { entityType?: string; from?: string; to?: string } = {}) => {
      const params = new URLSearchParams();
      if (filters.entityType) params.set('entityType', filters.entityType);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const query = params.toString();
      return request<AuditEntry[]>(`/admin/audit${query ? `?${query}` : ''}`);
    }
  }
};
