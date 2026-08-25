import { isStaff, isSuperAdmin } from "./roles";

export const USER_PLANS = ["analyst", "signals", "builder"] as const;
export type UserPlan = (typeof USER_PLANS)[number];

export const DEFAULT_USER_PLAN: UserPlan = "builder";

export type PlanCapability =
  | "market"
  | "indicators_library"
  | "indicators_editor"
  | "lucy_signals"
  | "lucy_control"
  | "broker_accounts"
  | "manual_orders"
  | "wallets"
  | "jupiter_execute"
  | "strategies_auto";

export const PLAN_LABELS: Record<UserPlan, string> = {
  analyst: "Analista",
  signals: "Señales",
  builder: "Builder",
};

export const PLAN_BLURBS: Record<UserPlan, string> = {
  analyst: "Mercado, indicadores y señales. Órdenes manuales si usas broker.",
  signals: "Mercado, indicadores y el feed de señales de Lucy.",
  builder: "Mercado, creas indicadores y ves el feed de señales.",
};

const PLAN_CAPABILITIES: Record<UserPlan, PlanCapability[]> = {
  analyst: ["market", "indicators_library", "lucy_signals", "broker_accounts", "manual_orders", "wallets"],
  signals: ["market", "indicators_library", "lucy_signals", "broker_accounts", "wallets"],
  builder: ["market", "indicators_library", "indicators_editor", "lucy_signals", "broker_accounts", "wallets"],
};

const ADMIN_CAPABILITIES: PlanCapability[] = [
  "market",
  "indicators_library",
  "indicators_editor",
  "lucy_signals",
  "lucy_control",
  "broker_accounts",
  "manual_orders",
  "wallets",
  "jupiter_execute",
  "strategies_auto",
];

type PlanBearer = {
  role?: string;
  plan?: string | null;
} | null | undefined;

export function isUserPlan(value: unknown): value is UserPlan {
  return typeof value === "string" && (USER_PLANS as readonly string[]).includes(value);
}

export function userPlan(user: PlanBearer): UserPlan | null {
  if (!user) return null;
  if (isStaff(user)) return null;
  return isUserPlan(user.plan) ? user.plan : DEFAULT_USER_PLAN;
}

export function hasCapability(user: PlanBearer, capability: PlanCapability): boolean {
  if (!user) return false;
  if (isStaff(user)) return ADMIN_CAPABILITIES.includes(capability);
  const plan = userPlan(user);
  if (!plan) return false;
  return PLAN_CAPABILITIES[plan].includes(capability);
}

export function homePath(user: PlanBearer): string {
  return user ? "/mercado" : "/";
}

export function deskNavHrefs(user: PlanBearer): string[] {
  if (!user) return [];
  if (isStaff(user)) {
    return [
      "/dashboard",
      "/mercado",
      "/lucy",
      "/indicadores",
      "/estrategias",
      "/trading",
      "/cuentas",
    ];
  }
  return ["/mercado", "/indicadores", "/senales", "/cuentas"];
}

export function deskMenuHrefs(user: PlanBearer): string[] {
  if (!user) return [];
  if (isSuperAdmin(user)) {
    return [...deskNavHrefs(user), "/admin", "/superadmin", "/ajustes", "/perfil"];
  }
  if (isStaff(user)) {
    return [...deskNavHrefs(user), "/admin", "/ajustes", "/perfil"];
  }
  return ["/mercado", "/indicadores", "/senales", "/cuentas", "/perfil"];
}

export function canAccessPath(user: PlanBearer, href: string): boolean {
  if (!user) return false;
  if (href === "/perfil" || href === "/ajustes") return true;
  if (href === "/dashboard") return isStaff(user);
  if (href === "/admin") return isStaff(user);
  if (href === "/superadmin") return isSuperAdmin(user);
  if (href === "/mercado") return hasCapability(user, "market");
  if (href === "/lucy") return hasCapability(user, "lucy_control");
  if (href === "/senales" || href === "/señales") return hasCapability(user, "lucy_signals");
  if (href === "/indicadores") {
    return hasCapability(user, "indicators_library") || hasCapability(user, "indicators_editor");
  }
  if (href === "/estrategias") return hasCapability(user, "strategies_auto");
  if (href === "/trading") {
    return (
      hasCapability(user, "manual_orders") ||
      hasCapability(user, "jupiter_execute") ||
      hasCapability(user, "lucy_control")
    );
  }
  if (href === "/cuentas") {
    return hasCapability(user, "broker_accounts") || hasCapability(user, "wallets");
  }
  return true;
}

export const PLAN_DENIED: Partial<Record<PlanCapability, string>> = {
  wallets: "Conecta Phantom o Solflare desde Cuentas.",
  lucy_signals: "Las señales de Lucy van en el plan Señales.",
  broker_accounts: "Conecta tu broker desde Cuentas.",
  manual_orders: "Las órdenes manuales son del plan Analista o del administrador.",
  indicators_editor: "Crear indicadores es del plan Builder.",
  strategies_auto: "El worker automático solo lo usa el administrador.",
};
