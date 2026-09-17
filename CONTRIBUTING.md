# Contributing

Thank you for your interest in improving this feedback template!  
Whether you're reporting bugs, suggesting features, or sending a pull request, contributions are welcome.

## Ways to Contribute

### Reporting Bugs

Please open a GitHub issue and include:

- Clear title describing the bug
- Steps to reproduce
- Expected vs. actual behavior
- Environment details (browser, OS, Node version)
- Screenshots or error messages if applicable

### Requesting Features

For feature requests, open a GitHub issue and describe:

- The problem you're trying to solve
- Your proposed solution or ideas
- How this would benefit users of the template

### Improving Documentation

Documentation fixes and clarifications are very welcome.  
For small changes you can use GitHub’s web editor; for larger ones, please open a PR.

### Contributing Code

If you’d like to contribute code, please follow the guidelines below.

## Prerequisites

- **Node.js 20+**
- **pnpm 10+** (this repo assumes pnpm; other package managers are not supported)

## Getting Started (Local Dev)

1. **Clone the repository**

   ```bash
   git clone <your-fork-url>
   cd <repo-name>
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Configure environment variables**

   - Create `.env` files for the relevant apps (e.g. `apps/www`, `apps/slack-app`) based on the variables defined in:
     - `apps/www/src/lib/env.server.ts`
     - `apps/www/src/lib/env.client.ts`
     - Slack app config files under `apps/slack-app/server/**`
   - Use your own infrastructure credentials (database, Redis, AI provider, Slack, auth provider, etc.).

4. **Set up the database and seed demo data**

   ```bash
   # run database migrations
   pnpm db:push

   # seed demo data (optional but helpful for testing)
   pnpm db:seed
   ```

   The seed script populates demo data and generates embeddings for feature requests if AI credentials are configured.

5. **Run the development server**

   ```bash
   pnpm dev
   ```

   The web app will be available at `http://localhost:3000`.  
   The Slack app server will also run at `http://localhost:3001`.

## Development Workflow

### Making Changes

1. Create a feature branch from `main`:

   ```bash
   git checkout -b my-feature
   ```

2. Make your changes.

3. Test your changes locally:

   ```bash
   pnpm lint
   pnpm build
   ```

4. Commit with a descriptive message:

   ```bash
   git commit -m "fix: describe the change clearly"
   ```

### Commit Convention

Using [conventional commits](https://www.conventionalcommits.org/) is encouraged:

- `feat:` – new feature
- `fix:` – bug fix
- `docs:` – documentation changes
- `refactor:` – code refactoring
- `test:` – adding or updating tests
- `chore:` – maintenance tasks

### Testing Your Changes

Before submitting a pull request:

1. **Build:**

   ```bash
   pnpm build
   ```

2. **Run dev and smoke test:**
   - Start dev server: `pnpm dev`
   - Manually test your changes (light/dark modes, responsive layouts, basic flows)
   - Check the browser console and server logs for errors

Some workspaces may also run pre-commit hooks (e.g. Husky) to format and lint code automatically.

## Pull Request Process

1. **Before opening a PR:**
   - Ensure `pnpm build` succeeds
   - Ensure `pnpm lint` passes
   - Verify your changes locally

2. **PR title:** Prefer a clear, action-oriented title, ideally following conventional commit style:

   ```text
   fix: resolve avatar background in dark mode
   feat: add user analytics dashboard
   ```

3. **PR description:** Please include:
   - Summary of changes
   - Screenshots (for UI changes)
   - Any breaking changes or migration notes
   - Testing steps

## Project Structure (Overview)

```text
.
├── apps/
│   ├── www/         # Next.js feedback web app
│   └── slack-app/   # Slack integration (Bolt + Nitro)
├── packages/
│   ├── ai/          # Shared AI utilities
│   ├── database/    # Drizzle ORM schema & DB helpers
│   └── redis/       # Redis client helpers
└── ...
```

## Questions / Support

If you’re not sure how best to contribute:

- Check existing issues and pull requests
- Open a new issue describing your question or proposal

Thanks again for helping improve this template! 🚀
