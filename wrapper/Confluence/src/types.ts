/**
 * Confluence Cloud REST API type definitions.
 */

export interface ConfluenceConfig {
  /** Your Atlassian Cloud domain (e.g., 'your-domain.atlassian.net') */
  domain: string;
  /** Email address for Basic Auth */
  email: string;
  /** API token from https://id.atlassian.com/manage-profile/security/api-tokens */
  apiToken: string;
}

export interface CursorPaginationParams {
  /** Maximum number of items to return */
  limit?: number;
  /** Cursor returned by a previous response */
  cursor?: string;
}

export interface CursorPagedResponse<T> {
  results: T[];
  _links?: {
    next?: string;
    base?: string;
    [key: string]: string | undefined;
  };
}

export interface ConfluenceErrorDetail {
  status?: number;
  code?: string;
  title?: string;
  detail?: string;
}

export interface ErrorResponse {
  message?: string;
  errors?: ConfluenceErrorDetail[];
}

export type ContentStatus = 'current' | 'draft' | 'archived' | 'trashed';
export type WritableContentStatus = 'current' | 'draft';
export type BodyRepresentation = 'storage' | 'atlas_doc_format';
export type ReadBodyFormat =
  | 'storage'
  | 'atlas_doc_format'
  | 'view'
  | 'export_view'
  | 'styled_view';

export interface BodyValue {
  representation: string;
  value: string;
}

export interface PageBody {
  storage?: BodyValue;
  atlas_doc_format?: BodyValue;
  view?: BodyValue;
  export_view?: BodyValue;
  styled_view?: BodyValue;
}

export interface PageBodyWrite {
  representation: BodyRepresentation;
  value: string;
}

export interface Version {
  number: number;
  message?: string;
  minorEdit?: boolean;
  authorId?: string;
  createdAt?: string;
}

export interface Space {
  id: string;
  key: string;
  name: string;
  type?: string;
  status?: string;
  homepageId?: string;
  authorId?: string;
  createdAt?: string;
  _links?: Record<string, string>;
}

/**
 * The Atlassian account the API token authenticates as.
 * Returned by the REST `/user/current` endpoint.
 */
export interface CurrentUser {
  accountId: string;
  accountType?: string;
  email?: string;
  publicName?: string;
  displayName?: string;
  isExternalCollaborator?: boolean;
  _links?: Record<string, string>;
}

export interface SpaceListParams extends CursorPaginationParams {
  ids?: string[];
  keys?: string[];
  type?: string;
  status?: string;
}

export interface Page {
  id: string;
  status: ContentStatus;
  title: string;
  spaceId?: string;
  parentId?: string;
  authorId?: string;
  createdAt?: string;
  version?: Version;
  body?: PageBody;
  _links?: Record<string, string>;
}

export interface PageListParams extends CursorPaginationParams {
  id?: string[];
  spaceId?: string[];
  title?: string;
  status?: ContentStatus[];
  sort?: string;
  bodyFormat?: ReadBodyFormat;
}

export interface GetPageParams {
  bodyFormat?: ReadBodyFormat;
  getDraft?: boolean;
  status?: ContentStatus;
  includeLabels?: boolean;
  includeProperties?: boolean;
  includeOperations?: boolean;
  includeLikes?: boolean;
  includeVersions?: boolean;
  includeVersion?: boolean;
}

export interface CreatePageParams {
  spaceId: string;
  title: string;
  body: string | PageBodyWrite;
  parentId?: string;
  status?: WritableContentStatus;
  rootLevel?: boolean;
  private?: boolean;
}

export interface UpdatePageParams {
  id: string;
  spaceId: string;
  title: string;
  body?: string | PageBodyWrite;
  status?: WritableContentStatus;
  parentId?: string;
  versionNumber?: number;
  versionMessage?: string;
  minorEdit?: boolean;
}

export interface Label {
  id?: string;
  name: string;
  prefix?: string;
}

export interface LabelCreateParams {
  labels: Label[];
}

export interface CqlSearchParams {
  cql: string;
  limit?: number;
  start?: number;
  expand?: string[];
  excerpt?: 'highlight' | 'none';
  includeArchivedSpaces?: boolean;
}

export interface CqlSearchResult {
  content?: {
    id: string;
    type: string;
    status: string;
    title: string;
    _links?: Record<string, string>;
  };
  title?: string;
  excerpt?: string;
  url?: string;
  resultGlobalContainer?: {
    title?: string;
    displayUrl?: string;
  };
  entityType?: string;
}

export interface CqlSearchResponse {
  results: CqlSearchResult[];
  start: number;
  limit: number;
  size: number;
  totalSize?: number;
  cqlQuery?: string;
  _links?: Record<string, string>;
}
