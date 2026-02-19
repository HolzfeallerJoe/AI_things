# Figma API Wrapper

A type-safe TypeScript wrapper for the Figma REST API.

## Installation

```bash
npm install
npm run build
```

## Configuration

Create a `.env` file with your Figma credentials:

```env
FIGMA_ACCESS_TOKEN=your-personal-access-token
```

Get your personal access token from: https://www.figma.com/developers/api#access-tokens

## Quick Start

**Important**: Always wrap code in an async function - top-level await is not supported.

```typescript
import { config } from 'dotenv';
import { FigmaClient } from './src/index.js';

config({ path: 'C:/Users/Dominik/Projects/Private/AI_things/wrapper/Figma/.env' });

async function main() {
  const figma = new FigmaClient({
    accessToken: process.env.FIGMA_ACCESS_TOKEN!,
  });

  const me = await figma.getCurrentUser();
  console.log(`Logged in as: ${me.handle}`);
}

main();
```

Run with:
```bash
npx tsx your-script.ts
```

## Usage Examples

### Working with Files

```typescript
// Get a file
const file = await figma.getFile('ABC123fileKey');

// Get specific nodes from a file
const nodes = await figma.getFileNodes('ABC123fileKey', ['1:2', '1:3']);

// Get file metadata
const meta = await figma.getFileMeta('ABC123fileKey');

// Get file versions
const versions = await figma.getFileVersions('ABC123fileKey');
```

### Extracting Images

```typescript
// Render nodes as images
const images = await figma.getImage('ABC123fileKey', {
  ids: ['1:2', '1:3'],
  format: 'png',
  scale: 2,
});

console.log(images.images); // { "1:2": "https://...", "1:3": "https://..." }

// Get image fill URLs
const fills = await figma.getImageFills('ABC123fileKey');
```

### Working with Comments

```typescript
// Get comments on a file
const comments = await figma.getComments('ABC123fileKey');

// Post a comment
const comment = await figma.postComment('ABC123fileKey', {
  message: 'Great work!',
  client_meta: { node_id: '1:2' }, // Optional: attach to a node
});

// Delete a comment
await figma.deleteComment('ABC123fileKey', 'commentId');

// React to a comment
await figma.postCommentReaction('ABC123fileKey', 'commentId', '👍');
```

### Working with Components

```typescript
// Get a component by key
const component = await figma.getComponent('componentKey');

// Get components from a file
const fileComponents = await figma.getFileComponents('ABC123fileKey');

// Get team components
const teamComponents = await figma.getTeamComponents('teamId');

// Get component sets
const componentSets = await figma.getFileComponentSets('ABC123fileKey');
```

### Working with Styles

```typescript
// Get a style by key
const style = await figma.getStyle('styleKey');

// Get styles from a file
const fileStyles = await figma.getFileStyles('ABC123fileKey');

// Get team styles
const teamStyles = await figma.getTeamStyles('teamId');
```

### Working with Projects

```typescript
// Get team projects
const projects = await figma.getTeamProjects('teamId');

// Get files in a project
const files = await figma.getProjectFiles('projectId');
```

### Working with Webhooks

```typescript
// Create a webhook
const webhook = await figma.createWebhook({
  event_type: 'FILE_UPDATE',
  team_id: 'teamId',
  endpoint: 'https://your-server.com/webhook',
  passcode: 'your-secret-passcode',
});

// Get webhooks
const webhooks = await figma.getWebhooks({ team_id: 'teamId' });

// Update a webhook
await figma.updateWebhook('webhookId', {
  status: 'PAUSED',
});

// Delete a webhook
await figma.deleteWebhook('webhookId');
```

### Working with Variables

```typescript
// Get local variables
const localVars = await figma.getLocalVariables('ABC123fileKey');

// Get published variables
const publishedVars = await figma.getPublishedVariables('ABC123fileKey');
```

### Working with Dev Resources

```typescript
// Get dev resources for a file
const resources = await figma.getDevResources('ABC123fileKey');

// Create a dev resource
const resource = await figma.createDevResource({
  name: 'Storybook',
  url: 'https://storybook.example.com/component',
  file_key: 'ABC123fileKey',
  node_id: '1:2',
});

// Update a dev resource
await figma.updateDevResource('resourceId', {
  url: 'https://new-url.com',
});

// Delete a dev resource
await figma.deleteDevResource('resourceId');
```

### URL Helpers

```typescript
import { extractFileKey, extractNodeId, buildFileUrl } from './src/index.js';

// Extract file key from URL
const fileKey = extractFileKey('https://www.figma.com/file/ABC123/MyFile');
// Returns: 'ABC123'

// Extract node ID from URL
const nodeId = extractNodeId('https://www.figma.com/file/ABC123/MyFile?node-id=1-2');
// Returns: '1:2'

// Build a Figma URL
const url = buildFileUrl('ABC123', '1:2');
// Returns: 'https://www.figma.com/file/ABC123?node-id=1-2'

// Also available as static methods on FigmaClient
const key = FigmaClient.extractFileKey(url);
```

