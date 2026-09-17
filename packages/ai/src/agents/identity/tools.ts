import { tool } from "ai";
import { z } from "zod";
import { db } from "@feedback/db";

export const identityOutputSchema = z.object({
  userId: z
    .string()
    .nullable()
    .describe(
      "The user ID if there's a confident match, or null if no good match exists",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Confidence score from 0.0 to 1.0 indicating how confident you are that the target email matches the user email. 1.0 = exact match, 0.0 = no match",
    ),
  reason: z
    .string()
    .optional()
    .describe(
      "Brief explanation of why this match was made or why no match was found",
    ),
});

export type IdentityOutput = z.infer<typeof identityOutputSchema>;

export const getAllUsers = tool({
  description:
    "Fetches all users from the database with their id, email, and name. Call this first to get the list of users to match against.",
  inputSchema: z.object({}),
  execute: async () => {
    const users = await db.query.users.findMany({
      columns: {
        id: true,
        email: true,
        name: true,
      },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
    }));
  },
});

export const identityTools = {
  getAllUsers,
};
