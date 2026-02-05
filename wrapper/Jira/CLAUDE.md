# CLAUDE.md

This file provides guidance to Claude Code when working with the Jira API wrapper.

## Project Overview

This is a type-safe TypeScript wrapper for the Jira Cloud REST API v3. It provides a `JiraClient` class with methods for all common Jira operations, plus helper utilities for building JQL queries and Atlassian Document Format (ADF) content.

## Important Notes

- **No top-level await**: When writing scripts, always wrap code in an `async function main()` and call `main()` at the end. The tsx runner doesn't support top-level await with CommonJS output.
- **API Endpoint Change**: The search endpoint is `/search/jql` (not `/search`). This was updated in the Jira API - the old endpoint returns a 410 Gone error.
- **Always load .env**: Use `config({ path: 'C:/Users/Dominik/Projects/wrapper/Jira/.env' })` to load credentials.

## Common Commands

### Running Scripts
```bash
cd C:\Users\Dominik\Projects\wrapper\Jira
npx tsx your-script.ts
```

### Building
```bash
npm run build
```

## Code Pattern

```typescript
import { config } from 'dotenv';
import { JiraClient, JqlBuilder } from './src/index.js';

config({ path: 'C:/Users/Dominik/Projects/wrapper/Jira/.env' });

async function main() {
  const jira = new JiraClient({
    domain: process.env.JIRA_DOMAIN!,
    email: process.env.JIRA_EMAIL!,
    apiToken: process.env.JIRA_API_TOKEN!,
  });

  // Operations here...
}

main();
```

## Architecture

### Directory Structure
- `src/client.ts` - Main JiraClient class with all API methods
- `src/types.ts` - TypeScript type definitions for all Jira entities
- `src/helpers.ts` - JqlBuilder, AdfBuilder, and utility functions
- `src/index.ts` - Main exports
- `dist/` - Compiled JavaScript output
- `.env` - Environment variables (credentials)

### Key Classes
- `JiraClient` - Main API client with methods for issues, projects, users, sprints, etc.
- `JqlBuilder` - Fluent builder for JQL queries
- `AdfBuilder` - Builder for Atlassian Document Format (rich text)
- `JiraApiError` - Custom error class with status code and error details

## API Notes

### Search Endpoint
The `searchIssues()` method uses POST `/rest/api/3/search/jql` (not the deprecated `/search`).

### Authentication
Uses Basic Auth with email + API token, encoded as Base64.

### Response Structure
Search results return:
```typescript
{
  issues: Issue[],
  total: number,
  isLast: boolean
}
```

## Troubleshooting

### "Top-level await is currently not supported"
Wrap your code in an async function:
```typescript
async function main() { ... }
main();
```

### "The requested API has been removed" (410 error)
The search endpoint changed. Make sure `client.ts` uses `/search/jql` not `/search`.

### Authentication errors
Verify `.env` has correct values:
- `JIRA_DOMAIN` - e.g., `ascora.atlassian.net`
- `JIRA_EMAIL` - Your Atlassian account email
- `JIRA_API_TOKEN` - Token from https://id.atlassian.com/manage-profile/security/api-tokens
