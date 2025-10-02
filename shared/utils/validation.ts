import { z } from "zod";

export class ValidationError extends Error {
  constructor(message: string, public readonly errors: z.ZodError) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validates data against a Zod schema and returns typed result
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: ValidationError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: new ValidationError("Validation failed", result.error),
  };
}

/**
 * Validates data and throws on error
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = validate(schema, data);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

/**
 * Formats Zod errors for user display
 */
export function formatValidationErrors(error: z.ZodError): string[] {
  return error.issues.map((err: { path: unknown[]; message: unknown }) => {
    const path = err.path.map(String).join(".");
    return path ? `${path}: ${err.message}` : String(err.message);
  });
}

/**
 * Creates a user-friendly error message from Zod errors
 */
export function createUserErrorMessage(error: z.ZodError): string {
  const errors = formatValidationErrors(error);
  if (errors.length === 1) {
    return errors[0];
  }
  return `Multiple validation errors:\n${errors
    .map((e) => `- ${e}`)
    .join("\n")}`;
}
