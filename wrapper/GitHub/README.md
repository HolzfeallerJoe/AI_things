# GitHub API Wrapper

A type-safe TypeScript wrapper for the GitHub REST API.

## Installation

```bash
npm install
npm run build
```

## Configuration

Create a `.env` file with your GitHub credentials:

```env
GITHUB_TOKEN=your-personal-access-token
```

Get your personal access token from: https://github.com/settings/tokens

## Quick Start

**Important**: Always wrap code in an async function - top-level await is not supported.

```typescript
import { config } from 'dotenv';
import { GitHubClient } from './src/index.js';

config({ path: 'C:/Users/Dominik/Projects/wrapper/GitHub/.env' });

async function main() {
  const github = new GitHubClient({
    token: process.env.GITHUB_TOKEN!,
  });

  const me = await github.getCurrentUser();
  console.log(`Logged in as: ${me.login}`);
}

main();
```

Run with:
```bash
npx tsx your-script.ts
```

## Usage Examples

### Working with Repositories

```typescript
// List your repositories
const repos = await github.listRepositories({ type: 'owner', sort: 'updated' });

// Get a specific repository
const repo = await github.getRepository('owner', 'repo-name');

// Create a repository
const newRepo = await github.createRepository({
  name: 'my-new-repo',
  description: 'A new repository',
  private: true,
  auto_init: true,
});

// Update a repository
await github.updateRepository('owner', 'repo', {
  description: 'Updated description',
  has_wiki: false,
});

// Delete a repository
await github.deleteRepository('owner', 'repo');
```

### Working with Issues

```typescript
// List issues
const issues = await github.listIssues('owner', 'repo', {
  state: 'open',
  labels: 'bug',
  sort: 'updated',
});

// Get an issue
const issue = await github.getIssue('owner', 'repo', 123);

// Create an issue
const newIssue = await github.createIssue('owner', 'repo', {
  title: 'Bug report',
  body: 'Description of the bug',
  labels: ['bug', 'priority-high'],
  assignees: ['username'],
});

// Update an issue
await github.updateIssue('owner', 'repo', 123, {
  state: 'closed',
  state_reason: 'completed',
});

// Add a comment
await github.createIssueComment('owner', 'repo', 123, 'This is fixed now!');
```

### Working with Pull Requests

```typescript
// List pull requests
const prs = await github.listPullRequests('owner', 'repo', {
  state: 'open',
  sort: 'updated',
});

// Get a pull request
const pr = await github.getPullRequest('owner', 'repo', 456);

// Create a pull request
const newPr = await github.createPullRequest('owner', 'repo', {
  title: 'Add new feature',
  body: 'This PR adds a new feature',
  head: 'feature-branch',
  base: 'main',
});

// Merge a pull request
await github.mergePullRequest('owner', 'repo', 456, {
  merge_method: 'squash',
  commit_title: 'feat: add new feature',
});

// Request reviewers
await github.requestReviewers('owner', 'repo', 456, {
  reviewers: ['reviewer1', 'reviewer2'],
});

// Create a review
await github.createPullRequestReview('owner', 'repo', 456, {
  event: 'APPROVE',
  body: 'Looks good to me!',
});
```

### Working with Branches

```typescript
// List branches
const branches = await github.listBranches('owner', 'repo');

// Get a branch
const branch = await github.getBranch('owner', 'repo', 'main');

// Rename a branch
await github.renameBranch('owner', 'repo', 'old-name', 'new-name');
```

### Working with Commits

```typescript
// List commits
const commits = await github.listCommits('owner', 'repo', {
  sha: 'main',
  since: '2024-01-01T00:00:00Z',
});

// Get a commit
const commit = await github.getCommit('owner', 'repo', 'abc123');

// Compare commits
const comparison = await github.compareCommits('owner', 'repo', 'main', 'feature-branch');
```

### Working with File Contents

