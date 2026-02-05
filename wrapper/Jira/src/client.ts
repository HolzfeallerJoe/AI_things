import {
  JiraConfig,
  Issue,
  IssueCreateParams,
  IssueUpdateParams,
  IssueGetParams,
  SearchParams,
  SearchResponse,
  Project,
  ProjectCreateParams,
  ProjectUpdateParams,
  ProjectSearchParams,
  User,
  CurrentUser,
  UserSearchParams,
  Comment,
  CommentCreateParams,
  CommentUpdateParams,
  CommentsParams,
  Attachment,
  Worklog,
  WorklogCreateParams,
  WorklogUpdateParams,
  Transition,
  TransitionParams,
  IssueLink,
  IssueLinkCreateParams,
  IssueLinkType,
  Component,
  Version,
  IssueType,
  Priority,
  Status,
  Field,
  Filter,
  Sprint,
  SprintCreateParams,
  SprintUpdateParams,
  Board,
  PagedResponse,
  PaginationParams,
  ErrorResponse,
  BulkIssueCreateParams,
  BulkIssueCreateResponse,
  BulkTransitionParams,
} from './types.js';

type QueryParams = Record<string, string | number | boolean | string[] | undefined | null>;

/**
 * Custom error class for Jira API errors
 */
export class JiraApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errorResponse?: ErrorResponse
  ) {
    super(message);
    this.name = 'JiraApiError';
  }
}

/**
 * Type-safe Jira REST API v3 Client
 */
export class JiraClient {
  private readonly baseUrl: string;
  private readonly agileBaseUrl: string;
  private readonly authHeader: string;

  constructor(config: JiraConfig) {
    this.baseUrl = `https://${config.domain}/rest/api/3`;
    this.agileBaseUrl = `https://${config.domain}/rest/agile/1.0`;
    this.authHeader = `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`;
  }

