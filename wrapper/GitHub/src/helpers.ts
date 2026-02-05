/**
 * GitHub Search Query Builder
 * Helps construct search queries for GitHub's search API
 */
export class SearchQueryBuilder {
  private parts: string[] = [];

  static create(): SearchQueryBuilder {
    return new SearchQueryBuilder();
  }

  /**
   * Add a raw query term
   */
  term(value: string): this {
    this.parts.push(value);
    return this;
  }

  /**
   * Add a qualifier (key:value)
   */
  qualifier(key: string, value: string | number | boolean): this {
    const stringValue = String(value);
    // Quote values with spaces
    const formattedValue = stringValue.includes(' ') ? `"${stringValue}"` : stringValue;
    this.parts.push(`${key}:${formattedValue}`);
    return this;
  }

  // ==========================================================================
  // Repository Search Qualifiers
  // ==========================================================================

  /**
   * Search in repository name, description, or readme
   */
  in(locations: ('name' | 'description' | 'topics' | 'readme')[]): this {
    return this.qualifier('in', locations.join(','));
  }

  /**
   * Filter by user or organization
   */
  user(username: string): this {
    return this.qualifier('user', username);
  }

  /**
   * Filter by organization
   */
  org(orgName: string): this {
    return this.qualifier('org', orgName);
  }

  /**
   * Filter by repository
   */
  repo(fullName: string): this {
    return this.qualifier('repo', fullName);
  }

  /**
   * Filter by repository size (in KB)
   */
  size(operator: string, kb: number): this {
    return this.qualifier('size', `${operator}${kb}`);
  }

  /**
   * Filter by number of forks
   */
  forks(operator: string, count: number): this {
    return this.qualifier('forks', `${operator}${count}`);
  }

  /**
   * Filter by number of stars
   */
  stars(operator: string, count: number): this {
    return this.qualifier('stars', `${operator}${count}`);
  }

  /**
   * Filter by language
   */
  language(lang: string): this {
    return this.qualifier('language', lang);
  }

  /**
   * Filter by topic
   */
  topic(topicName: string): this {
    return this.qualifier('topic', topicName);
  }

  /**
   * Filter by number of topics
   */
  topics(operator: string, count: number): this {
    return this.qualifier('topics', `${operator}${count}`);
  }

  /**
   * Filter by license
   */
  license(licenseKey: string): this {
    return this.qualifier('license', licenseKey);
  }

  /**
   * Filter by visibility
   */
  visibility(type: 'public' | 'private' | 'internal'): this {
    return this.qualifier('is', type);
  }

  /**
   * Filter by mirror status
   */
  isMirror(value: boolean): this {
    return this.qualifier('mirror', value);
  }

  /**
   * Filter by archived status
   */
  isArchived(value: boolean): this {
    return this.qualifier('archived', value);
  }

  /**
   * Filter by fork status
   */
  isFork(value: boolean | 'only'): this {
    return this.qualifier('fork', value);
  }

  /**
   * Filter by template status
   */
  isTemplate(value: boolean): this {
    return this.qualifier('template', value);
  }

  // ==========================================================================
  // Issue/PR Search Qualifiers
  // ==========================================================================

  /**
   * Filter by issue type
   */
  type(issueType: 'issue' | 'pr'): this {
    return this.qualifier('type', issueType);
  }

  /**
   * Filter by state
   */
  state(issueState: 'open' | 'closed'): this {
    return this.qualifier('state', issueState);
  }

  /**
   * Filter by author
   */
  author(username: string): this {
    return this.qualifier('author', username);
  }

  /**
   * Filter by assignee
   */
  assignee(username: string): this {
    return this.qualifier('assignee', username);
  }

  /**
   * Filter by mentions
   */
  mentions(username: string): this {
    return this.qualifier('mentions', username);
  }

  /**
   * Filter by commenter
   */
  commenter(username: string): this {
    return this.qualifier('commenter', username);
  }

