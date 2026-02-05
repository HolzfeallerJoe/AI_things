import { Color, SceneNode, FrameNode, TextNode, ComponentNode, InstanceNode } from './types.js';
/**
 * Convert Figma color (0-1 range) to hex string
 */
export declare function colorToHex(color: Color): string;
/**
 * Convert Figma color to rgba string
 */
export declare function colorToRgba(color: Color): string;
/**
 * Convert hex string to Figma color
 */
export declare function hexToColor(hex: string): Color;
/**
 * Extract file key from a Figma URL
 */
export declare function extractFileKey(url: string): string;
/**
 * Extract node ID from a Figma URL
 */
export declare function extractNodeId(url: string): string | null;
/**
 * Build a Figma file URL
 */
export declare function buildFileUrl(fileKey: string, nodeId?: string): string;
/**
 * Build a Figma design URL (new format)
 */
export declare function buildDesignUrl(fileKey: string, fileName?: string, nodeId?: string): string;
/**
 * Convert Figma node ID format (e.g., "1:2") to URL format (e.g., "1-2")
 */
export declare function nodeIdToUrlFormat(nodeId: string): string;
/**
 * Convert URL node ID format (e.g., "1-2") to Figma format (e.g., "1:2")
 */
export declare function urlFormatToNodeId(urlNodeId: string): string;
/**
 * Check if a node is a frame-like node (FRAME, GROUP, COMPONENT, etc.)
 */
export declare function isFrameLike(node: SceneNode): node is FrameNode;
/**
 * Check if a node is a text node
 */
export declare function isTextNode(node: SceneNode): node is TextNode;
/**
 * Check if a node is a component
 */
export declare function isComponent(node: SceneNode): node is ComponentNode;
/**
 * Check if a node is an instance
 */
export declare function isInstance(node: SceneNode): node is InstanceNode;
/**
 * Flatten a node tree into an array
 */
export declare function flattenNodes(node: SceneNode): SceneNode[];
/**
 * Find nodes by type in a tree
 */
export declare function findNodesByType<T extends SceneNode>(node: SceneNode, type: T['type']): T[];
/**
 * Find a node by ID in a tree
 */
export declare function findNodeById(node: SceneNode, id: string): SceneNode | null;
/**
 * Find nodes by name in a tree
 */
export declare function findNodesByName(node: SceneNode, name: string): SceneNode[];
/**
 * Find nodes matching a predicate
 */
export declare function findNodes(node: SceneNode, predicate: (node: SceneNode) => boolean): SceneNode[];
/**
 * Get the absolute position of a node
 */
export declare function getAbsolutePosition(node: SceneNode): {
    x: number;
    y: number;
} | null;
/**
 * Get the size of a node
 */
export declare function getNodeSize(node: SceneNode): {
    width: number;
    height: number;
} | null;
/**
 * Calculate the depth of a node in the tree
 */
export declare function calculateNodeDepth(nodeId: string, nodes: Map<string, {
    parentId?: string;
}>): number;
/**
 * Format bytes to human readable string
 */
export declare function formatBytes(bytes: number): string;
/**
 * Generate a unique ID
 */
export declare function generateId(): string;
/**
 * Sleep for a specified duration (useful for rate limiting)
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Retry a function with exponential backoff
 */
export declare function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries?: number, baseDelay?: number): Promise<T>;
//# sourceMappingURL=helpers.d.ts.map