# CLAUDE.md

This file provides guidance to Claude Code when working with the GitHub API wrapper.

## Project Overview

This is a type-safe TypeScript wrapper for the GitHub REST API. It provides a `GitHubClient` class with methods for repositories, issues, pull requests, branches, commits, releases, actions, and more. Plus helper utilities for building search queries.

## Important Notes

- **No top-level await**: When writing scripts, always wrap code in an `async function main()` and call `main()` at the end. The tsx runner doesn't support top-level await with CommonJS output.
- **Authentication**: Uses Bearer token authentication with a Personal Access Token (PAT).
- **Always load .env**: Use `config({ path: 'C:/Users/Dominik/Projects/wrapper/GitHub/.env' })` to load credentials.
- **API Version**: Uses `X-GitHub-Api-Version: 2022-11-28` header by default.

## Common Commands

### Running Scripts
```bash
cd C:\Users\Dominik\Projects\wrapper\GitHub
npx tsx your-script.ts
```

### Building
```bash
npm run build
```

## Code Pattern

```typescript
import { config } from 'dotenv';
import { GitHubClient, SearchQueryBuilder } from './src/index.js';

config({ path: 'C:/Users/Dominik/Projects/wrapper/GitHub/.env' });

async function main() {
  const github = new GitHubClient({
    token: process.env.GITHUB_TOKEN!,
  });

  // Operations here...
}

main();
```

## Architecture

### Directory Structure
- `src/client.ts` - Main GitHubClient class with all API methods
- `src/types.ts` - TypeScript type definitions for all GitHub entities
- `src/helpers.ts` - SearchQueryBuilder and utility functions
- `src/index.ts` - Main exports
- `dist/` - Compiled JavaScript output
- `.env` - Environment variables (token)

### Key Classes
- `GitHubClient` - Main API client with methods for repos, issues, PRs, etc.
- `SearchQueryBuilder` - Fluent builder for search queries
- `GitHubApiError` - Custom error class with status code and error details

## API Notes

### Authentication
Uses Bearer token authentication: `Authorization: Bearer <token>`

Personal Access Tokens can be created at: https://github.com/settings/tokens

### Rate Limits
- Unauthenticated: 60 requests/hour
- Authenticated: 5,000 requests/hour
- Check limits with `getRateLimit()`

### Response Structure
Most list endpoints return arrays directly. Search endpoints return:
```typescript
{
  total_count: number,
  incomplete_results: boolean,
  items: T[]
}
```

## Common Operations

### Get repository info
```typescript
const repo = await github.getRepository('owner', 'repo-name');
```

### List open issues
```typescript
const issues = await github.listIssues('owner', 'repo', { state: 'open' });
```

### Create a pull request
```typescript
const pr = await github.createPullRequest('owner', 'repo', {
  title: 'My PR',
  head: 'feature-branch',
  base: 'main',
});
```

### Search repositories
```typescript
const results = await github.searchRepositories({
  q: SearchQueryBuilder.create()
    .language('typescript')
    .stars('>', 1000)
    .build(),
});
```

## Troubleshooting

### "Top-level await is currently not supported"
Wrap your code in an async function:
```typescript
async function main() { ... }
main();
```

### "does not provide an export named 'GitHubClientConfig'"
TypeScript interfaces must be exported with `export type`, not just `export`. The index.ts uses:
```typescript
export { GitHubClient, GitHubApiError } from './client.js';
export type { GitHubClientConfig } from './client.js';
```

### 401 Unauthorized
Check that your token is valid and has the required scopes.

### 403 Forbidden
You may have hit rate limits. Check with `getRateLimit()`.

### 404 Not Found
The resource may not exist, or your token may not have access to private resources.

## Learnings

### Type Exports in ESM
When exporting TypeScript interfaces/types from index.ts, use `export type { ... }` instead of regular `export { ... }`. This is required because interfaces don't exist at runtime in JavaScript - they're compile-time only constructs. Mixing them with value exports causes runtime errors like:
```
SyntaxError: The requested module './client.js' does not provide an export named 'GitHubClientConfig'
```

### QueryParams Type
The `QueryParams` type uses `Record<string, any>` instead of a stricter type to allow passing various parameter objects (like `ListIssuesParams`, `SearchRepositoriesParams`) without index signature errors. This is a pragmatic choice for flexibility.

### No Top-Level Await
Same as the Jira wrapper - tsx with CommonJS output doesn't support top-level await. Always use the async main() pattern.