  /**
   * Filter by involvement (author, assignee, mentions, commenter)
   */
  involves(username: string): this {
    return this.qualifier('involves', username);
  }

  /**
   * Filter by team mention
   */
  team(teamName: string): this {
    return this.qualifier('team', teamName);
  }

  /**
   * Filter by label
   */
  label(labelName: string): this {
    return this.qualifier('label', labelName);
  }

  /**
   * Filter by milestone
   */
  milestone(milestoneName: string): this {
    return this.qualifier('milestone', milestoneName);
  }

  /**
   * Filter by project board
   */
  project(projectNumber: number): this {
    return this.qualifier('project', projectNumber);
  }

  /**
   * Filter by number of comments
   */
  comments(operator: string, count: number): this {
    return this.qualifier('comments', `${operator}${count}`);
  }

  /**
   * Filter by number of interactions (reactions + comments)
   */
  interactions(operator: string, count: number): this {
    return this.qualifier('interactions', `${operator}${count}`);
  }

  /**
   * Filter by number of reactions
   */
  reactions(operator: string, count: number): this {
    return this.qualifier('reactions', `${operator}${count}`);
  }

  // ==========================================================================
  // Date Qualifiers
  // ==========================================================================

  /**
   * Filter by creation date
   */
  created(operator: string, date: string): this {
    return this.qualifier('created', `${operator}${date}`);
  }

  /**
   * Filter by update date
   */
  updated(operator: string, date: string): this {
    return this.qualifier('updated', `${operator}${date}`);
  }

  /**
   * Filter by push date
   */
  pushed(operator: string, date: string): this {
    return this.qualifier('pushed', `${operator}${date}`);
  }

  /**
   * Filter by closed date
   */
  closed(operator: string, date: string): this {
    return this.qualifier('closed', `${operator}${date}`);
  }

  /**
   * Filter by merge date
   */
  merged(operator: string, date: string): this {
    return this.qualifier('merged', `${operator}${date}`);
  }

  // ==========================================================================
  // PR-specific Qualifiers
  // ==========================================================================

  /**
   * Filter by merge status
   */
  isMerged(value: boolean): this {
    return this.qualifier('is', value ? 'merged' : 'unmerged');
  }

  /**
   * Filter by draft status
   */
  isDraft(value: boolean): this {
    return this.qualifier('draft', value);
  }

  /**
   * Filter by review status
   */
  reviewStatus(status: 'none' | 'required' | 'approved' | 'changes_requested'): this {
    return this.qualifier('review', status);
  }

  /**
   * Filter by reviewer
   */
  reviewedBy(username: string): this {
    return this.qualifier('reviewed-by', username);
  }

  /**
   * Filter by review requested
   */
  reviewRequested(username: string): this {
    return this.qualifier('review-requested', username);
  }

  /**
   * Filter by team review requested
   */
  teamReviewRequested(teamName: string): this {
    return this.qualifier('team-review-requested', teamName);
  }

  /**
   * Filter by base branch
   */
  base(branchName: string): this {
    return this.qualifier('base', branchName);
  }

  /**
   * Filter by head branch
   */
  head(branchName: string): this {
    return this.qualifier('head', branchName);
  }

  // ==========================================================================
  // Code Search Qualifiers
  // ==========================================================================

  /**
   * Filter by filename
   */
  filename(name: string): this {
    return this.qualifier('filename', name);
  }

  /**
   * Filter by file extension
   */
  extension(ext: string): this {
    return this.qualifier('extension', ext);
  }

  /**
   * Filter by file path
   */
  path(filePath: string): this {
    return this.qualifier('path', filePath);
  }

  // ==========================================================================
  // User Search Qualifiers
  // ==========================================================================

  /**
   * Filter by number of followers
   */
  followers(operator: string, count: number): this {
    return this.qualifier('followers', `${operator}${count}`);
  }

  /**
   * Filter by number of repositories
   */
  repos(operator: string, count: number): this {
    return this.qualifier('repos', `${operator}${count}`);
  }

