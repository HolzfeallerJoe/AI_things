export class GitHubApiError extends Error {
    status;
    errorResponse;
    constructor(message, status, errorResponse) {
        super(message);
        this.status = status;
        this.errorResponse = errorResponse;
        this.name = 'GitHubApiError';
    }
}
export class GitHubClient {
    baseUrl;
    token;
    apiVersion;
    constructor(config) {
        this.token = config.token;
        this.baseUrl = config.baseUrl || 'https://api.github.com';
        this.apiVersion = config.apiVersion || '2022-11-28';
    }
    async request(method, path, body, params) {
        let url = `${this.baseUrl}${path}`;
        if (params) {
            const filteredParams = {};
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined) {
                    filteredParams[key] = String(value);
                }
            }
            if (Object.keys(filteredParams).length > 0) {
                url += '?' + new URLSearchParams(filteredParams).toString();
            }
        }
        const headers = {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${this.token}`,
            'X-GitHub-Api-Version': this.apiVersion,
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
            throw new GitHubApiError(errorResponse?.message || `HTTP ${response.status}`, response.status, errorResponse);
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
    patch(path, body) {
        return this.request('PATCH', path, body);
    }
    delete(path) {
        return this.request('DELETE', path);
    }
    // ==========================================================================
    // User Methods
    // ==========================================================================
    /**
     * Get the authenticated user
     */
    async getCurrentUser() {
        return this.get('/user');
    }
    /**
     * Get a user by username
     */
    async getUser(username) {
        return this.get(`/users/${username}`);
    }
    /**
     * List followers of the authenticated user
     */
    async listFollowers(params) {
        return this.get('/user/followers', params);
    }
    /**
     * List users the authenticated user is following
     */
    async listFollowing(params) {
        return this.get('/user/following', params);
    }
    // ==========================================================================
    // Repository Methods
    // ==========================================================================
    /**
     * List repositories for the authenticated user
     */
    async listRepositories(params) {
        return this.get('/user/repos', params);
    }
    /**
     * List repositories for a user
     */
    async listUserRepositories(username, params) {
        return this.get(`/users/${username}/repos`, params);
    }
    /**
     * List organization repositories
     */
    async listOrgRepositories(org, params) {
        return this.get(`/orgs/${org}/repos`, params);
    }
    /**
     * Get a repository
     */
    async getRepository(owner, repo) {
        return this.get(`/repos/${owner}/${repo}`);
    }
    /**
     * Create a repository for the authenticated user
     */
    async createRepository(params) {
        return this.post('/user/repos', params);
    }
    /**
     * Create a repository in an organization
     */
    async createOrgRepository(org, params) {
        return this.post(`/orgs/${org}/repos`, params);
    }
    /**
     * Update a repository
     */
    async updateRepository(owner, repo, params) {
        return this.patch(`/repos/${owner}/${repo}`, params);
    }
    /**
     * Delete a repository
     */
    async deleteRepository(owner, repo) {
        return this.delete(`/repos/${owner}/${repo}`);
    }
    /**
     * List repository topics
     */
    async listRepositoryTopics(owner, repo) {
        return this.get(`/repos/${owner}/${repo}/topics`);
    }
    /**
     * Replace repository topics
     */
    async replaceRepositoryTopics(owner, repo, topics) {
        return this.put(`/repos/${owner}/${repo}/topics`, { names: topics });
    }
    /**
     * List repository languages
     */
    async listRepositoryLanguages(owner, repo) {
        return this.get(`/repos/${owner}/${repo}/languages`);
    }
    /**
     * List repository contributors
     */
    async listContributors(owner, repo, params) {
        return this.get(`/repos/${owner}/${repo}/contributors`, params);
    }
    // ==========================================================================
    // Issue Methods
    // ==========================================================================
    /**
     * List issues for a repository
     */
    async listIssues(owner, repo, params) {
        return this.get(`/repos/${owner}/${repo}/issues`, params);
    }
    /**
     * Get an issue
     */
    async getIssue(owner, repo, issueNumber) {
        return this.get(`/repos/${owner}/${repo}/issues/${issueNumber}`);
    }
    /**
     * Create an issue
     */
    async createIssue(owner, repo, params) {
        return this.post(`/repos/${owner}/${repo}/issues`, params);
    }
    /**
     * Update an issue
     */
    async updateIssue(owner, repo, issueNumber, params) {
        return this.patch(`/repos/${owner}/${repo}/issues/${issueNumber}`, params);
    }
    /**
     * Lock an issue
     */
    async lockIssue(owner, repo, issueNumber, lockReason) {
        return this.put(`/repos/${owner}/${repo}/issues/${issueNumber}/lock`, lockReason ? { lock_reason: lockReason } : undefined);
    }
    /**
     * Unlock an issue
     */
    async unlockIssue(owner, repo, issueNumber) {
        return this.delete(`/repos/${owner}/${repo}/issues/${issueNumber}/lock`);
    }
    // ==========================================================================
    // Issue Comments
    // ==========================================================================
    /**
     * List comments on an issue
     */
    async listIssueComments(owner, repo, issueNumber, params) {
        return this.get(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, params);
    }
    /**
     * Get an issue comment
     */
    async getIssueComment(owner, repo, commentId) {
        return this.get(`/repos/${owner}/${repo}/issues/comments/${commentId}`);
    }
    /**
     * Create an issue comment
     */
    async createIssueComment(owner, repo, issueNumber, body) {
        return this.post(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { body });
    }
    /**
     * Update an issue comment
     */
    async updateIssueComment(owner, repo, commentId, body) {
        return this.patch(`/repos/${owner}/${repo}/issues/comments/${commentId}`, { body });
    }
    /**
     * Delete an issue comment
     */
    async deleteIssueComment(owner, repo, commentId) {
        return this.delete(`/repos/${owner}/${repo}/issues/comments/${commentId}`);
    }
    // ==========================================================================
    // Labels
    // ==========================================================================
    /**
     * List labels for a repository
     */
    async listLabels(owner, repo, params) {
        return this.get(`/repos/${owner}/${repo}/labels`, params);
    }
    /**
     * Get a label
     */
    async getLabel(owner, repo, name) {
        return this.get(`/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`);
    }
    /**
     * Create a label
     */
    async createLabel(owner, repo, params) {
        return this.post(`/repos/${owner}/${repo}/labels`, params);
    }
    /**
     * Update a label
     */
    async updateLabel(owner, repo, name, params) {
        return this.patch(`/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`, params);
    }
    /**
     * Delete a label
     */
    async deleteLabel(owner, repo, name) {
        return this.delete(`/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`);
    }
    // ==========================================================================
    // Milestones
    // ==========================================================================
    /**
     * List milestones for a repository
     */
    async listMilestones(owner, repo, params) {
        return this.get(`/repos/${owner}/${repo}/milestones`, params);
    }
    /**
     * Get a milestone
     */
    async getMilestone(owner, repo, milestoneNumber) {
        return this.get(`/repos/${owner}/${repo}/milestones/${milestoneNumber}`);
    }
    /**
     * Create a milestone
     */
    async createMilestone(owner, repo, params) {
        return this.post(`/repos/${owner}/${repo}/milestones`, params);
    }
    /**
     * Update a milestone
     */
    async updateMilestone(owner, repo, milestoneNumber, params) {
        return this.patch(`/repos/${owner}/${repo}/milestones/${milestoneNumber}`, params);
    }
    /**
     * Delete a milestone
     */
    async deleteMilestone(owner, repo, milestoneNumber) {
        return this.delete(`/repos/${owner}/${repo}/milestones/${milestoneNumber}`);
    }
    // ==========================================================================
    // Pull Request Methods
    // ==========================================================================
    /**
     * List pull requests for a repository
     */
    async listPullRequests(owner, repo, params) {
        return this.get(`/repos/${owner}/${repo}/pulls`, params);
    }
    /**
     * Get a pull request
     */
    async getPullRequest(owner, repo, pullNumber) {
        return this.get(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
    }
    /**
     * Create a pull request
     */
    async createPullRequest(owner, repo, params) {
        return this.post(`/repos/${owner}/${repo}/pulls`, params);
    }
    /**
     * Update a pull request
     */
    async updatePullRequest(owner, repo, pullNumber, params) {
        return this.patch(`/repos/${owner}/${repo}/pulls/${pullNumber}`, params);
    }
    /**
     * List commits on a pull request
     */
    async listPullRequestCommits(owner, repo, pullNumber, params) {
        return this.get(`/repos/${owner}/${repo}/pulls/${pullNumber}/commits`, params);
    }
    /**
     * List files on a pull request
     */
    async listPullRequestFiles(owner, repo, pullNumber, params) {
        return this.get(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`, params);
    }
    /**
     * Check if a pull request has been merged
     */
    async isPullRequestMerged(owner, repo, pullNumber) {
        try {
            await this.get(`/repos/${owner}/${repo}/pulls/${pullNumber}/merge`);
            return true;
        }
        catch (error) {
            if (error instanceof GitHubApiError && error.status === 404) {
                return false;
            }
            throw error;
        }
    }
    /**
     * Merge a pull request
     */
    async mergePullRequest(owner, repo, pullNumber, params) {
        return this.put(`/repos/${owner}/${repo}/pulls/${pullNumber}/merge`, params);
    }
    // ==========================================================================
    // Pull Request Reviews
    // ==========================================================================
    /**
     * List reviews on a pull request
     */
    async listPullRequestReviews(owner, repo, pullNumber, params) {
        return this.get(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, params);
    }
    /**
     * Get a review
     */
    async getPullRequestReview(owner, repo, pullNumber, reviewId) {
        return this.get(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews/${reviewId}`);
    }
    /**
     * Create a review
     */
    async createPullRequestReview(owner, repo, pullNumber, params) {
        return this.post(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, params);
    }
    /**
     * Submit a pending review
     */
    async submitPullRequestReview(owner, repo, pullNumber, reviewId, params) {
        return this.post(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews/${reviewId}/events`, params);
    }
    /**
     * Dismiss a review
     */
    async dismissPullRequestReview(owner, repo, pullNumber, reviewId, message) {
        return this.put(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews/${reviewId}/dismissals`, { message });
    }
    /**
     * Request reviewers for a pull request
     */
    async requestReviewers(owner, repo, pullNumber, params) {
        return this.post(`/repos/${owner}/${repo}/pulls/${pullNumber}/requested_reviewers`, params);
    }
    /**
     * Remove requested reviewers from a pull request
     */
    async removeRequestedReviewers(owner, repo, pullNumber, params) {
        return this.delete(`/repos/${owner}/${repo}/pulls/${pullNumber}/requested_reviewers`);
    }
    // ==========================================================================
    // Branch Methods
    // ==========================================================================
    /**
     * List branches for a repository
     */
    async listBranches(owner, repo, params) {
        return this.get(`/repos/${owner}/${repo}/branches`, params);
    }
    /**
     * Get a branch
     */
    async getBranch(owner, repo, branch) {
        return this.get(`/repos/${owner}/${repo}/branches/${branch}`);
    }
    /**
     * Rename a branch
     */
    async renameBranch(owner, repo, branch, newName) {
        return this.post(`/repos/${owner}/${repo}/branches/${branch}/rename`, { new_name: newName });
    }
    /**
     * Get branch protection
     */
    async getBranchProtection(owner, repo, branch) {
        return this.get(`/repos/${owner}/${repo}/branches/${branch}/protection`);
    }
    /**
     * Delete branch protection
     */
    async deleteBranchProtection(owner, repo, branch) {
        return this.delete(`/repos/${owner}/${repo}/branches/${branch}/protection`);
    }
    // ==========================================================================
    // Commit Methods
    // ==========================================================================
    /**
     * List commits
     */
    async listCommits(owner, repo, params) {
        return this.get(`/repos/${owner}/${repo}/commits`, params);
    }
    /**
     * Get a commit
     */
    async getCommit(owner, repo, ref) {
        return this.get(`/repos/${owner}/${repo}/commits/${ref}`);
    }
    /**
     * Compare two commits
     */
    async compareCommits(owner, repo, base, head) {
        return this.get(`/repos/${owner}/${repo}/compare/${base}...${head}`);
    }
    // ==========================================================================
    // Content Methods
    // ==========================================================================
    /**
     * Get repository content
     */
    async getContent(owner, repo, path, ref) {
        return this.get(`/repos/${owner}/${repo}/contents/${path}`, ref ? { ref } : undefined);
    }
    /**
     * Get file content (decoded)
     */
    async getFileContent(owner, repo, path, ref) {
        const content = await this.getContent(owner, repo, path, ref);
        if (content.type !== 'file') {
            throw new Error(`Path ${path} is not a file`);
        }
        return Buffer.from(content.content, 'base64').toString('utf-8');
    }
    /**
     * Create or update file contents
     */
    async createOrUpdateFile(owner, repo, path, params) {
        return this.put(`/repos/${owner}/${repo}/contents/${path}`, params);
    }
    /**
     * Delete a file
     */
    async deleteFile(owner, repo, path, params) {
        return this.delete(`/repos/${owner}/${repo}/contents/${path}`);
    }
    /**
     * Get the README
     */
    async getReadme(owner, repo, ref) {
        return this.get(`/repos/${owner}/${repo}/readme`, ref ? { ref } : undefined);
    }
    // ==========================================================================
    // Release Methods
    // ==========================================================================
    /**
     * List releases
     */
    async listReleases(owner, repo, params) {
        return this.get(`/repos/${owner}/${repo}/releases`, params);
    }
    /**
     * Get a release
     */
    async getRelease(owner, repo, releaseId) {
        return this.get(`/repos/${owner}/${repo}/releases/${releaseId}`);
    }
    /**
     * Get the latest release
     */
    async getLatestRelease(owner, repo) {
        return this.get(`/repos/${owner}/${repo}/releases/latest`);
    }
    /**
     * Get release by tag
     */
    async getReleaseByTag(owner, repo, tag) {
        return this.get(`/repos/${owner}/${repo}/releases/tags/${tag}`);
    }
    /**
     * Create a release
     */
    async createRelease(owner, repo, params) {
        return this.post(`/repos/${owner}/${repo}/releases`, params);
    }
    /**
     * Update a release
     */
    async updateRelease(owner, repo, releaseId, params) {
        return this.patch(`/repos/${owner}/${repo}/releases/${releaseId}`, params);
    }
    /**
     * Delete a release
     */
    async deleteRelease(owner, repo, releaseId) {
        return this.delete(`/repos/${owner}/${repo}/releases/${releaseId}`);
    }
    // ==========================================================================
    // Webhook Methods
    // ==========================================================================
    /**
     * List repository webhooks
     */
    async listWebhooks(owner, repo, params) {
        return this.get(`/repos/${owner}/${repo}/hooks`, params);
    }
    /**
     * Get a webhook
     */
    async getWebhook(owner, repo, hookId) {
        return this.get(`/repos/${owner}/${repo}/hooks/${hookId}`);
    }
    /**
     * Create a webhook
     */
    async createWebhook(owner, repo, params) {
        return this.post(`/repos/${owner}/${repo}/hooks`, params);
    }
    /**
     * Update a webhook
     */
    async updateWebhook(owner, repo, hookId, params) {
        return this.patch(`/repos/${owner}/${repo}/hooks/${hookId}`, params);
    }
    /**
     * Delete a webhook
     */
    async deleteWebhook(owner, repo, hookId) {
        return this.delete(`/repos/${owner}/${repo}/hooks/${hookId}`);
    }
    /**
     * Ping a webhook
     */
    async pingWebhook(owner, repo, hookId) {
        return this.post(`/repos/${owner}/${repo}/hooks/${hookId}/pings`);
    }
    // ==========================================================================
    // Search Methods
    // ==========================================================================
    /**
     * Search repositories
     */
    async searchRepositories(params) {
        return this.get('/search/repositories', params);
    }
    /**
     * Search issues and pull requests
     */
    async searchIssues(params) {
        return this.get('/search/issues', params);
    }
    /**
     * Search users
     */
    async searchUsers(params) {
        return this.get('/search/users', params);
    }
    /**
     * Search code
     */
    async searchCode(params) {
        return this.get('/search/code', params);
    }
    // ==========================================================================
    // Organization Methods
    // ==========================================================================
    /**
     * List organizations for the authenticated user
     */
    async listOrganizations(params) {
        return this.get('/user/orgs', params);
    }
    /**
     * Get an organization
     */
    async getOrganization(org) {
        return this.get(`/orgs/${org}`);
    }
    /**
     * List organization members
     */
    async listOrgMembers(org, params) {
        return this.get(`/orgs/${org}/members`, params);
    }
    /**
     * List organization teams
     */
    async listOrgTeams(org, params) {
        return this.get(`/orgs/${org}/teams`, params);
    }
    // ==========================================================================
    // Gist Methods
    // ==========================================================================
    /**
     * List gists for the authenticated user
     */
    async listGists(params) {
        return this.get('/gists', params);
    }
    /**
     * Get a gist
     */
    async getGist(gistId) {
        return this.get(`/gists/${gistId}`);
    }
    /**
     * Create a gist
     */
    async createGist(params) {
        return this.post('/gists', params);
    }
    /**
     * Update a gist
     */
    async updateGist(gistId, params) {
        return this.patch(`/gists/${gistId}`, params);
    }
    /**
     * Delete a gist
     */
    async deleteGist(gistId) {
        return this.delete(`/gists/${gistId}`);
    }
    /**
     * Star a gist
     */
    async starGist(gistId) {
        return this.put(`/gists/${gistId}/star`);
    }
    /**
     * Unstar a gist
     */
    async unstarGist(gistId) {
        return this.delete(`/gists/${gistId}/star`);
    }
    // ==========================================================================
    // Actions Methods
    // ==========================================================================
    /**
     * List repository workflows
     */
    async listWorkflows(owner, repo, params) {
        return this.get(`/repos/${owner}/${repo}/actions/workflows`, params);
    }
    /**
     * Get a workflow
     */
    async getWorkflow(owner, repo, workflowId) {
        return this.get(`/repos/${owner}/${repo}/actions/workflows/${workflowId}`);
    }
    /**
     * List workflow runs
     */
    async listWorkflowRuns(owner, repo, params) {
        return this.get(`/repos/${owner}/${repo}/actions/runs`, params);
    }
    /**
     * Get a workflow run
     */
    async getWorkflowRun(owner, repo, runId) {
        return this.get(`/repos/${owner}/${repo}/actions/runs/${runId}`);
    }
    /**
     * Cancel a workflow run
     */
    async cancelWorkflowRun(owner, repo, runId) {
        return this.post(`/repos/${owner}/${repo}/actions/runs/${runId}/cancel`);
    }
    /**
     * Re-run a workflow
     */
    async rerunWorkflow(owner, repo, runId) {
        return this.post(`/repos/${owner}/${repo}/actions/runs/${runId}/rerun`);
    }
    /**
     * Trigger a workflow dispatch event
     */
    async dispatchWorkflow(owner, repo, workflowId, ref, inputs) {
        return this.post(`/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, { ref, inputs });
    }
    // ==========================================================================
    // Notification Methods
    // ==========================================================================
    /**
     * List notifications for the authenticated user
     */
    async listNotifications(params) {
        return this.get('/notifications', params);
    }
    /**
     * Mark notifications as read
     */
    async markNotificationsAsRead(lastReadAt) {
        return this.put('/notifications', lastReadAt ? { last_read_at: lastReadAt } : undefined);
    }
    /**
     * Get a thread
     */
    async getThread(threadId) {
        return this.get(`/notifications/threads/${threadId}`);
    }
    /**
     * Mark a thread as read
     */
    async markThreadAsRead(threadId) {
        return this.patch(`/notifications/threads/${threadId}`);
    }
    // ==========================================================================
    // Rate Limit Methods
    // ==========================================================================
    /**
     * Get rate limit status
     */
    async getRateLimit() {
        return this.get('/rate_limit');
    }
    // ==========================================================================
    // Star Methods
    // ==========================================================================
    /**
     * Star a repository
     */
    async starRepository(owner, repo) {
        return this.put(`/user/starred/${owner}/${repo}`);
    }
    /**
     * Unstar a repository
     */
    async unstarRepository(owner, repo) {
        return this.delete(`/user/starred/${owner}/${repo}`);
    }
    /**
     * Check if a repository is starred
     */
    async isRepositoryStarred(owner, repo) {
        try {
            await this.get(`/user/starred/${owner}/${repo}`);
            return true;
        }
        catch (error) {
            if (error instanceof GitHubApiError && error.status === 404) {
                return false;
            }
            throw error;
        }
    }
    /**
     * List starred repositories
     */
    async listStarredRepositories(params) {
        return this.get('/user/starred', params);
    }
    // ==========================================================================
    // Pagination Helpers
    // ==========================================================================
    /**
     * Paginate through all results
     */
    async *paginate(fetchFn, pageSize = 100) {
        let page = 1;
        while (true) {
            const results = await fetchFn({ per_page: pageSize, page });
            for (const item of results) {
                yield item;
            }
            if (results.length < pageSize) {
                break;
            }
            page++;
        }
    }
    /**
     * Get all results at once
     */
    async getAll(fetchFn, pageSize = 100) {
        const results = [];
        for await (const item of this.paginate(fetchFn, pageSize)) {
            results.push(item);
        }
        return results;
    }
}
//# sourceMappingURL=client.js.map