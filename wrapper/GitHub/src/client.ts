import {
  GitHubUser,
  Repository,
  CreateRepositoryParams,
  UpdateRepositoryParams,
  Issue,
  CreateIssueParams,
  UpdateIssueParams,
  IssueComment,
  PullRequest,
  CreatePullRequestParams,
  UpdatePullRequestParams,
  PullRequestReview,
  CreateReviewParams,
  Branch,
  Commit,
  ContentItem,
  FileContent,
  CreateOrUpdateFileParams,
  DeleteFileParams,
  FileCommitResponse,
  Release,
  CreateReleaseParams,
  UpdateReleaseParams,
  Webhook,
  CreateWebhookParams,
  SearchResponse,
  SearchRepositoriesParams,
  SearchIssuesParams,
  SearchUsersParams,
  SearchCodeParams,
  CodeSearchResult,
  Organization,
  Gist,
  CreateGistParams,
  UpdateGistParams,
  Workflow,
  WorkflowRun,
  WorkflowRunsResponse,
  WorkflowsResponse,
  Notification,
  RateLimitResponse,
  GitHubErrorResponse,
  ListRepositoriesParams,
  ListIssuesParams,
  ListPullRequestsParams,
  ListCommitsParams,
  ListBranchesParams,
  Label,
  Milestone,
  Team,
  SimpleUser,
} from './types.js';

export interface GitHubClientConfig {
  token: string;
  baseUrl?: string;
  apiVersion?: string;
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errorResponse?: GitHubErrorResponse
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryParams = Record<string, any>;

export class GitHubClient {
  private baseUrl: string;
  private token: string;
  private apiVersion: string;

  constructor(config: GitHubClientConfig) {
    this.token = config.token;
    this.baseUrl = config.baseUrl || 'https://api.github.com';
    this.apiVersion = config.apiVersion || '2022-11-28';
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: QueryParams
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    if (params) {
      const filteredParams: Record<string, string> = {};
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          filteredParams[key] = String(value);
        }
      }
      if (Object.keys(filteredParams).length > 0) {
        url += '?' + new URLSearchParams(filteredParams).toString();
      }
    }