  /**
   * Filter by location
   */
  location(place: string): this {
    return this.qualifier('location', place);
  }

  // ==========================================================================
  // Negation
  // ==========================================================================

  /**
   * Negate a qualifier
   */
  not(key: string, value: string | number | boolean): this {
    const stringValue = String(value);
    const formattedValue = stringValue.includes(' ') ? `"${stringValue}"` : stringValue;
    this.parts.push(`-${key}:${formattedValue}`);
    return this;
  }

  /**
   * Exclude a label
   */
  notLabel(labelName: string): this {
    return this.not('label', labelName);
  }

  /**
   * Exclude a language
   */
  notLanguage(lang: string): this {
    return this.not('language', lang);
  }

  // ==========================================================================
  // Build
  // ==========================================================================

  /**
   * Build the search query string
   */
  build(): string {
    return this.parts.join(' ');
  }
}

/**
 * Encode content to base64 for file creation/update
 */
export function encodeBase64(content: string): string {
  return Buffer.from(content, 'utf-8').toString('base64');
}

/**
 * Decode base64 content from file response
 */
export function decodeBase64(content: string): string {
  return Buffer.from(content, 'base64').toString('utf-8');
}

/**
 * Parse a repository full name into owner and repo
 */
export function parseRepoFullName(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repository full name: ${fullName}`);
  }
  return { owner, repo };
}

/**
 * Format a date for GitHub API (ISO 8601)
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Parse date qualifiers for search
 * Examples: ">2024-01-01", "2024-01-01..2024-12-31", ">=2024-06-01"
 */
export function dateRange(start: Date, end?: Date): string {
  if (end) {
    return `${start.toISOString().split('T')[0]}..${end.toISOString().split('T')[0]}`;
  }
  return `>=${start.toISOString().split('T')[0]}`;
}

/**
 * Create a relative date string
 * @param days Number of days ago (negative for past)
 */
export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Parse GitHub issue/PR URL to extract owner, repo, and number
 */
export function parseIssueUrl(url: string): { owner: string; repo: string; number: number; type: 'issue' | 'pull' } {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/);
  if (!match) {
    throw new Error(`Invalid GitHub issue/PR URL: ${url}`);
  }
  return {
    owner: match[1],
    repo: match[2],
    type: match[3] === 'pull' ? 'pull' : 'issue',
    number: parseInt(match[4], 10),
  };
}

/**
 * Parse GitHub repository URL to extract owner and repo
 */
export function parseRepoUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    throw new Error(`Invalid GitHub repository URL: ${url}`);
  }
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
  };
}

/**
 * Generate a slug from a string (useful for branch names)
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Check if a string is a valid branch name
 */
export function isValidBranchName(name: string): boolean {
  // Branch names cannot:
  // - Start with a dot
  // - Contain consecutive dots
  // - End with .lock
  // - Contain certain special characters
  const invalidPatterns = [
    /^\./,
    /\.\./,
    /\.lock$/,
    /[\x00-\x1f\x7f~^:?*\[\\]/,
    /@\{/,
    /\/$/,
    /^\/$/,
  ];
  return !invalidPatterns.some((pattern) => pattern.test(name));
}

/**
 * Build a comparison URL between two refs
 */
export function buildCompareUrl(owner: string, repo: string, base: string, head: string): string {
  return `https://github.com/${owner}/${repo}/compare/${base}...${head}`;
}

/**
 * Build a pull request URL
 */
export function buildPullRequestUrl(owner: string, repo: string, number: number): string {
  return `https://github.com/${owner}/${repo}/pull/${number}`;
}

/**
 * Build an issue URL
 */
export function buildIssueUrl(owner: string, repo: string, number: number): string {
  return `https://github.com/${owner}/${repo}/issues/${number}`;
}

/**
 * Build a file URL
 */
export function buildFileUrl(owner: string, repo: string, path: string, ref?: string): string {
  const refPart = ref ? `/blob/${ref}` : '/blob/main';
  return `https://github.com/${owner}/${repo}${refPart}/${path}`;
}
