"use client";

const STORAGE_KEY = "sms.session";

export type Session = {
  tenantId: string | null;
  tenantSlug: string;
  userId: string;
  displayName?: string;
  expiresAt?: string;
  isPlatform?: boolean;
  roles?: string[];
  permissions?: string[];
};

export function isPlatformSession(session: Session | null | undefined): boolean {
  return session?.isPlatform === true || session?.tenantId === null;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as Session;
    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setSession(session: Session): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}
