/**
 * Convert Figma color (0-1 range) to hex string
 */
export function colorToHex(color) {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
/**
 * Convert Figma color to rgba string
 */
export function colorToRgba(color) {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return `rgba(${r}, ${g}, ${b}, ${color.a})`;
}
/**
 * Convert hex string to Figma color
 */
export function hexToColor(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
        throw new Error(`Invalid hex color: ${hex}`);
    }
    return {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
        a: 1,
    };
}
/**
 * Extract file key from a Figma URL
 */
export function extractFileKey(url) {
    const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
    if (!match) {
        throw new Error(`Invalid Figma URL: ${url}`);
    }
    return match[1];
}
/**
 * Extract node ID from a Figma URL
 */
export function extractNodeId(url) {
    const match = url.match(/node-id=([0-9]+[-:][0-9]+)/);
    return match ? match[1].replace('-', ':') : null;
}
/**
 * Build a Figma file URL
 */
export function buildFileUrl(fileKey, nodeId) {
    let url = `https://www.figma.com/file/${fileKey}`;
    if (nodeId) {
        url += `?node-id=${nodeId.replace(':', '-')}`;
    }
    return url;
}
/**
 * Build a Figma design URL (new format)
 */
export function buildDesignUrl(fileKey, fileName, nodeId) {
    let url = `https://www.figma.com/design/${fileKey}`;
    if (fileName) {
        url += `/${encodeURIComponent(fileName)}`;
    }
    if (nodeId) {
        url += `?node-id=${nodeId.replace(':', '-')}`;
    }
    return url;
}
/**
 * Convert Figma node ID format (e.g., "1:2") to URL format (e.g., "1-2")
 */
export function nodeIdToUrlFormat(nodeId) {
    return nodeId.replace(':', '-');
}
/**
 * Convert URL node ID format (e.g., "1-2") to Figma format (e.g., "1:2")
 */
export function urlFormatToNodeId(urlNodeId) {
    return urlNodeId.replace('-', ':');
}
/**
 * Check if a node is a frame-like node (FRAME, GROUP, COMPONENT, etc.)
 */
export function isFrameLike(node) {
    return ['FRAME', 'GROUP', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE'].includes(node.type);
}
/**
 * Check if a node is a text node
 */
export function isTextNode(node) {
    return node.type === 'TEXT';
}
/**
 * Check if a node is a component
 */
export function isComponent(node) {
    return node.type === 'COMPONENT';
}
/**
 * Check if a node is an instance
 */
export function isInstance(node) {
    return node.type === 'INSTANCE';
}
/**
 * Flatten a node tree into an array
 */
export function flattenNodes(node) {
    const nodes = [node];
    if ('children' in node && node.children) {
        for (const child of node.children) {
            nodes.push(...flattenNodes(child));
        }
    }
    return nodes;
}
/**
 * Find nodes by type in a tree
 */
export function findNodesByType(node, type) {
    const nodes = [];
    if (node.type === type) {
        nodes.push(node);
    }
    if ('children' in node && node.children) {
        for (const child of node.children) {
            nodes.push(...findNodesByType(child, type));
        }
    }
    return nodes;
}
/**
 * Find a node by ID in a tree
 */
export function findNodeById(node, id) {
    if (node.id === id) {
        return node;
    }
    if ('children' in node && node.children) {
        for (const child of node.children) {
            const found = findNodeById(child, id);
            if (found) {
                return found;
            }
        }
    }
    return null;
}
/**
 * Find nodes by name in a tree
 */
export function findNodesByName(node, name) {
    const nodes = [];
    if (node.name === name) {
        nodes.push(node);
    }
    if ('children' in node && node.children) {
        for (const child of node.children) {
            nodes.push(...findNodesByName(child, name));
        }
    }
    return nodes;
}
/**
 * Find nodes matching a predicate
 */
export function findNodes(node, predicate) {
    const nodes = [];
    if (predicate(node)) {
        nodes.push(node);
    }
    if ('children' in node && node.children) {
        for (const child of node.children) {
            nodes.push(...findNodes(child, predicate));
        }
    }
    return nodes;
}
/**
 * Get the absolute position of a node
 */
export function getAbsolutePosition(node) {
    if ('absoluteBoundingBox' in node && node.absoluteBoundingBox) {
        return {
            x: node.absoluteBoundingBox.x,
            y: node.absoluteBoundingBox.y,
        };
    }
    return null;
}
/**
 * Get the size of a node
 */
export function getNodeSize(node) {
    if ('absoluteBoundingBox' in node && node.absoluteBoundingBox) {
        return {
            width: node.absoluteBoundingBox.width,
            height: node.absoluteBoundingBox.height,
        };
    }
    if ('size' in node && node.size) {
        return {
            width: node.size.x,
            height: node.size.y,
        };
    }
    return null;
}
/**
 * Calculate the depth of a node in the tree
 */
export function calculateNodeDepth(nodeId, nodes) {
    let depth = 0;
    let currentId = nodeId;
    while (currentId) {
        const node = nodes.get(currentId);
        if (!node?.parentId)
            break;
        currentId = node.parentId;
        depth++;
    }
    return depth;
}
/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
/**
 * Generate a unique ID
 */
export function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Sleep for a specified duration (useful for rate limiting)
 */
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, i);
                await sleep(delay);
            }
        }
    }
    throw lastError;
}
//# sourceMappingURL=helpers.js.map