/**
 * Jira REST API v3 Type Definitions
 */

// ============================================================================
// Authentication & Configuration
// ============================================================================

export interface JiraConfig {
  /** Your Jira Cloud domain (e.g., 'your-domain.atlassian.net') */
  domain: string;
  /** Email address for Basic Auth */
  email: string;
  /** API token from https://id.atlassian.com/manage-profile/security/api-tokens */
  apiToken: string;
}

// ============================================================================
// Common Types
// ============================================================================

export interface PaginationParams {
  /** Index of the first item to return (0-based) */
  startAt?: number;
  /** Maximum number of items to return */
  maxResults?: number;
}

export interface PagedResponse<T> {
  startAt: number;
  maxResults: number;
  total: number;
  values: T[];
  isLast?: boolean;
}

export interface AvatarUrls {
  '16x16'?: string;
  '24x24'?: string;
  '32x32'?: string;
  '48x48'?: string;
}

export interface ErrorResponse {
  errorMessages: string[];
  errors: Record<string, string>;
}

// ============================================================================
// User Types
// ============================================================================

export interface User {
  accountId: string;
  accountType?: string;
  emailAddress?: string;
  displayName: string;
  active: boolean;
  timeZone?: string;
  locale?: string;
  avatarUrls?: AvatarUrls;
  self?: string;
}

export interface CurrentUser extends User {
  groups?: { items: Group[] };
  applicationRoles?: { items: ApplicationRole[] };
}

export interface UserSearchParams extends PaginationParams {
  query?: string;
  accountId?: string;
  username?: string;
}

// ============================================================================
// Group Types
// ============================================================================

export interface Group {
  name: string;
  groupId?: string;
  self?: string;
}

export interface ApplicationRole {
  key: string;
  name: string;
  groups?: string[];
  defaultGroups?: string[];
}

// ============================================================================
// Project Types
// ============================================================================

export interface Project {
  id: string;
  key: string;
  name: string;
  description?: string;
  lead?: User;
  projectTypeKey?: ProjectTypeKey;
  simplified?: boolean;
  style?: 'classic' | 'next-gen';
  avatarUrls?: AvatarUrls;
  issueTypes?: IssueType[];
  components?: Component[];
  versions?: Version[];
  self?: string;
  url?: string;
}

export type ProjectTypeKey = 'software' | 'service_desk' | 'business';

export interface ProjectCreateParams {
  key: string;
  name: string;
  description?: string;
  leadAccountId?: string;
  projectTypeKey: ProjectTypeKey;
  projectTemplateKey?: string;
  assigneeType?: 'PROJECT_LEAD' | 'UNASSIGNED';
}

export interface ProjectUpdateParams {
  key?: string;
  name?: string;
  description?: string;
  leadAccountId?: string;
  assigneeType?: 'PROJECT_LEAD' | 'UNASSIGNED';
}

export interface ProjectSearchParams extends PaginationParams {
  keys?: string[];
  query?: string;
  typeKey?: ProjectTypeKey;
  orderBy?: 'category' | 'key' | 'name' | 'owner';
  expand?: ProjectExpand[];
}

export type ProjectExpand = 'description' | 'issueTypes' | 'lead' | 'projectKeys' | 'issueTypeHierarchy';

// ============================================================================
// Component & Version Types
// ============================================================================

export interface Component {
  id: string;
  name: string;
  description?: string;
  lead?: User;
  leadAccountId?: string;
  assigneeType?: 'PROJECT_DEFAULT' | 'COMPONENT_LEAD' | 'PROJECT_LEAD' | 'UNASSIGNED';
  assignee?: User;
  project?: string;
  projectId?: number;
  self?: string;
}

export interface Version {
  id: string;
  name: string;
  description?: string;
  archived?: boolean;
  released?: boolean;
  releaseDate?: string;
  startDate?: string;
  projectId?: number;
  self?: string;
}

// ============================================================================
// Issue Type & Status Types
// ============================================================================

export interface IssueType {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  subtask: boolean;
  avatarId?: number;
  hierarchyLevel?: number;
  self?: string;
}

