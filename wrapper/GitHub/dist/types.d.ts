export interface GitHubUser {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    gravatar_id: string;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: 'User' | 'Organization' | 'Bot';
    site_admin: boolean;
    name?: string | null;
    company?: string | null;
    blog?: string | null;
    location?: string | null;
    email?: string | null;
    hireable?: boolean | null;
    bio?: string | null;
    twitter_username?: string | null;
    public_repos?: number;
    public_gists?: number;
    followers?: number;
    following?: number;
    created_at?: string;
    updated_at?: string;
}
export interface SimpleUser {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    url: string;
    html_url: string;
    type: string;
}
export interface Repository {
    id: number;
    node_id: string;
    name: string;
    full_name: string;
    private: boolean;
    owner: SimpleUser;
    html_url: string;
    description: string | null;
    fork: boolean;
    url: string;
    forks_url: string;
    keys_url: string;
    collaborators_url: string;
    teams_url: string;
    hooks_url: string;
    issue_events_url: string;
    events_url: string;
    assignees_url: string;
    branches_url: string;
    tags_url: string;
    blobs_url: string;
    git_tags_url: string;
    git_refs_url: string;
    trees_url: string;
    statuses_url: string;
    languages_url: string;
    stargazers_url: string;
    contributors_url: string;
    subscribers_url: string;
    subscription_url: string;
    commits_url: string;
    git_commits_url: string;
    comments_url: string;
    issue_comment_url: string;
    contents_url: string;
    compare_url: string;
    merges_url: string;
    archive_url: string;
    downloads_url: string;
    issues_url: string;
    pulls_url: string;
    milestones_url: string;
    notifications_url: string;
    labels_url: string;
    releases_url: string;
    deployments_url: string;
    created_at: string;
    updated_at: string;
    pushed_at: string;
    git_url: string;
    ssh_url: string;
    clone_url: string;
    svn_url: string;
    homepage: string | null;
    size: number;
    stargazers_count: number;
    watchers_count: number;
    language: string | null;
    has_issues: boolean;
    has_projects: boolean;
    has_downloads: boolean;
    has_wiki: boolean;
    has_pages: boolean;
    has_discussions: boolean;
    forks_count: number;
    mirror_url: string | null;
    archived: boolean;
    disabled: boolean;
    open_issues_count: number;
    license: License | null;
    allow_forking: boolean;
    is_template: boolean;
    web_commit_signoff_required: boolean;
    topics: string[];
    visibility: 'public' | 'private' | 'internal';
    forks: number;
    open_issues: number;
    watchers: number;
    default_branch: string;
    permissions?: RepositoryPermissions;
}
export interface RepositoryPermissions {
    admin: boolean;
    maintain?: boolean;
    push: boolean;
    triage?: boolean;
    pull: boolean;
}
export interface License {
    key: string;
    name: string;
    spdx_id: string;
    url: string | null;
    node_id: string;
}
export interface CreateRepositoryParams {
    name: string;
    description?: string;
    homepage?: string;
    private?: boolean;
    visibility?: 'public' | 'private' | 'internal';
    has_issues?: boolean;
    has_projects?: boolean;
    has_wiki?: boolean;
    has_discussions?: boolean;
    is_template?: boolean;
    team_id?: number;
    auto_init?: boolean;
    gitignore_template?: string;
    license_template?: string;
    allow_squash_merge?: boolean;
    allow_merge_commit?: boolean;
    allow_rebase_merge?: boolean;
    allow_auto_merge?: boolean;
    delete_branch_on_merge?: boolean;
}
export interface UpdateRepositoryParams {
    name?: string;
    description?: string;
    homepage?: string;
    private?: boolean;
    visibility?: 'public' | 'private' | 'internal';
    has_issues?: boolean;
    has_projects?: boolean;
    has_wiki?: boolean;
    has_discussions?: boolean;
    is_template?: boolean;
    default_branch?: string;
    allow_squash_merge?: boolean;
    allow_merge_commit?: boolean;
    allow_rebase_merge?: boolean;
    allow_auto_merge?: boolean;
    delete_branch_on_merge?: boolean;
    archived?: boolean;
}
export interface Issue {
    id: number;
    node_id: string;
    url: string;
    repository_url: string;
    labels_url: string;
    comments_url: string;
    events_url: string;
    html_url: string;
    number: number;
    state: 'open' | 'closed';
    state_reason?: 'completed' | 'reopened' | 'not_planned' | null;
    title: string;
    body: string | null;
    user: SimpleUser | null;
    labels: Label[];
    assignee: SimpleUser | null;
    assignees: SimpleUser[];
    milestone: Milestone | null;
    locked: boolean;
    active_lock_reason: string | null;
    comments: number;
    pull_request?: {
        url: string;
        html_url: string;
        diff_url: string;
        patch_url: string;
        merged_at?: string | null;
    };
    closed_at: string | null;
    created_at: string;
    updated_at: string;
    draft?: boolean;
    closed_by?: SimpleUser | null;
    author_association: AuthorAssociation;
    reactions?: Reactions;
}
export interface Label {
    id: number;
    node_id: string;
    url: string;
    name: string;
    description: string | null;
    color: string;
    default: boolean;
}
export interface Milestone {
    url: string;
    html_url: string;
    labels_url: string;
    id: number;
    node_id: string;
    number: number;
    state: 'open' | 'closed';
    title: string;
    description: string | null;
    creator: SimpleUser | null;
    open_issues: number;
    closed_issues: number;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    due_on: string | null;
}
export type AuthorAssociation = 'COLLABORATOR' | 'CONTRIBUTOR' | 'FIRST_TIMER' | 'FIRST_TIME_CONTRIBUTOR' | 'MANNEQUIN' | 'MEMBER' | 'NONE' | 'OWNER';
export interface Reactions {
    url: string;
    total_count: number;
    '+1': number;
    '-1': number;
    laugh: number;
    hooray: number;
    confused: number;
    heart: number;
    rocket: number;
    eyes: number;
}
export interface CreateIssueParams {
    title: string;
    body?: string;
    assignee?: string;
    assignees?: string[];
    milestone?: number;
    labels?: string[];
}
export interface UpdateIssueParams {
    title?: string;
    body?: string;
    assignee?: string | null;
    assignees?: string[];
    milestone?: number | null;
    labels?: string[];
    state?: 'open' | 'closed';
    state_reason?: 'completed' | 'not_planned' | 'reopened';
}
export interface IssueComment {
    id: number;
    node_id: string;
    url: string;
    html_url: string;
    body: string;
    user: SimpleUser | null;
    created_at: string;
    updated_at: string;
    issue_url: string;
    author_association: AuthorAssociation;
    reactions?: Reactions;
}
export interface PullRequest {
    id: number;
    node_id: string;
    url: string;
    html_url: string;
    diff_url: string;
    patch_url: string;
    issue_url: string;
    number: number;
    state: 'open' | 'closed';
    locked: boolean;
    title: string;
    user: SimpleUser | null;
    body: string | null;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    merged_at: string | null;
    merge_commit_sha: string | null;
    assignee: SimpleUser | null;
    assignees: SimpleUser[];
    requested_reviewers: SimpleUser[];
    requested_teams: Team[];
    labels: Label[];
    milestone: Milestone | null;
    draft: boolean;
    commits_url: string;
    review_comments_url: string;
    review_comment_url: string;
    comments_url: string;
    statuses_url: string;
    head: PullRequestRef;
    base: PullRequestRef;
    author_association: AuthorAssociation;
    auto_merge: AutoMerge | null;
    merged: boolean;
    mergeable: boolean | null;
    rebaseable: boolean | null;
    mergeable_state: string;
    merged_by: SimpleUser | null;
    comments: number;
    review_comments: number;
    maintainer_can_modify: boolean;
    commits: number;
    additions: number;
    deletions: number;
    changed_files: number;
}
export interface PullRequestRef {
    label: string;
    ref: string;
    sha: string;
    user: SimpleUser | null;
    repo: Repository | null;
}
export interface AutoMerge {
    enabled_by: SimpleUser;
    merge_method: 'merge' | 'squash' | 'rebase';
    commit_title: string;
    commit_message: string;
}
export interface Team {
    id: number;
    node_id: string;
    url: string;
    html_url: string;
    name: string;
    slug: string;
    description: string | null;
    privacy: 'closed' | 'secret';
    permission: string;
    members_url: string;
    repositories_url: string;
    parent: Team | null;
}
export interface CreatePullRequestParams {
    title: string;
    body?: string;
    head: string;
    base: string;
    head_repo?: string;
    maintainer_can_modify?: boolean;
    draft?: boolean;
}
export interface UpdatePullRequestParams {
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    base?: string;
    maintainer_can_modify?: boolean;
}
export interface PullRequestReview {
    id: number;
    node_id: string;
    user: SimpleUser | null;
    body: string;
    state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
    html_url: string;
    pull_request_url: string;
    submitted_at: string;
    commit_id: string;
    author_association: AuthorAssociation;
}
export interface CreateReviewParams {
    commit_id?: string;
    body?: string;
    event?: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    comments?: ReviewComment[];
}
export interface ReviewComment {
    path: string;
    position?: number;
    body: string;
    line?: number;
    side?: 'LEFT' | 'RIGHT';
    start_line?: number;
    start_side?: 'LEFT' | 'RIGHT';
}
export interface Branch {
    name: string;
    commit: {
        sha: string;
        url: string;
    };
    protected: boolean;
    protection?: BranchProtection;
    protection_url?: string;
}
export interface BranchProtection {
    url: string;
    enabled: boolean;
    required_status_checks?: RequiredStatusChecks;
    enforce_admins?: {
        url: string;
        enabled: boolean;
    };
    required_pull_request_reviews?: RequiredPullRequestReviews;
    restrictions?: BranchRestrictions;
    required_linear_history?: {
        enabled: boolean;
    };
    allow_force_pushes?: {
        enabled: boolean;
    };
    allow_deletions?: {
        enabled: boolean;
    };
    required_conversation_resolution?: {
        enabled: boolean;
    };
}
export interface RequiredStatusChecks {
    url: string;
    strict: boolean;
    contexts: string[];
    contexts_url: string;
    checks: StatusCheck[];
}
export interface StatusCheck {
    context: string;
    app_id: number | null;
}
export interface RequiredPullRequestReviews {
    url: string;
    dismiss_stale_reviews: boolean;
    require_code_owner_reviews: boolean;
    required_approving_review_count: number;
    require_last_push_approval?: boolean;
    dismissal_restrictions?: {
        users: SimpleUser[];
        teams: Team[];
        apps?: GitHubApp[];
    };
}
export interface BranchRestrictions {
    url: string;
    users_url: string;
    teams_url: string;
    apps_url: string;
    users: SimpleUser[];
    teams: Team[];
    apps: GitHubApp[];
}
export interface GitHubApp {
    id: number;
    slug: string;
    node_id: string;
    owner: SimpleUser | null;
    name: string;
    description: string | null;
    external_url: string;
    html_url: string;
    created_at: string;
    updated_at: string;
}
export interface Commit {
    sha: string;
    node_id: string;
    url: string;
    html_url: string;
    comments_url: string;
    commit: {
        url: string;
        author: GitAuthor | null;
        committer: GitAuthor | null;
        message: string;
        tree: {
            sha: string;
            url: string;
        };
        comment_count: number;
        verification?: Verification;
    };
    author: SimpleUser | null;
    committer: SimpleUser | null;
    parents: {
        sha: string;
        url: string;
        html_url?: string;
    }[];
    stats?: {
        additions: number;
        deletions: number;
        total: number;
    };
    files?: CommitFile[];
}
export interface GitAuthor {
    name: string;
    email: string;
    date: string;
}
export interface Verification {
    verified: boolean;
    reason: string;
    signature: string | null;
    payload: string | null;
}
export interface CommitFile {
    sha: string;
    filename: string;
    status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
    additions: number;
    deletions: number;
    changes: number;
    blob_url: string;
    raw_url: string;
    contents_url: string;
    patch?: string;
    previous_filename?: string;
}
export interface FileContent {
    type: 'file';
    encoding: 'base64';
    size: number;
    name: string;
    path: string;
    content: string;
    sha: string;
    url: string;
    git_url: string;
    html_url: string;
    download_url: string;
}
export interface DirectoryContent {
    type: 'dir';
    size: number;
    name: string;
    path: string;
    sha: string;
    url: string;
    git_url: string;
    html_url: string;
    download_url: string | null;
}
export type ContentItem = FileContent | DirectoryContent;
export interface CreateOrUpdateFileParams {
    message: string;
    content: string;
    sha?: string;
    branch?: string;
    committer?: GitAuthor;
    author?: GitAuthor;
}
export interface DeleteFileParams {
    message: string;
    sha: string;
    branch?: string;
    committer?: GitAuthor;
    author?: GitAuthor;
}
export interface FileCommitResponse {
    content: FileContent | null;
    commit: {
        sha: string;
        node_id: string;
        url: string;
        html_url: string;
        author: GitAuthor;
        committer: GitAuthor;
        message: string;
        tree: {
            sha: string;
            url: string;
        };
        parents: {
            sha: string;
            url: string;
            html_url: string;
        }[];
        verification?: Verification;
    };
}
export interface Release {
    id: number;
    node_id: string;
    url: string;
    assets_url: string;
    upload_url: string;
    html_url: string;
    tag_name: string;
    target_commitish: string;
    name: string | null;
    draft: boolean;
    prerelease: boolean;
    created_at: string;
    published_at: string | null;
    author: SimpleUser;
    assets: ReleaseAsset[];
    body: string | null;
    body_html?: string;
    body_text?: string;
    tarball_url: string | null;
    zipball_url: string | null;
}
export interface ReleaseAsset {
    id: number;
    node_id: string;
    url: string;
    name: string;
    label: string | null;
    content_type: string;
    state: 'uploaded' | 'open';
    size: number;
    download_count: number;
    created_at: string;
    updated_at: string;
    browser_download_url: string;
    uploader: SimpleUser | null;
}
export interface CreateReleaseParams {
    tag_name: string;
    target_commitish?: string;
    name?: string;
    body?: string;
    draft?: boolean;
    prerelease?: boolean;
    generate_release_notes?: boolean;
}
export interface UpdateReleaseParams {
    tag_name?: string;
    target_commitish?: string;
    name?: string;
    body?: string;
    draft?: boolean;
    prerelease?: boolean;
}
export interface Webhook {
    id: number;
    type: string;
    name: string;
    active: boolean;
    events: string[];
    config: WebhookConfig;
    updated_at: string;
    created_at: string;
    url: string;
    test_url: string;
    ping_url: string;
    deliveries_url?: string;
    last_response: WebhookLastResponse;
}
export interface WebhookConfig {
    url?: string;
    content_type?: 'json' | 'form';
    secret?: string;
    insecure_ssl?: '0' | '1';
}
export interface WebhookLastResponse {
    code: number | null;
    status: string | null;
    message: string | null;
}
export interface CreateWebhookParams {
    name?: string;
    config: WebhookConfig;
    events?: string[];
    active?: boolean;
}
export interface SearchResponse<T> {
    total_count: number;
    incomplete_results: boolean;
    items: T[];
}
export interface SearchRepositoriesParams {
    q: string;
    sort?: 'stars' | 'forks' | 'help-wanted-issues' | 'updated';
    order?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
}
export interface SearchIssuesParams {
    q: string;
    sort?: 'comments' | 'reactions' | 'reactions-+1' | 'reactions--1' | 'reactions-smile' | 'reactions-thinking_face' | 'reactions-heart' | 'reactions-tada' | 'interactions' | 'created' | 'updated';
    order?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
}
export interface SearchUsersParams {
    q: string;
    sort?: 'followers' | 'repositories' | 'joined';
    order?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
}
export interface SearchCodeParams {
    q: string;
    sort?: 'indexed';
    order?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
}
export interface CodeSearchResult {
    name: string;
    path: string;
    sha: string;
    url: string;
    git_url: string;
    html_url: string;
    repository: Repository;
    score: number;
}
export interface Organization {
    login: string;
    id: number;
    node_id: string;
    url: string;
    repos_url: string;
    events_url: string;
    hooks_url: string;
    issues_url: string;
    members_url: string;
    public_members_url: string;
    avatar_url: string;
    description: string | null;
    name?: string;
    company?: string;
    blog?: string;
    location?: string;
    email?: string;
    twitter_username?: string | null;
    is_verified?: boolean;
    has_organization_projects?: boolean;
    has_repository_projects?: boolean;
    public_repos?: number;
    public_gists?: number;
    followers?: number;
    following?: number;
    html_url?: string;
    created_at?: string;
    updated_at?: string;
    type?: string;
}
export interface Gist {
    id: string;
    node_id: string;
    url: string;
    forks_url: string;
    commits_url: string;
    git_pull_url: string;
    git_push_url: string;
    html_url: string;
    files: Record<string, GistFile>;
    public: boolean;
    created_at: string;
    updated_at: string;
    description: string | null;
    comments: number;
    user: SimpleUser | null;
    comments_url: string;
    owner?: SimpleUser;
    truncated?: boolean;
}
export interface GistFile {
    filename: string;
    type: string;
    language: string | null;
    raw_url: string;
    size: number;
    content?: string;
}
export interface CreateGistParams {
    description?: string;
    files: Record<string, {
        content: string;
    }>;
    public?: boolean;
}
export interface UpdateGistParams {
    description?: string;
    files?: Record<string, {
        content?: string;
        filename?: string;
    } | null>;
}
export interface Workflow {
    id: number;
    node_id: string;
    name: string;
    path: string;
    state: 'active' | 'deleted' | 'disabled_fork' | 'disabled_inactivity' | 'disabled_manually';
    created_at: string;
    updated_at: string;
    url: string;
    html_url: string;
    badge_url: string;
}
export interface WorkflowRun {
    id: number;
    node_id: string;
    name: string;
    head_branch: string;
    head_sha: string;
    path: string;
    run_number: number;
    event: string;
    status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending';
    conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | 'stale' | null;
    workflow_id: number;
    url: string;
    html_url: string;
    created_at: string;
    updated_at: string;
    run_attempt: number;
    run_started_at: string;
    jobs_url: string;
    logs_url: string;
    check_suite_url: string;
    artifacts_url: string;
    cancel_url: string;
    rerun_url: string;
    workflow_url: string;
    head_commit: {
        id: string;
        tree_id: string;
        message: string;
        timestamp: string;
        author: GitAuthor;
        committer: GitAuthor;
    } | null;
    repository: Repository;
    head_repository: Repository;
}
export interface WorkflowRunsResponse {
    total_count: number;
    workflow_runs: WorkflowRun[];
}
export interface WorkflowsResponse {
    total_count: number;
    workflows: Workflow[];
}
export interface Notification {
    id: string;
    repository: Repository;
    subject: {
        title: string;
        url: string;
        latest_comment_url: string | null;
        type: 'Issue' | 'PullRequest' | 'Commit' | 'Release' | 'Discussion' | 'CheckSuite';
    };
    reason: 'assign' | 'author' | 'comment' | 'ci_activity' | 'invitation' | 'manual' | 'mention' | 'review_requested' | 'security_alert' | 'state_change' | 'subscribed' | 'team_mention';
    unread: boolean;
    updated_at: string;
    last_read_at: string | null;
    url: string;
    subscription_url: string;
}
export interface RateLimitResponse {
    resources: {
        core: RateLimit;
        search: RateLimit;
        graphql: RateLimit;
        integration_manifest?: RateLimit;
        code_scanning_upload?: RateLimit;
    };
    rate: RateLimit;
}
export interface RateLimit {
    limit: number;
    used: number;
    remaining: number;
    reset: number;
}
export interface GitHubErrorResponse {
    message: string;
    documentation_url?: string;
    errors?: Array<{
        resource?: string;
        field?: string;
        code?: string;
        message?: string;
    }>;
}
export interface PaginationParams {
    per_page?: number;
    page?: number;
}
export interface ListRepositoriesParams extends PaginationParams {
    type?: 'all' | 'owner' | 'public' | 'private' | 'member';
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    direction?: 'asc' | 'desc';
}
export interface ListIssuesParams extends PaginationParams {
    milestone?: string | number;
    state?: 'open' | 'closed' | 'all';
    assignee?: string;
    creator?: string;
    mentioned?: string;
    labels?: string;
    sort?: 'created' | 'updated' | 'comments';
    direction?: 'asc' | 'desc';
    since?: string;
}
export interface ListPullRequestsParams extends PaginationParams {
    state?: 'open' | 'closed' | 'all';
    head?: string;
    base?: string;
    sort?: 'created' | 'updated' | 'popularity' | 'long-running';
    direction?: 'asc' | 'desc';
}
export interface ListCommitsParams extends PaginationParams {
    sha?: string;
    path?: string;
    author?: string;
    committer?: string;
    since?: string;
    until?: string;
}
export interface ListBranchesParams extends PaginationParams {
    protected?: boolean;
}
//# sourceMappingURL=types.d.ts.map