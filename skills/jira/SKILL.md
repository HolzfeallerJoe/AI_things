---
name: jira
description: Use this skill whenever the user asks to interact with Jira - fetching tickets, creating issues, searching, updating status, adding comments, or any other Jira operations. Provides a type-safe TypeScript wrapper for the Jira REST API.
---

When working with Jira, use the TypeScript wrapper located at `C:\Users\Dominik\Projects\Private\AI_things\wrapper\Jira`.

## Setup

The wrapper requires environment variables from `C:\Users\Dominik\Projects\Private\AI_things\wrapper\Jira\.env`:
- `JIRA_DOMAIN` - Jira Cloud domain (e.g., `ascora.atlassian.net`)
- `JIRA_EMAIL` - Atlassian account email
- `JIRA_API_TOKEN` - API token from https://id.atlassian.com/manage-profile/security/api-tokens

## Code Pattern

**IMPORTANT**: Always wrap code in an async function - top-level await is not supported with tsx/cjs.

```typescript
import { config } from 'dotenv';
import { JiraClient, JqlBuilder } from 'C:/Users/Dominik/Projects/Private/AI_things/wrapper/Jira/src/index.js';

config({ path: 'C:/Users/Dominik/Projects/Private/AI_things/wrapper/Jira/.env' });

async function main() {
  const jira = new JiraClient({
    domain: process.env.JIRA_DOMAIN!,
    email: process.env.JIRA_EMAIL!,
    apiToken: process.env.JIRA_API_TOKEN!,
  });

  // Your Jira operations here...
}

main();
```

## Running Scripts

To execute Jira scripts, write a `.ts` file in the wrapper directory and run with tsx:

```bash
cd C:\Users\Dominik\Projects\Private\AI_things\wrapper\Jira
npx tsx your-script.ts
```

## Available Methods

### Issues
- `jira.getIssue(key)` - Get single issue
- `jira.createIssue({ fields: {...} })` - Create issue
- `jira.updateIssue(key, { fields: {...} })` - Update issue
- `jira.deleteIssue(key)` - Delete issue
- `jira.searchIssues({ jql, fields, maxResults })` - Search with JQL (uses `/search/jql` endpoint)

### JQL Builder
```typescript
const jql = JqlBuilder.create()
  .eq('project', 'TIM')           // project = TIM
  .in('status', ['Open', 'Done']) // status in (Open, Done)
  .contains('summary', 'bug')     // summary ~ "bug"
  .isNot('assignee', 'EMPTY')     // assignee is not EMPTY
  .orderBy('created', 'DESC')
  .build();
```

### Comments
- `jira.addComment(issueKey, { body })` - Add comment
- `jira.getComments(issueKey)` - Get comments

### Transitions
- `jira.getTransitions(issueKey)` - Get available transitions
- `jira.transitionIssue(issueKey, { transition: { id } })` - Change status

### Projects
- `jira.getProjects()` - List all projects
- `jira.getProject(key)` - Get project details

### Users
- `jira.getCurrentUser()` - Get authenticated user
- `jira.searchUsers({ query })` - Search users

### Sprints & Boards (Agile)
- `jira.getBoards()` - List boards
- `jira.getBoardSprints(boardId)` - Get sprints
- `jira.getSprintIssues(sprintId)` - Get sprint issues

## Examples

### Get all tickets from a project
```typescript
async function main() {
  const jira = new JiraClient({...});

  const results = await jira.searchIssues({
    jql: JqlBuilder.create().eq('project', 'TIM').orderBy('key', 'ASC').build(),
    maxResults: 100,
    fields: ['summary', 'status', 'assignee', 'priority', 'issuetype'],
  });

  console.log(`Found ${results.total} tickets`);
  for (const issue of results.issues) {
    console.log(`${issue.key}: ${issue.fields.summary}`);
  }
}
main();
```

### Create a new ticket
```typescript
const issue = await jira.createIssue({
  fields: {
    project: { key: 'TIM' },
    issuetype: { name: 'Task' },
    summary: 'New task title',
    description: 'Task description',
    priority: { name: 'Medium' },
  },
});
```

### Transition an issue to Done
```typescript
const { transitions } = await jira.getTransitions('TIM-123');
const done = transitions.find(t => t.name === 'Done');
if (done) {
  await jira.transitionIssue('TIM-123', { transition: { id: done.id } });
}
```

## Important Notes

- **Always wrap in async function** - No top-level await support
- **Always load `.env`** with the correct path using `config({ path: '...' })`
- The wrapper uses Jira Cloud REST API v3 with the new `/search/jql` endpoint
- All responses are fully typed in TypeScript
- Use `JqlBuilder` for type-safe JQL query construction
- Clean up temporary scripts after use
