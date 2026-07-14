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
