import { getToken } from "./auth";

const API_BASE = "/api";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AuthData {
  id: number;
  username: string;
  email: string;
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
    login: (email: string, password: string) =>
      request<AuthData>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    register: (username: string, email: string, password: string) =>
      request<AuthData>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      }),
  },
  trades: {
    list: (userId: number) => request<Trade[]>(`/trades/${userId}`),
    create: (data: {
      userId: number;
      symbol: string;
      type: "buy" | "sell";
      quantity: number;
      price: number;
    }) =>
      request("/trades", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  portfolio: {
    get: (userId: number) => request<PortfolioItem[]>(`/portfolio/${userId}`),
  },
  engine: {
    brokers: () => request<any[]>("/engine/brokers"),
    price: (broker: string, symbol: string) =>
      request<{ broker: string; symbol: string; price: number }>(
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
    }) =>
      request<any>("/engine/order", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    positions: (broker?: string) =>
      request<any[]>(`/engine/positions${broker ? `?broker=${broker}` : ""}`),
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


export interface Trade {
  id: number;
  userId: number;
  symbol: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  total: number;
  status: "open" | "closed" | "cancelled";
  createdAt: string;
}

export interface PortfolioItem {
  id: number;
  userId: number;
  symbol: string;
  quantity: number;
  averagePrice: number;
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
