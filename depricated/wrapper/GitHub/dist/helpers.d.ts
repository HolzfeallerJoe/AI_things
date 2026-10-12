/**
 * GitHub Search Query Builder
 * Helps construct search queries for GitHub's search API
 */
export declare class SearchQueryBuilder {
    private parts;
    static create(): SearchQueryBuilder;
    /**
     * Add a raw query term
     */
    term(value: string): this;
    /**
     * Add a qualifier (key:value)
     */
    qualifier(key: string, value: string | number | boolean): this;
    /**
     * Search in repository name, description, or readme
     */
    in(locations: ('name' | 'description' | 'topics' | 'readme')[]): this;
    /**
     * Filter by user or organization
     */
    user(username: string): this;
    /**
     * Filter by organization
     */
    org(orgName: string): this;
    /**
     * Filter by repository
     */
    repo(fullName: string): this;
    /**
     * Filter by repository size (in KB)
     */
    size(operator: string, kb: number): this;
    /**
     * Filter by number of forks
     */
    forks(operator: string, count: number): this;
    /**
     * Filter by number of stars
     */
    stars(operator: string, count: number): this;
    /**
     * Filter by language
     */
    language(lang: string): this;
    /**
     * Filter by topic
     */
    topic(topicName: string): this;
    /**
     * Filter by number of topics
     */
    topics(operator: string, count: number): this;
    /**
     * Filter by license
     */
    license(licenseKey: string): this;
    /**
     * Filter by visibility
     */
    visibility(type: 'public' | 'private' | 'internal'): this;
    /**
     * Filter by mirror status
     */
    isMirror(value: boolean): this;
    /**
     * Filter by archived status
     */
    isArchived(value: boolean): this;
    /**
     * Filter by fork status
     */
    isFork(value: boolean | 'only'): this;
    /**
     * Filter by template status
     */
    isTemplate(value: boolean): this;
    /**
     * Filter by issue type
     */
    type(issueType: 'issue' | 'pr'): this;
    /**
     * Filter by state
     */
    state(issueState: 'open' | 'closed'): this;
    /**
     * Filter by author
     */
    author(username: string): this;
    /**
     * Filter by assignee
     */
    assignee(username: string): this;
    /**
     * Filter by mentions
     */
    mentions(username: string): this;
    /**
     * Filter by commenter
     */
    commenter(username: string): this;
    /**
     * Filter by involvement (author, assignee, mentions, commenter)
     */
    involves(username: string): this;
    /**
     * Filter by team mention
     */
    team(teamName: string): this;
    /**
     * Filter by label
     */
    label(labelName: string): this;
    /**
     * Filter by milestone
     */
    milestone(milestoneName: string): this;
    /**
     * Filter by project board
     */
    project(projectNumber: number): this;
    /**
     * Filter by number of comments
     */
    comments(operator: string, count: number): this;
    /**
     * Filter by number of interactions (reactions + comments)
     */
    interactions(operator: string, count: number): this;
    /**
     * Filter by number of reactions
     */
    reactions(operator: string, count: number): this;
    /**
     * Filter by creation date
     */
    created(operator: string, date: string): this;
    /**
     * Filter by update date
     */
    updated(operator: string, date: string): this;
    /**
     * Filter by push date
     */
    pushed(operator: string, date: string): this;
    /**
     * Filter by closed date
     */
    closed(operator: string, date: string): this;
    /**
     * Filter by merge date
     */
    merged(operator: string, date: string): this;
    /**
     * Filter by merge status
     */
    isMerged(value: boolean): this;
    /**
     * Filter by draft status
     */
    isDraft(value: boolean): this;
    /**
     * Filter by review status
     */
    reviewStatus(status: 'none' | 'required' | 'approved' | 'changes_requested'): this;
    /**
     * Filter by reviewer
     */
    reviewedBy(username: string): this;
    /**
     * Filter by review requested
     */
    reviewRequested(username: string): this;
    /**
     * Filter by team review requested
     */
    teamReviewRequested(teamName: string): this;
    /**
     * Filter by base branch
     */
    base(branchName: string): this;
    /**
     * Filter by head branch
     */
    head(branchName: string): this;
    /**
     * Filter by filename
     */
    filename(name: string): this;
    /**
     * Filter by file extension
     */
    extension(ext: string): this;
    /**
     * Filter by file path
     */
    path(filePath: string): this;
    /**
     * Filter by number of followers
     */
    followers(operator: string, count: number): this;
    /**
     * Filter by number of repositories
     */
    repos(operator: string, count: number): this;
    /**
     * Filter by location
     */
    location(place: string): this;
    /**
     * Negate a qualifier
     */
    not(key: string, value: string | number | boolean): this;
    /**
     * Exclude a label
     */
    notLabel(labelName: string): this;
    /**
     * Exclude a language
     */
    notLanguage(lang: string): this;
    /**
     * Build the search query string
     */
    build(): string;
}
/**
 * Encode content to base64 for file creation/update
 */
export declare function encodeBase64(content: string): string;
/**
 * Decode base64 content from file response
 */
export declare function decodeBase64(content: string): string;
/**
 * Parse a repository full name into owner and repo
 */
export declare function parseRepoFullName(fullName: string): {
    owner: string;
    repo: string;
};
/**
 * Format a date for GitHub API (ISO 8601)
 */
export declare function formatDate(date: Date): string;
/**
 * Parse date qualifiers for search
 * Examples: ">2024-01-01", "2024-01-01..2024-12-31", ">=2024-06-01"
 */
export declare function dateRange(start: Date, end?: Date): string;
/**
 * Create a relative date string
 * @param days Number of days ago (negative for past)
 */
export declare function daysAgo(days: number): string;
/**
 * Parse GitHub issue/PR URL to extract owner, repo, and number
 */
export declare function parseIssueUrl(url: string): {
    owner: string;
    repo: string;
    number: number;
    type: 'issue' | 'pull';
};
/**
 * Parse GitHub repository URL to extract owner and repo
 */
export declare function parseRepoUrl(url: string): {
    owner: string;
    repo: string;
};
/**
 * Generate a slug from a string (useful for branch names)
 */
export declare function slugify(text: string): string;
/**
 * Check if a string is a valid branch name
 */
export declare function isValidBranchName(name: string): boolean;
/**
 * Build a comparison URL between two refs
 */
export declare function buildCompareUrl(owner: string, repo: string, base: string, head: string): string;
/**
 * Build a pull request URL
 */
export declare function buildPullRequestUrl(owner: string, repo: string, number: number): string;
/**
 * Build an issue URL
 */
export declare function buildIssueUrl(owner: string, repo: string, number: number): string;
/**
 * Build a file URL
 */
export declare function buildFileUrl(owner: string, repo: string, path: string, ref?: string): string;
//# sourceMappingURL=helpers.d.ts.map