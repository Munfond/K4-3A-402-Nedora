/**
 * seed.ts
 *
 * seeds the database with demo data and generates vector embeddings.
 * usage: pnpm db:seed
 */

import "dotenv/config";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createRequestEmbeddings,
  storeRequestEmbeddings,
} from "@feedback/ai/embeddings";
import { db } from "@feedback/db";
import * as schema from "@feedback/db/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface SeedData {
  users: Array<{
    id: string;
    name: string;
    email: string;
    image: string | null;
    avatar: string | null;
    isAdmin: boolean;
  }>;
  areas: Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
    firehoseChannel: string | null;
  }>;
  sfdcAccounts: Array<{
    id: string;
    name: string;
    type: string;
    regionName: string;
    arr: number;
    isEnterprise: boolean;
    website: string;
    logo: string | null;
    link: string | null;
  }>;
  sfdcOpportunities: Array<{
    id: string;
    accountId: string;
    name: string;
    arr: number;
    stage: string;
    closeDate: string;
  }>;
  requests: Array<{
    id: string;
    title: string;
    description: string;
    status: "open" | "shipped" | "deprioritized";
    creator: string;
    slug: string;
    notes: string | null;
    areaIds: string[];
    relatedLinks: string[];
    linearUrl: string | null;
    followers: string[];
    relatedRequestId: string | null;
    metadata: Record<string, unknown> | null;
  }>;
  feedback: Array<{
    requestId: string;
    accountId: string;
    opportunityId: string | null;
    severity: "low" | "medium" | "high";
    description: string;
    creator: string;
    externalLinks: string[];
    slug: string | null;
    creationSource: "manual" | "agent";
    metadata: Record<string, unknown> | null;
  }>;
}

async function seedDatabase(seedData: SeedData) {
  // 1. insert users (batch insert)
  console.log("\n1. inserting users...");
  await db
    .insert(schema.users)
    .values(
      seedData.users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        avatar: user.avatar,
        isAdmin: user.isAdmin,
      })),
    )
    .onConflictDoNothing();
  console.log(`   inserted ${seedData.users.length} users`);

  // 2. insert product areas (batch insert)
  console.log("\n2. inserting product areas...");
  await db
    .insert(schema.areas)
    .values(
      seedData.areas.map((area) => ({
        id: area.id,
        name: area.name,
        slug: area.slug,
        description: area.description,
        firehoseChannel: area.firehoseChannel,
      })),
    )
    .onConflictDoNothing();
  console.log(`   inserted ${seedData.areas.length} product areas`);

  // 3. insert sfdc accounts (batch insert)
  console.log("\n3. inserting accounts...");
  await db
    .insert(schema.sfdcAccounts)
    .values(
      seedData.sfdcAccounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        regionName: account.regionName,
        arr: account.arr,
        isEnterprise: account.isEnterprise,
        website: account.website,
        logo: account.logo,
        link: account.link,
      })),
    )
    .onConflictDoNothing();
  console.log(`   inserted ${seedData.sfdcAccounts.length} accounts`);

  // 4. insert sfdc opportunities (batch insert)
  console.log("\n4. inserting opportunities...");
  await db
    .insert(schema.sfdcOpportunities)
    .values(
      seedData.sfdcOpportunities.map((opp) => ({
        id: opp.id,
        accountId: opp.accountId,
        name: opp.name,
        arr: opp.arr,
        stage: opp.stage,
        closeDate: opp.closeDate ? new Date(opp.closeDate) : null,
      })),
    )
    .onConflictDoNothing();
  console.log(`   inserted ${seedData.sfdcOpportunities.length} opportunities`);

  // 5. insert requests (batch insert)
  console.log("\n5. inserting requests...");
  await db
    .insert(schema.requests)
    .values(
      seedData.requests.map((req) => ({
        id: req.id,
        title: req.title,
        description: req.description,
        status: req.status,
        creator: req.creator,
        slug: req.slug,
        notes: req.notes,
        areaIds: req.areaIds,
        relatedLinks: req.relatedLinks,
        linearUrl: req.linearUrl,
        followers: req.followers,
        relatedRequestId: req.relatedRequestId,
        metadata: req.metadata,
      })),
    )
    .onConflictDoNothing();
  console.log(`   inserted ${seedData.requests.length} requests`);

  // 6. insert feedback (batch insert)
  console.log("\n6. inserting feedback...");
  await db
    .insert(schema.feedback)
    .values(
      seedData.feedback.map((fb) => ({
        requestId: fb.requestId,
        accountId: fb.accountId,
        opportunityId: fb.opportunityId,
        severity: fb.severity,
        description: fb.description,
        creator: fb.creator,
        externalLinks: fb.externalLinks,
        slug: fb.slug,
        creationSource: fb.creationSource,
        metadata: fb.metadata,
      })),
    )
    .onConflictDoNothing();
  console.log(`   inserted ${seedData.feedback.length} feedback`);
}