export interface Status {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  statusCategory?: StatusCategory;
  self?: string;
}

export interface StatusCategory {
  id: number;
  key: string;
  name: string;
  colorName: string;
  self?: string;
}

export interface Priority {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  statusColor?: string;
  self?: string;
}

export interface Resolution {
  id: string;
  name: string;
  description?: string;
  self?: string;
}

// ============================================================================
// Issue Types
// ============================================================================

export interface Issue {
  id: string;
  key: string;
  self?: string;
  expand?: string;
  fields: IssueFields;
  changelog?: Changelog;
  renderedFields?: Record<string, unknown>;
  transitions?: Transition[];
}

export interface IssueFields {
  summary: string;
  description?: AtlassianDocument | string | null;
  issuetype: IssueType;
  project: Project;
  status: Status;
  priority?: Priority;
  resolution?: Resolution | null;
  assignee?: User | null;
  reporter?: User;
  creator?: User;
  created?: string;
  updated?: string;
  resolutiondate?: string | null;
  duedate?: string | null;
  labels?: string[];
  components?: Component[];
  fixVersions?: Version[];
  versions?: Version[];
  parent?: Issue;
  subtasks?: Issue[];
  issuelinks?: IssueLink[];
  comment?: { comments: Comment[]; total: number };
  worklog?: { worklogs: Worklog[]; total: number };
  attachment?: Attachment[];
  timetracking?: TimeTracking;
  watches?: Watches;
  votes?: Votes;
  [key: string]: unknown;
}

export interface IssueCreateParams {
  fields: IssueCreateFields;
  update?: Record<string, unknown[]>;
}

export interface IssueCreateFields {
  summary: string;
  description?: AtlassianDocument | string;
  issuetype: { id: string } | { name: string };
  project: { id: string } | { key: string };
  priority?: { id: string } | { name: string };
  assignee?: { accountId: string } | null;
  reporter?: { accountId: string };
  labels?: string[];
  components?: Array<{ id: string } | { name: string }>;
  fixVersions?: Array<{ id: string } | { name: string }>;
  duedate?: string;
  parent?: { key: string };
  [key: string]: unknown;
}

export interface IssueUpdateParams {
  fields?: Partial<IssueCreateFields>;
  update?: Record<string, IssueUpdateOperation[]>;
  historyMetadata?: Record<string, unknown>;
  properties?: EntityProperty[];
}

export type IssueUpdateOperation =
  | { add: unknown }
  | { set: unknown }
  | { remove: unknown }
  | { edit: unknown };

export interface IssueGetParams {
  fields?: string[];
  expand?: IssueExpand[];
  properties?: string[];
  fieldsByKeys?: boolean;
  updateHistory?: boolean;
}

export type IssueExpand =
  | 'renderedFields'
  | 'names'
  | 'schema'
  | 'transitions'
  | 'operations'
  | 'editmeta'
  | 'changelog'
  | 'versionedRepresentations';

// ============================================================================
// Search Types
// ============================================================================

export interface SearchParams extends PaginationParams {
  jql: string;
  fields?: string[];
  expand?: IssueExpand[];
  properties?: string[];
  fieldsByKeys?: boolean;
  validateQuery?: 'strict' | 'warn' | 'none';
}

export interface SearchResponse {
  expand?: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: Issue[];
  names?: Record<string, string>;
  schema?: Record<string, FieldSchema>;
  warningMessages?: string[];
}

export interface FieldSchema {
  type: string;
  system?: string;
  items?: string;
  custom?: string;
  customId?: number;
}

// ============================================================================
// Comment Types
// ============================================================================

export interface Comment {
  id: string;
  self?: string;
  author?: User;
  updateAuthor?: User;
  body: AtlassianDocument | string;
  created?: string;
  updated?: string;
  visibility?: Visibility;
  jsdPublic?: boolean;
}

export interface CommentCreateParams {
  body: AtlassianDocument | string;
  visibility?: Visibility;
}

export interface CommentUpdateParams {
  body: AtlassianDocument | string;
  visibility?: Visibility;
}

