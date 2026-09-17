# Slack Feedback App (`apps/slack-app`)

Slack app for capturing feedback via reactions, commands, and AI assistant. Built with Bolt and Nitro.

## Deploy

1. **Create Slack App**

   - Go to [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From manifest
   - Paste contents of [`manifest.json`](./manifest.json) into the manifest editor
   - Install to workspace and note your credentials:
     - **Signing Secret** (Basic Information → App Credentials)
     - **Bot Token** (OAuth & Permissions → Bot User OAuth Token, starts with `xoxb-`)
   - Generate a random string for `SLACK_APP_VERIFICATION` (shared secret between this app and the web app). You can create one with `openssl rand -base64 32` in your terminal.

2. **Deploy to Vercel**

   Click below and enter your Slack credentials when prompted:

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/vercel-labs/oss-gtm-feedback&root-directory=apps/slack-app&project-name=gtm-feedback-slack-app&repository-name=gtm-feedback-slack-app&env=SLACK_SIGNING_SECRET,SLACK_BOT_TOKEN,SLACK_APP_VERIFICATION&envDescription=Retrieve%20your%20Slack%20app%20credentials%20from%20api.slack.com%2Fapps&envLink=https://api.slack.com/apps)

3. **Add `:gtm-feedback:` emoji**

   Add a `:gtm-feedback:` custom emoji to your Slack workspace. This emoji is required for the reaction-based feedback feature to work. Users can react to messages with `:gtm-feedback:` to capture feedback.

   - Go to your workspace settings → Customize → Emoji
   - Add a custom emoji named `gtm-feedback` (or upload an image and name it `gtm-feedback`)

4. **Update Slack App URLs**

   After deployment, update your Slack app's Request URL to point to your Vercel deployment:
   - Event Subscriptions → Request URL: `https://your-app.vercel.app/api/slack/events`
   - Interactivity → Request URL: `https://your-app.vercel.app/api/slack/events`

## Local Development

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Set up environment**

   ```bash
   cp .env.example .env
   ```

   Add your `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`, and other credentials. 
   
   Continue following these steps under [Environment Setup](https://vercel.com/templates/ai/slack-agent-template).

3. **Link to your Slack app**

   ```bash
   slack app link
   ```

   - Select "yes" when prompted to update the manifest source to remote
   - Enter your App ID from [api.slack.com/apps](https://api.slack.com/apps)
   - Select "Local" when prompted

4. **Start the dev server**

   ```bash
   slack run
   ```

   This starts the server with automatic tunneling. Select "yes" if asked to update app settings with local manifest changes.

5. **Test in Slack**

   Add your app to a channel and mention it or send a DM.

## Project Structure

```
server/
├── app.ts                 # bolt app init
├── api/slack/events.post.ts
├── lib/
│   ├── ai/                # ai response + tools
│   └── slack/             # utilities
└── listeners/
    ├── actions/           # button handlers
    ├── commands/          # slash commands
    ├── events/            # reactions, mentions, unfurls
    ├── messages/          # dm handlers
    ├── shortcuts/         # global shortcuts
    └── views/             # modal submissions
```