    const headers: Record<string, string> = {
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
      let errorResponse: GitHubErrorResponse | undefined;
      try {
        errorResponse = (await response.json()) as GitHubErrorResponse;
      } catch {
        // Ignore JSON parsing errors
      }
      throw new GitHubApiError(
        errorResponse?.message || `HTTP ${response.status}`,
        response.status,
        errorResponse
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private get<T>(path: string, params?: QueryParams): Promise<T> {
    return this.request<T>('GET', path, undefined, params);
  }

  private post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  private patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  private delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  // ==========================================================================
  // User Methods
  // ==========================================================================

  /**
   * Get the authenticated user
   */
  async getCurrentUser(): Promise<GitHubUser> {
    return this.get<GitHubUser>('/user');
  }

  /**
   * Get a user by username
   */
  async getUser(username: string): Promise<GitHubUser> {
    return this.get<GitHubUser>(`/users/${username}`);
  }

  /**
   * List followers of the authenticated user
   */
  async listFollowers(params?: { per_page?: number; page?: number }): Promise<SimpleUser[]> {
    return this.get<SimpleUser[]>('/user/followers', params);
  }

  /**
   * List users the authenticated user is following
   */
  async listFollowing(params?: { per_page?: number; page?: number }): Promise<SimpleUser[]> {
    return this.get<SimpleUser[]>('/user/following', params);
  }

  // ==========================================================================
  // Repository Methods
  // ==========================================================================

  /**
   * List repositories for the authenticated user
   */
  async listRepositories(params?: ListRepositoriesParams): Promise<Repository[]> {
    return this.get<Repository[]>('/user/repos', params);
  }

  /**
   * List repositories for a user
   */
  async listUserRepositories(
    username: string,
    params?: { type?: 'all' | 'owner' | 'member'; sort?: 'created' | 'updated' | 'pushed' | 'full_name'; direction?: 'asc' | 'desc'; per_page?: number; page?: number }
  ): Promise<Repository[]> {
    return this.get<Repository[]>(`/users/${username}/repos`, params);
  }

  /**
   * List organization repositories
   */
  async listOrgRepositories(
    org: string,
    params?: { type?: 'all' | 'public' | 'private' | 'forks' | 'sources' | 'member'; sort?: 'created' | 'updated' | 'pushed' | 'full_name'; direction?: 'asc' | 'desc'; per_page?: number; page?: number }
  ): Promise<Repository[]> {
    return this.get<Repository[]>(`/orgs/${org}/repos`, params);
  }

  /**
   * Get a repository
   */
  async getRepository(owner: string, repo: string): Promise<Repository> {
    return this.get<Repository>(`/repos/${owner}/${repo}`);
  }

  /**
   * Create a repository for the authenticated user
   */
  async createRepository(params: CreateRepositoryParams): Promise<Repository> {
    return this.post<Repository>('/user/repos', params);
  }

  /**
   * Create a repository in an organization
   */
  async createOrgRepository(org: string, params: CreateRepositoryParams): Promise<Repository> {
    return this.post<Repository>(`/orgs/${org}/repos`, params);
  }

  /**
   * Update a repository
   */
  async updateRepository(owner: string, repo: string, params: UpdateRepositoryParams): Promise<Repository> {
    return this.patch<Repository>(`/repos/${owner}/${repo}`, params);
  }

  /**
   * Delete a repository
   */
  async deleteRepository(owner: string, repo: string): Promise<void> {
    return this.delete<void>(`/repos/${owner}/${repo}`);
  }

  /**
   * List repository topics
   */
  async listRepositoryTopics(owner: string, repo: string): Promise<{ names: string[] }> {
    return this.get<{ names: string[] }>(`/repos/${owner}/${repo}/topics`);
  }

  /**
   * Replace repository topics
   */
  async replaceRepositoryTopics(owner: string, repo: string, topics: string[]): Promise<{ names: string[] }> {
    return this.put<{ names: string[] }>(`/repos/${owner}/${repo}/topics`, { names: topics });
  }

  /**
   * List repository languages
   */
  async listRepositoryLanguages(owner: string, repo: string): Promise<Record<string, number>> {
    return this.get<Record<string, number>>(`/repos/${owner}/${repo}/languages`);
  }

  /**
   * List repository contributors
   */
  async listContributors(
    owner: string,
    repo: string,
    params?: { anon?: boolean; per_page?: number; page?: number }
  ): Promise<SimpleUser[]> {
    return this.get<SimpleUser[]>(`/repos/${owner}/${repo}/contributors`, params);
  }

  // ==========================================================================
  // Issue Methods
  // ==========================================================================

  /**
   * List issues for a repository
   */
  async listIssues(owner: string, repo: string, params?: ListIssuesParams): Promise<Issue[]> {
    return this.get<Issue[]>(`/repos/${owner}/${repo}/issues`, params);
  }

  /**
   * Get an issue
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<Issue> {
    return this.get<Issue>(`/repos/${owner}/${repo}/issues/${issueNumber}`);
  }

  /**
   * Create an issue
   */
  async createIssue(owner: string, repo: string, params: CreateIssueParams): Promise<Issue> {
    return this.post<Issue>(`/repos/${owner}/${repo}/issues`, params);
  }

  /**
   * Update an issue
   */
  async updateIssue(owner: string, repo: string, issueNumber: number, params: UpdateIssueParams): Promise<Issue> {
    return this.patch<Issue>(`/repos/${owner}/${repo}/issues/${issueNumber}`, params);
  }

  /**
   * Lock an issue
   */
  async lockIssue(owner: string, repo: string, issueNumber: number, lockReason?: 'off-topic' | 'too heated' | 'resolved' | 'spam'): Promise<void> {
    return this.put<void>(`/repos/${owner}/${repo}/issues/${issueNumber}/lock`, lockReason ? { lock_reason: lockReason } : undefined);
  }

  /**
   * Unlock an issue
   */
  async unlockIssue(owner: string, repo: string, issueNumber: number): Promise<void> {
    return this.delete<void>(`/repos/${owner}/${repo}/issues/${issueNumber}/lock`);
  }

  // ==========================================================================
  // Issue Comments
  // ==========================================================================

  /**
   * List comments on an issue
   */
  async listIssueComments(
    owner: string,
    repo: string,
    issueNumber: number,
    params?: { since?: string; per_page?: number; page?: number }
  ): Promise<IssueComment[]> {
    return this.get<IssueComment[]>(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, params);
  }

  /**
   * Get an issue comment
   */
  async getIssueComment(owner: string, repo: string, commentId: number): Promise<IssueComment> {
    return this.get<IssueComment>(`/repos/${owner}/${repo}/issues/comments/${commentId}`);
  }

  /**
   * Create an issue comment
   */
  async createIssueComment(owner: string, repo: string, issueNumber: number, body: string): Promise<IssueComment> {
    return this.post<IssueComment>(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { body });
  }

  /**
   * Update an issue comment
   */
  async updateIssueComment(owner: string, repo: string, commentId: number, body: string): Promise<IssueComment> {
    return this.patch<IssueComment>(`/repos/${owner}/${repo}/issues/comments/${commentId}`, { body });
  }

  /**
   * Delete an issue comment
   */
  async deleteIssueComment(owner: string, repo: string, commentId: number): Promise<void> {
    return this.delete<void>(`/repos/${owner}/${repo}/issues/comments/${commentId}`);
  }

  // ==========================================================================
  // Labels
  // ==========================================================================

  /**
   * List labels for a repository
   */
  async listLabels(owner: string, repo: string, params?: { per_page?: number; page?: number }): Promise<Label[]> {
    return this.get<Label[]>(`/repos/${owner}/${repo}/labels`, params);
  }

  /**
   * Get a label
   */
  async getLabel(owner: string, repo: string, name: string): Promise<Label> {
    return this.get<Label>(`/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`);
  }

  /**
   * Create a label
   */
  async createLabel(owner: string, repo: string, params: { name: string; color?: string; description?: string }): Promise<Label> {
    return this.post<Label>(`/repos/${owner}/${repo}/labels`, params);
  }

  /**
   * Update a label
   */
  async updateLabel(owner: string, repo: string, name: string, params: { new_name?: string; color?: string; description?: string }): Promise<Label> {
    return this.patch<Label>(`/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`, params);
  }

  /**
   * Delete a label
   */
  async deleteLabel(owner: string, repo: string, name: string): Promise<void> {
    return this.delete<void>(`/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`);
  }

  // ==========================================================================
  // Milestones
  // ==========================================================================

  /**
   * List milestones for a repository
   */
  async listMilestones(
    owner: string,
    repo: string,
    params?: { state?: 'open' | 'closed' | 'all'; sort?: 'due_on' | 'completeness'; direction?: 'asc' | 'desc'; per_page?: number; page?: number }
  ): Promise<Milestone[]> {
    return this.get<Milestone[]>(`/repos/${owner}/${repo}/milestones`, params);
  }

  /**
   * Get a milestone
   */
  async getMilestone(owner: string, repo: string, milestoneNumber: number): Promise<Milestone> {
    return this.get<Milestone>(`/repos/${owner}/${repo}/milestones/${milestoneNumber}`);
  }

  /**
   * Create a milestone
   */
  async createMilestone(owner: string, repo: string, params: { title: string; state?: 'open' | 'closed'; description?: string; due_on?: string }): Promise<Milestone> {
    return this.post<Milestone>(`/repos/${owner}/${repo}/milestones`, params);
  }

  /**
   * Update a milestone
   */
  async updateMilestone(owner: string, repo: string, milestoneNumber: number, params: { title?: string; state?: 'open' | 'closed'; description?: string; due_on?: string }): Promise<Milestone> {
    return this.patch<Milestone>(`/repos/${owner}/${repo}/milestones/${milestoneNumber}`, params);
  }

  /**
   * Delete a milestone
   */
  async deleteMilestone(owner: string, repo: string, milestoneNumber: number): Promise<void> {
    return this.delete<void>(`/repos/${owner}/${repo}/milestones/${milestoneNumber}`);
  }

  // ==========================================================================
  // Pull Request Methods
  // ==========================================================================

  /**
   * List pull requests for a repository
   */
  async listPullRequests(owner: string, repo: string, params?: ListPullRequestsParams): Promise<PullRequest[]> {
    return this.get<PullRequest[]>(`/repos/${owner}/${repo}/pulls`, params);
  }

  /**
   * Get a pull request
   */
  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<PullRequest> {
    return this.get<PullRequest>(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
  }

  /**
   * Create a pull request
   */
  async createPullRequest(owner: string, repo: string, params: CreatePullRequestParams): Promise<PullRequest> {
    return this.post<PullRequest>(`/repos/${owner}/${repo}/pulls`, params);
  }

  /**
   * Update a pull request
   */
  async updatePullRequest(owner: string, repo: string, pullNumber: number, params: UpdatePullRequestParams): Promise<PullRequest> {
    return this.patch<PullRequest>(`/repos/${owner}/${repo}/pulls/${pullNumber}`, params);
  }

  /**
   * List commits on a pull request
   */
  async listPullRequestCommits(
    owner: string,
    repo: string,
    pullNumber: number,
    params?: { per_page?: number; page?: number }
  ): Promise<Commit[]> {
    return this.get<Commit[]>(`/repos/${owner}/${repo}/pulls/${pullNumber}/commits`, params);
  }

  /**
   * List files on a pull request
   */
  async listPullRequestFiles(
    owner: string,
    repo: string,
    pullNumber: number,
    params?: { per_page?: number; page?: number }
  ): Promise<{ sha: string; filename: string; status: string; additions: number; deletions: number; changes: number; patch?: string }[]> {
    return this.get(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`, params);
  }

  /**
   * Check if a pull request has been merged
   */
  async isPullRequestMerged(owner: string, repo: string, pullNumber: number): Promise<boolean> {
    try {
      await this.get<void>(`/repos/${owner}/${repo}/pulls/${pullNumber}/merge`);
      return true;
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Merge a pull request
   */
  async mergePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    params?: { commit_title?: string; commit_message?: string; sha?: string; merge_method?: 'merge' | 'squash' | 'rebase' }
  ): Promise<{ sha: string; merged: boolean; message: string }> {
    return this.put(`/repos/${owner}/${repo}/pulls/${pullNumber}/merge`, params);
  }

  // ==========================================================================
  // Pull Request Reviews
  // ==========================================================================

  /**
   * List reviews on a pull request
   */
  async listPullRequestReviews(
    owner: string,
    repo: string,
    pullNumber: number,
    params?: { per_page?: number; page?: number }
  ): Promise<PullRequestReview[]> {
    return this.get<PullRequestReview[]>(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, params);
  }

  /**
   * Get a review
   */
  async getPullRequestReview(owner: string, repo: string, pullNumber: number, reviewId: number): Promise<PullRequestReview> {
    return this.get<PullRequestReview>(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews/${reviewId}`);
  }

  /**
   * Create a review
   */
  async createPullRequestReview(owner: string, repo: string, pullNumber: number, params: CreateReviewParams): Promise<PullRequestReview> {
    return this.post<PullRequestReview>(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, params);
  }

  /**
   * Submit a pending review
   */
  async submitPullRequestReview(
    owner: string,
    repo: string,
    pullNumber: number,
    reviewId: number,
    params: { body?: string; event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' }
  ): Promise<PullRequestReview> {
    return this.post<PullRequestReview>(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews/${reviewId}/events`, params);
  }

  /**
   * Dismiss a review
   */
  async dismissPullRequestReview(owner: string, repo: string, pullNumber: number, reviewId: number, message: string): Promise<PullRequestReview> {
    return this.put<PullRequestReview>(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews/${reviewId}/dismissals`, { message });
  }

  /**
   * Request reviewers for a pull request
   */
  async requestReviewers(
    owner: string,
    repo: string,
    pullNumber: number,
    params: { reviewers?: string[]; team_reviewers?: string[] }
  ): Promise<PullRequest> {
    return this.post<PullRequest>(`/repos/${owner}/${repo}/pulls/${pullNumber}/requested_reviewers`, params);
  }

  /**
   * Remove requested reviewers from a pull request
   */
  async removeRequestedReviewers(
    owner: string,
    repo: string,
    pullNumber: number,
    params: { reviewers?: string[]; team_reviewers?: string[] }
  ): Promise<PullRequest> {
    return this.delete<PullRequest>(`/repos/${owner}/${repo}/pulls/${pullNumber}/requested_reviewers`);
  }

  // ==========================================================================
  // Branch Methods
  // ==========================================================================

  /**
   * List branches for a repository
   */
  async listBranches(owner: string, repo: string, params?: ListBranchesParams): Promise<Branch[]> {
    return this.get<Branch[]>(`/repos/${owner}/${repo}/branches`, params);
  }

  /**
   * Get a branch
   */
  async getBranch(owner: string, repo: string, branch: string): Promise<Branch> {
    return this.get<Branch>(`/repos/${owner}/${repo}/branches/${branch}`);
  }

  /**
   * Rename a branch
   */
  async renameBranch(owner: string, repo: string, branch: string, newName: string): Promise<Branch> {
    return this.post<Branch>(`/repos/${owner}/${repo}/branches/${branch}/rename`, { new_name: newName });
  }

  /**
   * Get branch protection
   */
  async getBranchProtection(owner: string, repo: string, branch: string): Promise<any> {
    return this.get(`/repos/${owner}/${repo}/branches/${branch}/protection`);
  }

  /**
   * Delete branch protection
   */
  async deleteBranchProtection(owner: string, repo: string, branch: string): Promise<void> {
    return this.delete<void>(`/repos/${owner}/${repo}/branches/${branch}/protection`);
  }

  // ==========================================================================
  // Commit Methods
  // ==========================================================================

  /**
   * List commits
   */
  async listCommits(owner: string, repo: string, params?: ListCommitsParams): Promise<Commit[]> {
    return this.get<Commit[]>(`/repos/${owner}/${repo}/commits`, params);
  }

  /**
   * Get a commit
   */
  async getCommit(owner: string, repo: string, ref: string): Promise<Commit> {
    return this.get<Commit>(`/repos/${owner}/${repo}/commits/${ref}`);
  }

  /**
   * Compare two commits
   */
  async compareCommits(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<{
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
  }> {
    return this.get(`/repos/${owner}/${repo}/compare/${base}...${head}`);
  }

  // ==========================================================================
  // Content Methods
  // ==========================================================================

  /**
   * Get repository content
   */
  async getContent(owner: string, repo: string, path: string, ref?: string): Promise<ContentItem | ContentItem[]> {
    return this.get(`/repos/${owner}/${repo}/contents/${path}`, ref ? { ref } : undefined);
  }

  /**
   * Get file content (decoded)
   */
  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    const content = await this.getContent(owner, repo, path, ref) as FileContent;
    if (content.type !== 'file') {
      throw new Error(`Path ${path} is not a file`);
    }
    return Buffer.from(content.content, 'base64').toString('utf-8');
  }

  /**
   * Create or update file contents
   */
  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    params: CreateOrUpdateFileParams
  ): Promise<FileCommitResponse> {
    return this.put(`/repos/${owner}/${repo}/contents/${path}`, params);
  }

  /**
   * Delete a file
   */
  async deleteFile(owner: string, repo: string, path: string, params: DeleteFileParams): Promise<FileCommitResponse> {
    return this.delete(`/repos/${owner}/${repo}/contents/${path}`);
  }

  /**
   * Get the README
   */
  async getReadme(owner: string, repo: string, ref?: string): Promise<FileContent> {
    return this.get(`/repos/${owner}/${repo}/readme`, ref ? { ref } : undefined);
  }

  // ==========================================================================
  // Release Methods
  // ==========================================================================

  /**
   * List releases
   */
  async listReleases(owner: string, repo: string, params?: { per_page?: number; page?: number }): Promise<Release[]> {
    return this.get<Release[]>(`/repos/${owner}/${repo}/releases`, params);
  }

  /**
   * Get a release
   */
  async getRelease(owner: string, repo: string, releaseId: number): Promise<Release> {
    return this.get<Release>(`/repos/${owner}/${repo}/releases/${releaseId}`);
  }

  /**
   * Get the latest release
   */
  async getLatestRelease(owner: string, repo: string): Promise<Release> {
    return this.get<Release>(`/repos/${owner}/${repo}/releases/latest`);
  }

  /**
   * Get release by tag
   */
  async getReleaseByTag(owner: string, repo: string, tag: string): Promise<Release> {
    return this.get<Release>(`/repos/${owner}/${repo}/releases/tags/${tag}`);
  }

  /**
   * Create a release
   */
  async createRelease(owner: string, repo: string, params: CreateReleaseParams): Promise<Release> {
    return this.post<Release>(`/repos/${owner}/${repo}/releases`, params);
  }

  /**
   * Update a release
   */
  async updateRelease(owner: string, repo: string, releaseId: number, params: UpdateReleaseParams): Promise<Release> {
    return this.patch<Release>(`/repos/${owner}/${repo}/releases/${releaseId}`, params);
  }

  /**
   * Delete a release
   */
  async deleteRelease(owner: string, repo: string, releaseId: number): Promise<void> {
    return this.delete<void>(`/repos/${owner}/${repo}/releases/${releaseId}`);
  }

  // ==========================================================================
  // Webhook Methods
  // ==========================================================================

  /**
   * List repository webhooks
   */
  async listWebhooks(owner: string, repo: string, params?: { per_page?: number; page?: number }): Promise<Webhook[]> {
    return this.get<Webhook[]>(`/repos/${owner}/${repo}/hooks`, params);
  }

  /**
   * Get a webhook
   */
  async getWebhook(owner: string, repo: string, hookId: number): Promise<Webhook> {
    return this.get<Webhook>(`/repos/${owner}/${repo}/hooks/${hookId}`);
  }

  /**
   * Create a webhook
   */
  async createWebhook(owner: string, repo: string, params: CreateWebhookParams): Promise<Webhook> {
    return this.post<Webhook>(`/repos/${owner}/${repo}/hooks`, params);
  }

  /**
   * Update a webhook
   */
  async updateWebhook(owner: string, repo: string, hookId: number, params: Partial<CreateWebhookParams>): Promise<Webhook> {
    return this.patch<Webhook>(`/repos/${owner}/${repo}/hooks/${hookId}`, params);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(owner: string, repo: string, hookId: number): Promise<void> {
    return this.delete<void>(`/repos/${owner}/${repo}/hooks/${hookId}`);
  }

  /**
   * Ping a webhook
   */
  async pingWebhook(owner: string, repo: string, hookId: number): Promise<void> {
    return this.post<void>(`/repos/${owner}/${repo}/hooks/${hookId}/pings`);
  }

  // ==========================================================================
  // Search Methods
  // ==========================================================================

  /**
   * Search repositories
   */
  async searchRepositories(params: SearchRepositoriesParams): Promise<SearchResponse<Repository>> {
    return this.get<SearchResponse<Repository>>('/search/repositories', params);
  }

  /**
   * Search issues and pull requests
   */
  async searchIssues(params: SearchIssuesParams): Promise<SearchResponse<Issue>> {
    return this.get<SearchResponse<Issue>>('/search/issues', params);
  }

  /**
   * Search users
   */
  async searchUsers(params: SearchUsersParams): Promise<SearchResponse<GitHubUser>> {
    return this.get<SearchResponse<GitHubUser>>('/search/users', params);
  }

  /**
   * Search code
   */
  async searchCode(params: SearchCodeParams): Promise<SearchResponse<CodeSearchResult>> {
    return this.get<SearchResponse<CodeSearchResult>>('/search/code', params);
  }

  // ==========================================================================
  // Organization Methods
  // ==========================================================================

  /**
   * List organizations for the authenticated user
   */
  async listOrganizations(params?: { per_page?: number; page?: number }): Promise<Organization[]> {
    return this.get<Organization[]>('/user/orgs', params);
  }

  /**
   * Get an organization
   */
  async getOrganization(org: string): Promise<Organization> {
    return this.get<Organization>(`/orgs/${org}`);
  }

  /**
   * List organization members
   */
  async listOrgMembers(
    org: string,
    params?: { filter?: 'all' | '2fa_disabled'; role?: 'all' | 'admin' | 'member'; per_page?: number; page?: number }
  ): Promise<SimpleUser[]> {
    return this.get<SimpleUser[]>(`/orgs/${org}/members`, params);
  }

  /**
   * List organization teams
   */
  async listOrgTeams(org: string, params?: { per_page?: number; page?: number }): Promise<Team[]> {
    return this.get<Team[]>(`/orgs/${org}/teams`, params);
  }

  // ==========================================================================
  // Gist Methods
  // ==========================================================================

  /**
   * List gists for the authenticated user
   */
  async listGists(params?: { since?: string; per_page?: number; page?: number }): Promise<Gist[]> {
    return this.get<Gist[]>('/gists', params);
  }

  /**
   * Get a gist
   */
  async getGist(gistId: string): Promise<Gist> {
    return this.get<Gist>(`/gists/${gistId}`);
  }

  /**
   * Create a gist
   */
  async createGist(params: CreateGistParams): Promise<Gist> {
    return this.post<Gist>('/gists', params);
  }

  /**
   * Update a gist
   */
  async updateGist(gistId: string, params: UpdateGistParams): Promise<Gist> {
    return this.patch<Gist>(`/gists/${gistId}`, params);
  }

  /**
   * Delete a gist
   */
  async deleteGist(gistId: string): Promise<void> {
    return this.delete<void>(`/gists/${gistId}`);
  }

  /**
   * Star a gist
   */
  async starGist(gistId: string): Promise<void> {
    return this.put<void>(`/gists/${gistId}/star`);
  }

  /**
   * Unstar a gist
   */
  async unstarGist(gistId: string): Promise<void> {
    return this.delete<void>(`/gists/${gistId}/star`);
  }

  // ==========================================================================
  // Actions Methods
  // ==========================================================================

  /**
   * List repository workflows
   */
  async listWorkflows(owner: string, repo: string, params?: { per_page?: number; page?: number }): Promise<WorkflowsResponse> {
    return this.get<WorkflowsResponse>(`/repos/${owner}/${repo}/actions/workflows`, params);
  }

  /**
   * Get a workflow
   */
  async getWorkflow(owner: string, repo: string, workflowId: number | string): Promise<Workflow> {
    return this.get<Workflow>(`/repos/${owner}/${repo}/actions/workflows/${workflowId}`);
  }

  /**
   * List workflow runs
   */
  async listWorkflowRuns(
    owner: string,
    repo: string,
    params?: {
      actor?: string;
      branch?: string;
      event?: string;
      status?: 'completed' | 'action_required' | 'cancelled' | 'failure' | 'neutral' | 'skipped' | 'stale' | 'success' | 'timed_out' | 'in_progress' | 'queued' | 'requested' | 'waiting' | 'pending';
      per_page?: number;
      page?: number;
      created?: string;
      exclude_pull_requests?: boolean;
    }
  ): Promise<WorkflowRunsResponse> {
    return this.get<WorkflowRunsResponse>(`/repos/${owner}/${repo}/actions/runs`, params);
  }

  /**
   * Get a workflow run
   */
  async getWorkflowRun(owner: string, repo: string, runId: number): Promise<WorkflowRun> {
    return this.get<WorkflowRun>(`/repos/${owner}/${repo}/actions/runs/${runId}`);
  }

  /**
   * Cancel a workflow run
   */
  async cancelWorkflowRun(owner: string, repo: string, runId: number): Promise<void> {
    return this.post<void>(`/repos/${owner}/${repo}/actions/runs/${runId}/cancel`);
  }

  /**
   * Re-run a workflow
   */
  async rerunWorkflow(owner: string, repo: string, runId: number): Promise<void> {
    return this.post<void>(`/repos/${owner}/${repo}/actions/runs/${runId}/rerun`);
  }

  /**
   * Trigger a workflow dispatch event
   */
  async dispatchWorkflow(
    owner: string,
    repo: string,
    workflowId: number | string,
    ref: string,
    inputs?: Record<string, string>
  ): Promise<void> {
    return this.post<void>(`/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, { ref, inputs });
  }

  // ==========================================================================
  // Notification Methods
  // ==========================================================================

  /**
   * List notifications for the authenticated user
   */
  async listNotifications(params?: {
    all?: boolean;
    participating?: boolean;
    since?: string;
    before?: string;
    per_page?: number;
    page?: number;
  }): Promise<Notification[]> {
    return this.get<Notification[]>('/notifications', params);
  }

  /**
   * Mark notifications as read
   */
  async markNotificationsAsRead(lastReadAt?: string): Promise<void> {
    return this.put<void>('/notifications', lastReadAt ? { last_read_at: lastReadAt } : undefined);
  }

  /**
   * Get a thread
   */
  async getThread(threadId: string): Promise<Notification> {
    return this.get<Notification>(`/notifications/threads/${threadId}`);
  }

  /**
   * Mark a thread as read
   */
  async markThreadAsRead(threadId: string): Promise<void> {
    return this.patch<void>(`/notifications/threads/${threadId}`);
  }

  // ==========================================================================
  // Rate Limit Methods
  // ==========================================================================

  /**
   * Get rate limit status
   */
  async getRateLimit(): Promise<RateLimitResponse> {
    return this.get<RateLimitResponse>('/rate_limit');
  }

  // ==========================================================================
  // Star Methods
  // ==========================================================================

  /**
   * Star a repository
   */
  async starRepository(owner: string, repo: string): Promise<void> {
    return this.put<void>(`/user/starred/${owner}/${repo}`);
  }

  /**
   * Unstar a repository
   */
  async unstarRepository(owner: string, repo: string): Promise<void> {
    return this.delete<void>(`/user/starred/${owner}/${repo}`);
  }

  /**
   * Check if a repository is starred
   */
  async isRepositoryStarred(owner: string, repo: string): Promise<boolean> {
    try {
      await this.get<void>(`/user/starred/${owner}/${repo}`);
      return true;
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * List starred repositories
   */
  async listStarredRepositories(params?: { sort?: 'created' | 'updated'; direction?: 'asc' | 'desc'; per_page?: number; page?: number }): Promise<Repository[]> {
    return this.get<Repository[]>('/user/starred', params);
  }

  // ==========================================================================
  // Pagination Helpers
  // ==========================================================================

  /**
   * Paginate through all results
   */
  async *paginate<T>(
    fetchFn: (params: { per_page: number; page: number }) => Promise<T[]>,
    pageSize: number = 100
  ): AsyncGenerator<T> {
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
  async getAll<T>(
    fetchFn: (params: { per_page: number; page: number }) => Promise<T[]>,
    pageSize: number = 100
  ): Promise<T[]> {
    const results: T[] = [];
    for await (const item of this.paginate(fetchFn, pageSize)) {
      results.push(item);
    }
    return results;
  }
}
