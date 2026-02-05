"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraClient = exports.JiraApiError = void 0;
/**
 * Custom error class for Jira API errors
 */
class JiraApiError extends Error {
    status;
    errorResponse;
    constructor(message, status, errorResponse) {
        super(message);
        this.status = status;
        this.errorResponse = errorResponse;
        this.name = 'JiraApiError';
    }
}
exports.JiraApiError = JiraApiError;
/**
 * Type-safe Jira REST API v3 Client
 */
class JiraClient {
    baseUrl;
    agileBaseUrl;
    authHeader;
    constructor(config) {
        this.baseUrl = `https://${config.domain}/rest/api/3`;
        this.agileBaseUrl = `https://${config.domain}/rest/agile/1.0`;
        this.authHeader = `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`;
    }
    // ============================================================================
    // HTTP Methods
    // ============================================================================
    async request(method, path, options = {}) {
        const baseUrl = options.isAgile ? this.agileBaseUrl : this.baseUrl;
        const url = new URL(`${baseUrl}${path}`);
        if (options.query) {
            for (const [key, value] of Object.entries(options.query)) {
                if (value !== undefined && value !== null) {
                    if (Array.isArray(value)) {
                        url.searchParams.set(key, value.join(','));
                    }
                    else {
                        url.searchParams.set(key, String(value));
                    }
                }
            }
        }
        const headers = {
            Authorization: this.authHeader,
            Accept: 'application/json',
        };
        if (options.body) {
            headers['Content-Type'] = 'application/json';
        }
        const response = await fetch(url.toString(), {
            method,
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
        if (!response.ok) {
            let errorResponse;
            try {
                errorResponse = (await response.json());
            }
            catch {
                // Response may not be JSON
            }
            const message = errorResponse?.errorMessages?.join(', ') ||
                `Jira API error: ${response.status} ${response.statusText}`;
            throw new JiraApiError(message, response.status, errorResponse);
        }
        // Handle 204 No Content
        if (response.status === 204) {
            return undefined;
        }
        return response.json();
    }
    get(path, query) {
        return this.request('GET', path, { query });
    }
    post(path, body, query) {
        return this.request('POST', path, { body, query });
    }
    put(path, body, query) {
        return this.request('PUT', path, { body, query });
    }
    delete(path, query) {
        return this.request('DELETE', path, { query });
    }
    // ============================================================================
    // Issues
    // ============================================================================
    /**
     * Get a single issue by ID or key
     */
    async getIssue(issueIdOrKey, params) {
        return this.get(`/issue/${issueIdOrKey}`, {
            fields: params?.fields,
            expand: params?.expand,
            properties: params?.properties,
            fieldsByKeys: params?.fieldsByKeys,
            updateHistory: params?.updateHistory,
        });
    }
    /**
     * Create a new issue
     */
    async createIssue(params) {
        return this.post('/issue', params);
    }
    /**
     * Create multiple issues in bulk
     */
    async createIssuesBulk(params) {
        return this.post('/issue/bulk', params);
    }
    /**
     * Update an existing issue
     */
    async updateIssue(issueIdOrKey, params) {
        return this.put(`/issue/${issueIdOrKey}`, params);
    }
    /**
     * Delete an issue
     */
    async deleteIssue(issueIdOrKey, deleteSubtasks = false) {
        return this.delete(`/issue/${issueIdOrKey}`, { deleteSubtasks });
    }
    /**
     * Search for issues using JQL
     */
    async searchIssues(params) {
        return this.post('/search', {
            jql: params.jql,
            startAt: params.startAt,
            maxResults: params.maxResults,
            fields: params.fields,
            expand: params.expand,
            properties: params.properties,
            fieldsByKeys: params.fieldsByKeys,
            validateQuery: params.validateQuery,
        });
    }
    /**
     * Get issue changelog
     */
    async getIssueChangelog(issueIdOrKey, params) {
        return this.get(`/issue/${issueIdOrKey}/changelog`, {
            startAt: params?.startAt,
            maxResults: params?.maxResults,
        });
    }
    // ============================================================================
    // Transitions
    // ============================================================================
    /**
     * Get available transitions for an issue
     */
    async getTransitions(issueIdOrKey) {
        return this.get(`/issue/${issueIdOrKey}/transitions`);
    }
    /**
     * Transition an issue to a new status
     */
    async transitionIssue(issueIdOrKey, params) {
        return this.post(`/issue/${issueIdOrKey}/transitions`, params);
    }
    /**
     * Bulk transition multiple issues
     */
    async bulkTransitionIssues(params) {
        return this.post('/issue/bulk/transition', params);
    }
    // ============================================================================
    // Comments
    // ============================================================================
    /**
     * Get all comments for an issue
     */
    async getComments(issueIdOrKey, params) {
        return this.get(`/issue/${issueIdOrKey}/comment`, {
            startAt: params?.startAt,
            maxResults: params?.maxResults,
            orderBy: params?.orderBy,
            expand: params?.expand,
        });
    }
    /**
     * Get a single comment
     */
    async getComment(issueIdOrKey, commentId) {
        return this.get(`/issue/${issueIdOrKey}/comment/${commentId}`);
    }
    /**
     * Add a comment to an issue
     */
    async addComment(issueIdOrKey, params) {
        return this.post(`/issue/${issueIdOrKey}/comment`, params);
    }
    /**
     * Update a comment
     */
    async updateComment(issueIdOrKey, commentId, params) {
        return this.put(`/issue/${issueIdOrKey}/comment/${commentId}`, params);
    }
    /**
     * Delete a comment
     */
    async deleteComment(issueIdOrKey, commentId) {
        return this.delete(`/issue/${issueIdOrKey}/comment/${commentId}`);
    }
    // ============================================================================
    // Attachments
    // ============================================================================
    /**
     * Get attachment metadata
     */
    async getAttachment(attachmentId) {
        return this.get(`/attachment/${attachmentId}`);
    }
    /**
     * Delete an attachment
     */
    async deleteAttachment(attachmentId) {
        return this.delete(`/attachment/${attachmentId}`);
    }
    /**
     * Upload an attachment to an issue
     * Note: This requires multipart/form-data which needs special handling
     */
    async uploadAttachment(issueIdOrKey, file, filename) {
        const url = `${this.baseUrl}/issue/${issueIdOrKey}/attachments`;
        const formData = new FormData();
        formData.append('file', file instanceof Blob ? file : new Blob([file]), filename);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: this.authHeader,
                'X-Atlassian-Token': 'no-check',
            },
            body: formData,
        });
        if (!response.ok) {
            throw new JiraApiError(`Failed to upload attachment: ${response.statusText}`, response.status);
        }
        return response.json();
    }
    // ============================================================================
    // Worklogs
    // ============================================================================
    /**
     * Get worklogs for an issue
     */
    async getWorklogs(issueIdOrKey, params) {
        return this.get(`/issue/${issueIdOrKey}/worklog`, {
            startAt: params?.startAt,
            maxResults: params?.maxResults,
        });
    }
    /**
     * Get a single worklog
     */
    async getWorklog(issueIdOrKey, worklogId) {
        return this.get(`/issue/${issueIdOrKey}/worklog/${worklogId}`);
    }
    /**
     * Add a worklog to an issue
     */
    async addWorklog(issueIdOrKey, params) {
        return this.post(`/issue/${issueIdOrKey}/worklog`, params);
    }
    /**
     * Update a worklog
     */
    async updateWorklog(issueIdOrKey, worklogId, params) {
        return this.put(`/issue/${issueIdOrKey}/worklog/${worklogId}`, params);
    }
    /**
     * Delete a worklog
     */
    async deleteWorklog(issueIdOrKey, worklogId) {
        return this.delete(`/issue/${issueIdOrKey}/worklog/${worklogId}`);
    }
    // ============================================================================
    // Issue Links
    // ============================================================================
    /**
     * Get all issue link types
     */
    async getIssueLinkTypes() {
        return this.get('/issueLinkType');
    }
    /**
     * Create an issue link
     */
    async createIssueLink(params) {
        return this.post('/issueLink', params);
    }
    /**
     * Get an issue link
     */
    async getIssueLink(linkId) {
        return this.get(`/issueLink/${linkId}`);
    }
    /**
     * Delete an issue link
     */
    async deleteIssueLink(linkId) {
        return this.delete(`/issueLink/${linkId}`);
    }
    // ============================================================================
    // Watchers & Votes
    // ============================================================================
    /**
     * Get watchers for an issue
     */
    async getWatchers(issueIdOrKey) {
        return this.get(`/issue/${issueIdOrKey}/watchers`);
    }
    /**
     * Add a watcher to an issue
     */
    async addWatcher(issueIdOrKey, accountId) {
        return this.post(`/issue/${issueIdOrKey}/watchers`, JSON.stringify(accountId));
    }
    /**
     * Remove a watcher from an issue
     */
    async removeWatcher(issueIdOrKey, accountId) {
        return this.delete(`/issue/${issueIdOrKey}/watchers`, { accountId });
    }
    /**
     * Get votes for an issue
     */
    async getVotes(issueIdOrKey) {
        return this.get(`/issue/${issueIdOrKey}/votes`);
    }
    /**
     * Add vote to an issue
     */
    async addVote(issueIdOrKey) {
        return this.post(`/issue/${issueIdOrKey}/votes`);
    }
    /**
     * Remove vote from an issue
     */
    async removeVote(issueIdOrKey) {
        return this.delete(`/issue/${issueIdOrKey}/votes`);
    }
    // ============================================================================
    // Projects
    // ============================================================================
    /**
     * Get all projects
     */
    async getProjects(params) {
        return this.get('/project/search', {
            keys: params?.keys,
            query: params?.query,
            typeKey: params?.typeKey,
            orderBy: params?.orderBy,
            expand: params?.expand,
            startAt: params?.startAt,
            maxResults: params?.maxResults,
        });
    }
    /**
     * Get a single project
     */
    async getProject(projectIdOrKey, expand) {
        return this.get(`/project/${projectIdOrKey}`, { expand });
    }
    /**
     * Create a new project
     */
    async createProject(params) {
        return this.post('/project', params);
    }
    /**
     * Update a project
     */
    async updateProject(projectIdOrKey, params) {
        return this.put(`/project/${projectIdOrKey}`, params);
    }
    /**
     * Delete a project
     */
    async deleteProject(projectIdOrKey) {
        return this.delete(`/project/${projectIdOrKey}`);
    }
    /**
     * Get project components
     */
    async getProjectComponents(projectIdOrKey) {
        return this.get(`/project/${projectIdOrKey}/components`);
    }
    /**
     * Get project versions
     */
    async getProjectVersions(projectIdOrKey) {
        return this.get(`/project/${projectIdOrKey}/versions`);
    }
    // ============================================================================
    // Users
    // ============================================================================
    /**
     * Get current user
     */
    async getCurrentUser() {
        return this.get('/myself');
    }
    /**
     * Get a user by account ID
     */
    async getUser(accountId) {
        return this.get('/user', { accountId });
    }
    /**
     * Search for users
     */
    async searchUsers(params) {
        return this.get('/user/search', {
            query: params?.query,
            accountId: params?.accountId,
            username: params?.username,
            startAt: params?.startAt,
            maxResults: params?.maxResults,
        });
    }
    /**
     * Search users assignable to an issue
     */
    async searchAssignableUsers(issueKey, projectKey, params) {
        return this.get('/user/assignable/search', {
            query: params?.query,
            accountId: params?.accountId,
            username: params?.username,
            startAt: params?.startAt,
            maxResults: params?.maxResults,
            issueKey,
            project: projectKey,
        });
    }
    // ============================================================================
    // Issue Types, Priorities, Statuses
    // ============================================================================
    /**
     * Get all issue types
     */
    async getIssueTypes() {
        return this.get('/issuetype');
    }
    /**
     * Get issue types for a project
     */
    async getProjectIssueTypes(projectIdOrKey) {
        return this.get(`/issuetype/project?projectId=${projectIdOrKey}`);
    }
    /**
     * Get all priorities
     */
    async getPriorities() {
        return this.get('/priority');
    }
    /**
     * Get all statuses
     */
    async getStatuses() {
        return this.get('/status');
    }
    /**
     * Get statuses for a project
     */
    async getProjectStatuses(projectIdOrKey) {
        return this.get(`/project/${projectIdOrKey}/statuses`);
    }
    // ============================================================================
    // Fields
    // ============================================================================
    /**
     * Get all fields (system and custom)
     */
    async getFields() {
        return this.get('/field');
    }
    // ============================================================================
    // Filters
    // ============================================================================
    /**
     * Get a filter
     */
    async getFilter(filterId) {
        return this.get(`/filter/${filterId}`);
    }
    /**
     * Get favorite filters
     */
    async getFavoriteFilters() {
        return this.get('/filter/favourite');
    }
    /**
     * Get my filters
     */
    async getMyFilters() {
        return this.get('/filter/my');
    }
    // ============================================================================
    // Sprints (Agile API)
    // ============================================================================
    /**
     * Get a sprint
     */
    async getSprint(sprintId) {
        return this.request('GET', `/sprint/${sprintId}`, { isAgile: true });
    }
    /**
     * Create a sprint
     */
    async createSprint(params) {
        return this.request('POST', '/sprint', { body: params, isAgile: true });
    }
    /**
     * Update a sprint
     */
    async updateSprint(sprintId, params) {
        return this.request('PUT', `/sprint/${sprintId}`, { body: params, isAgile: true });
    }
    /**
     * Delete a sprint
     */
    async deleteSprint(sprintId) {
        return this.request('DELETE', `/sprint/${sprintId}`, { isAgile: true });
    }
    /**
     * Get issues in a sprint
     */
    async getSprintIssues(sprintId, params) {
        return this.request('GET', `/sprint/${sprintId}/issue`, {
            query: {
                startAt: params?.startAt,
                maxResults: params?.maxResults,
                jql: params?.jql,
                fields: params?.fields,
            },
            isAgile: true,
        });
    }
    /**
     * Move issues to a sprint
     */
    async moveIssuesToSprint(sprintId, issueKeys, rankBefore, rankAfter) {
        return this.request('POST', `/sprint/${sprintId}/issue`, {
            body: { issues: issueKeys, rankBefore, rankAfter },
            isAgile: true,
        });
    }
    // ============================================================================
    // Boards (Agile API)
    // ============================================================================
    /**
     * Get all boards
     */
    async getBoards(params) {
        return this.request('GET', '/board', {
            query: {
                startAt: params?.startAt,
                maxResults: params?.maxResults,
                name: params?.name,
                projectKeyOrId: params?.projectKeyOrId,
                type: params?.type,
            },
            isAgile: true,
        });
    }
    /**
     * Get a board
     */
    async getBoard(boardId) {
        return this.request('GET', `/board/${boardId}`, { isAgile: true });
    }
    /**
     * Get sprints for a board
     */
    async getBoardSprints(boardId, params) {
        return this.request('GET', `/board/${boardId}/sprint`, {
            query: {
                startAt: params?.startAt,
                maxResults: params?.maxResults,
                state: params?.state,
            },
            isAgile: true,
        });
    }
    /**
     * Get backlog issues for a board
     */
    async getBoardBacklog(boardId, params) {
        return this.request('GET', `/board/${boardId}/backlog`, {
            query: {
                startAt: params?.startAt,
                maxResults: params?.maxResults,
                jql: params?.jql,
                fields: params?.fields,
            },
            isAgile: true,
        });
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Helper to paginate through all results
     */
    async *paginate(fetchFn, pageSize = 50) {
        let startAt = 0;
        let hasMore = true;
        while (hasMore) {
            const response = await fetchFn({ startAt, maxResults: pageSize });
            for (const item of response.values) {
                yield item;
            }
            startAt += response.values.length;
            hasMore = response.isLast === false || startAt < response.total;
        }
    }
    /**
     * Helper to get all results at once
     */
    async getAll(fetchFn, pageSize = 50) {
        const results = [];
        for await (const item of this.paginate(fetchFn, pageSize)) {
            results.push(item);
        }
        return results;
    }
}
exports.JiraClient = JiraClient;
//# sourceMappingURL=client.js.map