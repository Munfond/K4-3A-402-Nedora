/**
 * The application base URL resolved from environment variables.
 *
 * Priority order:
 * 1. NEXT_PUBLIC_APP_URL - explicit override for local dev, production, or custom deployments
 * 2. https://${VERCEL_URL} in preview environments
 * 3. Fallback to http://localhost:3000
 *
 * Environment variables used:
 * - NEXT_PUBLIC_APP_URL: The base URL for the application (required in production)
 * - VERCEL_ENV: "production" | "preview" | "development" (set by Vercel)
 * - VERCEL_URL: Auto-generated deployment URL (set by Vercel)
 */
export const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");
