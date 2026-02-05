---
name: github
description: Use this skill whenever the user asks to interact with GitHub - listing repositories, managing issues, pull requests, branches, commits, releases, workflows, or any other GitHub operations. Provides a type-safe TypeScript wrapper for the GitHub REST API.
---

When working with GitHub, use the TypeScript wrapper located at `C:\Users\Dominik\Projects\wrapper\GitHub`.

## Setup

The wrapper requires environment variables from `C:\Users\Dominik\Projects\wrapper\GitHub\.env`:
- `GITHUB_TOKEN` - Personal Access Token from https://github.com/settings/tokens

## Code Pattern

**IMPORTANT**: Always wrap code in an async function - top-level await is not supported with tsx/cjs.

```typescript
import { config } from 'dotenv';
import { GitHubClient, SearchQueryBuilder } from 'C:/Users/Dominik/Projects/wrapper/GitHub/src/index.js';

config({ path: 'C:/Users/Dominik/Projects/wrapper/GitHub/.env' });

async function main() {
  const github = new GitHubClient({
    token: process.env.GITHUB_TOKEN!,
  });

  // Your GitHub operations here...
}

main();
```

## Running Scripts

To execute GitHub scripts, write a `.ts` file in the wrapper directory and run with tsx:

```bash
cd C:\Users\Dominik\Projects\wrapper\GitHub
npx tsx your-script.ts
```

## Available Methods

### Users
- `github.getCurrentUser()` - Get authenticated user
- `github.getUser(username)` - Get a user

### Repositories
- `github.listRepositories(params?)` - List your repos
- `github.getRepository(owner, repo)` - Get a repo
- `github.createRepository(params)` - Create a repo
- `github.updateRepository(owner, repo, params)` - Update a repo
- `github.deleteRepository(owner, repo)` - Delete a repo

### Issues
- `github.listIssues(owner, repo, params?)` - List issues
- `github.getIssue(owner, repo, number)` - Get an issue
- `github.createIssue(owner, repo, params)` - Create an issue
- `github.updateIssue(owner, repo, number, params)` - Update an issue
- `github.createIssueComment(owner, repo, number, body)` - Add comment

### Pull Requests
- `github.listPullRequests(owner, repo, params?)` - List PRs
- `github.getPullRequest(owner, repo, number)` - Get a PR
- `github.createPullRequest(owner, repo, params)` - Create a PR
- `github.mergePullRequest(owner, repo, number, params?)` - Merge a PR
- `github.createPullRequestReview(owner, repo, number, params)` - Review a PR

### Branches & Commits
- `github.listBranches(owner, repo)` - List branches
- `github.getBranch(owner, repo, branch)` - Get branch
- `github.listCommits(owner, repo, params?)` - List commits
- `github.getCommit(owner, repo, ref)` - Get commit

### Contents
- `github.getContent(owner, repo, path, ref?)` - Get file/dir content
- `github.getFileContent(owner, repo, path, ref?)` - Get decoded file
- `github.createOrUpdateFile(owner, repo, path, params)` - Create/update file

### Releases
- `github.listReleases(owner, repo)` - List releases
- `github.getLatestRelease(owner, repo)` - Get latest release
- `github.createRelease(owner, repo, params)` - Create release

### Search
```typescript
const results = await github.searchRepositories({
  q: SearchQueryBuilder.create()
    .language('typescript')
    .stars('>', 1000)
    .build(),
  sort: 'stars',
});
```

### Actions
- `github.listWorkflows(owner, repo)` - List workflows
- `github.listWorkflowRuns(owner, repo, params?)` - List runs
- `github.dispatchWorkflow(owner, repo, workflowId, ref, inputs?)` - Trigger workflow

## Examples

### List your repositories
```typescript
async function main() {
  const github = new GitHubClient({...});

  const repos = await github.listRepositories({ type: 'owner', sort: 'updated' });
  for (const repo of repos) {
    console.log(`${repo.full_name}: ${repo.stargazers_count} stars`);
  }
}
main();
```

### Get open issues from a repo
```typescript
const issues = await github.listIssues('owner', 'repo', {
  state: 'open',
  labels: 'bug',
});
```

### Create a pull request
```typescript
const pr = await github.createPullRequest('owner', 'repo', {
  title: 'Add new feature',
  head: 'feature-branch',
  base: 'main',
  body: 'Description of changes',
});
```

### Search for TypeScript repos with many stars
```typescript
const results = await github.searchRepositories({
  q: SearchQueryBuilder.create()
    .language('typescript')
    .stars('>', 5000)
    .build(),
  sort: 'stars',
  order: 'desc',
});
```

## Important Notes

- **Always wrap in async function** - No top-level await support
- **Always load `.env`** with the correct path using `config({ path: '...' })`
- The wrapper uses GitHub REST API with version header `2022-11-28`
- All responses are fully typed in TypeScript
- Use `SearchQueryBuilder` for type-safe search query construction
- Rate limits: 5,000 requests/hour when authenticated
- Clean up temporary scripts after use

## Troubleshooting

### "Top-level await is currently not supported"
Wrap code in an async function:
```typescript
async function main() { ... }
main();
```

### "does not provide an export named..."
TypeScript interfaces must use `export type` in index.ts. This is already handled in the wrapper.

### 401 Unauthorized
Token is invalid or expired. Create a new one at https://github.com/settings/tokens

### 403 Forbidden
Rate limit exceeded. Check with `github.getRateLimit()`.

### 404 Not Found
Resource doesn't exist or token lacks access to private resources.
