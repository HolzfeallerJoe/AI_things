// Main exports
export { FigmaClient, FigmaApiError } from './client.js';
export type { FigmaClientConfig } from './client.js';

// Helper exports
export {
  colorToHex,
  colorToRgba,
  hexToColor,
  extractFileKey,
  extractNodeId,
  buildFileUrl,
  buildDesignUrl,
  nodeIdToUrlFormat,
  urlFormatToNodeId,
  isFrameLike,
  isTextNode,
  isComponent,
  isInstance,
  flattenNodes,
  findNodesByType,
  findNodeById,
  findNodesByName,
  findNodes,
  getAbsolutePosition,
  getNodeSize,
  calculateNodeDepth,
  formatBytes,
  generateId,
  sleep,
  retryWithBackoff,
} from './helpers.js';

// Type exports
export * from './types.js';