```typescript
import { encodeBase64, decodeBase64 } from './src/index.js';

// Get file content (raw string)
const content = await github.getFileContent('owner', 'repo', 'path/to/file.txt');

// Get directory listing
const contents = await github.getContent('owner', 'repo', 'src');

// Create or update a file
await github.createOrUpdateFile('owner', 'repo', 'path/to/file.txt', {
  message: 'Create new file',
  content: encodeBase64('File content here'),
  branch: 'main',
});

// Update existing file (requires sha)
const existing = await github.getContent('owner', 'repo', 'path/to/file.txt');
await github.createOrUpdateFile('owner', 'repo', 'path/to/file.txt', {
  message: 'Update file',
  content: encodeBase64('Updated content'),
  sha: existing.sha,
});
```

### Working with Releases

```typescript
// List releases
const releases = await github.listReleases('owner', 'repo');

// Get latest release
const latest = await github.getLatestRelease('owner', 'repo');

// Create a release
const release = await github.createRelease('owner', 'repo', {
  tag_name: 'v1.0.0',
  name: 'Version 1.0.0',
  body: 'Release notes here',
  draft: false,
  prerelease: false,
  generate_release_notes: true,
});
```

### Searching

```typescript
import { SearchQueryBuilder } from './src/index.js';

// Search repositories
const repoResults = await github.searchRepositories({
  q: SearchQueryBuilder.create()
    .term('typescript')
    .language('typescript')
    .stars('>', 1000)
    .build(),
  sort: 'stars',
  order: 'desc',
});

// Search issues
const issueResults = await github.searchIssues({
  q: SearchQueryBuilder.create()
    .type('issue')
    .state('open')
    .label('bug')
    .repo('owner/repo')
    .build(),
});

// Search code
const codeResults = await github.searchCode({
  q: SearchQueryBuilder.create()
    .term('function')
    .language('javascript')
    .repo('owner/repo')
    .build(),
});
```

### GitHub Actions

```typescript
// List workflows
const workflows = await github.listWorkflows('owner', 'repo');

// List workflow runs
const runs = await github.listWorkflowRuns('owner', 'repo', {
  status: 'completed',
  branch: 'main',
});

// Trigger a workflow
await github.dispatchWorkflow('owner', 'repo', 'ci.yml', 'main', {
  environment: 'production',
});

// Cancel a run
await github.cancelWorkflowRun('owner', 'repo', runId);
```

### Organizations

```typescript
// List your organizations
const orgs = await github.listOrganizations();

// Get organization details
const org = await github.getOrganization('org-name');

// List org repos
const orgRepos = await github.listOrgRepositories('org-name');

// List org members
const members = await github.listOrgMembers('org-name');
```

### Pagination

```typescript
// Iterate through all results
for await (const repo of github.paginate(
  (params) => github.listRepositories(params),
  100
)) {
  console.log(repo.name);
}

// Get all results at once
const allRepos = await github.getAll(
  (params) => github.listRepositories(params),
  100
);
```

### Rate Limits

```typescript
const limits = await github.getRateLimit();
console.log(`Remaining: ${limits.rate.remaining}/${limits.rate.limit}`);
console.log(`Resets at: ${new Date(limits.rate.reset * 1000)}`);
```

### Error Handling

```typescript
import { GitHubApiError } from './src/index.js';

try {
  await github.getRepository('owner', 'non-existent');
} catch (error) {
  if (error instanceof GitHubApiError) {
    console.error(`GitHub API Error (${error.status}): ${error.message}`);
    if (error.errorResponse) {
      console.error('Details:', error.errorResponse.errors);
    }
  }
}
```

## Search Query Builder

Type-safe search query construction:

