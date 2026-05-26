# Confluence API Wrapper

A type-safe TypeScript wrapper for Confluence Cloud REST API v2, with CQL search through the Confluence REST search endpoint.

## Installation

```bash
npm install
npm run build
```

## Configuration

Create a `.env` file with your Atlassian credentials:

```env
CONFLUENCE_DOMAIN=your-domain.atlassian.net
CONFLUENCE_EMAIL=your-email@example.com
CONFLUENCE_API_TOKEN=your-api-token
```

Get your API token from: https://id.atlassian.com/manage-profile/security/api-tokens

## Quick Start

**Important**: Always wrap code in an async function - top-level await is not supported.

```typescript
import { config } from 'dotenv';
import { ConfluenceClient, markdownToStorage } from './src/index.js';

config({ path: './.env' });

async function main() {
  const confluence = new ConfluenceClient({
    domain: process.env.CONFLUENCE_DOMAIN!,
    email: process.env.CONFLUENCE_EMAIL!,
    apiToken: process.env.CONFLUENCE_API_TOKEN!,
  });

  const space = await confluence.getSpaceByKey('ENG');
  if (!space) {
    throw new Error('Space not found');
  }

  const page = await confluence.createPage({
    spaceId: space.id,
    title: 'API-created page',
    body: markdownToStorage('# Hello\n\nCreated from TypeScript.'),
  });

  console.log(`Created page ${page.id}: ${page.title}`);
}

main();
```

Run with:

```bash
npx tsx your-script.ts
```

## Usage Examples

### Spaces

```typescript
const spaces = await confluence.getSpaces({ limit: 25 });
const engineering = await confluence.getSpaceByKey('ENG');
```

### Pages

```typescript
const pages = await confluence.getPages({
  spaceId: ['123456'],
  bodyFormat: 'storage',
  limit: 25,
});

const page = await confluence.getPage('987654', {
  bodyFormat: 'storage',
  includeVersion: true,
});
```

### Create a Page

```typescript
const page = await confluence.createPage({
  spaceId: '123456',
  parentId: '987654',
  title: 'Weekly Status',
  body: markdownToStorage(`
# Weekly Status

- Completed API integration
- Preparing rollout checklist
`),
});
```

### Update a Page

```typescript
await confluence.updatePage({
  id: '987654',
  spaceId: '123456',
  title: 'Weekly Status',
  body: markdownToStorage('# Updated Status\n\nAll systems green.'),
  versionMessage: 'Updated weekly status',
});
```

If `versionNumber` is omitted, the wrapper fetches the current page version and increments it.

### Search with CQL

```typescript
const results = await confluence.search({
  cql: 'type=page AND space=ENG AND title~"status"',
  limit: 10,
});

for (const result of results.results) {
  console.log(result.content?.id, result.title || result.content?.title);
}
```

### Pagination Helper

```typescript
for await (const page of confluence.paginate(
  (params) => confluence.getPagesInSpace('123456', params),
  50
)) {
  console.log(page.title);
}

const allSpaces = await confluence.getAll((params) => confluence.getSpaces(params), 50);
```

### Error Handling

```typescript
import { ConfluenceApiError } from './src/index.js';

try {
  await confluence.getPage('missing');
} catch (error) {
  if (error instanceof ConfluenceApiError) {
    console.error(`Confluence API Error (${error.status}): ${error.message}`);
  }
}
```

## API Reference

### ConfluenceClient Methods

#### Spaces
- `getSpaces(params?)` - List visible spaces
- `getSpace(spaceId)` - Get a space by numeric ID
- `getSpaceByKey(key)` - Get the first matching space by key

#### Pages
- `getPages(params?)` - List pages
- `getPagesInSpace(spaceId, params?)` - List pages in a space
- `getPage(pageId, params?)` - Get a page
- `createPage(params)` - Create a page
- `updatePage(params)` - Update a page
- `deletePage(pageId)` - Delete a page
- `getPageChildren(pageId, params?)` - List child pages

#### Labels
- `getPageLabels(pageId, params?)` - Get page labels
- `addPageLabels(pageId, params)` - Add page labels

#### Search
- `search(params)` - Search with Confluence Query Language

#### Utilities
- `paginate(fetchFn, pageSize?)` - Async iterator for cursor pagination
- `getAll(fetchFn, pageSize?)` - Get all cursor-paginated results

### Helpers
- `markdownToStorage(markdown)` - Convert supported Markdown to Confluence storage XHTML
- `inlineMarkdownToStorage(text)` - Convert inline Markdown only
- `textToStorage(text)` - Convert plain text paragraphs to storage XHTML
- `storageBody(value)` - Wrap storage XHTML in a write body
- `escapeStorageHtml(value)` - Escape storage XHTML text

## Notes

- Create and update page bodies use Confluence storage-format XHTML by default.
- `markdownToStorage` supports headings, paragraphs, horizontal rules, bullet/numbered/nested lists, task lists, blockquotes, pipe tables, fenced code blocks with optional language, standalone external images, and inline bold/italic/code/link/strikethrough.
- Use explicit storage XHTML for advanced Confluence macros, layouts, attachments, mentions, and other rich editor features.
- Page updates require an incremented version number. The wrapper handles this automatically unless you pass `versionNumber`.

## License

MIT
