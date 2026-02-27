# QA Copilot

Define testing scope from user and technical perspectives. Built with Next.js + Anthropic Claude.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Create `.env.local`:

```bash
ANTHROPIC_API_KEY=your_key_here

JIRA_DOMAIN=yourcompany.atlassian.net
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=your_jira_token

GITHUB_TOKEN=your_github_token
```

Optional — to ground regression analysis in your app structure:

```bash
WEB_APP_PATH=/path/to/web-app
CORE_SERVICE_PATH=/path/to/core-service
```

The Evaluate page uses the app map so regression areas reference real routes and API endpoints from your codebase.