export interface CommentsParams extends PaginationParams {
  orderBy?: 'created' | '-created';
  expand?: 'renderedBody'[];
}

export interface Visibility {
  type: 'group' | 'role';
  value: string;
  identifier?: string;
}

// ============================================================================
// Atlassian Document Format (ADF)
// ============================================================================

export interface AtlassianDocument {
  type: 'doc';
  version: 1;
  content: AtlassianDocumentNode[];
}

export interface AtlassianDocumentNode {
  type: string;
  content?: AtlassianDocumentNode[];
  text?: string;
  marks?: AtlassianDocumentMark[];
  attrs?: Record<string, unknown>;
}

export interface AtlassianDocumentMark {
  type: string;
  attrs?: Record<string, unknown>;
}

// ============================================================================
// Attachment Types
// ============================================================================

export interface Attachment {
  id: string;
  self?: string;
  filename: string;
  author?: User;
  created?: string;
  size: number;
  mimeType?: string;
  content?: string;
  thumbnail?: string;
}

// ============================================================================
// Worklog Types
// ============================================================================

export interface Worklog {
  id: string;
  self?: string;
  author?: User;
  updateAuthor?: User;
  comment?: AtlassianDocument | string;
  created?: string;
  updated?: string;
  started?: string;
  timeSpent?: string;
  timeSpentSeconds?: number;
  visibility?: Visibility;
}

export interface WorklogCreateParams {
  comment?: AtlassianDocument | string;
  started: string;
  timeSpentSeconds?: number;
  timeSpent?: string;
  visibility?: Visibility;
}

export interface WorklogUpdateParams extends WorklogCreateParams {}

export interface TimeTracking {
  originalEstimate?: string;
  remainingEstimate?: string;
  timeSpent?: string;
  originalEstimateSeconds?: number;
  remainingEstimateSeconds?: number;
  timeSpentSeconds?: number;
}

// ============================================================================
// Transition Types
// ============================================================================

export interface Transition {
  id: string;
  name: string;
  to: Status;
  hasScreen?: boolean;
  isGlobal?: boolean;
  isInitial?: boolean;
  isAvailable?: boolean;
  isConditional?: boolean;
  isLooped?: boolean;
  fields?: Record<string, TransitionField>;
}

export interface TransitionField {
  required: boolean;
  schema: FieldSchema;
  name: string;
  fieldId: string;
  hasDefaultValue?: boolean;
  operations?: string[];
  allowedValues?: unknown[];
  defaultValue?: unknown;
}

export interface TransitionParams {
  transition: { id: string };
  fields?: Record<string, unknown>;
  update?: Record<string, IssueUpdateOperation[]>;
  historyMetadata?: Record<string, unknown>;
}

// ============================================================================
// Issue Link Types
// ============================================================================

export interface IssueLink {
  id: string;
  self?: string;
  type: IssueLinkType;
  inwardIssue?: LinkedIssue;
  outwardIssue?: LinkedIssue;
}

export interface IssueLinkType {
  id: string;
  name: string;
  inward: string;
  outward: string;
  self?: string;
}

export interface LinkedIssue {
  id: string;
  key: string;
  self?: string;
  fields?: {
    summary: string;
    status: Status;
    priority?: Priority;
    issuetype: IssueType;
  };
}

export interface IssueLinkCreateParams {
  type: { id: string } | { name: string };
  inwardIssue: { id: string } | { key: string };
  outwardIssue: { id: string } | { key: string };
  comment?: CommentCreateParams;
}

// ============================================================================
// Changelog Types
// ============================================================================

export interface Changelog {
  startAt: number;
  maxResults: number;
  total: number;
  histories: ChangelogHistory[];
}

export interface ChangelogHistory {
  id: string;
  author?: User;
  created?: string;
  items: ChangelogItem[];
}

export interface ChangelogItem {
  field: string;
  fieldtype: string;
  fieldId?: string;
  from?: string | null;
  fromString?: string | null;
  to?: string | null;
  toString?: string | null;
}

// ============================================================================
// Watch & Vote Types
// ============================================================================