async function seedEmbeddings(requestItems: SeedData["requests"]) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const vectorUrl = process.env.UPSTASH_VECTOR_REST_URL;
  const vectorToken = process.env.UPSTASH_VECTOR_REST_TOKEN;

  if (!openaiApiKey || !vectorUrl || !vectorToken) {
    console.log(
      "\n⚠ skipping embeddings (missing OPENAI_API_KEY, UPSTASH_VECTOR_REST_URL, or UPSTASH_VECTOR_REST_TOKEN)",
    );
    return;
  }

  console.log("\n7. generating embeddings...");

  // process in batches of 50
  const batchSize = 50;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < requestItems.length; i += batchSize) {
    const batch = requestItems.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(requestItems.length / batchSize);

    console.log(
      `   processing batch ${batchNum}/${totalBatches} (${batch.length} items)...`,
    );

    const items = batch.map((req) => ({
      title: req.title,
      description: req.description,
    }));

    const embeddings = await createRequestEmbeddings(items, openaiApiKey);

    if (!embeddings) {
      console.error(`   failed to create embeddings for batch ${batchNum}`);
      failCount += batch.length;
      continue;
    }

    const embeddingItems = batch.map((req, idx) => ({
      requestId: req.id,
      embedding: embeddings[idx],
      metadata: {
        title: req.title,
        status: req.status,
        slug: req.slug,
      },
    }));

    const storedIds = await storeRequestEmbeddings(
      embeddingItems,
      vectorUrl,
      vectorToken,
    );

    successCount += storedIds.size;
    failCount += batch.length - storedIds.size;

    // small delay between batches
    if (i + batchSize < requestItems.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  console.log(`   stored ${successCount}/${requestItems.length} embeddings`);
  if (failCount > 0) {
    console.log(`   ⚠ ${failCount} embeddings failed`);
  }
}

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  // load seed data from database package
  const seedPath = join(
    __dirname,
    "..",
    "..",
    "..",
    "packages",
    "database",
    "seed.json",
  );
  console.log("loading seed data from:", seedPath);
  const seedData: SeedData = JSON.parse(readFileSync(seedPath, "utf-8"));

  console.log("seed data loaded:");
  console.log(`  - ${seedData.users.length} users`);
  console.log(`  - ${seedData.areas.length} product areas`);
  console.log(`  - ${seedData.sfdcAccounts.length} accounts`);
  console.log(`  - ${seedData.sfdcOpportunities.length} opportunities`);
  console.log(`  - ${seedData.requests.length} requests`);
  console.log(`  - ${seedData.feedback.length} feedback`);

  try {
    // seed database
    await seedDatabase(seedData);

    // seed embeddings (optional, skips if env vars missing)
    await seedEmbeddings(seedData.requests);

    console.log("\n✓ seeding complete!");
  } catch (error) {
    console.error("seeding failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

seed();
