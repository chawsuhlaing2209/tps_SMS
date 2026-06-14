import type { Response } from "express";

export const SESSION_COOKIE_NAME = "sms_session";

/**
 * Idle timeout: a session must be used at least this often or it expires. The
 * idle deadline slides forward on each authenticated request.
 */
export const SESSION_IDLE_TTL_MS = 1000 * 60 * 60 * 12;

/**
 * Absolute lifetime: a session can never live longer than this from creation,
 * regardless of activity. The cookie itself is set to this lifetime so the
 * browser keeps sending it while the server enforces the sliding idle window.
 */
export const SESSION_ABSOLUTE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

interface CookieCarrier {
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Reads the session token from the request cookie header. Parsed manually so
 * the API does not need cookie-parser middleware just to read one cookie.
 */
export function readSessionCookie(request: CookieCarrier): string | undefined {
  const header = request.headers?.cookie;
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) {
    return undefined;
  }

  for (const part of raw.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    if (name === SESSION_COOKIE_NAME) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return undefined;
}

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/"
  };
}

export function setSessionCookie(res: Response, token: string): void {
  // The cookie lasts the absolute session lifetime; the server still enforces
  // the shorter, sliding idle timeout on every request.
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    maxAge: SESSION_ABSOLUTE_TTL_MS
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, baseCookieOptions());
}
