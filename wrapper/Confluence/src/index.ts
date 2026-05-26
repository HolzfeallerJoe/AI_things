// Main exports
export { ConfluenceClient, ConfluenceApiError } from './client.js';

// Type exports
export * from './types.js';

// Helper exports
export {
  escapeStorageHtml,
  inlineMarkdownToStorage,
  markdownToStorage,
  storageBody,
  textToStorage,
} from './helpers.js';