### Color Helpers

```typescript
import { colorToHex, colorToRgba, hexToColor } from './src/index.js';

// Convert Figma color to hex
const hex = colorToHex({ r: 1, g: 0.5, b: 0, a: 1 });
// Returns: '#ff8000'

// Convert Figma color to rgba
const rgba = colorToRgba({ r: 1, g: 0.5, b: 0, a: 0.8 });
// Returns: 'rgba(255, 128, 0, 0.8)'

// Convert hex to Figma color
const color = hexToColor('#ff8000');
// Returns: { r: 1, g: 0.5, b: 0, a: 1 }
```

### Node Tree Helpers

```typescript
import {
  flattenNodes,
  findNodesByType,
  findNodeById,
  findNodesByName,
  isTextNode,
} from './src/index.js';

// Get file and flatten all nodes
const file = await figma.getFile('ABC123fileKey');
const allNodes = flattenNodes(file.document.children[0]); // First page

// Find all text nodes
const textNodes = findNodesByType(file.document.children[0], 'TEXT');

// Find a specific node by ID
const node = findNodeById(file.document.children[0], '1:2');

// Find nodes by name
const buttons = findNodesByName(file.document.children[0], 'Button');

// Type guard
if (isTextNode(node)) {
  console.log(node.characters);
}
```

### Error Handling

```typescript
import { FigmaApiError } from './src/index.js';

try {
  await figma.getFile('invalid-key');
} catch (error) {
  if (error instanceof FigmaApiError) {
    console.error(`Figma API Error (${error.status}): ${error.message}`);
  }
}
```

## API Reference

### FigmaClient Methods

#### User
- `getCurrentUser()` - Get authenticated user

#### Files
- `getFile(fileKey, params?)` - Get a file
- `getFileNodes(fileKey, ids, params?)` - Get specific nodes
- `getFileMeta(fileKey)` - Get file metadata
- `getFileVersions(fileKey, params?)` - Get file versions

#### Images
- `getImage(fileKey, params)` - Render images from nodes
- `getImageFills(fileKey)` - Get image fill URLs

#### Comments
- `getComments(fileKey, params?)` - Get comments
- `postComment(fileKey, params)` - Post a comment
- `deleteComment(fileKey, commentId)` - Delete a comment
- `getCommentReactions(fileKey, commentId)` - Get reactions
- `postCommentReaction(fileKey, commentId, emoji)` - Add reaction
- `deleteCommentReaction(fileKey, commentId, emoji)` - Remove reaction

#### Components
- `getComponent(componentKey)` - Get component by key
- `getFileComponents(fileKey, params?)` - Get file components
- `getTeamComponents(teamId, params?)` - Get team components
- `getComponentSet(componentSetKey)` - Get component set
- `getFileComponentSets(fileKey, params?)` - Get file component sets
- `getTeamComponentSets(teamId, params?)` - Get team component sets

#### Styles
- `getStyle(styleKey)` - Get style by key
- `getFileStyles(fileKey, params?)` - Get file styles
- `getTeamStyles(teamId, params?)` - Get team styles

#### Projects
- `getTeamProjects(teamId)` - Get team projects
- `getProjectFiles(projectId, params?)` - Get project files

#### Webhooks
- `createWebhook(params)` - Create a webhook
- `getWebhook(webhookId)` - Get a webhook
- `getWebhooks(params?)` - List webhooks
- `updateWebhook(webhookId, params)` - Update a webhook
- `deleteWebhook(webhookId)` - Delete a webhook
- `getWebhookRequests(webhookId)` - Get webhook requests

#### Variables
- `getLocalVariables(fileKey)` - Get local variables
- `getPublishedVariables(fileKey)` - Get published variables

#### Dev Resources
- `getDevResources(fileKey, params?)` - Get dev resources
- `createDevResource(params)` - Create dev resource
- `updateDevResource(id, params)` - Update dev resource
- `deleteDevResource(id)` - Delete dev resource

#### Activity
- `getActivityLogs(params)` - Get activity logs

#### Static Methods
- `FigmaClient.extractFileKey(url)` - Extract file key from URL
- `FigmaClient.extractNodeId(url)` - Extract node ID from URL
- `FigmaClient.buildFileUrl(fileKey, nodeId?)` - Build file URL

## Troubleshooting

### "Top-level await is currently not supported"
Always wrap your code in an async function:
```typescript
async function main() {
  // your code here
}
main();
```

### Authentication errors
Verify your `.env` file has the correct token. Generate one at:
https://www.figma.com/developers/api#access-tokens

### Rate limiting
Figma has rate limits. Use the `retryWithBackoff` helper for automatic retries.

## License

MIT
