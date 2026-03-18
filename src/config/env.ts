import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  SESSION_CREATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(20),
  NZBN_API_BASE_URL: z.string().url().default("https://api.business.govt.nz/gateway/nzbn/v5"),
  NZBN_API_KEY: z.string().default("")
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`Invalid environment configuration: ${parsedEnv.error.message}`);
}

export const env = parsedEnv.data;
