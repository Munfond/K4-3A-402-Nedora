# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies (pnpm only)
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting (using Biome)
pnpm lint
pnpm lint:fix  # Auto-fix linting issues

# Type checking
npx tsc --noEmit
```

## Architecture Overview

This is a Next.js 16 application for GTM feedback collection and reporting. It uses:

- **Next.js 16** with App Router and Turbopack for the framework
- **NextAuth v5** with Google for authentication
- **Drizzle ORM** with PostgreSQL (Neon) for database
- **Tailwind CSS v4** with shadcn/ui components for styling
- **SWR** for data fetching and caching
- **Biome** for linting and formatting

### Key Architectural Patterns

1. **Authentication Flow**:
   - NextAuth v5 with Google provider
   - Uses Drizzle adapter for database session management
   - Session callbacks extend user data with id and avatar

2. **Data Architecture**:
   - Feedback items stored in PostgreSQL via Drizzle ORM
   - Account/opportunity data stored in PostgreSQL
   - Comments system for feedback entries
   - Database entities: Users, Feedback, Entries, Comments, Areas

3. **Component Structure**:
   - UI components in `src/components/ui/` (shadcn-based)
   - Feature components organized by domain (feedback, accounts, areas, analytics)
   - Advanced data-table system with filtering, sorting, pagination, and column controls
      - Located in `src/components/data-table/`
      - Uses @tanstack/react-table with URL state management via nuqs
      - Supports faceted filters, date ranges, sliders, and advanced toolbar

4. **API Routes**:
   - `/api/auth/[...nextauth]` - NextAuth authentication endpoints
   - `/api/feedback/[id]` - Individual feedback operations and ARR calculations
   - `/api/accounts/[id]` - Account details and opportunities from database
   - `/api/search` - Unified search across all entities (uses local database for accounts/opportunities)
   - `/api/areas` - Product areas management

5. **Server Actions**:
   - next-safe-action v8 for type-safe server actions
   - Action clients in `src/lib/actions/clients/` with middleware pipeline
   - Three main clients: base, authenticated, and admin
   - Custom error handling with ActionError class
   - Built-in logging and performance monitoring

6. **State Management**:
   - URL state via `nuqs` for filters and pagination
   - SWR for server state with optimistic updates
   - UserContext for authentication state
   - **Custom hooks in `src/hooks/` MUST use SWR for data fetching**

## Important Configuration

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string (Neon)
- `AUTH_SECRET` - NextAuth secret for JWT signing
- `AUTH_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `AUTH_GOOGLE_SECRET` - Google OAuth client secret

### TypeScript Configuration
- Strict mode enabled, targeting ES2017
- Path alias `@/` maps to `./src/`
- Vitest globals types included
- Uses Next.js plugin for type checking

### Code Quality Tools
- **Biome** for linting and formatting (replaces ESLint/Prettier)
   - Import organization with specific group ordering
   - 2-space indentation, semicolons, trailing commas
   - Sorted CSS classes via `useSortedClasses` rule

## Server Actions with next-safe-action

This project uses next-safe-action v8 for type-safe server actions with a sophisticated middleware pipeline.

### Action Client Architecture

Located in `src/lib/actions/clients/`, we have three main action clients:

#### 1. Base Client (`src/lib/actions/clients/index.ts`)
```typescript
import { createSafeActionClient } from "next-safe-action";

export const baseClient = createSafeActionClient({
  handleServerError(error) {
    // Custom error handling with ActionError class
    if (error instanceof ActionError) {
      return error.message;
    }
    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
  defaultValidationErrorsShape: "flattened",
  defineMetadataSchema: () => z.object({
    actionName: z.string(),
    entity: z.enum(["user", "feedback", "entry", "comment", "area", "account"])
  })
});
```

#### 2. Authenticated Client (`src/lib/actions/clients/auth.ts`)
```typescript
import { authActionClient } from "@/lib/actions/clients/auth";

// Automatically adds user to context
export const authActionClient = baseClient.use(authMiddleware);
```

