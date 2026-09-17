import type { AdapterAccountType } from "@auth/core/adapters";
import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ENUMS
export const requestStatusEnum = pgEnum("request_status", [
  "open",
  "shipped",
  "deprioritized",
]);

export const severityEnum = pgEnum("severity", ["low", "medium", "high"]);

export const feedbackCreationSourceEnum = pgEnum("feedback_creation_source", [
  "manual",
  "agent",
]);

// TABLES
export const users = pgTable(
  "users",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text("name").notNull(),
    email: text("email").unique().notNull(),
    image: text("image"),
    avatar: text("avatar"),
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    isAdmin: boolean("is_admin").default(false).notNull(),
  },
  (table) => [unique("users_email_key").on(table.email)],
);

export const accounts = pgTable(
  "account",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    {
      compoundKey: primaryKey({
        columns: [account.provider, account.providerAccountId],
      }),
    },
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const authenticators = pgTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (authenticator) => [
    {
      compositePK: primaryKey({
        columns: [authenticator.userId, authenticator.credentialID],
      }),
    },
  ],
);

export const requests = pgTable(
  "requests",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    title: text().notNull(),
    description: text().notNull(),
    status: requestStatusEnum("status").default("open").notNull(),
    creator: uuid("creator"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    slug: text().notNull(),
    notes: text("notes"),
    areaIds: varchar("area_ids", { length: 36 })
      .array()
      .notNull()
      .default(sql`ARRAY[]::varchar[]`),
    relatedLinks: text("related_links")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    linearUrl: text("linear_url"),
    followers: uuid("followers")
      .array()
      .notNull()
      .default(sql`ARRAY[]::uuid[]`),
    relatedRequestId: uuid("related_request_id"),
    metadata: jsonb("metadata"),
  },
  (table) => [
    foreignKey({
      columns: [table.creator],
      foreignColumns: [users.id],
      name: "requests_creator_fkey",
    }),
    foreignKey({
      columns: [table.relatedRequestId],
      foreignColumns: [table.id],
      name: "requests_related_request_id_fkey",
    }),
    unique("requests_slug_key").on(table.slug),
    index("requests_creator_idx").on(table.creator),
    index("requests_updated_at_idx").on(table.updatedAt),
    index("requests_area_ids_idx").using("gin", table.areaIds),
    index("requests_related_links_idx").using("gin", table.relatedLinks),
    index("requests_followers_idx").using("gin", table.followers),
    index("requests_related_request_id_idx").on(table.relatedRequestId),
  ],
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    requestId: uuid("request_id").notNull(),
    accountId: text("account_id").notNull(),
    opportunityId: text("opportunity_id"),
    severity: severityEnum("severity").notNull(),
    description: text("description").notNull(),
    creator: uuid("creator").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    externalLinks: text("external_links")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    slug: text("slug"),
    creationSource: feedbackCreationSourceEnum("creation_source")
      .default("manual")
      .notNull(),
    metadata: jsonb("metadata"),
  },
  (table) => [
    foreignKey({
      columns: [table.creator],
      foreignColumns: [users.id],
      name: "feedback_creator_fkey",
    }),
    foreignKey({
      columns: [table.requestId],
      foreignColumns: [requests.id],
      name: "feedback_request_id_fkey",
    }).onDelete("cascade"),
    unique("feedback_request_slug_key").on(table.requestId, table.slug),
    index("feedback_request_created_idx").on(table.requestId, table.createdAt),
    index("feedback_account_idx").on(table.accountId),
    index("feedback_creator_idx").on(table.creator),
  ],
);

export const areas = pgTable(
  "areas",
  {
    id: varchar({ length: 36 }).primaryKey().notNull(),
    name: text().notNull(),
    slug: text().notNull(),
    description: text().notNull(),
    firehoseChannel: text("firehose_channel"),
  },
  (table) => [
    unique("areas_name_key").on(table.name),
    unique("areas_slug_key").on(table.slug),
  ],
);

export const sfdcAccounts = pgTable(
  "sfdc_accounts",
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    type: text(),
    regionName: text("region_name"),
    arr: numeric("arr", { precision: 14, scale: 2, mode: "number" }),
    isEnterprise: boolean("is_enterprise").default(false),
    website: text(),
    logo: text(),
    link: text(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
  },
  (table) => [
    index("sfdc_accounts_name_idx").on(table.name),
    index("sfdc_accounts_arr_idx").on(table.arr),
    index("sfdc_accounts_is_enterprise_idx").on(table.isEnterprise),
  ],
);

export const sfdcOpportunities = pgTable(
  "sfdc_opportunities",
  {
    id: text().primaryKey().notNull(),
    accountId: text("account_id").notNull(),
    name: text().notNull(),
    arr: numeric("arr", { precision: 14, scale: 2, mode: "number" }),
    stage: text(),
    closeDate: timestamp("close_date", { mode: "date" }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [sfdcAccounts.id],
      name: "sfdc_opportunities_account_id_fkey",
    }),
    index("sfdc_opportunities_account_idx").on(table.accountId),
    index("sfdc_opportunities_arr_idx").on(table.arr),
    index("sfdc_opportunities_stage_idx").on(table.stage),
    index("sfdc_opportunities_close_date_idx").on(table.closeDate),
  ],
);
