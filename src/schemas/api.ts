import { z } from "zod";

export const createSessionSchema = z.object({
  contactMethod: z.enum(["sms", "email"]),
  contactValue: z.string().min(1).max(150)
});

export const sendLinkSchema = z.object({
  contactMethod: z.enum(["sms", "email"]),
  contactValue: z.string().min(1).max(150)
});

export const presentCredentialSchema = z.object({
  scenario: z.enum(["valid", "expired", "revoked", "invalid", "no_presentation"])
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().length(32)
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type SendLinkInput = z.infer<typeof sendLinkSchema>;
export type PresentCredentialInput = z.infer<typeof presentCredentialSchema>;
