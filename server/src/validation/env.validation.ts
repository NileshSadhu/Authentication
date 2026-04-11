import * as z from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  PORT: z.string(),
  NODE_ENV: z.enum(["development", "production", "test"]),
});
