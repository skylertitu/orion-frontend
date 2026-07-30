export interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  language?: string;
  timezone?: string;
  avatar?: string | null;
  termsAccepted?: boolean;
  emailVerified?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string | null;
}

export interface Session {
  user: User;
  token: string;
  rememberMe?: boolean;
}

const SESSION_KEY = "orion_trading_session";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const local = localStorage.getItem(SESSION_KEY);
    if (local) return JSON.parse(local) as Session;

    const session = sessionStorage.getItem(SESSION_KEY);
    if (session) return JSON.parse(session) as Session;

    return null;
  } catch {
    return null;
  }
}

export function setSession(session: Session, rememberMe = true) {
  if (typeof window === "undefined") return;
  const data = JSON.stringify({ ...session, rememberMe });
  if (rememberMe) {
    localStorage.setItem(SESSION_KEY, data);
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    sessionStorage.setItem(SESSION_KEY, data);
    localStorage.removeItem(SESSION_KEY);
  }
}

export function updateUserInSession(userUpdates: Partial<User>) {
  const current = getSession();
  if (!current) return;
  const updatedUser = { ...current.user, ...userUpdates };
  setSession({ ...current, user: updatedUser }, current.rememberMe ?? true);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export function getToken(): string | null {
  return getSession()?.token ?? null;
}

export function getUser(): User | null {
  return getSession()?.user ?? null;
}
