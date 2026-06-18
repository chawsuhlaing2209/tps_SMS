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