```typescript
// Repository search
const repoQuery = SearchQueryBuilder.create()
  .term('react')
  .language('typescript')
  .stars('>', 5000)
  .forks('>', 1000)
  .pushed('>', '2024-01-01')
  .notLanguage('javascript')
  .build();
// Result: react language:typescript stars:>5000 forks:>1000 pushed:>2024-01-01 -language:javascript

// Issue/PR search
const issueQuery = SearchQueryBuilder.create()
  .type('pr')
  .state('open')
  .reviewStatus('approved')
  .base('main')
  .isDraft(false)
  .created('>', '2024-01-01')
  .build();
// Result: type:pr state:open review:approved base:main draft:false created:>2024-01-01
```

## API Reference

### GitHubClient Methods

#### Users
- `getCurrentUser()` - Get authenticated user
- `getUser(username)` - Get a user
- `listFollowers()` - List your followers
- `listFollowing()` - List who you follow

#### Repositories
- `listRepositories(params?)` - List your repos
- `listUserRepositories(username, params?)` - List user's repos
- `listOrgRepositories(org, params?)` - List org repos
- `getRepository(owner, repo)` - Get a repo
- `createRepository(params)` - Create a repo
- `createOrgRepository(org, params)` - Create org repo
- `updateRepository(owner, repo, params)` - Update a repo
- `deleteRepository(owner, repo)` - Delete a repo
- `listRepositoryTopics(owner, repo)` - Get topics
- `replaceRepositoryTopics(owner, repo, topics)` - Set topics
- `listRepositoryLanguages(owner, repo)` - Get languages
- `listContributors(owner, repo)` - List contributors

#### Issues
- `listIssues(owner, repo, params?)` - List issues
- `getIssue(owner, repo, number)` - Get an issue
- `createIssue(owner, repo, params)` - Create an issue
- `updateIssue(owner, repo, number, params)` - Update an issue
- `lockIssue(owner, repo, number, reason?)` - Lock issue
- `unlockIssue(owner, repo, number)` - Unlock issue

#### Issue Comments
- `listIssueComments(owner, repo, issueNumber)` - List comments
- `getIssueComment(owner, repo, commentId)` - Get comment
- `createIssueComment(owner, repo, issueNumber, body)` - Add comment
- `updateIssueComment(owner, repo, commentId, body)` - Update comment
- `deleteIssueComment(owner, repo, commentId)` - Delete comment

#### Labels
- `listLabels(owner, repo)` - List labels
- `getLabel(owner, repo, name)` - Get label
- `createLabel(owner, repo, params)` - Create label
- `updateLabel(owner, repo, name, params)` - Update label
- `deleteLabel(owner, repo, name)` - Delete label

#### Milestones
- `listMilestones(owner, repo, params?)` - List milestones
- `getMilestone(owner, repo, number)` - Get milestone
- `createMilestone(owner, repo, params)` - Create milestone
- `updateMilestone(owner, repo, number, params)` - Update milestone
- `deleteMilestone(owner, repo, number)` - Delete milestone

#### Pull Requests
- `listPullRequests(owner, repo, params?)` - List PRs
- `getPullRequest(owner, repo, number)` - Get a PR
- `createPullRequest(owner, repo, params)` - Create a PR
- `updatePullRequest(owner, repo, number, params)` - Update a PR
- `listPullRequestCommits(owner, repo, number)` - List commits
- `listPullRequestFiles(owner, repo, number)` - List files
- `isPullRequestMerged(owner, repo, number)` - Check merge status
- `mergePullRequest(owner, repo, number, params?)` - Merge a PR

#### PR Reviews
- `listPullRequestReviews(owner, repo, number)` - List reviews
- `getPullRequestReview(owner, repo, number, reviewId)` - Get review
- `createPullRequestReview(owner, repo, number, params)` - Create review
- `submitPullRequestReview(owner, repo, number, reviewId, params)` - Submit review
- `dismissPullRequestReview(owner, repo, number, reviewId, message)` - Dismiss review
- `requestReviewers(owner, repo, number, params)` - Request reviewers

#### Branches
- `listBranches(owner, repo, params?)` - List branches
- `getBranch(owner, repo, branch)` - Get branch
- `renameBranch(owner, repo, branch, newName)` - Rename branch