### Action Implementation Patterns

#### Basic Structure
```typescript
"use server";

import { z } from "zod";
import { authActionClient } from "@/lib/actions/clients/auth";

const inputSchema = z.object({
  title: z.string().min(1),
  description: z.string().max(1000),
});

export const createFeedback = authActionClient
  .metadata({ actionName: "createFeedback", entity: "feedback" })
  .inputSchema(inputSchema)
  .action(async ({ parsedInput, ctx: { user } }) => {
    // Database operations with user context available
    const result = await db.insert(Feedback).values({
      ...parsedInput,
      creator: user.id
    }).returning();
    
    revalidatePath("/feedback");
    return { success: true, data: result[0] };
  });
```

#### Form Data Actions
```typescript
import { zfd } from "zod-form-data";

const formSchema = zfd.formData({
  title: zfd.text(z.string().min(1)),
  severity: zfd.text(z.enum(["low", "medium", "high"])),
  tags: zfd.text(z.string()).transform(val => val.split(",")),
});
```

#### Error Handling
```typescript
import { ActionError } from "@/lib/actions/clients";

// In your action:
if (!hasPermission) {
  throw new ActionError("You don't have permission to perform this action");
}
```

### Middleware Features

- **Authentication**: Automatically validates user session
- **Authorization**: Admin middleware for privileged operations
- **Logging**: Built-in performance monitoring and request logging
- **Error Handling**: Structured error responses with ActionError class
- **Metadata**: Action naming and entity classification for debugging

### Client Usage Patterns

#### In Components (with useAction)
```tsx
import { useAction } from "next-safe-action/hooks";
import { createNewFeedbackItem } from "@/lib/actions/feedback";

export function FeedbackForm() {
  const { execute, result, isPending } = useAction(createNewFeedbackItem);
  
  return (
    <form action={execute}>
      <input name="title" required />
      <button disabled={isPending}>
        {isPending ? "Creating..." : "Create Feedback"}
      </button>
    </form>
  );
}
```

#### Form Actions
```tsx
// Direct form action usage
<form action={createFeedback}>
  <input name="title" />
  <button type="submit">Submit</button>
</form>
```

### Best Practices

1. **Always use appropriate client**: `baseClient` for public, `authActionClient` for authenticated, `adminActionClient` for admin
2. **Include metadata**: Provide descriptive `actionName` and correct `entity` for debugging
3. **Use ActionError**: Throw ActionError for user-facing errors, let other errors be masked
4. **Validate inputs**: Always use inputSchema with Zod for type safety
5. **Revalidate paths**: Call `revalidatePath()` after mutations to update cache
6. **Handle context**: Access `ctx.user` in authenticated actions for user-specific operations

### File Organization

- Action clients: `src/lib/actions/clients/`
- Server actions: `src/lib/actions/` (grouped by entity)

## Database Operations with Drizzle ORM

### Required Syntax - Drizzle Relational Query Builder (RQB)

**CRITICAL**: Use Drizzle Relational Query Builder (RQB) syntax ONLY

**✅ CORRECT - Use Query Engine:**
```typescript
import { db } from "@feedback/db";

// Find many with relations
const feedback = await db.query.feedback.findMany({
  with: {
    user: true,
    entries: {
      with: { user: true },
      orderBy: (entries, { desc }) => [desc(entries.createdAt)]
    },
    comments: {
      orderBy: (comments, { desc }) => [desc(comments.createdAt)],
      limit: 10
    }
  },
  where: (feedback, { eq, and, isNotNull }) => and(
    eq(feedback.status, 'open'),
    isNotNull(feedback.creator)
  ),
  orderBy: (feedback, { desc }) => [desc(feedback.updatedAt)]
});

// Find first/single record
const feedback = await db.query.feedback.findFirst({
  where: (feedback, { eq }) => eq(feedback.id, feedbackId),
  with: { user: true, entries: true, comments: { with: { user: true } } }
});
```

