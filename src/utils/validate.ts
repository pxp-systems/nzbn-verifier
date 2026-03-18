import { ZodSchema } from "zod";

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationErrorPayload {
  message: string;
  issues: ValidationIssue[];
}

export function parseOrThrow<T>(schema: ZodSchema<T>, input: unknown): T {
  const parsed = schema.safeParse(input);

  if (parsed.success) {
    return parsed.data;
  }

  const payload: ValidationErrorPayload = {
    message: "Validation failed",
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  };

  const error = new Error(payload.message);
  error.name = "ValidationError";
  (error as Error & { payload?: ValidationErrorPayload }).payload = payload;
  throw error;
}
