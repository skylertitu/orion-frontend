import { getToken, User } from "./auth";

function apiBase(): string {
  const origin = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "").trim();
  if (origin) return `${origin}/api`;
  return "/api";
}

const API_BASE = apiBase();

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
  options?: RequestInit & { timeoutMs?: number }
): Promise<ApiResponse<T>> {
  const token = getToken();
  const { timeoutMs, ...fetchOptions } = options || {};
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs ?? 45000);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok && !data.error) {
      data.success = false;
      data.error = "Error de conexión con el servidor";
    }
    return data;
  } catch {
    return { success: false, error: "No se pudo conectar con el servidor" };
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  auth: {
    login: (email: string, password: string, rememberMe = false) =>
      request<AuthData>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, rememberMe }),
      }),
    google: (idToken: string, rememberMe = false) =>
      request<AuthData>("/auth/google", {
        method: "POST",
        body: JSON.stringify({ idToken, rememberMe }),
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
    logout: () => request("/auth/logout", { method: "POST" }),
    forgotPassword: (email: string) =>
      request<{
        resetToken?: string;
        resetUrl?: string;
        emailSent?: boolean;
        googleAccount?: boolean;
      }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    resetPassword: (token: string, newPassword: string) =>
      request("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      }),
    resetPasswordFromFirebase: (idToken: string, newPassword: string) =>
      request("/auth/reset-password-firebase", {
        method: "POST",
        body: JSON.stringify({ idToken, newPassword }),
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
    requestEmailVerification: () =>
      request<{ verifyUrl?: string; emailSent?: boolean }>("/auth/verify-email/request", {
        method: "POST",
      }),
    confirmEmailVerification: (token: string) =>
      request<User>("/auth/verify-email/confirm", {
        method: "POST",
        body: JSON.stringify({ token }),
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
    list: () => request<StrategyRecord[]>("/strategies"),
    get: (id: number) => request<StrategyRecord>(`/strategies/${id}`),
    create: (data: {
      userId?: number;
      name: string;
      description: string;
      config: object;
    }) =>
      request<StrategyRecord>("/strategies", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      id: number,
      data: {
        name?: string;
        description?: string;
        config?: object;
        isActive?: boolean;
      }
    ) =>
      request<StrategyRecord>(`/strategies/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    toggle: (id: number, userId?: number) =>
      request<StrategyRecord>(`/strategies/${id}/toggle`, {
        method: "PATCH",
        body: JSON.stringify(userId ? { userId } : {}),
      }),
    remove: (id: number) =>
      request(`/strategies/${id}`, {
        method: "DELETE",
      }),
  },
  mt: {
    status: () => request<{ connected: boolean; message: string }>("/mt/status"),
  },
  brokerAccounts: {
    list: (userId?: number) =>
      request<BrokerAccountPublic[]>(
        userId != null ? `/broker-accounts/${userId}` : "/broker-accounts"
      ),
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
    setMode: (userId: number, id: number, mode: "demo" | "live") =>
      request<BrokerAccountPublic>(`/broker-accounts/${userId}/${id}/mode`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      }),
  },
  wallets: {
    list: () => request<WalletPublic[]>("/wallets"),
    transfers: () => request<WalletTransferPublic[]>("/wallets/transfers"),
    network: () => request<SolanaNetworkStatus>("/wallets/network"),
    balance: (address: string) =>
      request<SolanaBalance>(`/wallets/balance?address=${encodeURIComponent(address)}`),
    airdrop: (address: string, amount = 1) =>
      request<SolanaBalance & { signature?: string; faucetUrl?: string }>("/wallets/airdrop", {
        method: "POST",
        body: JSON.stringify({ address, amount }),
        timeoutMs: 30000,
      }),
    nonce: (address: string) =>
      request<WalletNoncePayload>("/wallets/nonce", {
        method: "POST",
        body: JSON.stringify({ address }),
      }),
    link: (payload: {
      address: string;
      signature: string;
      nonce: string;
      issuedAt: string;
      label?: string;
    }) =>
      request<WalletPublic>("/wallets/link", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    linkManual: (payload: { address: string; label?: string }) =>
      request<WalletPublic>("/wallets/link-manual", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    setPrimary: (id: number) =>
      request<WalletPublic>(`/wallets/${id}/primary`, { method: "POST" }),
    unlink: (id: number) => request(`/wallets/${id}`, { method: "DELETE" }),
  },
  indicators: {
    mine: () => request<ServerIndicator[]>("/indicators/mine"),
    saveMine: (scripts: Array<{ clientId: string; name: string; source: string; enabled: boolean; category?: string }>) =>
      request<ServerIndicator[]>("/indicators/mine", {
        method: "PUT",
        body: JSON.stringify({ scripts }),
      }),
    popular: () => request<PopularIndicator[]>("/indicators/popular"),
    clone: (sourceHash: string) =>
      request<ServerIndicator>("/indicators/clone", {
        method: "POST",
        body: JSON.stringify({ sourceHash }),
      }),
    inUse: () => request<InUseIndicator[]>("/indicators/in-use"),
    block: (sourceHash: string, name: string, source?: string) =>
      request("/indicators/block", {
        method: "POST",
        body: JSON.stringify({ sourceHash, name, source }),
      }),
    unblock: (sourceHash: string) =>
      request("/indicators/unblock", {
        method: "POST",
        body: JSON.stringify({ sourceHash }),
      }),
  },
  lucy: {
    health: () =>
      request<{ alive: boolean; pending?: boolean; enabled?: boolean; reason?: string }>(
        "/lucy/health"
      ),
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
    setPlan: (id: number, plan: "analyst" | "signals" | "builder") =>
      request(`/admin/users/${id}/plan`, {
        method: "POST",
        body: JSON.stringify({ plan }),
      }),
    system: () => request<SystemOverview>("/admin/system", { timeoutMs: 25000 }),
    toggleModule: (id: string, enabled: boolean, note?: string) =>
      request<SystemOverview>(`/admin/system/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled, note }),
      }),
    saveRisk: (limits: RiskLimits) =>
      request<SystemOverview>("/admin/risk", {
        method: "PATCH",
        body: JSON.stringify(limits),
      }),
    pauseRisk: (reason?: string) =>
      request<SystemOverview>("/admin/risk/pause", {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    resumeRisk: () => request<SystemOverview>("/admin/risk/resume", { method: "POST" }),
    jupiterStatus: () => request<JupiterStatus>("/admin/integrations/jupiter"),
    setJupiterKey: (apiKey: string) =>
      request<JupiterStatus>("/admin/integrations/jupiter", {
        method: "PATCH",
        body: JSON.stringify({ apiKey }),
      }),
  },
  superadmin: {
    users: (params?: { page?: number; limit?: number; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.search) qs.set("search", params.search);
      return request<AdminUsersData>(`/superadmin/users?${qs}`);
    },
    updateUser: (id: number, data: Partial<AdminUser & { password: string; emailVerified: boolean }>) =>
      request<AdminUser>(`/superadmin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    setRole: (id: number, role: "user" | "admin" | "superadmin") =>
      request<AdminUser>(`/superadmin/users/${id}/role`, {
        method: "POST",
        body: JSON.stringify({ role }),
      }),
    block: (id: number, reason?: string) =>
      request<AdminUser>(`/superadmin/users/${id}/block`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    unblock: (id: number) =>
      request<AdminUser>(`/superadmin/users/${id}/unblock`, { method: "POST" }),
    deleteUser: (id: number) =>
      request(`/superadmin/users/${id}`, { method: "DELETE" }),
  },
  system: {
    status: () => request<SystemOverview>("/system/status"),
  },
  jupiter: {
    status: () => request<JupiterStatus>("/jupiter/status"),
    prices: () => request<JupiterPriceRow[]>("/jupiter/prices"),
    quote: (input: string, output: string, amount: number, slippageBps?: number) => {
      const qs = new URLSearchParams({ input, output, amount: String(amount) });
      if (slippageBps != null) qs.set("slippageBps", String(slippageBps));
      return request<JupiterQuote>(`/jupiter/quote?${qs}`);
    },
    order: (input: string, output: string, amount: number, taker: string, slippageBps?: number) => {
      const qs = new URLSearchParams({ input, output, amount: String(amount), taker });
      if (slippageBps != null) qs.set("slippageBps", String(slippageBps));
      return request<JupiterOrder>(`/jupiter/order?${qs}`, { timeoutMs: 20000 });
    },
    execute: (payload: {
      signedTransaction: string;
      requestId: string;
      taker: string;
      input: string;
      output: string;
      amount: number;
      walletLabel?: string;
    }) =>
      request<JupiterExecuteResult>("/jupiter/execute", {
        method: "POST",
        body: JSON.stringify(payload),
        timeoutMs: 50000,
      }),
    simulate: (payload: { taker: string; input: string; output: string; amount: number; walletLabel?: string }) =>
      request<JupiterExecuteResult>("/jupiter/simulate", {
        method: "POST",
        body: JSON.stringify(payload),
        timeoutMs: 20000,
      }),
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
  executionMode?: "demo" | "live";
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

export type StrategyType = "indicator_combination" | "spread_zscore" | "lucy";

export interface StrategyConfig {
  type: StrategyType;
  broker: string;
  brokerAccountId?: number;
  symbol: string;
  pairSymbol?: string;
  interval?: string;
  quantity?: number;
  indicators?: Record<string, unknown>;
  entryConditions?: Array<Record<string, unknown>>;
  exitConditions?: Array<Record<string, unknown>>;
  logic?: "AND" | "OR";
  stop_loss_pct?: number;
  take_profit_pct?: number;
  lookback?: number;
  zscore_entry?: number;
  zscore_exit?: number;
}

export interface StrategyRecord {
  id: number;
  userId: number;
  name: string;
  description: string;
  config: StrategyConfig;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  role: "user" | "admin" | "superadmin";
  plan?: "analyst" | "signals" | "builder" | null;
  balance: number;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  country?: string | null;
  language?: string | null;
  timezone?: string | null;
  emailVerified?: boolean;
  blocked?: boolean;
  blockedReason?: string | null;
  blockedAt?: string | null;
  lastLoginAt?: string | null;
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

export interface ServerIndicator {
  id: number;
  clientId: string;
  name: string;
  source: string;
  sourceHash: string;
  category?: "trend" | "oscillator" | "sessions" | "volume" | "custom";
  enabled: boolean;
  blocked: boolean;
}

export interface PopularIndicator {
  sourceHash: string;
  name: string;
  source: string;
  category?: "trend" | "oscillator" | "sessions" | "volume" | "custom";
  users: number;
  inUse: number;
}

export interface InUseIndicator extends ServerIndicator {
  userId: number;
  username: string;
}

export type SystemModuleHealth = "ok" | "down" | "pending" | "paused";

export interface SystemModuleStatus {
  id: string;
  name: string;
  description: string;
  href?: string;
  enabled: boolean;
  health: SystemModuleHealth;
  label: string;
  error?: string;
  detail?: string;
  note?: string | null;
}

export interface RiskLimits {
  maxDailyLossUsd: number;
  maxOrderUsd: number;
  maxOpenPositions: number;
  maxErrorStreak: number;
}

export interface RiskSnapshot {
  limits: RiskLimits;
  pausedByRisk: boolean;
  pauseReason: string | null;
  errorStreak: number;
  dailyPnlUsd: number;
  openPositions: number;
  lastReject: {
    at: string;
    reason: string;
    symbol?: string;
    strategyId?: number;
  } | null;
  updatedBy: number | null;
  updatedAt: string | null;
}

export interface SystemOverview {
  modules: SystemModuleStatus[];
  worker?: {
    running?: boolean;
    cycleCount?: number;
    lastCycleAt?: string | null;
    wsConnected?: boolean;
    errors?: string[];
    openPositions?: number;
    activeStrategies?: number;
  } | null;
  brokers?: Array<{
    id: string;
    label: string;
    connected: boolean;
    enabled: boolean;
    message?: string;
    error?: string;
  }>;
  extras?: {
    database: boolean;
    firebaseAdmin: boolean;
    firebaseAuth: boolean;
  };
  risk?: RiskSnapshot | null;
}

export interface JupiterStatus {
  connected: boolean;
  hasKey: boolean;
  keySource: "env" | "database" | "none";
  keyHint: string | null;
  error?: string;
  sample?: { symbol: string; usdPrice: number };
  solana?: {
    cluster: string;
    executionMode: string;
    rpcOk: boolean;
    rpcHost: string;
    error?: string;
  };
}

export interface JupiterPriceRow {
  symbol: string;
  name: string;
  mint: string;
  usdPrice: number | null;
  change24h: number | null;
  liquidity: number | null;
  decimals: number;
}

export interface JupiterQuote {
  input: { symbol: string; name: string; mint: string; decimals: number };
  output: { symbol: string; name: string; mint: string; decimals: number };
  inAmount: string;
  outAmount: string;
  inUi: number;
  outUi: number;
  price: number;
  priceImpactPct: number | null;
  routePlanCount: number;
}

export interface JupiterOrder extends JupiterQuote {
  requestId: string;
  transaction: string;
  router?: string;
  taker: string;
}

export interface JupiterExecuteResult {
  status: "Success" | "Failed";
  signature?: string;
  error?: string;
  solscanUrl?: string;
  simulated?: boolean;
  cluster?: string;
  executionMode?: string;
}

export interface WalletPublic {
  id: number;
  address: string;
  label: string | null;
  isPrimary: boolean;
  verified?: boolean;
  source?: string;
}

export interface WalletNoncePayload {
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  chain: "solana";
  address: string;
  message: string;
  cluster?: string;
  executionMode?: string;
}

export interface SolanaNetworkStatus {
  cluster: string;
  executionMode: "demo" | "live" | string;
  rpcHost: string;
  faucetUrl: string | null;
  phantomHint: string;
}

export interface SplTokenBalance {
  mint: string;
  symbol: string;
  name: string;
  initials: string;
  decimals: number;
  amount: string;
  uiAmount: number;
}

export interface SolanaBalance {
  address: string;
  cluster: string;
  executionMode?: string;
  lamports: number;
  sol: number;
  explorerUrl?: string;
  signature?: string;
  faucetUrl?: string;
  tokens?: SplTokenBalance[];
}

export interface WalletTransferPublic {
  id: number;
  type: string;
  asset: string;
  amount: number;
  status: string;
  txHash: string | null;
  note: string | null;
  createdAt: string;
}
