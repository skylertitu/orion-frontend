export interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
}

interface Session {
  user: User;
  token: string;
}

const SESSION_KEY = "autotrading_session";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function setSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getToken(): string | null {
  return getSession()?.token ?? null;
}

export function getUser(): User | null {
  return getSession()?.user ?? null;
}
