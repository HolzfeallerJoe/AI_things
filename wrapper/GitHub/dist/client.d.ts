import { GitHubUser, Repository, CreateRepositoryParams, UpdateRepositoryParams, Issue, CreateIssueParams, UpdateIssueParams, IssueComment, PullRequest, CreatePullRequestParams, UpdatePullRequestParams, PullRequestReview, CreateReviewParams, Branch, Commit, ContentItem, FileContent, CreateOrUpdateFileParams, DeleteFileParams, FileCommitResponse, Release, CreateReleaseParams, UpdateReleaseParams, Webhook, CreateWebhookParams, SearchResponse, SearchRepositoriesParams, SearchIssuesParams, SearchUsersParams, SearchCodeParams, CodeSearchResult, Organization, Gist, CreateGistParams, UpdateGistParams, Workflow, WorkflowRun, WorkflowRunsResponse, WorkflowsResponse, Notification, RateLimitResponse, GitHubErrorResponse, ListRepositoriesParams, ListIssuesParams, ListPullRequestsParams, ListCommitsParams, ListBranchesParams, Label, Milestone, Team, SimpleUser } from './types.js';
export interface GitHubClientConfig {
    token: string;
    baseUrl?: string;
    apiVersion?: string;
}
export declare class GitHubApiError extends Error {
    status: number;
    errorResponse?: GitHubErrorResponse | undefined;
    constructor(message: string, status: number, errorResponse?: GitHubErrorResponse | undefined);
}
export declare class GitHubClient {
    private baseUrl;
    private token;
    private apiVersion;
    constructor(config: GitHubClientConfig);
    private request;
    private get;
    private post;
    private put;
    private patch;
    private delete;
    /**
     * Get the authenticated user
     */
    getCurrentUser(): Promise<GitHubUser>;
    /**
     * Get a user by username
     */
    getUser(username: string): Promise<GitHubUser>;
    /**
     * List followers of the authenticated user
     */
    listFollowers(params?: {
        per_page?: number;
        page?: number;
    }): Promise<SimpleUser[]>;
    /**
     * List users the authenticated user is following
     */
    listFollowing(params?: {
        per_page?: number;
        page?: number;
    }): Promise<SimpleUser[]>;
    /**
     * List repositories for the authenticated user
     */
    listRepositories(params?: ListRepositoriesParams): Promise<Repository[]>;
    /**
     * List repositories for a user
     */
    listUserRepositories(username: string, params?: {
        type?: 'all' | 'owner' | 'member';
        sort?: 'created' | 'updated' | 'pushed' | 'full_name';
        direction?: 'asc' | 'desc';
        per_page?: number;
        page?: number;
    }): Promise<Repository[]>;
    /**
     * List organization repositories
     */
    listOrgRepositories(org: string, params?: {
        type?: 'all' | 'public' | 'private' | 'forks' | 'sources' | 'member';
        sort?: 'created' | 'updated' | 'pushed' | 'full_name';
        direction?: 'asc' | 'desc';
        per_page?: number;
        page?: number;
    }): Promise<Repository[]>;
    /**
     * Get a repository
     */
    getRepository(owner: string, repo: string): Promise<Repository>;
    /**
     * Create a repository for the authenticated user
     */
    createRepository(params: CreateRepositoryParams): Promise<Repository>;
    /**
     * Create a repository in an organization
     */
    createOrgRepository(org: string, params: CreateRepositoryParams): Promise<Repository>;
    /**
     * Update a repository
     */
    updateRepository(owner: string, repo: string, params: UpdateRepositoryParams): Promise<Repository>;
    /**
     * Delete a repository
     */
    deleteRepository(owner: string, repo: string): Promise<void>;
    /**
     * List repository topics
     */
    listRepositoryTopics(owner: string, repo: string): Promise<{
        names: string[];
    }>;
    /**
     * Replace repository topics
     */
    replaceRepositoryTopics(owner: string, repo: string, topics: string[]): Promise<{
        names: string[];
    }>;
    /**
     * List repository languages
     */
    listRepositoryLanguages(owner: string, repo: string): Promise<Record<string, number>>;
    /**
     * List repository contributors
     */
    listContributors(owner: string, repo: string, params?: {
        anon?: boolean;
        per_page?: number;
        page?: number;
    }): Promise<SimpleUser[]>;
    /**
     * List issues for a repository
     */
    listIssues(owner: string, repo: string, params?: ListIssuesParams): Promise<Issue[]>;
    /**
     * Get an issue
     */
    getIssue(owner: string, repo: string, issueNumber: number): Promise<Issue>;
    /**
     * Create an issue
     */
    createIssue(owner: string, repo: string, params: CreateIssueParams): Promise<Issue>;
    /**
     * Update an issue
     */
    updateIssue(owner: string, repo: string, issueNumber: number, params: UpdateIssueParams): Promise<Issue>;
    /**
     * Lock an issue
     */
    lockIssue(owner: string, repo: string, issueNumber: number, lockReason?: 'off-topic' | 'too heated' | 'resolved' | 'spam'): Promise<void>;
    /**
     * Unlock an issue
     */
    unlockIssue(owner: string, repo: string, issueNumber: number): Promise<void>;
    /**
     * List comments on an issue
     */
    listIssueComments(owner: string, repo: string, issueNumber: number, params?: {
        since?: string;
        per_page?: number;
        page?: number;
    }): Promise<IssueComment[]>;
    /**
     * Get an issue comment
     */
    getIssueComment(owner: string, repo: string, commentId: number): Promise<IssueComment>;
    /**
     * Create an issue comment
     */
    createIssueComment(owner: string, repo: string, issueNumber: number, body: string): Promise<IssueComment>;
    /**
     * Update an issue comment
     */
    updateIssueComment(owner: string, repo: string, commentId: number, body: string): Promise<IssueComment>;
    /**
     * Delete an issue comment
     */
    deleteIssueComment(owner: string, repo: string, commentId: number): Promise<void>;
    /**
     * List labels for a repository
     */
    listLabels(owner: string, repo: string, params?: {
        per_page?: number;
        page?: number;
    }): Promise<Label[]>;
    /**
     * Get a label
     */
    getLabel(owner: string, repo: string, name: string): Promise<Label>;
    /**
     * Create a label
     */
    createLabel(owner: string, repo: string, params: {
        name: string;
        color?: string;
        description?: string;
    }): Promise<Label>;
    /**
     * Update a label
     */
    updateLabel(owner: string, repo: string, name: string, params: {
        new_name?: string;
        color?: string;
        description?: string;
    }): Promise<Label>;
    /**
     * Delete a label
     */
    deleteLabel(owner: string, repo: string, name: string): Promise<void>;
    /**
     * List milestones for a repository
     */
    listMilestones(owner: string, repo: string, params?: {
        state?: 'open' | 'closed' | 'all';
        sort?: 'due_on' | 'completeness';
        direction?: 'asc' | 'desc';
        per_page?: number;
        page?: number;
    }): Promise<Milestone[]>;
    /**
     * Get a milestone
     */
    getMilestone(owner: string, repo: string, milestoneNumber: number): Promise<Milestone>;
    /**
     * Create a milestone
     */
    createMilestone(owner: string, repo: string, params: {
        title: string;
        state?: 'open' | 'closed';
        description?: string;
        due_on?: string;
    }): Promise<Milestone>;
    /**
     * Update a milestone
     */
    updateMilestone(owner: string, repo: string, milestoneNumber: number, params: {
        title?: string;
        state?: 'open' | 'closed';
        description?: string;
        due_on?: string;
    }): Promise<Milestone>;
    /**
     * Delete a milestone
     */
    deleteMilestone(owner: string, repo: string, milestoneNumber: number): Promise<void>;
    /**
     * List pull requests for a repository
     */
    listPullRequests(owner: string, repo: string, params?: ListPullRequestsParams): Promise<PullRequest[]>;
    /**
     * Get a pull request
     */
    getPullRequest(owner: string, repo: string, pullNumber: number): Promise<PullRequest>;
    /**
     * Create a pull request
     */
    createPullRequest(owner: string, repo: string, params: CreatePullRequestParams): Promise<PullRequest>;
    /**
     * Update a pull request
     */
    updatePullRequest(owner: string, repo: string, pullNumber: number, params: UpdatePullRequestParams): Promise<PullRequest>;
    /**
     * List commits on a pull request
     */
    listPullRequestCommits(owner: string, repo: string, pullNumber: number, params?: {
        per_page?: number;
        page?: number;
    }): Promise<Commit[]>;
    /**
     * List files on a pull request
     */
    listPullRequestFiles(owner: string, repo: string, pullNumber: number, params?: {
        per_page?: number;
        page?: number;
    }): Promise<{
        sha: string;
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        changes: number;
        patch?: string;
    }[]>;
    /**
     * Check if a pull request has been merged
     */
    isPullRequestMerged(owner: string, repo: string, pullNumber: number): Promise<boolean>;
    /**
     * Merge a pull request
     */
    mergePullRequest(owner: string, repo: string, pullNumber: number, params?: {
        commit_title?: string;
        commit_message?: string;
        sha?: string;
        merge_method?: 'merge' | 'squash' | 'rebase';
    }): Promise<{
        sha: string;
        merged: boolean;
        message: string;
    }>;
    /**
     * List reviews on a pull request
     */
    listPullRequestReviews(owner: string, repo: string, pullNumber: number, params?: {
        per_page?: number;
        page?: number;
    }): Promise<PullRequestReview[]>;
    /**
     * Get a review
     */
    getPullRequestReview(owner: string, repo: string, pullNumber: number, reviewId: number): Promise<PullRequestReview>;
    /**
     * Create a review
     */
    createPullRequestReview(owner: string, repo: string, pullNumber: number, params: CreateReviewParams): Promise<PullRequestReview>;
    /**
     * Submit a pending review
     */
    submitPullRequestReview(owner: string, repo: string, pullNumber: number, reviewId: number, params: {
        body?: string;
        event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    }): Promise<PullRequestReview>;
    /**
     * Dismiss a review
     */
    dismissPullRequestReview(owner: string, repo: string, pullNumber: number, reviewId: number, message: string): Promise<PullRequestReview>;
    /**
     * Request reviewers for a pull request
     */
    requestReviewers(owner: string, repo: string, pullNumber: number, params: {
        reviewers?: string[];
        team_reviewers?: string[];
    }): Promise<PullRequest>;
    /**
     * Remove requested reviewers from a pull request
     */
    removeRequestedReviewers(owner: string, repo: string, pullNumber: number, params: {
        reviewers?: string[];
        team_reviewers?: string[];
    }): Promise<PullRequest>;
    /**
     * List branches for a repository
     */
    listBranches(owner: string, repo: string, params?: ListBranchesParams): Promise<Branch[]>;
    /**
     * Get a branch
     */
    getBranch(owner: string, repo: string, branch: string): Promise<Branch>;
    /**
     * Rename a branch
     */
    renameBranch(owner: string, repo: string, branch: string, newName: string): Promise<Branch>;
    /**
     * Get branch protection
     */
    getBranchProtection(owner: string, repo: string, branch: string): Promise<any>;
    /**
     * Delete branch protection
     */
    deleteBranchProtection(owner: string, repo: string, branch: string): Promise<void>;
    /**
     * List commits
     */
    listCommits(owner: string, repo: string, params?: ListCommitsParams): Promise<Commit[]>;
    /**
     * Get a commit
     */
    getCommit(owner: string, repo: string, ref: string): Promise<Commit>;
    /**
     * Compare two commits
     */
    compareCommits(owner: string, repo: string, base: string, head: string): Promise<{
        url: string;
        html_url: string;
        permalink_url: string;
        diff_url: string;
        patch_url: string;
        base_commit: Commit;
        merge_base_commit: Commit;
        status: 'diverged' | 'ahead' | 'behind' | 'identical';
        ahead_by: number;
        behind_by: number;
        total_commits: number;
        commits: Commit[];
        files: any[];
    }>;
    /**
     * Get repository content
     */
    getContent(owner: string, repo: string, path: string, ref?: string): Promise<ContentItem | ContentItem[]>;
    /**
     * Get file content (decoded)
     */
    getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string>;
    /**
     * Create or update file contents
     */
    createOrUpdateFile(owner: string, repo: string, path: string, params: CreateOrUpdateFileParams): Promise<FileCommitResponse>;
    /**
     * Delete a file
     */
    deleteFile(owner: string, repo: string, path: string, params: DeleteFileParams): Promise<FileCommitResponse>;
    /**
     * Get the README
     */
    getReadme(owner: string, repo: string, ref?: string): Promise<FileContent>;
    /**
     * List releases
     */
    listReleases(owner: string, repo: string, params?: {
        per_page?: number;
        page?: number;
    }): Promise<Release[]>;
    /**
     * Get a release
     */
    getRelease(owner: string, repo: string, releaseId: number): Promise<Release>;
    /**
     * Get the latest release
     */
    getLatestRelease(owner: string, repo: string): Promise<Release>;
    /**
     * Get release by tag
     */
    getReleaseByTag(owner: string, repo: string, tag: string): Promise<Release>;
    /**
     * Create a release
     */
    createRelease(owner: string, repo: string, params: CreateReleaseParams): Promise<Release>;
    /**
     * Update a release
     */
    updateRelease(owner: string, repo: string, releaseId: number, params: UpdateReleaseParams): Promise<Release>;
    /**
     * Delete a release
     */
    deleteRelease(owner: string, repo: string, releaseId: number): Promise<void>;
    /**
     * List repository webhooks
     */
    listWebhooks(owner: string, repo: string, params?: {
        per_page?: number;
        page?: number;
    }): Promise<Webhook[]>;
    /**
     * Get a webhook
     */
    getWebhook(owner: string, repo: string, hookId: number): Promise<Webhook>;
    /**
     * Create a webhook
     */
    createWebhook(owner: string, repo: string, params: CreateWebhookParams): Promise<Webhook>;
    /**
     * Update a webhook
     */
    updateWebhook(owner: string, repo: string, hookId: number, params: Partial<CreateWebhookParams>): Promise<Webhook>;
    /**
     * Delete a webhook
     */
    deleteWebhook(owner: string, repo: string, hookId: number): Promise<void>;
    /**
     * Ping a webhook
     */
    pingWebhook(owner: string, repo: string, hookId: number): Promise<void>;
    /**
     * Search repositories
     */
    searchRepositories(params: SearchRepositoriesParams): Promise<SearchResponse<Repository>>;
    /**
     * Search issues and pull requests
     */
    searchIssues(params: SearchIssuesParams): Promise<SearchResponse<Issue>>;
    /**
     * Search users
     */
    searchUsers(params: SearchUsersParams): Promise<SearchResponse<GitHubUser>>;
    /**
     * Search code
     */
    searchCode(params: SearchCodeParams): Promise<SearchResponse<CodeSearchResult>>;
    /**
     * List organizations for the authenticated user
     */
    listOrganizations(params?: {
        per_page?: number;
        page?: number;
    }): Promise<Organization[]>;
    /**
     * Get an organization
     */
    getOrganization(org: string): Promise<Organization>;
    /**
     * List organization members
     */
    listOrgMembers(org: string, params?: {
        filter?: 'all' | '2fa_disabled';
        role?: 'all' | 'admin' | 'member';
        per_page?: number;
        page?: number;
    }): Promise<SimpleUser[]>;
    /**
     * List organization teams
     */
    listOrgTeams(org: string, params?: {
        per_page?: number;
        page?: number;
    }): Promise<Team[]>;
    /**
     * List gists for the authenticated user
     */
    listGists(params?: {
        since?: string;
        per_page?: number;
        page?: number;
    }): Promise<Gist[]>;
    /**
     * Get a gist
     */
    getGist(gistId: string): Promise<Gist>;
    /**
     * Create a gist
     */
    createGist(params: CreateGistParams): Promise<Gist>;
    /**
     * Update a gist
     */
    updateGist(gistId: string, params: UpdateGistParams): Promise<Gist>;
    /**
     * Delete a gist
     */
    deleteGist(gistId: string): Promise<void>;
    /**
     * Star a gist
     */
    starGist(gistId: string): Promise<void>;
    /**
     * Unstar a gist
     */
    unstarGist(gistId: string): Promise<void>;
    /**
     * List repository workflows
     */
    listWorkflows(owner: string, repo: string, params?: {
        per_page?: number;
        page?: number;
    }): Promise<WorkflowsResponse>;
    /**
     * Get a workflow
     */
    getWorkflow(owner: string, repo: string, workflowId: number | string): Promise<Workflow>;
    /**
     * List workflow runs
     */
    listWorkflowRuns(owner: string, repo: string, params?: {
        actor?: string;
        branch?: string;
        event?: string;
        status?: 'completed' | 'action_required' | 'cancelled' | 'failure' | 'neutral' | 'skipped' | 'stale' | 'success' | 'timed_out' | 'in_progress' | 'queued' | 'requested' | 'waiting' | 'pending';
        per_page?: number;
        page?: number;
        created?: string;
        exclude_pull_requests?: boolean;
    }): Promise<WorkflowRunsResponse>;
    /**
     * Get a workflow run
     */
    getWorkflowRun(owner: string, repo: string, runId: number): Promise<WorkflowRun>;
    /**
     * Cancel a workflow run
     */
    cancelWorkflowRun(owner: string, repo: string, runId: number): Promise<void>;
    /**
     * Re-run a workflow
     */
    rerunWorkflow(owner: string, repo: string, runId: number): Promise<void>;
    /**
     * Trigger a workflow dispatch event
     */
    dispatchWorkflow(owner: string, repo: string, workflowId: number | string, ref: string, inputs?: Record<string, string>): Promise<void>;
    /**
     * List notifications for the authenticated user
     */
    listNotifications(params?: {
        all?: boolean;
        participating?: boolean;
        since?: string;
        before?: string;
        per_page?: number;
        page?: number;
    }): Promise<Notification[]>;
    /**
     * Mark notifications as read
     */
    markNotificationsAsRead(lastReadAt?: string): Promise<void>;
    /**
     * Get a thread
     */
    getThread(threadId: string): Promise<Notification>;
    /**
     * Mark a thread as read
     */
    markThreadAsRead(threadId: string): Promise<void>;
    /**
     * Get rate limit status
     */
    getRateLimit(): Promise<RateLimitResponse>;
    /**
     * Star a repository
     */
    starRepository(owner: string, repo: string): Promise<void>;
    /**
     * Unstar a repository
     */
    unstarRepository(owner: string, repo: string): Promise<void>;
    /**
     * Check if a repository is starred
     */
    isRepositoryStarred(owner: string, repo: string): Promise<boolean>;
    /**
     * List starred repositories
     */
    listStarredRepositories(params?: {
        sort?: 'created' | 'updated';
        direction?: 'asc' | 'desc';
        per_page?: number;
        page?: number;
    }): Promise<Repository[]>;
    /**
     * Paginate through all results
     */
    paginate<T>(fetchFn: (params: {
        per_page: number;
        page: number;
    }) => Promise<T[]>, pageSize?: number): AsyncGenerator<T>;
    /**
     * Get all results at once
     */
    getAll<T>(fetchFn: (params: {
        per_page: number;
        page: number;
    }) => Promise<T[]>, pageSize?: number): Promise<T[]>;
}
//# sourceMappingURL=client.d.ts.map