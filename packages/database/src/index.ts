import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

import {
  areasRelations,
  feedbackRelations,
  requestsRelations,
  sfdcAccountsRelations,
  sfdcOpportunitiesRelations,
  usersRelations,
} from "./relations";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const fullSchema = {
  ...schema,
  usersRelations,
  requestsRelations,
  feedbackRelations,
  areasRelations,
  sfdcAccountsRelations,
  sfdcOpportunitiesRelations,
};

export const db = drizzle(pool, { schema: fullSchema });

// Re-export commonly used items for convenience
export * from "./schema";
export * from "./types";
export * from "./relations";