  // ============================================================================
  // HTTP Methods
  // ============================================================================

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: QueryParams;
      isAgile?: boolean;
    } = {}
  ): Promise<T> {
    const baseUrl = options.isAgile ? this.agileBaseUrl : this.baseUrl;
    const url = new URL(`${baseUrl}${path}`);

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            url.searchParams.set(key, value.join(','));
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      }
    }

    const headers: Record<string, string> = {
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
      let errorResponse: ErrorResponse | undefined;
      try {
        errorResponse = (await response.json()) as ErrorResponse;
      } catch {
        // Response may not be JSON
      }

      const message =
        errorResponse?.errorMessages?.join(', ') ||
        `Jira API error: ${response.status} ${response.statusText}`;

      throw new JiraApiError(message, response.status, errorResponse);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private get<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>('GET', path, { query });
  }

  private post<T>(path: string, body?: unknown, query?: QueryParams): Promise<T> {
    return this.request<T>('POST', path, { body, query });
  }

  private put<T>(path: string, body?: unknown, query?: QueryParams): Promise<T> {
    return this.request<T>('PUT', path, { body, query });
  }

  private delete<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>('DELETE', path, { query });
  }

  // ============================================================================
  // Issues
  // ============================================================================

  /**
   * Get a single issue by ID or key
   */
  async getIssue(issueIdOrKey: string, params?: IssueGetParams): Promise<Issue> {
    return this.get<Issue>(`/issue/${issueIdOrKey}`, {
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
  async createIssue(params: IssueCreateParams): Promise<Issue> {
    return this.post<Issue>('/issue', params);
  }

  /**
   * Create multiple issues in bulk
   */
  async createIssuesBulk(params: BulkIssueCreateParams): Promise<BulkIssueCreateResponse> {
    return this.post<BulkIssueCreateResponse>('/issue/bulk', params);
  }

  /**
   * Update an existing issue
   */
  async updateIssue(issueIdOrKey: string, params: IssueUpdateParams): Promise<void> {
    return this.put<void>(`/issue/${issueIdOrKey}`, params);
  }

  /**
   * Delete an issue
   */
  async deleteIssue(issueIdOrKey: string, deleteSubtasks = false): Promise<void> {
    return this.delete<void>(`/issue/${issueIdOrKey}`, { deleteSubtasks });
  }

  /**
   * Search for issues using JQL
   */
  async searchIssues(params: SearchParams): Promise<SearchResponse> {
    return this.post<SearchResponse>('/search/jql', {
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
  async getIssueChangelog(
    issueIdOrKey: string,
    params?: PaginationParams
  ): Promise<PagedResponse<import('./types.js').ChangelogHistory>> {
    return this.get<PagedResponse<import('./types.js').ChangelogHistory>>(
      `/issue/${issueIdOrKey}/changelog`,
      {
        startAt: params?.startAt,
        maxResults: params?.maxResults,
      }
    );
  }

  // ============================================================================
  // Transitions
  // ============================================================================

  /**
   * Get available transitions for an issue
   */
  async getTransitions(issueIdOrKey: string): Promise<{ transitions: Transition[] }> {
    return this.get<{ transitions: Transition[] }>(`/issue/${issueIdOrKey}/transitions`);
  }

  /**
   * Transition an issue to a new status
   */
  async transitionIssue(issueIdOrKey: string, params: TransitionParams): Promise<void> {
    return this.post<void>(`/issue/${issueIdOrKey}/transitions`, params);
  }

  /**
   * Bulk transition multiple issues
   */
  async bulkTransitionIssues(params: BulkTransitionParams): Promise<void> {
    return this.post<void>('/issue/bulk/transition', params);
  }

  // ============================================================================
  // Comments
  // ============================================================================

  /**
   * Get all comments for an issue
   */
  async getComments(
    issueIdOrKey: string,
    params?: CommentsParams
  ): Promise<PagedResponse<Comment>> {
    return this.get<PagedResponse<Comment>>(`/issue/${issueIdOrKey}/comment`, {
      startAt: params?.startAt,
      maxResults: params?.maxResults,
      orderBy: params?.orderBy,
      expand: params?.expand,
    });
  }

  /**
   * Get a single comment
   */
  async getComment(issueIdOrKey: string, commentId: string): Promise<Comment> {
    return this.get<Comment>(`/issue/${issueIdOrKey}/comment/${commentId}`);
  }

  /**
   * Add a comment to an issue
   */
  async addComment(issueIdOrKey: string, params: CommentCreateParams): Promise<Comment> {
    return this.post<Comment>(`/issue/${issueIdOrKey}/comment`, params);
  }

  /**
   * Update a comment
   */
  async updateComment(
    issueIdOrKey: string,
    commentId: string,
    params: CommentUpdateParams
  ): Promise<Comment> {
    return this.put<Comment>(`/issue/${issueIdOrKey}/comment/${commentId}`, params);
  }

  /**
   * Delete a comment
   */
  async deleteComment(issueIdOrKey: string, commentId: string): Promise<void> {
    return this.delete<void>(`/issue/${issueIdOrKey}/comment/${commentId}`);
  }

  // ============================================================================
  // Attachments
  // ============================================================================

  /**
   * Get attachment metadata
   */
  async getAttachment(attachmentId: string): Promise<Attachment> {
    return this.get<Attachment>(`/attachment/${attachmentId}`);
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(attachmentId: string): Promise<void> {
    return this.delete<void>(`/attachment/${attachmentId}`);
  }

  /**
   * Upload an attachment to an issue
   * Note: This requires multipart/form-data which needs special handling
   */
  async uploadAttachment(
    issueIdOrKey: string,
    file: Blob | Buffer,
    filename: string
  ): Promise<Attachment[]> {
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
      throw new JiraApiError(
        `Failed to upload attachment: ${response.statusText}`,
        response.status
      );
    }

    return response.json() as Promise<Attachment[]>;
  }

  // ============================================================================
  // Worklogs
  // ============================================================================

  /**
   * Get worklogs for an issue
   */
  async getWorklogs(
    issueIdOrKey: string,
    params?: PaginationParams
  ): Promise<PagedResponse<Worklog>> {
    return this.get<PagedResponse<Worklog>>(`/issue/${issueIdOrKey}/worklog`, {
      startAt: params?.startAt,
      maxResults: params?.maxResults,
    });
  }

  /**
   * Get a single worklog
   */
  async getWorklog(issueIdOrKey: string, worklogId: string): Promise<Worklog> {
    return this.get<Worklog>(`/issue/${issueIdOrKey}/worklog/${worklogId}`);
  }

  /**
   * Add a worklog to an issue
   */
  async addWorklog(issueIdOrKey: string, params: WorklogCreateParams): Promise<Worklog> {
    return this.post<Worklog>(`/issue/${issueIdOrKey}/worklog`, params);
  }

  /**
   * Update a worklog
   */
  async updateWorklog(
    issueIdOrKey: string,
    worklogId: string,
    params: WorklogUpdateParams
  ): Promise<Worklog> {
    return this.put<Worklog>(`/issue/${issueIdOrKey}/worklog/${worklogId}`, params);
  }

  /**
   * Delete a worklog
   */
  async deleteWorklog(issueIdOrKey: string, worklogId: string): Promise<void> {
    return this.delete<void>(`/issue/${issueIdOrKey}/worklog/${worklogId}`);
  }

  // ============================================================================
  // Issue Links
  // ============================================================================

  /**
   * Get all issue link types
   */
  async getIssueLinkTypes(): Promise<{ issueLinkTypes: IssueLinkType[] }> {
    return this.get<{ issueLinkTypes: IssueLinkType[] }>('/issueLinkType');
  }

  /**
   * Create an issue link
   */
  async createIssueLink(params: IssueLinkCreateParams): Promise<void> {
    return this.post<void>('/issueLink', params);
  }

  /**
   * Get an issue link
   */
  async getIssueLink(linkId: string): Promise<IssueLink> {
    return this.get<IssueLink>(`/issueLink/${linkId}`);
  }

  /**
   * Delete an issue link
   */
  async deleteIssueLink(linkId: string): Promise<void> {
    return this.delete<void>(`/issueLink/${linkId}`);
  }

  // ============================================================================
  // Watchers & Votes
  // ============================================================================

  /**
   * Get watchers for an issue
   */
  async getWatchers(issueIdOrKey: string): Promise<import('./types.js').Watches> {
    return this.get<import('./types.js').Watches>(`/issue/${issueIdOrKey}/watchers`);
  }

  /**
   * Add a watcher to an issue
   */
  async addWatcher(issueIdOrKey: string, accountId: string): Promise<void> {
    return this.post<void>(`/issue/${issueIdOrKey}/watchers`, JSON.stringify(accountId));
  }

  /**
   * Remove a watcher from an issue
   */
  async removeWatcher(issueIdOrKey: string, accountId: string): Promise<void> {
    return this.delete<void>(`/issue/${issueIdOrKey}/watchers`, { accountId });
  }

  /**
   * Get votes for an issue
   */
  async getVotes(issueIdOrKey: string): Promise<import('./types.js').Votes> {
    return this.get<import('./types.js').Votes>(`/issue/${issueIdOrKey}/votes`);
  }

  /**
   * Add vote to an issue
   */
  async addVote(issueIdOrKey: string): Promise<void> {
    return this.post<void>(`/issue/${issueIdOrKey}/votes`);
  }

  /**
   * Remove vote from an issue
   */
  async removeVote(issueIdOrKey: string): Promise<void> {
    return this.delete<void>(`/issue/${issueIdOrKey}/votes`);
  }

  // ============================================================================
  // Projects
  // ============================================================================

  /**
   * Get all projects
   */
  async getProjects(params?: ProjectSearchParams): Promise<PagedResponse<Project>> {
    return this.get<PagedResponse<Project>>('/project/search', {
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
  async getProject(projectIdOrKey: string, expand?: string[]): Promise<Project> {
    return this.get<Project>(`/project/${projectIdOrKey}`, { expand });
  }

  /**
   * Create a new project
   */
  async createProject(params: ProjectCreateParams): Promise<Project> {
    return this.post<Project>('/project', params);
  }

  /**
   * Update a project
   */
  async updateProject(projectIdOrKey: string, params: ProjectUpdateParams): Promise<Project> {
    return this.put<Project>(`/project/${projectIdOrKey}`, params);
  }

  /**
   * Delete a project
   */
  async deleteProject(projectIdOrKey: string): Promise<void> {
    return this.delete<void>(`/project/${projectIdOrKey}`);
  }

  /**
   * Get project components
   */
  async getProjectComponents(projectIdOrKey: string): Promise<Component[]> {
    return this.get<Component[]>(`/project/${projectIdOrKey}/components`);
  }

  /**
   * Get project versions
   */
  async getProjectVersions(projectIdOrKey: string): Promise<Version[]> {
    return this.get<Version[]>(`/project/${projectIdOrKey}/versions`);
  }

  // ============================================================================
  // Users
  // ============================================================================

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<CurrentUser> {
    return this.get<CurrentUser>('/myself');
  }

  /**
   * Get a user by account ID
   */
  async getUser(accountId: string): Promise<User> {
    return this.get<User>('/user', { accountId });
  }

  /**
   * Search for users
   */
  async searchUsers(params?: UserSearchParams): Promise<User[]> {
    return this.get<User[]>('/user/search', {
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
  async searchAssignableUsers(
    issueKey?: string,
    projectKey?: string,
    params?: UserSearchParams
  ): Promise<User[]> {
    return this.get<User[]>('/user/assignable/search', {
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
  async getIssueTypes(): Promise<IssueType[]> {
    return this.get<IssueType[]>('/issuetype');
  }

  /**
   * Get issue types for a project
   */
  async getProjectIssueTypes(projectIdOrKey: string): Promise<IssueType[]> {
    return this.get<IssueType[]>(`/issuetype/project?projectId=${projectIdOrKey}`);
  }

  /**
   * Get all priorities
   */
  async getPriorities(): Promise<Priority[]> {
    return this.get<Priority[]>('/priority');
  }

  /**
   * Get all statuses
   */
  async getStatuses(): Promise<Status[]> {
    return this.get<Status[]>('/status');
  }

  /**
   * Get statuses for a project
   */
  async getProjectStatuses(
    projectIdOrKey: string
  ): Promise<{ issueTypes: Array<{ id: string; statuses: Status[] }> }> {
    return this.get<{ issueTypes: Array<{ id: string; statuses: Status[] }> }>(
      `/project/${projectIdOrKey}/statuses`
    );
  }

  // ============================================================================
  // Fields
  // ============================================================================

  /**
   * Get all fields (system and custom)
   */
  async getFields(): Promise<Field[]> {
    return this.get<Field[]>('/field');
  }

  // ============================================================================
  // Filters
  // ============================================================================

  /**
   * Get a filter
   */
  async getFilter(filterId: string): Promise<Filter> {
    return this.get<Filter>(`/filter/${filterId}`);
  }

  /**
   * Get favorite filters
   */
  async getFavoriteFilters(): Promise<Filter[]> {
    return this.get<Filter[]>('/filter/favourite');
  }

  /**
   * Get my filters
   */
  async getMyFilters(): Promise<Filter[]> {
    return this.get<Filter[]>('/filter/my');
  }

  // ============================================================================
  // Sprints (Agile API)
  // ============================================================================

  /**
   * Get a sprint
   */
  async getSprint(sprintId: number): Promise<Sprint> {
    return this.request<Sprint>('GET', `/sprint/${sprintId}`, { isAgile: true });
  }

  /**
   * Create a sprint
   */
  async createSprint(params: SprintCreateParams): Promise<Sprint> {
    return this.request<Sprint>('POST', '/sprint', { body: params, isAgile: true });
  }

  /**
   * Update a sprint
   */
  async updateSprint(sprintId: number, params: SprintUpdateParams): Promise<Sprint> {
    return this.request<Sprint>('PUT', `/sprint/${sprintId}`, { body: params, isAgile: true });
  }

  /**
   * Delete a sprint
   */
  async deleteSprint(sprintId: number): Promise<void> {
    return this.request<void>('DELETE', `/sprint/${sprintId}`, { isAgile: true });
  }

  /**
   * Get issues in a sprint
   */
  async getSprintIssues(
    sprintId: number,
    params?: PaginationParams & { jql?: string; fields?: string[] }
  ): Promise<SearchResponse> {
    return this.request<SearchResponse>('GET', `/sprint/${sprintId}/issue`, {
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
  async moveIssuesToSprint(
    sprintId: number,
    issueKeys: string[],
    rankBefore?: string,
    rankAfter?: string
  ): Promise<void> {
    return this.request<void>('POST', `/sprint/${sprintId}/issue`, {
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
  async getBoards(
    params?: PaginationParams & {
      name?: string;
      projectKeyOrId?: string;
      type?: 'scrum' | 'kanban' | 'simple';
    }
  ): Promise<PagedResponse<Board>> {
    return this.request<PagedResponse<Board>>('GET', '/board', {
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
  async getBoard(boardId: number): Promise<Board> {
    return this.request<Board>('GET', `/board/${boardId}`, { isAgile: true });
  }

  /**
   * Get sprints for a board
   */
  async getBoardSprints(
    boardId: number,
    params?: PaginationParams & { state?: 'future' | 'active' | 'closed' }
  ): Promise<PagedResponse<Sprint>> {
    return this.request<PagedResponse<Sprint>>('GET', `/board/${boardId}/sprint`, {
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
  async getBoardBacklog(
    boardId: number,
    params?: PaginationParams & { jql?: string; fields?: string[] }
  ): Promise<SearchResponse> {
    return this.request<SearchResponse>('GET', `/board/${boardId}/backlog`, {
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
  async *paginate<T>(
    fetchFn: (params: PaginationParams) => Promise<PagedResponse<T>>,
    pageSize = 50
  ): AsyncGenerator<T, void, unknown> {
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
  async getAll<T>(
    fetchFn: (params: PaginationParams) => Promise<PagedResponse<T>>,
    pageSize = 50
  ): Promise<T[]> {
    const results: T[] = [];
    for await (const item of this.paginate(fetchFn, pageSize)) {
      results.push(item);
    }
    return results;
  }
}
