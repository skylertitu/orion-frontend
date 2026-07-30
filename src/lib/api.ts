import { getToken, User } from "./auth";

const API_BASE = "/api";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AuthData extends User {
  token: string;
}

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok && !data.error) {
      data.success = false;
      data.error = "Error de conexión con el servidor";
    }
    return data;
  } catch {
    return { success: false, error: "No se pudo conectar con el servidor" };
  }
}

export const api = {
  auth: {
    login: (email: string, password: string, rememberMe = true) =>
      request<AuthData>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, rememberMe }),
      }),
    register: (data: {
      username?: string;
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      termsAccepted?: boolean;
    }) =>
      request<AuthData>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getMe: () => request<User>("/auth/me"),
    forgotPassword: (email: string) =>
      request<{ resetToken?: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    resetPassword: (token: string, newPassword: string) =>
      request("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request("/auth/change-password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    updateProfile: (profileData: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      country?: string;
      language?: string;
      timezone?: string;
    }) =>
      request<User>("/auth/profile", {
        method: "PUT",
        body: JSON.stringify(profileData),
      }),
  },
  engine: {
    brokers: () => request<BrokerStatus[]>("/engine/brokers"),
    price: (broker: string, symbol: string) =>
      request<{ broker: string; symbol: symbol; price: number }>(
        `/engine/price?broker=${broker}&symbol=${symbol}`
      ),
    order: (data: {
      broker: string;
      symbol: string;
      side: "buy" | "sell";
      quantity?: number;
      lot?: number;
      sl?: number;
      tp?: number;
      comment?: string;
      brokerAccountId?: number;
    }) =>
      request<any>("/engine/order", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    positions: (broker?: string, brokerAccountId?: number) => {
      const qs = new URLSearchParams();
      if (broker) qs.set("broker", broker);
      if (brokerAccountId) qs.set("brokerAccountId", String(brokerAccountId));
      const query = qs.toString();
      return request<any[]>(`/engine/positions${query ? `?${query}` : ""}`);
    },
    closePosition: (broker: string, ticket: string | number) =>
      request<any>(`/engine/positions/${broker}/${ticket}`, {
        method: "DELETE",
      }),
  },
  strategies: {
    list: (userId: number) => request(`/strategies/${userId}`),
    create: (data: {
      userId: number;
      name: string;
      description: string;
      config: object;
    }) =>
      request("/strategies", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    toggle: (id: number, userId: number) =>
      request(`/strategies/${id}/toggle`, {
        method: "PATCH",
        body: JSON.stringify({ userId }),
      }),
  },
  mt: {
    status: () => request<{ connected: boolean; message: string }>("/mt/status"),
  },
  brokerAccounts: {
    list: (userId: number) => request<BrokerAccountPublic[]>(`/broker-accounts/${userId}`),
    get: (userId: number, id: number) =>
      request<BrokerAccountPublic>(`/broker-accounts/${userId}/${id}`),
    create: (data: CreateBrokerAccountPayload) =>
      request<BrokerAccountPublic>("/broker-accounts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (userId: number, id: number, data: UpdateBrokerAccountPayload) =>
      request<BrokerAccountPublic>(`/broker-accounts/${userId}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (userId: number, id: number) =>
      request(`/broker-accounts/${userId}/${id}`, { method: "DELETE" }),
    test: (userId: number, id: number) =>
      request<BrokerConnectionTestResult>(`/broker-accounts/${userId}/${id}/test`, {
        method: "POST",
      }),
    setPrimary: (userId: number, id: number) =>
      request<BrokerAccountPublic>(`/broker-accounts/${userId}/${id}/set-primary`, {
        method: "POST",
      }),
  },
  lucy: {
    health: () => request<{ alive: boolean }>("/lucy/health"),
    analyze: (data: {
      symbol: string;
      interval: string;
      data: number[][];
      indicators?: Record<string, unknown>;
      script?: string;
    }) =>
      request<LucyAnalysis>("/lucy/analyze", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    signals: (symbol: string) =>
      request<LucyAnalysis>(`/lucy/signals/${encodeURIComponent(symbol)}`),
  },
  signals: {
    list: (userId: number, params?: { limit?: number; source?: string }) => {
      const qs = new URLSearchParams();
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.source) qs.set("source", params.source);
      const q = qs.toString();
      return request<SignalRecord[]>(`/signals/${userId}${q ? `?${q}` : ""}`);
    },
  },
  admin: {
    stats: () => request<AdminStats>("/admin/stats"),
    users: (params?: { page?: number; limit?: number; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.search) qs.set("search", params.search);
      return request<AdminUsersData>(`/admin/users?${qs}`);
    },
    getUser: (id: number) => request<AdminUser>(`/admin/users/${id}`),
    updateUser: (id: number, data: Partial<AdminUser & { password: string }>) =>
      request<AdminUser>(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    deleteUser: (id: number) =>
      request(`/admin/users/${id}`, { method: "DELETE" }),
    promote: (id: number) =>
      request(`/admin/users/${id}/promote`, { method: "POST" }),
    demote: (id: number) =>
      request(`/admin/users/${id}/demote`, { method: "POST" }),
  },
};

export interface BrokerStatus {
  id: string;
  label: string;
  connected: boolean;
  enabled: boolean;
  message?: string;
  error?: string;
}

export interface BrokerAccountPublic {
  id: number;
  userId: number;
  brokerId: string;
  accountName: string;
  accountType: string;
  environment: string;
  externalRef: string | null;
  status: string;
  isPrimary: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
  meta: Record<string, unknown>;
  hasCredentials: boolean;
  credentialFields: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BrokerAccountCredentialsInput {
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
}

export interface CreateBrokerAccountPayload {
  userId: number;
  brokerId: string;
  accountName: string;
  accountType?: string;
  environment?: string;
  externalRef?: string;
  isPrimary?: boolean;
  meta?: Record<string, unknown>;
  credentials?: BrokerAccountCredentialsInput;
}

export interface UpdateBrokerAccountPayload {
  accountName?: string;
  accountType?: string;
  environment?: string;
  externalRef?: string;
  status?: string;
  isPrimary?: boolean;
  meta?: Record<string, unknown>;
  credentials?: BrokerAccountCredentialsInput;
}

export interface BrokerConnectionTestResult {
  connected: boolean;
  status: string;
  message: string;
  account: BrokerAccountPublic;
}

export interface SignalRecord {
  id: number;
  strategyId: number;
  userId: number;
  symbol: string;
  action: string;
  confidence: number;
  reason: string;
  price: number;
  executed: boolean;
  source: string;
  brokerAccountId?: number | null;
  lucyRunId?: string | null;
  decision?: Record<string, unknown> | null;
  createdAt: string;
}

export interface LucySignal {
  symbol: string;
  action: "buy" | "sell" | "hold";
  confidence: number;
  timestamp: string;
  indicators: Record<string, unknown>;
}

export interface LucyAnalysis {
  success: boolean;
  signals: LucySignal[];
  patterns: string[];
  support: number;
  resistance: number;
  trend: "bullish" | "bearish" | "neutral";
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: "user" | "admin";
  balance: number;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminStats {
  totalUsers: number;
  totalTrades: number;
  totalStrategies: number;
  activeUsers: number;
  adminUsers: number;
}

export interface AdminUsersData {
  users: AdminUser[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
