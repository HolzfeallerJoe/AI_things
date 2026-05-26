---
name: confluence
description: Use this skill whenever the user asks to interact with Confluence - listing spaces, reading pages, creating pages, updating pages, searching with CQL, managing labels, or publishing Markdown/status/spec content to Confluence. Provides a type-safe TypeScript wrapper for the Confluence Cloud REST API.
---

When working with Confluence, use the TypeScript wrapper located at `C:\Users\Dominik\Projects\Private\AI_things\wrapper\Confluence`.

## Setup

The wrapper requires environment variables from `C:\Users\Dominik\Projects\Private\AI_things\wrapper\Confluence\.env`:
- `CONFLUENCE_DOMAIN` - Atlassian Cloud domain (e.g., `ascora.atlassian.net`)
- `CONFLUENCE_EMAIL` - Atlassian account email
- `CONFLUENCE_API_TOKEN` - API token from https://id.atlassian.com/manage-profile/security/api-tokens

## Code Pattern

**IMPORTANT**: Always wrap code in an async function - top-level await is not supported with tsx/cjs.

```typescript
import { config } from 'dotenv';
import {
  ConfluenceClient,
  markdownToStorage,
} from 'C:/Users/Dominik/Projects/Private/AI_things/wrapper/Confluence/src/index.js';

config({ path: 'C:/Users/Dominik/Projects/Private/AI_things/wrapper/Confluence/.env' });

async function main() {
  const confluence = new ConfluenceClient({
    domain: process.env.CONFLUENCE_DOMAIN!,
    email: process.env.CONFLUENCE_EMAIL!,
    apiToken: process.env.CONFLUENCE_API_TOKEN!,
  });

  // Your Confluence operations here...
}

main();
```

## Running Scripts

To execute Confluence scripts, write a `.ts` file in the wrapper directory and run with tsx:

```bash
cd C:\Users\Dominik\Projects\Private\AI_things\wrapper\Confluence
npx tsx your-script.ts
```

Clean up temporary scripts after use.

## Available Methods

### Users
- `confluence.getCurrentUser()` - Get the account the API token/email authenticates as (`accountId`, `displayName`, `email`)

### Spaces
- `confluence.getSpaces(params?)` - List visible spaces
- `confluence.getSpace(spaceId)` - Get a space by numeric ID
- `confluence.getSpaceByKey(key)` - Get the first matching space by key
- `confluence.getCurrentUserPersonalSpace()` - Resolve the current user's personal ("under my name") space, or `undefined` if none exists
- `confluence.getPersonalSpace(accountId)` - Resolve a personal space for a specific account id
- `confluence.personalSpaceKey(accountId)` - Compute the personal space key for an account id (`~` + accountId with `:`/`-` stripped)

### Pages
- `confluence.getPages(params?)` - List pages
- `confluence.getPagesInSpace(spaceId, params?)` - List pages in a space
- `confluence.getPage(pageId, params?)` - Get one page
- `confluence.createPage({ spaceId, title, body, parentId? })` - Create a page
- `confluence.updatePage({ id, spaceId, title, body, versionMessage? })` - Update a page
- `confluence.deletePage(pageId)` - Delete a page
- `confluence.getPageChildren(pageId, params?)` - List child pages

### Labels
- `confluence.getPageLabels(pageId, params?)` - Get page labels
- `confluence.addPageLabels(pageId, { labels })` - Add page labels

### Search
- `confluence.search({ cql, limit, start, expand })` - Search with Confluence Query Language

### Helpers
- `markdownToStorage(markdown)` - Convert supported Markdown to Confluence storage-format XHTML: headings, paragraphs, horizontal rules, bullet/numbered/nested lists, task lists, blockquotes, pipe tables, fenced code blocks with optional language, standalone external images, and inline **bold**, *italic*, `code`, [links](url), ~~strikethrough~~
- `inlineMarkdownToStorage(text)` - Convert inline Markdown only (bold/italic/code/link/strikethrough) for a single line/span
- `textToStorage(text)` - Convert plain text paragraphs to storage-format XHTML
- `storageBody(value)` - Wrap storage XHTML in a page body object
- `escapeStorageHtml(value)` - Escape storage XHTML text

## Examples

### List Spaces

```typescript
const spaces = await confluence.getSpaces({ limit: 25 });
for (const space of spaces.results) {
  console.log(`${space.key}: ${space.name} (${space.id})`);
}
```

### Create a Page

```typescript
const space = await confluence.getSpaceByKey('ENG');
if (!space) throw new Error('Space not found');

const page = await confluence.createPage({
  spaceId: space.id,
  parentId: '123456', // optional
  title: 'Weekly Status',
  body: markdownToStorage(`
# Weekly Status

- Completed API integration
- Preparing rollout checklist
`),
});

console.log(`Created page ${page.id}: ${page.title}`);
```

### Update a Page

```typescript
const existing = await confluence.getPage('987654', { includeVersion: true });

await confluence.updatePage({
  id: existing.id,
  spaceId: existing.spaceId!,
  title: existing.title,
  body: markdownToStorage('# Updated Status\n\nAll systems green.'),
  versionMessage: 'Updated by agent',
});
```

### Search Pages

```typescript
const results = await confluence.search({
  cql: 'type=page AND space=ENG AND title~"status"',
  limit: 10,
});

for (const result of results.results) {
  console.log(result.content?.id, result.title || result.content?.title);
}
```

### Create a Page in the Current User's Personal Space ("under my name")

```typescript
const space = await confluence.getCurrentUserPersonalSpace();
if (!space) {
  throw new Error(
    'The authenticated user has no personal space. ' +
      'Personal spaces are not auto-created on Confluence Cloud — ' +
      'create one in Confluence first, or pick another space.'
  );
}

const page = await confluence.createPage({
  spaceId: space.id,
  title: 'My Page',
  body: markdownToStorage('# My Page\n\nContent here.'),
});

console.log(`Created page ${page.id} in ${space.key}`);
```

## Important Notes

- Ask for the destination space key or space ID before creating pages. If the user only gives a space name, list/search spaces first.
- When the user says "under my name" / "my space" / "my personal space", use `getCurrentUserPersonalSpace()` — do not guess the key. Personal space keys are `~` + accountId with `:`/`-` removed (e.g. accountId `712020:7ed4b425-...` → key `~7120207ed4b425...`), which is why a raw `~<accountId>` lookup fails. If it returns `undefined`, the user has no personal space (not auto-created on Cloud) — tell them and offer to use another space.
- Ask whether to create a root page or nest under a parent page if the destination is ambiguous.
- Use Markdown as the authoring format, then convert it with `markdownToStorage()` unless the user provides storage XHTML.
- Page updates require an incremented version. `updatePage()` handles this automatically when `versionNumber` is omitted.
- Never expose API tokens or print `.env` contents.
