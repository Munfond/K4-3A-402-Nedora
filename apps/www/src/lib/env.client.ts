import { z } from "zod";

export const clientEnvSchema = z.object({
  // site
  NEXT_PUBLIC_APP_URL: z.url().optional(),

  // vercel
  VERCEL_ENV: z
    .enum(["development", "preview", "production"])
    .optional()
    .default("development"),
});

export const CLIENT_ENV = clientEnvSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  VERCEL_ENV: process.env.VERCEL_ENV,
});
