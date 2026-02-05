# Jira API Wrapper

A type-safe TypeScript wrapper for the Jira Cloud REST API v3.

## Installation

```bash
npm install
npm run build
```

## Configuration

Create a `.env` file with your Jira credentials:

```env
JIRA_DOMAIN=your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
```

Get your API token from: https://id.atlassian.com/manage-profile/security/api-tokens

## Quick Start

**Important**: Always wrap code in an async function - top-level await is not supported.

```typescript
import { config } from 'dotenv';
import { JiraClient, JqlBuilder } from './src/index.js';

config({ path: './.env' });

async function main() {
  const jira = new JiraClient({
    domain: process.env.JIRA_DOMAIN!,
    email: process.env.JIRA_EMAIL!,
    apiToken: process.env.JIRA_API_TOKEN!,
  });

  const me = await jira.getCurrentUser();
  console.log(`Logged in as: ${me.displayName}`);
}

main();
```

Run with:
```bash
npx tsx your-script.ts
```

## Usage Examples

### Working with Issues

```typescript
// Get an issue
const issue = await jira.getIssue('PROJ-123', {
  expand: ['changelog', 'transitions'],
});

// Create an issue
const newIssue = await jira.createIssue({
  fields: {
    summary: 'New bug report',
    description: AdfBuilder.text('Description of the issue'),
    issuetype: { name: 'Bug' },
    project: { key: 'PROJ' },
    priority: { name: 'High' },
    labels: ['bug', 'urgent'],
  },
});

// Update an issue
await jira.updateIssue('PROJ-123', {
  fields: {
    summary: 'Updated summary',
  },
  update: {
    labels: [{ add: 'new-label' }],
  },
});

// Delete an issue
await jira.deleteIssue('PROJ-123');
```

### Searching with JQL

```typescript
// Using the JQL builder
const jql = JqlBuilder.create()
  .eq('project', 'PROJ')
  .in('status', ['Open', 'In Progress'])
  .isNot('assignee', 'EMPTY')
  .gte('created', '-7d')
  .orderBy('created', 'DESC')
  .build();

// Search for issues
const results = await jira.searchIssues({
  jql,
  maxResults: 50,
  fields: ['summary', 'status', 'assignee'],
});

console.log(`Found ${results.total} issues`);
for (const issue of results.issues) {
  console.log(`${issue.key}: ${issue.fields.summary}`);
}
```

### Transitions

```typescript
// Get available transitions
const { transitions } = await jira.getTransitions('PROJ-123');

// Find the "Done" transition
const doneTransition = transitions.find((t) => t.name === 'Done');

// Transition the issue
if (doneTransition) {
  await jira.transitionIssue('PROJ-123', {
    transition: { id: doneTransition.id },
    fields: {
      resolution: { name: 'Fixed' },
    },
  });
}
```

### Comments

```typescript
// Add a comment with rich formatting
const comment = await jira.addComment('PROJ-123', {
  body: AdfBuilder.create()
    .heading('Investigation Results', 2)
    .paragraph('Found the root cause:')
    .codeBlock('const bug = true; // <- here', 'typescript')
    .panel('Fixed in PR #456', 'success')
    .build(),
});

// Get all comments
const comments = await jira.getComments('PROJ-123');

// Update a comment
await jira.updateComment('PROJ-123', comment.id, {
  body: AdfBuilder.text('Updated comment'),
});
```

### Worklogs

```typescript
// Add time tracking
await jira.addWorklog('PROJ-123', {
  started: new Date().toISOString(),
  timeSpent: '2h 30m',
  comment: AdfBuilder.text('Debugging and testing'),
});

// Get worklogs
const worklogs = await jira.getWorklogs('PROJ-123');
```

### Projects

```typescript
// Get all projects
const projects = await jira.getProjects({
  maxResults: 100,
  expand: ['description', 'lead'],
});

// Get a specific project with components
const project = await jira.getProject('PROJ', ['components', 'versions']);

// Get project components
const components = await jira.getProjectComponents('PROJ');
```

### Users

```typescript
// Get current user
const me = await jira.getCurrentUser();

// Search for users
const users = await jira.searchUsers({ query: 'john' });

// Find assignable users for a project
const assignable = await jira.searchAssignableUsers(undefined, 'PROJ');
```

### Sprints (Agile)

```typescript
// Get boards
const boards = await jira.getBoards({ type: 'scrum' });

// Get sprints for a board
const sprints = await jira.getBoardSprints(boards.values[0].id, {
  state: 'active',
});

// Get issues in a sprint
const sprintIssues = await jira.getSprintIssues(sprints.values[0].id);

// Move issues to a sprint
await jira.moveIssuesToSprint(sprintId, ['PROJ-1', 'PROJ-2', 'PROJ-3']);
```

### Pagination Helper

```typescript
// Iterate through all issues
for await (const project of jira.paginate(
  (params) => jira.getProjects(params),
  50
)) {
  console.log(project.name);
}

// Get all results at once
const allProjects = await jira.getAll(
  (params) => jira.getProjects(params),
  50
);
```

### Error Handling

```typescript
import { JiraApiError } from './src/index.js';

try {
  await jira.getIssue('INVALID-KEY');
} catch (error) {
  if (error instanceof JiraApiError) {
    console.error(`Jira API Error (${error.status}): ${error.message}`);
    if (error.errorResponse) {
      console.error('Details:', error.errorResponse.errors);
    }
  }
}
```

## ADF (Atlassian Document Format)

The wrapper includes a builder for creating rich text content:

