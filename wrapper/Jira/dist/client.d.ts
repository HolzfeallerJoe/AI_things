import { JiraConfig, Issue, IssueCreateParams, IssueUpdateParams, IssueGetParams, SearchParams, SearchResponse, Project, ProjectCreateParams, ProjectUpdateParams, ProjectSearchParams, User, CurrentUser, UserSearchParams, Comment, CommentCreateParams, CommentUpdateParams, CommentsParams, Attachment, Worklog, WorklogCreateParams, WorklogUpdateParams, Transition, TransitionParams, IssueLink, IssueLinkCreateParams, IssueLinkType, Component, Version, IssueType, Priority, Status, Field, Filter, Sprint, SprintCreateParams, SprintUpdateParams, Board, PagedResponse, PaginationParams, ErrorResponse, BulkIssueCreateParams, BulkIssueCreateResponse, BulkTransitionParams } from './types.js';
/**
 * Custom error class for Jira API errors
 */
export declare class JiraApiError extends Error {
    readonly status: number;
    readonly errorResponse?: ErrorResponse | undefined;
    constructor(message: string, status: number, errorResponse?: ErrorResponse | undefined);
}
/**
 * Type-safe Jira REST API v3 Client
 */
export declare class JiraClient {
    private readonly baseUrl;
    private readonly agileBaseUrl;
    private readonly authHeader;
    constructor(config: JiraConfig);
    private request;
    private get;
    private post;
    private put;
    private delete;
    /**
     * Get a single issue by ID or key
     */
    getIssue(issueIdOrKey: string, params?: IssueGetParams): Promise<Issue>;
    /**
     * Create a new issue
     */
    createIssue(params: IssueCreateParams): Promise<Issue>;
    /**
     * Create multiple issues in bulk
     */
    createIssuesBulk(params: BulkIssueCreateParams): Promise<BulkIssueCreateResponse>;
    /**
     * Update an existing issue
     */
    updateIssue(issueIdOrKey: string, params: IssueUpdateParams): Promise<void>;
    /**
     * Delete an issue
     */
    deleteIssue(issueIdOrKey: string, deleteSubtasks?: boolean): Promise<void>;
    /**
     * Search for issues using JQL
     */
    searchIssues(params: SearchParams): Promise<SearchResponse>;
    /**
     * Get issue changelog
     */
    getIssueChangelog(issueIdOrKey: string, params?: PaginationParams): Promise<PagedResponse<import('./types.js').ChangelogHistory>>;
    /**
     * Get available transitions for an issue
     */
    getTransitions(issueIdOrKey: string): Promise<{
        transitions: Transition[];
    }>;
    /**
     * Transition an issue to a new status
     */
    transitionIssue(issueIdOrKey: string, params: TransitionParams): Promise<void>;
    /**
     * Bulk transition multiple issues
     */
    bulkTransitionIssues(params: BulkTransitionParams): Promise<void>;
    /**
     * Get all comments for an issue
     */
    getComments(issueIdOrKey: string, params?: CommentsParams): Promise<PagedResponse<Comment>>;
    /**
     * Get a single comment
     */
    getComment(issueIdOrKey: string, commentId: string): Promise<Comment>;
    /**
     * Add a comment to an issue
     */
    addComment(issueIdOrKey: string, params: CommentCreateParams): Promise<Comment>;
    /**
     * Update a comment
     */
    updateComment(issueIdOrKey: string, commentId: string, params: CommentUpdateParams): Promise<Comment>;
    /**
     * Delete a comment
     */
    deleteComment(issueIdOrKey: string, commentId: string): Promise<void>;
    /**
     * Get attachment metadata
     */
    getAttachment(attachmentId: string): Promise<Attachment>;
    /**
     * Delete an attachment
     */
    deleteAttachment(attachmentId: string): Promise<void>;
    /**
     * Upload an attachment to an issue
     * Note: This requires multipart/form-data which needs special handling
     */
    uploadAttachment(issueIdOrKey: string, file: Blob | Buffer, filename: string): Promise<Attachment[]>;
    /**
     * Get worklogs for an issue
     */
    getWorklogs(issueIdOrKey: string, params?: PaginationParams): Promise<PagedResponse<Worklog>>;
    /**
     * Get a single worklog
     */
    getWorklog(issueIdOrKey: string, worklogId: string): Promise<Worklog>;
    /**
     * Add a worklog to an issue
     */
    addWorklog(issueIdOrKey: string, params: WorklogCreateParams): Promise<Worklog>;
    /**
     * Update a worklog
     */
    updateWorklog(issueIdOrKey: string, worklogId: string, params: WorklogUpdateParams): Promise<Worklog>;
    /**
     * Delete a worklog
     */
    deleteWorklog(issueIdOrKey: string, worklogId: string): Promise<void>;
    /**
     * Get all issue link types
     */
    getIssueLinkTypes(): Promise<{
        issueLinkTypes: IssueLinkType[];
    }>;
    /**
     * Create an issue link
     */
    createIssueLink(params: IssueLinkCreateParams): Promise<void>;
    /**
     * Get an issue link
     */
    getIssueLink(linkId: string): Promise<IssueLink>;
    /**
     * Delete an issue link
     */
    deleteIssueLink(linkId: string): Promise<void>;
    /**
     * Get watchers for an issue
     */
    getWatchers(issueIdOrKey: string): Promise<import('./types.js').Watches>;
    /**
     * Add a watcher to an issue
     */
    addWatcher(issueIdOrKey: string, accountId: string): Promise<void>;
    /**
     * Remove a watcher from an issue
     */
    removeWatcher(issueIdOrKey: string, accountId: string): Promise<void>;
    /**
     * Get votes for an issue
     */
    getVotes(issueIdOrKey: string): Promise<import('./types.js').Votes>;
    /**
     * Add vote to an issue
     */
    addVote(issueIdOrKey: string): Promise<void>;
    /**
     * Remove vote from an issue
     */
    removeVote(issueIdOrKey: string): Promise<void>;
    /**
     * Get all projects
     */
    getProjects(params?: ProjectSearchParams): Promise<PagedResponse<Project>>;
    /**
     * Get a single project
     */
    getProject(projectIdOrKey: string, expand?: string[]): Promise<Project>;
    /**
     * Create a new project
     */
    createProject(params: ProjectCreateParams): Promise<Project>;
    /**
     * Update a project
     */
    updateProject(projectIdOrKey: string, params: ProjectUpdateParams): Promise<Project>;
    /**
     * Delete a project
     */
    deleteProject(projectIdOrKey: string): Promise<void>;
    /**
     * Get project components
     */
    getProjectComponents(projectIdOrKey: string): Promise<Component[]>;
    /**
     * Get project versions
     */
    getProjectVersions(projectIdOrKey: string): Promise<Version[]>;
    /**
     * Get current user
     */
    getCurrentUser(): Promise<CurrentUser>;
    /**
     * Get a user by account ID
     */
    getUser(accountId: string): Promise<User>;
    /**
     * Search for users
     */
    searchUsers(params?: UserSearchParams): Promise<User[]>;
    /**
     * Search users assignable to an issue
     */
    searchAssignableUsers(issueKey?: string, projectKey?: string, params?: UserSearchParams): Promise<User[]>;
    /**
     * Get all issue types
     */
    getIssueTypes(): Promise<IssueType[]>;
    /**
     * Get issue types for a project
     */
    getProjectIssueTypes(projectIdOrKey: string): Promise<IssueType[]>;
    /**
     * Get all priorities
     */
    getPriorities(): Promise<Priority[]>;
    /**
     * Get all statuses
     */
    getStatuses(): Promise<Status[]>;
    /**
     * Get statuses for a project
     */
    getProjectStatuses(projectIdOrKey: string): Promise<{
        issueTypes: Array<{
            id: string;
            statuses: Status[];
        }>;
    }>;
    /**
     * Get all fields (system and custom)
     */
    getFields(): Promise<Field[]>;
    /**
     * Get a filter
     */
    getFilter(filterId: string): Promise<Filter>;
    /**
     * Get favorite filters
     */
    getFavoriteFilters(): Promise<Filter[]>;
    /**
     * Get my filters
     */
    getMyFilters(): Promise<Filter[]>;
    /**
     * Get a sprint
     */
    getSprint(sprintId: number): Promise<Sprint>;
    /**
     * Create a sprint
     */
    createSprint(params: SprintCreateParams): Promise<Sprint>;
    /**
     * Update a sprint
     */
    updateSprint(sprintId: number, params: SprintUpdateParams): Promise<Sprint>;
    /**
     * Delete a sprint
     */
    deleteSprint(sprintId: number): Promise<void>;
    /**
     * Get issues in a sprint
     */
    getSprintIssues(sprintId: number, params?: PaginationParams & {
        jql?: string;
        fields?: string[];
    }): Promise<SearchResponse>;
    /**
     * Move issues to a sprint
     */
    moveIssuesToSprint(sprintId: number, issueKeys: string[], rankBefore?: string, rankAfter?: string): Promise<void>;
    /**
     * Get all boards
     */
    getBoards(params?: PaginationParams & {
        name?: string;
        projectKeyOrId?: string;
        type?: 'scrum' | 'kanban' | 'simple';
    }): Promise<PagedResponse<Board>>;
    /**
     * Get a board
     */
    getBoard(boardId: number): Promise<Board>;
    /**
     * Get sprints for a board
     */
    getBoardSprints(boardId: number, params?: PaginationParams & {
        state?: 'future' | 'active' | 'closed';
    }): Promise<PagedResponse<Sprint>>;
    /**
     * Get backlog issues for a board
     */
    getBoardBacklog(boardId: number, params?: PaginationParams & {
        jql?: string;
        fields?: string[];
    }): Promise<SearchResponse>;
    /**
     * Helper to paginate through all results
     */
    paginate<T>(fetchFn: (params: PaginationParams) => Promise<PagedResponse<T>>, pageSize?: number): AsyncGenerator<T, void, unknown>;
    /**
     * Helper to get all results at once
     */
    getAll<T>(fetchFn: (params: PaginationParams) => Promise<PagedResponse<T>>, pageSize?: number): Promise<T[]>;
}
//# sourceMappingURL=client.d.ts.map