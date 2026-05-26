# CLAUDE.md

This file provides guidance to Claude Code when working with the Confluence API wrapper.

## Project Overview

This is a type-safe TypeScript wrapper for the Confluence Cloud REST API. It provides a `ConfluenceClient` class with methods for spaces, pages, labels, and CQL search, plus helper utilities for building Confluence storage-format (XHTML) content from plain text or Markdown.

The client talks to two API surfaces:
- **v2** (`/wiki/api/v2`) for spaces, pages, and labels.
- **REST** (`/wiki/rest/api`) for CQL search, which has no v2 equivalent.

## Important Notes

- **No top-level await**: When writing scripts, always wrap code in an `async function main()` and call `main()` at the end. The tsx runner doesn't support top-level await with CommonJS output.
- **Authentication**: Uses Basic Auth with email + API token, encoded as Base64 (same as the Jira wrapper).
- **Always load .env**: Use `config({ path: 'C:/Users/Dominik/Projects/Private/AI_things/wrapper/Confluence/.env' })` to load credentials.
- **Storage format, not Markdown**: Confluence page bodies use storage-format XHTML. Use `markdownToStorage()` / `textToStorage()` to convert, or `storageBody()` to wrap raw storage XHTML.

## Common Commands

### Running Scripts
```bash
cd C:\Users\Dominik\Projects\Private\AI_things\wrapper\Confluence
npx tsx your-script.ts
```

### Building
```bash
npm run build
```

## Code Pattern

```typescript
import { config } from 'dotenv';
import { ConfluenceClient, markdownToStorage } from './src/index.js';

config({ path: 'C:/Users/Dominik/Projects/Private/AI_things/wrapper/Confluence/.env' });

async function main() {
  const confluence = new ConfluenceClient({
    domain: process.env.CONFLUENCE_DOMAIN!,
    email: process.env.CONFLUENCE_EMAIL!,
    apiToken: process.env.CONFLUENCE_API_TOKEN!,
  });

  // Operations here...
}

main();
```

## Architecture

### Directory Structure
- `src/client.ts` - Main ConfluenceClient class with all API methods
- `src/types.ts` - TypeScript type definitions for all Confluence entities
- `src/helpers.ts` - Storage-format (XHTML) builders and utility functions
- `src/index.ts` - Main exports
- `dist/` - Compiled JavaScript output
- `.env` - Environment variables (credentials)

### Key Classes
- `ConfluenceClient` - Main API client with methods for spaces, pages, labels, and search
- `ConfluenceApiError` - Custom error class with status code and error details

### Helpers
- `markdownToStorage(markdown)` - Converts a Markdown subset to storage-format XHTML: headings, paragraphs, horizontal rules, bullet/numbered/nested lists, task lists, blockquotes, pipe tables, fenced code blocks with optional language, standalone external images, and inline bold/italic/code/link/strikethrough
- `textToStorage(text)` - Wraps plain-text paragraphs in `<p>` storage XHTML
- `storageBody(value)` - Wraps raw storage XHTML in the API body object
- `escapeStorageHtml(value)` - Escapes text for safe inclusion in storage XHTML

## API Notes

### Authentication
Uses Basic Auth with email + API token, encoded as Base64: `Authorization: Basic <base64(email:token)>`.

### Dual Base URLs
The client routes requests to either the v2 or REST API depending on the operation. Most methods use v2; `search()` uses the REST CQL endpoint (`/wiki/rest/api/search`).

### CQL Search
The `search()` method takes a CQL query string (e.g. `type=page AND space=ENG`). See the Confluence CQL docs for the full grammar.

### Pagination
v2 endpoints use cursor-based pagination and return `CursorPagedResponse<T>`. Use the `paginate()` async generator to iterate pages, or `getAll()` to collect every result.

## Troubleshooting

### "Top-level await is currently not supported"
Wrap your code in an async function:
```typescript
async function main() { ... }
main();
```

### Authentication errors
Verify `.env` has correct values:
- `CONFLUENCE_DOMAIN` - e.g., `mycompany.atlassian.net`
- `CONFLUENCE_EMAIL` - Your Atlassian account email
- `CONFLUENCE_API_TOKEN` - Token from https://id.atlassian.com/manage-profile/security/api-tokens

### 404 on a space key
Space *keys* (e.g. `ENG`) are not space *ids*. Use `getSpaceByKey()` to resolve a key to a space, then pass `space.id` to page operations.

### Page body looks like raw HTML / tags show as text
Page bodies must be storage-format XHTML. Build them with `markdownToStorage()` / `textToStorage()`, or wrap raw storage XHTML with `storageBody()`.

## Learnings

### Type Exports in ESM
Same as the GitHub/Jira/Figma wrappers - interfaces must use `export type { ... }` in index.ts (or be re-exported via `export * from './types.js'`). Interfaces are compile-time only, so mixing them into value exports causes runtime "does not provide an export named ..." errors.

### No Top-Level Await
Same pattern as the other wrappers - use the async `main()` function.

### Personal Space Keys Are Normalized
A user's personal ("under my name") space key is `~` + their `accountId` with all `:` and `-` characters removed — not `~<accountId>`. For account id `712020:7ed4b425-2e83-44de-b207-fb2ef751caae` the key is `~7120207ed4b4252e8344deb207fb2ef751caae`. Use `getCurrentUser()` + `personalSpaceKey()`, or just `getCurrentUserPersonalSpace()`, instead of building the key by hand. Personal spaces are **not** auto-created on Confluence Cloud, so the lookup returns `undefined` until the user creates one.