**❌ INCORRECT - Never use db.select():**
```typescript
// NEVER DO THIS
const result = await db.select().from(Feedback).where(eq(Feedback.id, id))
```

### Database Schema Overview
- **Users**: User accounts with authentication
- **Requests**: Feature requests with areas, status, links
- **Feedback**: Customer-specific feedback linked to accounts/opportunities
- **Areas**: Product areas for categorization

### Relations Pattern
- Users → many Feedback, Entries, Comments (creator relationship)
- Feedback → one User (creator), many Entries, many Comments
- Entries → one User (creator), one Feedback, references accounts
- Comments → one User (creator), one Feedback, supports pinning

## Development Guidelines

### Database Operations
- **CRITICAL**: Use Drizzle Relational Query Builder (RQB) syntax ONLY
- Use `db.query.TableName.findMany()` and `findFirst()` patterns
- Never use `db.select()` syntax - always use the query engine
- Include relations with `with` clause, use callback syntax for filtering and ordering
- Database schema is in `src/lib/db/schema.ts`, relations in `src/lib/db/relations.ts`

### Authentication & Data Patterns  
- Follow NextAuth v5 patterns for authentication
- Use existing SWR hooks for data fetching
- **All custom hooks in `src/hooks/` MUST use SWR** for consistent caching and state management
- Use the established data-table components for any tabular data
- **Use next-safe-action clients for all server actions** - never create raw server actions
- All external data integrations should be properly typed
- Use the `@/` path alias consistently for imports

### Component & UI Guidelines
- Use shadcn/ui components from `src/components/ui/`
- Follow existing patterns for feedback, entries, and comments components
- Use Biome for formatting and linting

## Custom Hooks Pattern

**MANDATORY: All data fetching hooks in `src/hooks/` MUST use SWR for consistent caching and state management.**

### SWR Data Fetching Hook Pattern

```typescript
import useSWR from "swr";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch");
  return response.json();
};

export function useAccount(accountId: string | null | undefined) {
  const key = accountId ? `/api/accounts/${encodeURIComponent(accountId)}` : null;
  
  const { data, error, isLoading, mutate } = useSWR<{
    account: Account | null;
    opportunities: Opportunity[];
  }>(key, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  return {
    account: data?.account ?? null,
    opportunities: data?.opportunities ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    mutate,
  };
}
```

### Batch Data Fetching Pattern

```typescript
import useSWR from "swr";

const accountsFetcher = async (accountIds: string[]) => {
  if (accountIds.length === 0) return {};
  
  const promises = accountIds.map(async (id) => {
    try {
      const data = await fetcher(`/api/accounts/${encodeURIComponent(id)}`);
      return { id, data };
    } catch {
      return { id, data: { account: null, opportunities: [] } };
    }
  });
  
  const results = await Promise.all(promises);
  const accountsData = {};
  results.forEach(({ id, data }) => {
    accountsData[id] = data;
  });
  return accountsData;
};

export function useAccounts(accountIds: string[]) {
  const { data, error, isLoading, mutate } = useSWR(
    accountIds.length > 0 ? ["accounts", ...accountIds.sort()] : null,
    () => accountsFetcher(accountIds),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  return {
    accounts: data || {},
    loading: isLoading,
    error: error ? (error as Error).message : null,
    mutate,
  };
}
```

### Hook Requirements

1. **Use SWR**: All data fetching hooks must use SWR for consistent caching and state management
2. **Consistent Return Shape**: Return objects with descriptive properties (data, loading, error, mutate)
3. **Error Handling**: Gracefully handle errors and provide user-friendly error messages
4. **Type Safety**: Use proper TypeScript types for all data structures
5. **SWR Configuration**: Use appropriate SWR options for caching, revalidation, and retry behavior
6. **Key Design**: Design cache keys thoughtfully to enable proper deduplication and invalidation


### General Rules

1. Comments should be lowercase
2. Files should be kebab case and use simple names