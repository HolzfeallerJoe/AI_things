---
name: figma
description: Use this skill whenever the user asks to interact with Figma - fetching files, exporting images, managing comments, working with components, styles, variables, or any other Figma operations. Provides a type-safe TypeScript wrapper for the Figma REST API.
---

When working with Figma, use the TypeScript wrapper located at `C:\Users\Dominik\Projects\wrapper\Figma`.

## Setup

The wrapper requires environment variables from `C:\Users\Dominik\Projects\wrapper\Figma\.env`:
- `FIGMA_ACCESS_TOKEN` - Personal Access Token from https://www.figma.com/developers/api#access-tokens
- `FIGMA_TEAM_ID` - Team ID (for listing projects, components, styles)
- `FIGMA_USER_ID` - User ID

## Code Pattern

**IMPORTANT**: Always wrap code in an async function - top-level await is not supported with tsx/cjs.

```typescript
import { config } from 'dotenv';
import { FigmaClient, extractFileKey } from 'C:/Users/Dominik/Projects/wrapper/Figma/src/index.js';

config({ path: 'C:/Users/Dominik/Projects/wrapper/Figma/.env' });

async function main() {
  const figma = new FigmaClient({
    accessToken: process.env.FIGMA_ACCESS_TOKEN!,
  });

  // Your Figma operations here...
}

main();
```

## Running Scripts

To execute Figma scripts, write a `.ts` file in the wrapper directory and run with tsx:

```bash
cd C:\Users\Dominik\Projects\wrapper\Figma
npx tsx your-script.ts
```

## Available Methods

### User
- `figma.getCurrentUser()` - Get authenticated user

### Files
- `figma.getFile(fileKey, params?)` - Get a file's content
- `figma.getFileNodes(fileKey, ids, params?)` - Get specific nodes
- `figma.getFileMeta(fileKey)` - Get file metadata
- `figma.getFileVersions(fileKey)` - Get version history

### Images
- `figma.getImage(fileKey, { ids, format, scale })` - Export images
- `figma.getImageFills(fileKey)` - Get image fill URLs

### Comments
- `figma.getComments(fileKey)` - Get comments
- `figma.postComment(fileKey, { message, client_meta? })` - Post comment
- `figma.deleteComment(fileKey, commentId)` - Delete comment

### Components & Styles
- `figma.getComponent(key)` - Get component by key
- `figma.getFileComponents(fileKey)` - Get file components
- `figma.getTeamComponents(teamId)` - Get team components
- `figma.getStyle(key)` - Get style by key
- `figma.getFileStyles(fileKey)` - Get file styles

### Projects
- `figma.getTeamProjects(teamId)` - Get team projects
- `figma.getProjectFiles(projectId)` - Get project files

### Webhooks
- `figma.createWebhook(params)` - Create webhook
- `figma.getWebhooks({ team_id })` - List webhooks
- `figma.deleteWebhook(webhookId)` - Delete webhook

### Variables
- `figma.getLocalVariables(fileKey)` - Get local variables
- `figma.getPublishedVariables(fileKey)` - Get published variables

## Helper Functions

```typescript
import {
  extractFileKey,
  extractNodeId,
  buildFileUrl,
  colorToHex,
  colorToRgba,
  findNodesByType,
  flattenNodes,
} from 'C:/Users/Dominik/Projects/wrapper/Figma/src/index.js';

// Extract file key from URL
const fileKey = extractFileKey('https://www.figma.com/file/ABC123/MyFile');

// Build URL from key
const url = buildFileUrl('ABC123', '1:2');

// Convert colors
const hex = colorToHex({ r: 1, g: 0.5, b: 0, a: 1 }); // '#ff8000'
```

## Examples

### Get file and list pages
```typescript
async function main() {
  const figma = new FigmaClient({...});

  const file = await figma.getFile('ABC123fileKey');
  console.log(`File: ${file.name}`);

  for (const page of file.document.children) {
    console.log(`Page: ${page.name}`);
  }
}
main();
```

### Export a node as PNG
```typescript
const images = await figma.getImage('fileKey', {
  ids: ['1:2'],
  format: 'png',
  scale: 2,
});
console.log(images.images['1:2']); // URL to PNG
```

### Get components from a file
```typescript
const components = await figma.getFileComponents('fileKey');
for (const comp of components.meta.components) {
  console.log(`${comp.name}: ${comp.key}`);
}
```

## Important Notes

- **Always wrap in async function** - No top-level await support
- **Always load `.env`** with the correct path using `config({ path: '...' })`
- **Use file keys, not URLs** - Extract with `extractFileKey(url)`
- Node IDs use `:` format (e.g., `1:2`) but URLs use `-` format (e.g., `1-2`)
- Rate limits apply - use `retryWithBackoff()` for automatic retries
- Clean up temporary scripts after use

## Troubleshooting

### "Top-level await is currently not supported"
Wrap code in an async function:
```typescript
async function main() { ... }
main();
```

### 403 Forbidden
Token is invalid or lacks permissions. Create a new one at https://www.figma.com/developers/api#access-tokens

### 404 Not Found
File key may be wrong or you don't have access to the file.
