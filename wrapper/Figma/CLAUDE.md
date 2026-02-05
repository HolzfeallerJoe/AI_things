# CLAUDE.md

This file provides guidance to Claude Code when working with the Figma API wrapper.

## Project Overview

This is a type-safe TypeScript wrapper for the Figma REST API. It provides a `FigmaClient` class with methods for files, images, comments, components, styles, projects, webhooks, variables, and dev resources. Plus helper utilities for colors, URLs, and node tree traversal.

## Important Notes

- **No top-level await**: When writing scripts, always wrap code in an `async function main()` and call `main()` at the end. The tsx runner doesn't support top-level await with CommonJS output.
- **Authentication**: Uses `X-Figma-Token` header with a Personal Access Token.
- **Always load .env**: Use `config({ path: 'C:/Users/Dominik/Projects/wrapper/Figma/.env' })` to load credentials.
- **File Keys**: Figma uses file keys (not full URLs) for API calls. Use `extractFileKey()` to get the key from a URL.

## Common Commands

### Running Scripts
```bash
cd C:\Users\Dominik\Projects\wrapper\Figma
npx tsx your-script.ts
```

### Building
```bash
npm run build
```

## Code Pattern

```typescript
import { config } from 'dotenv';
import { FigmaClient, extractFileKey } from './src/index.js';

config({ path: 'C:/Users/Dominik/Projects/wrapper/Figma/.env' });

async function main() {
  const figma = new FigmaClient({
    accessToken: process.env.FIGMA_ACCESS_TOKEN!,
  });

  // Operations here...
}

main();
```

## Architecture

### Directory Structure
- `src/client.ts` - Main FigmaClient class with all API methods
- `src/types.ts` - TypeScript type definitions for all Figma entities
- `src/helpers.ts` - Color, URL, and node tree utility functions
- `src/index.ts` - Main exports
- `dist/` - Compiled JavaScript output
- `.env` - Environment variables (token)

### Key Classes
- `FigmaClient` - Main API client with methods for files, components, etc.
- `FigmaApiError` - Custom error class with status code and error details

## API Notes

### Authentication
Uses X-Figma-Token header: `X-Figma-Token: <token>`

Personal Access Tokens can be created at: https://www.figma.com/developers/api#access-tokens

### Rate Limits
Figma has tiered rate limits:
- Tier 1: File content endpoints
- Tier 2: Comments, webhooks
- Tier 3: Metadata, components, styles

Use the `retryWithBackoff()` helper for automatic retry with exponential backoff.

### File Keys vs URLs
Figma API uses file keys, not full URLs. Extract with:
```typescript
const fileKey = extractFileKey('https://www.figma.com/file/ABC123/MyFile');
// Returns: 'ABC123'
```

### Node IDs
Node IDs have format `1:2` but URLs use `1-2`. Helpers available:
```typescript
nodeIdToUrlFormat('1:2')  // Returns '1-2'
urlFormatToNodeId('1-2')  // Returns '1:2'
```

## Common Operations

### Get file content
```typescript
const file = await figma.getFile('fileKey');
console.log(file.name);
console.log(file.document.children); // Pages
```

### Export images
```typescript
const images = await figma.getImage('fileKey', {
  ids: ['1:2'],
  format: 'png',
  scale: 2,
});
```

### Find components
```typescript
const components = await figma.getFileComponents('fileKey');
```

### Post a comment
```typescript
await figma.postComment('fileKey', {
  message: 'Looks good!',
  client_meta: { node_id: '1:2' },
});
```

## Troubleshooting

### "Top-level await is currently not supported"
Wrap your code in an async function:
```typescript
async function main() { ... }
main();
```

### 403 Forbidden
Check that your token is valid and has the required scopes.

### 404 Not Found
The file key may be incorrect or you don't have access to the file.

### Rate Limited
Use `retryWithBackoff()` helper or add delays between requests.

## Learnings

### Type Exports in ESM
Same as GitHub/Jira wrappers - interfaces must use `export type { ... }` in index.ts.

### Array Query Parameters
Figma accepts comma-separated IDs. The client automatically joins arrays:
```typescript
// ids: ['1:2', '1:3'] becomes ids=1:2,1:3
```

### No Top-Level Await
Same pattern as other wrappers - use async main() function.