#### Commits
- `listCommits(owner, repo, params?)` - List commits
- `getCommit(owner, repo, ref)` - Get commit
- `compareCommits(owner, repo, base, head)` - Compare commits

#### Contents
- `getContent(owner, repo, path, ref?)` - Get content
- `getFileContent(owner, repo, path, ref?)` - Get decoded file
- `createOrUpdateFile(owner, repo, path, params)` - Create/update file
- `deleteFile(owner, repo, path, params)` - Delete file
- `getReadme(owner, repo, ref?)` - Get README

#### Releases
- `listReleases(owner, repo)` - List releases
- `getRelease(owner, repo, releaseId)` - Get release
- `getLatestRelease(owner, repo)` - Get latest release
- `getReleaseByTag(owner, repo, tag)` - Get by tag
- `createRelease(owner, repo, params)` - Create release
- `updateRelease(owner, repo, releaseId, params)` - Update release
- `deleteRelease(owner, repo, releaseId)` - Delete release

#### Webhooks
- `listWebhooks(owner, repo)` - List webhooks
- `getWebhook(owner, repo, hookId)` - Get webhook
- `createWebhook(owner, repo, params)` - Create webhook
- `updateWebhook(owner, repo, hookId, params)` - Update webhook
- `deleteWebhook(owner, repo, hookId)` - Delete webhook
- `pingWebhook(owner, repo, hookId)` - Ping webhook

#### Search
- `searchRepositories(params)` - Search repos
- `searchIssues(params)` - Search issues/PRs
- `searchUsers(params)` - Search users
- `searchCode(params)` - Search code

#### Organizations
- `listOrganizations()` - List your orgs
- `getOrganization(org)` - Get an org
- `listOrgMembers(org, params?)` - List members
- `listOrgTeams(org)` - List teams

#### Gists
- `listGists()` - List gists
- `getGist(gistId)` - Get gist
- `createGist(params)` - Create gist
- `updateGist(gistId, params)` - Update gist
- `deleteGist(gistId)` - Delete gist
- `starGist(gistId)` - Star gist
- `unstarGist(gistId)` - Unstar gist

#### Actions
- `listWorkflows(owner, repo)` - List workflows
- `getWorkflow(owner, repo, workflowId)` - Get workflow
- `listWorkflowRuns(owner, repo, params?)` - List runs
- `getWorkflowRun(owner, repo, runId)` - Get run
- `cancelWorkflowRun(owner, repo, runId)` - Cancel run
- `rerunWorkflow(owner, repo, runId)` - Re-run workflow
- `dispatchWorkflow(owner, repo, workflowId, ref, inputs?)` - Trigger workflow

#### Notifications
- `listNotifications(params?)` - List notifications
- `markNotificationsAsRead(lastReadAt?)` - Mark all read
- `getThread(threadId)` - Get thread
- `markThreadAsRead(threadId)` - Mark thread read

#### Rate Limits
- `getRateLimit()` - Get rate limit status

#### Stars
- `starRepository(owner, repo)` - Star repo
- `unstarRepository(owner, repo)` - Unstar repo
- `isRepositoryStarred(owner, repo)` - Check if starred
- `listStarredRepositories()` - List starred repos

#### Utilities
- `paginate(fetchFn, pageSize?)` - Async iterator
- `getAll(fetchFn, pageSize?)` - Get all results

## Troubleshooting

### "Top-level await is currently not supported"
Always wrap your code in an async function:
```typescript
async function main() {
  // your code here
}
main();
```

### "does not provide an export named 'SomeInterface'"
TypeScript interfaces/types must be exported with `export type` in ESM modules. This is already handled correctly in the wrapper's index.ts.

### Authentication errors
Verify your `.env` file has the correct token and the token has the required scopes.

### Rate limiting
Check your rate limit with `getRateLimit()`. Authenticated requests get 5000/hour.

## License

MIT
