import type { FieldErrors, FieldValues, Resolver, ResolverResult } from "react-hook-form";
import type { ZodType } from "zod";

/**
 * Minimal React Hook Form resolver for flat Zod object schemas. Avoids pulling
 * in @hookform/resolvers for the simple, single-level forms in this app.
 */
export function zodResolver<TValues extends FieldValues>(
  schema: ZodType<TValues>
): Resolver<TValues> {
  return async (values): Promise<ResolverResult<TValues>> => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors: FieldErrors<TValues> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (field != null && !(String(field) in errors)) {
        (errors as Record<string, unknown>)[String(field)] = {
          type: issue.code,
          message: issue.message
        };
      }
    }

    return { values: {}, errors };
  };
}