export interface Watches {
  self?: string;
  watchCount: number;
  isWatching: boolean;
  watchers?: User[];
}

export interface Votes {
  self?: string;
  votes: number;
  hasVoted: boolean;
  voters?: User[];
}

// ============================================================================
// Entity Property Types
// ============================================================================

export interface EntityProperty {
  key: string;
  value: unknown;
}

// ============================================================================
// Sprint Types (Agile)
// ============================================================================

export interface Sprint {
  id: number;
  self?: string;
  state: 'future' | 'active' | 'closed';
  name: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  activatedDate?: string;
  originBoardId?: number;
  goal?: string;
}

export interface SprintCreateParams {
  name: string;
  originBoardId: number;
  startDate?: string;
  endDate?: string;
  goal?: string;
}

export interface SprintUpdateParams {
  name?: string;
  state?: 'future' | 'active' | 'closed';
  startDate?: string;
  endDate?: string;
  goal?: string;
}

// ============================================================================
// Board Types (Agile)
// ============================================================================

export interface Board {
  id: number;
  self?: string;
  name: string;
  type: 'scrum' | 'kanban' | 'simple';
  location?: BoardLocation;
}

export interface BoardLocation {
  projectId?: number;
  userId?: number;
  userAccountId?: string;
  displayName?: string;
  projectName?: string;
  projectKey?: string;
  projectTypeKey?: string;
  avatarURI?: string;
  name?: string;
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface Webhook {
  id: number;
  name: string;
  url: string;
  events: WebhookEvent[];
  filters?: WebhookFilter;
  excludeBody?: boolean;
  enabled?: boolean;
  self?: string;
}

export type WebhookEvent =
  | 'jira:issue_created'
  | 'jira:issue_updated'
  | 'jira:issue_deleted'
  | 'comment_created'
  | 'comment_updated'
  | 'comment_deleted'
  | 'issue_property_set'
  | 'issue_property_deleted'
  | 'worklog_created'
  | 'worklog_updated'
  | 'worklog_deleted'
  | 'attachment_created'
  | 'attachment_deleted'
  | 'issuelink_created'
  | 'issuelink_deleted'
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'sprint_created'
  | 'sprint_updated'
  | 'sprint_deleted'
  | 'sprint_started'
  | 'sprint_closed'
  | 'board_created'
  | 'board_updated'
  | 'board_deleted';

export interface WebhookFilter {
  'issue-related-events-section'?: string;
}

// ============================================================================
// Field Types
// ============================================================================

export interface Field {
  id: string;
  key?: string;
  name: string;
  custom: boolean;
  orderable?: boolean;
  navigable?: boolean;
  searchable?: boolean;
  clauseNames?: string[];
  schema?: FieldSchema;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface Filter {
  id: string;
  self?: string;
  name: string;
  description?: string;
  owner?: User;
  jql: string;
  viewUrl?: string;
  searchUrl?: string;
  favourite?: boolean;
  favouritedCount?: number;
  sharePermissions?: SharePermission[];
}

export interface SharePermission {
  id?: number;
  type: 'user' | 'group' | 'project' | 'projectRole' | 'global' | 'authenticated';
  user?: User;
  group?: Group;
  project?: Project;
  role?: ProjectRole;
}

export interface ProjectRole {
  id: number;
  name: string;
  description?: string;
  self?: string;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface Dashboard {
  id: string;
  self?: string;
  name: string;
  description?: string;
  owner?: User;
  view?: string;
  isFavourite?: boolean;
  sharePermissions?: SharePermission[];
}

// ============================================================================
// Bulk Operation Types
// ============================================================================

export interface BulkIssueCreateParams {
  issueUpdates: IssueCreateParams[];
}

export interface BulkIssueCreateResponse {
  issues: Issue[];
  errors: BulkError[];
}

export interface BulkError {
  status: number;
  elementErrors: ErrorResponse;
  failedElementNumber?: number;
}

export interface BulkTransitionParams {
  issues: Array<{
    issueIdOrKey: string;
    transition: { id: string };
    fields?: Record<string, unknown>;
  }>;
  sendBulkNotification?: boolean;
}