```typescript
const doc = AdfBuilder.create()
  .heading('Release Notes', 1)
  .paragraph('Version 2.0 includes:')
  .bulletList([
    'New dashboard',
    'Performance improvements',
    'Bug fixes',
  ])
  .rule()
  .panel('Breaking changes below', 'warning')
  .table(
    ['Feature', 'Status'],
    [
      ['Dark mode', 'Complete'],
      ['Export', 'In Progress'],
    ]
  )
  .codeBlock('npm install @company/app@2.0', 'bash')
  .link('Full changelog', 'https://example.com/changelog')
  .build();
```

## JQL Builder

Type-safe JQL query construction:

```typescript
const query = JqlBuilder.create()
  .eq('project', 'PROJ')
  .in('issuetype', ['Bug', 'Story'])
  .contains('summary', 'login')
  .isNot('resolution', 'EMPTY')
  .gte('created', '2024-01-01')
  .lte('created', '2024-12-31')
  .orderBy('priority', 'DESC')
  .orderBy('created', 'ASC')
  .build();

// Result: project = PROJ AND issuetype in ("Bug", "Story") AND summary ~ "login" AND resolution is not EMPTY AND created >= 2024-01-01 AND created <= 2024-12-31 ORDER BY priority DESC, created ASC
```

## API Reference

### JiraClient Methods

#### Issues
- `getIssue(issueIdOrKey, params?)` - Get a single issue
- `createIssue(params)` - Create a new issue
- `createIssuesBulk(params)` - Create multiple issues
- `updateIssue(issueIdOrKey, params)` - Update an issue
- `deleteIssue(issueIdOrKey, deleteSubtasks?)` - Delete an issue
- `searchIssues(params)` - Search using JQL (uses `/search/jql` endpoint)
- `getIssueChangelog(issueIdOrKey, params?)` - Get issue history

#### Transitions
- `getTransitions(issueIdOrKey)` - Get available transitions
- `transitionIssue(issueIdOrKey, params)` - Transition an issue
- `bulkTransitionIssues(params)` - Bulk transition

#### Comments
- `getComments(issueIdOrKey, params?)` - Get comments
- `getComment(issueIdOrKey, commentId)` - Get a comment
- `addComment(issueIdOrKey, params)` - Add a comment
- `updateComment(issueIdOrKey, commentId, params)` - Update a comment
- `deleteComment(issueIdOrKey, commentId)` - Delete a comment

#### Attachments
- `getAttachment(attachmentId)` - Get attachment metadata
- `uploadAttachment(issueIdOrKey, file, filename)` - Upload attachment
- `deleteAttachment(attachmentId)` - Delete attachment

#### Worklogs
- `getWorklogs(issueIdOrKey, params?)` - Get worklogs
- `getWorklog(issueIdOrKey, worklogId)` - Get a worklog
- `addWorklog(issueIdOrKey, params)` - Add a worklog
- `updateWorklog(issueIdOrKey, worklogId, params)` - Update a worklog
- `deleteWorklog(issueIdOrKey, worklogId)` - Delete a worklog

#### Issue Links
- `getIssueLinkTypes()` - Get link types
- `createIssueLink(params)` - Create a link
- `getIssueLink(linkId)` - Get a link
- `deleteIssueLink(linkId)` - Delete a link

#### Watchers & Votes
- `getWatchers(issueIdOrKey)` - Get watchers
- `addWatcher(issueIdOrKey, accountId)` - Add watcher
- `removeWatcher(issueIdOrKey, accountId)` - Remove watcher
- `getVotes(issueIdOrKey)` - Get votes
- `addVote(issueIdOrKey)` - Add vote
- `removeVote(issueIdOrKey)` - Remove vote

#### Projects
- `getProjects(params?)` - Get all projects
- `getProject(projectIdOrKey, expand?)` - Get a project
- `createProject(params)` - Create a project
- `updateProject(projectIdOrKey, params)` - Update a project
- `deleteProject(projectIdOrKey)` - Delete a project
- `getProjectComponents(projectIdOrKey)` - Get components
- `getProjectVersions(projectIdOrKey)` - Get versions

#### Users
- `getCurrentUser()` - Get current user
- `getUser(accountId)` - Get a user
- `searchUsers(params?)` - Search users
- `searchAssignableUsers(issueKey?, projectKey?, params?)` - Find assignable users

#### Metadata
- `getIssueTypes()` - Get all issue types
- `getProjectIssueTypes(projectIdOrKey)` - Get project issue types
- `getPriorities()` - Get all priorities
- `getStatuses()` - Get all statuses
- `getProjectStatuses(projectIdOrKey)` - Get project statuses
- `getFields()` - Get all fields

#### Filters
- `getFilter(filterId)` - Get a filter
- `getFavoriteFilters()` - Get favorite filters
- `getMyFilters()` - Get my filters

#### Sprints (Agile)
- `getSprint(sprintId)` - Get a sprint
- `createSprint(params)` - Create a sprint
- `updateSprint(sprintId, params)` - Update a sprint
- `deleteSprint(sprintId)` - Delete a sprint
- `getSprintIssues(sprintId, params?)` - Get sprint issues
- `moveIssuesToSprint(sprintId, issueKeys, rankBefore?, rankAfter?)` - Move issues

#### Boards (Agile)
- `getBoards(params?)` - Get all boards
- `getBoard(boardId)` - Get a board
- `getBoardSprints(boardId, params?)` - Get board sprints
- `getBoardBacklog(boardId, params?)` - Get backlog

#### Utilities
- `paginate(fetchFn, pageSize?)` - Async iterator for pagination
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

### "The requested API has been removed" (410 error)
This wrapper uses the new `/search/jql` endpoint. If you see this error, make sure you're using the latest version of the wrapper.

### Authentication errors
Verify your `.env` file has the correct values and the API token is valid.

## License

MIT
