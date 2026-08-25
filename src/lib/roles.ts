export type AppRole = "user" | "admin" | "superadmin";

export function isStaff(user: { role?: string } | null | undefined): boolean {
  return user?.role === "admin" || user?.role === "superadmin";
}

export function isSuperAdmin(user: { role?: string } | null | undefined): boolean {
  return user?.role === "superadmin";
}

export function roleLabel(role?: string | null): string {
  if (role === "superadmin") return "Superadmin";
  if (role === "admin") return "Admin";
  return "Usuario";
}

export function roleBadgeClass(role?: string | null): string {
  if (role === "superadmin") return "text-fuchsia-400";
  if (role === "admin") return "text-amber-400";
  return "text-zinc-400";
}
