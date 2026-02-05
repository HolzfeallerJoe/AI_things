export class FigmaApiError extends Error {
    status;
    errorResponse;
    constructor(message, status, errorResponse) {
        super(message);
        this.status = status;
        this.errorResponse = errorResponse;
        this.name = 'FigmaApiError';
    }
}
export class FigmaClient {
    baseUrl;
    accessToken;
    constructor(config) {
        this.accessToken = config.accessToken;
        this.baseUrl = config.baseUrl || 'https://api.figma.com';
    }
    async request(method, path, body, params) {
        let url = `${this.baseUrl}${path}`;
        if (params) {
            const filteredParams = {};
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined) {
                    if (Array.isArray(value)) {
                        filteredParams[key] = value.join(',');
                    }
                    else {
                        filteredParams[key] = String(value);
                    }
                }
            }
            if (Object.keys(filteredParams).length > 0) {
                url += '?' + new URLSearchParams(filteredParams).toString();
            }
        }
        const headers = {
            'X-Figma-Token': this.accessToken,
        };
        if (body) {
            headers['Content-Type'] = 'application/json';
        }
        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            let errorResponse;
            try {
                errorResponse = (await response.json());
            }
            catch {
                // Ignore JSON parsing errors
            }
            throw new FigmaApiError(errorResponse?.err || errorResponse?.message || `HTTP ${response.status}`, response.status, errorResponse);
        }
        // Handle 204 No Content
        if (response.status === 204) {
            return undefined;
        }
        return (await response.json());
    }
    get(path, params) {
        return this.request('GET', path, undefined, params);
    }
    post(path, body) {
        return this.request('POST', path, body);
    }
    put(path, body) {
        return this.request('PUT', path, body);
    }
    delete(path) {
        return this.request('DELETE', path);
    }
    // ==========================================================================
    // User Methods
    // ==========================================================================
    /**
     * Get the current user
     */
    async getCurrentUser() {
        return this.get('/v1/me');
    }
    // ==========================================================================
    // File Methods
    // ==========================================================================
    /**
     * Get a file
     */
    async getFile(fileKey, params) {
        return this.get(`/v1/files/${fileKey}`, params);
    }
    /**
     * Get specific nodes from a file
     */
    async getFileNodes(fileKey, ids, params) {
        return this.get(`/v1/files/${fileKey}/nodes`, { ids, ...params });
    }
    /**
     * Get file metadata
     */
    async getFileMeta(fileKey) {
        return this.get(`/v1/files/${fileKey}/meta`);
    }
    /**
     * Get file versions
     */
    async getFileVersions(fileKey, params) {
        return this.get(`/v1/files/${fileKey}/versions`, params);
    }
    // ==========================================================================
    // Image Methods
    // ==========================================================================
    /**
     * Render images from a file
     */
    async getImage(fileKey, params) {
        return this.get(`/v1/images/${fileKey}`, params);
    }
    /**
     * Get image fill URLs
     */
    async getImageFills(fileKey) {
        return this.get(`/v1/files/${fileKey}/images`);
    }
    // ==========================================================================
    // Comment Methods
    // ==========================================================================
    /**
     * Get comments on a file
     */
    async getComments(fileKey, params) {
        return this.get(`/v1/files/${fileKey}/comments`, params);
    }
    /**
     * Post a comment on a file
     */
    async postComment(fileKey, params) {
        return this.post(`/v1/files/${fileKey}/comments`, params);
    }
    /**
     * Delete a comment
     */
    async deleteComment(fileKey, commentId) {
        return this.delete(`/v1/files/${fileKey}/comments/${commentId}`);
    }
    /**
     * Get reactions on a comment
     */
    async getCommentReactions(fileKey, commentId, params) {
        return this.get(`/v1/files/${fileKey}/comments/${commentId}/reactions`, params);
    }
    /**
     * Post a reaction to a comment
     */
    async postCommentReaction(fileKey, commentId, emoji) {
        return this.post(`/v1/files/${fileKey}/comments/${commentId}/reactions`, { emoji });
    }
    /**
     * Delete a reaction from a comment
     */
    async deleteCommentReaction(fileKey, commentId, emoji) {
        return this.delete(`/v1/files/${fileKey}/comments/${commentId}/reactions?emoji=${encodeURIComponent(emoji)}`);
    }
    // ==========================================================================
    // Component Methods
    // ==========================================================================
    /**
     * Get a component by key
     */
    async getComponent(componentKey) {
        return this.get(`/v1/components/${componentKey}`);
    }
    /**
     * Get components from a file
     */
    async getFileComponents(fileKey, params) {
        return this.get(`/v1/files/${fileKey}/components`, params);
    }
    /**
     * Get team components
     */
    async getTeamComponents(teamId, params) {
        return this.get(`/v1/teams/${teamId}/components`, params);
    }
    /**
     * Get a component set by key
     */
    async getComponentSet(componentSetKey) {
        return this.get(`/v1/component_sets/${componentSetKey}`);
    }
    /**
     * Get component sets from a file
     */
    async getFileComponentSets(fileKey, params) {
        return this.get(`/v1/files/${fileKey}/component_sets`, params);
    }
    /**
     * Get team component sets
     */
    async getTeamComponentSets(teamId, params) {
        return this.get(`/v1/teams/${teamId}/component_sets`, params);
    }
    // ==========================================================================
    // Style Methods
    // ==========================================================================
    /**
     * Get a style by key
     */
    async getStyle(styleKey) {
        return this.get(`/v1/styles/${styleKey}`);
    }
    /**
     * Get styles from a file
     */
    async getFileStyles(fileKey, params) {
        return this.get(`/v1/files/${fileKey}/styles`, params);
    }
    /**
     * Get team styles
     */
    async getTeamStyles(teamId, params) {
        return this.get(`/v1/teams/${teamId}/styles`, params);
    }
    // ==========================================================================
    // Project Methods
    // ==========================================================================
    /**
     * Get team projects
     */
    async getTeamProjects(teamId) {
        return this.get(`/v1/teams/${teamId}/projects`);
    }
    /**
     * Get project files
     */
    async getProjectFiles(projectId, params) {
        return this.get(`/v1/projects/${projectId}/files`, params);
    }
    // ==========================================================================
    // Webhook Methods (v2)
    // ==========================================================================
    /**
     * Create a webhook
     */
    async createWebhook(params) {
        return this.post('/v2/webhooks', params);
    }
    /**
     * Get a webhook
     */
    async getWebhook(webhookId) {
        return this.get(`/v2/webhooks/${webhookId}`);
    }
    /**
     * Get webhooks
     */
    async getWebhooks(params) {
        return this.get('/v2/webhooks', params);
    }
    /**
     * Update a webhook
     */
    async updateWebhook(webhookId, params) {
        return this.put(`/v2/webhooks/${webhookId}`, params);
    }
    /**
     * Delete a webhook
     */
    async deleteWebhook(webhookId) {
        return this.delete(`/v2/webhooks/${webhookId}`);
    }
    /**
     * Get webhook requests (for debugging)
     */
    async getWebhookRequests(webhookId) {
        return this.get(`/v2/webhooks/${webhookId}/requests`);
    }
    // ==========================================================================
    // Variable Methods
    // ==========================================================================
    /**
     * Get local variables in a file
     */
    async getLocalVariables(fileKey) {
        return this.get(`/v1/files/${fileKey}/variables/local`);
    }
    /**
     * Get published variables in a file
     */
    async getPublishedVariables(fileKey) {
        return this.get(`/v1/files/${fileKey}/variables/published`);
    }
    // ==========================================================================
    // Dev Resources Methods
    // ==========================================================================
    /**
     * Get dev resources for a file
     */
    async getDevResources(fileKey, params) {
        return this.get(`/v1/files/${fileKey}/dev_resources`, params);
    }
    /**
     * Create a dev resource
     */
    async createDevResource(params) {
        return this.post('/v1/dev_resources', params);
    }
    /**
     * Update a dev resource
     */
    async updateDevResource(devResourceId, params) {
        return this.put(`/v1/dev_resources/${devResourceId}`, params);
    }
    /**
     * Delete a dev resource
     */
    async deleteDevResource(devResourceId) {
        return this.delete(`/v1/dev_resources/${devResourceId}`);
    }
    // ==========================================================================
    // Activity Log Methods
    // ==========================================================================
    /**
     * Get activity logs for a team
     */
    async getActivityLogs(params) {
        return this.get('/v1/activity_logs', params);
    }
    // ==========================================================================
    // Helper Methods
    // ==========================================================================
    /**
     * Extract file key from Figma URL
     */
    static extractFileKey(url) {
        // Matches URLs like:
        // https://www.figma.com/file/ABC123/FileName
        // https://www.figma.com/design/ABC123/FileName
        // https://figma.com/file/ABC123/FileName
        const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
        if (!match) {
            throw new Error(`Invalid Figma URL: ${url}`);
        }
        return match[1];
    }
    /**
     * Extract node ID from Figma URL
     */
    static extractNodeId(url) {
        // Matches ?node-id=123-456 or ?node-id=123:456
        const match = url.match(/node-id=([0-9]+[-:][0-9]+)/);
        return match ? match[1].replace('-', ':') : null;
    }
    /**
     * Build a Figma file URL
     */
    static buildFileUrl(fileKey, nodeId) {
        let url = `https://www.figma.com/file/${fileKey}`;
        if (nodeId) {
            url += `?node-id=${nodeId.replace(':', '-')}`;
        }
        return url;
    }
}
//# sourceMappingURL=client.js.map