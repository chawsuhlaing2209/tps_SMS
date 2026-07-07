/** Map login fetch/proxy failures to a user-facing message. */
export function resolveLoginError(
  error: unknown,
  messages: { invalid: string; apiUnavailable: string }
): string {
  if (error instanceof TypeError) {
    return messages.apiUnavailable;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("failed to fetch") ||
      message.includes("network") ||
      message.includes("load failed") ||
      message.includes("econnrefused")
    ) {
      return messages.apiUnavailable;
    }
    return error.message;
  }

  return messages.invalid;
}

export function loginHttpError(
  status: number,
  body: { message?: string } | null,
  messages: { invalid: string; apiUnavailable: string }
): string {
  if (status >= 500) {
    return messages.apiUnavailable;
  }
  return body?.message ?? messages.invalid;
}

export type LoginField = "tenant" | "identifier" | "password";

export type LoginFailure = {
  /** Which form field the failure points at; absent → show as a form-level banner. */
  field?: LoginField;
  message: string;
};

export type LoginFailureMessages = {
  invalid: string;
  apiUnavailable: string;
  unknownTenant?: string;
  unknownIdentifier?: string;
  accountInactive?: string;
  wrongPassword?: string;
};

/**
 * Map the API's structured login error (`{ code, message }`) to a
 * field-specific failure so the form can highlight the exact input.
 */
export function loginHttpFailure(
  status: number,
  body: { message?: string; code?: string } | null,
  messages: LoginFailureMessages
): LoginFailure {
  if (status >= 500) {
    return { message: messages.apiUnavailable };
  }

  switch (body?.code) {
    case "auth.unknownTenant":
      return { field: "tenant", message: messages.unknownTenant ?? messages.invalid };
    case "auth.unknownIdentifier":
      return { field: "identifier", message: messages.unknownIdentifier ?? messages.invalid };
    case "auth.accountInactive":
      return { field: "identifier", message: messages.accountInactive ?? messages.invalid };
    case "auth.wrongPassword":
      return { field: "password", message: messages.wrongPassword ?? messages.invalid };
    default:
      return { message: body?.message ?? messages.invalid };
  }
}
