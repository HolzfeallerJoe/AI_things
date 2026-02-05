import {
  User,
  FileResponse,
  FileNodesResponse,
  FileMetaResponse,
  FileVersionsResponse,
  ImageResponse,
  ImageFillsResponse,
  GetImageParams,
  Comment,
  CommentsResponse,
  PostCommentParams,
  CommentReactionsResponse,
  ComponentResponse,
  ComponentsResponse,
  ComponentSetResponse,
  ComponentSetsResponse,
  StyleResponse,
  StylesResponse,
  Project,
  ProjectFilesResponse,
  TeamProjectsResponse,
  Webhook,
  WebhooksResponse,
  WebhookRequestsResponse,
  CreateWebhookParams,
  UpdateWebhookParams,
  LocalVariablesResponse,
  PublishedVariablesResponse,
  DevResource,
  DevResourcesResponse,
  CreateDevResourceParams,
  UpdateDevResourceParams,
  ActivityLogsResponse,
  FigmaErrorResponse,
  PaginationParams,
} from './types.js';

export interface FigmaClientConfig {
  accessToken: string;
  baseUrl?: string;
}

export class FigmaApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errorResponse?: FigmaErrorResponse
  ) {
    super(message);
    this.name = 'FigmaApiError';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryParams = Record<string, any>;

export class FigmaClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(config: FigmaClientConfig) {
    this.accessToken = config.accessToken;
    this.baseUrl = config.baseUrl || 'https://api.figma.com';
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: QueryParams
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    if (params) {
      const filteredParams: Record<string, string> = {};
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            filteredParams[key] = value.join(',');
          } else {
            filteredParams[key] = String(value);
          }
        }
      }
      if (Object.keys(filteredParams).length > 0) {
        url += '?' + new URLSearchParams(filteredParams).toString();
      }
    }

    const headers: Record<string, string> = {
      'X-Figma-Token': this.accessToken,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let errorResponse: FigmaErrorResponse | undefined;
      try {
        errorResponse = (await response.json()) as FigmaErrorResponse;
      } catch {
        // Ignore JSON parsing errors
      }
      throw new FigmaApiError(
        errorResponse?.err || errorResponse?.message || `HTTP ${response.status}`,
        response.status,
        errorResponse
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private get<T>(path: string, params?: QueryParams): Promise<T> {
    return this.request<T>('GET', path, undefined, params);
  }

  private post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  private delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  // ==========================================================================
  // User Methods
  // ==========================================================================

  /**
   * Get the current user
   */
  async getCurrentUser(): Promise<User> {
    return this.get<User>('/v1/me');
  }

  // ==========================================================================
  // File Methods
  // ==========================================================================

  /**
   * Get a file
   */
  async getFile(
    fileKey: string,
    params?: {
      version?: string;
      ids?: string[];
      depth?: number;
      geometry?: 'paths';
      plugin_data?: string;
      branch_data?: boolean;
    }
  ): Promise<FileResponse> {
    return this.get<FileResponse>(`/v1/files/${fileKey}`, params);
  }

  /**
   * Get specific nodes from a file
   */
  async getFileNodes(
    fileKey: string,
    ids: string[],
    params?: {
      version?: string;
      depth?: number;
      geometry?: 'paths';
      plugin_data?: string;
    }
  ): Promise<FileNodesResponse> {
    return this.get<FileNodesResponse>(`/v1/files/${fileKey}/nodes`, { ids, ...params });
  }

  /**
   * Get file metadata
   */
  async getFileMeta(fileKey: string): Promise<FileMetaResponse> {
    return this.get<FileMetaResponse>(`/v1/files/${fileKey}/meta`);
  }

  /**
   * Get file versions
   */
  async getFileVersions(
    fileKey: string,
    params?: PaginationParams
  ): Promise<FileVersionsResponse> {
    return this.get<FileVersionsResponse>(`/v1/files/${fileKey}/versions`, params);
  }

  // ==========================================================================
  // Image Methods
  // ==========================================================================

  /**
   * Render images from a file
   */
  async getImage(fileKey: string, params: GetImageParams): Promise<ImageResponse> {
    return this.get<ImageResponse>(`/v1/images/${fileKey}`, params);
  }

  /**
   * Get image fill URLs
   */
  async getImageFills(fileKey: string): Promise<ImageFillsResponse> {
    return this.get<ImageFillsResponse>(`/v1/files/${fileKey}/images`);
  }

  // ==========================================================================
  // Comment Methods
  // ==========================================================================

  /**
   * Get comments on a file
   */
  async getComments(
    fileKey: string,
    params?: { as_md?: boolean }
  ): Promise<CommentsResponse> {
    return this.get<CommentsResponse>(`/v1/files/${fileKey}/comments`, params);
  }

  /**
   * Post a comment on a file
   */
  async postComment(fileKey: string, params: PostCommentParams): Promise<Comment> {
    return this.post<Comment>(`/v1/files/${fileKey}/comments`, params);
  }

  /**
   * Delete a comment
   */
  async deleteComment(fileKey: string, commentId: string): Promise<void> {
    return this.delete<void>(`/v1/files/${fileKey}/comments/${commentId}`);
  }

  /**
   * Get reactions on a comment
   */
  async getCommentReactions(
    fileKey: string,
    commentId: string,
    params?: { cursor?: string }
  ): Promise<CommentReactionsResponse> {
    return this.get<CommentReactionsResponse>(
      `/v1/files/${fileKey}/comments/${commentId}/reactions`,
      params
    );
  }

  /**
   * Post a reaction to a comment
   */
  async postCommentReaction(
    fileKey: string,
    commentId: string,
    emoji: string
  ): Promise<void> {
    return this.post<void>(`/v1/files/${fileKey}/comments/${commentId}/reactions`, { emoji });
  }

  /**
   * Delete a reaction from a comment
   */
  async deleteCommentReaction(
    fileKey: string,
    commentId: string,
    emoji: string
  ): Promise<void> {
    return this.delete<void>(
      `/v1/files/${fileKey}/comments/${commentId}/reactions?emoji=${encodeURIComponent(emoji)}`
    );
  }

  // ==========================================================================
  // Component Methods
  // ==========================================================================

  /**
   * Get a component by key
   */
  async getComponent(componentKey: string): Promise<ComponentResponse> {
    return this.get<ComponentResponse>(`/v1/components/${componentKey}`);
  }

  /**
   * Get components from a file
   */
  async getFileComponents(
    fileKey: string,
    params?: PaginationParams
  ): Promise<ComponentsResponse> {
    return this.get<ComponentsResponse>(`/v1/files/${fileKey}/components`, params);
  }

  /**
   * Get team components
   */
  async getTeamComponents(
    teamId: string,
    params?: PaginationParams
  ): Promise<ComponentsResponse> {
    return this.get<ComponentsResponse>(`/v1/teams/${teamId}/components`, params);
  }

  /**
   * Get a component set by key
   */
  async getComponentSet(componentSetKey: string): Promise<ComponentSetResponse> {
    return this.get<ComponentSetResponse>(`/v1/component_sets/${componentSetKey}`);
  }

  /**
   * Get component sets from a file
   */
  async getFileComponentSets(
    fileKey: string,
    params?: PaginationParams
  ): Promise<ComponentSetsResponse> {
    return this.get<ComponentSetsResponse>(`/v1/files/${fileKey}/component_sets`, params);
  }

  /**
   * Get team component sets
   */
  async getTeamComponentSets(
    teamId: string,
    params?: PaginationParams
  ): Promise<ComponentSetsResponse> {
    return this.get<ComponentSetsResponse>(`/v1/teams/${teamId}/component_sets`, params);
  }

  // ==========================================================================
  // Style Methods
  // ==========================================================================

  /**
   * Get a style by key
   */
  async getStyle(styleKey: string): Promise<StyleResponse> {
    return this.get<StyleResponse>(`/v1/styles/${styleKey}`);
  }

  /**
   * Get styles from a file
   */
  async getFileStyles(
    fileKey: string,
    params?: PaginationParams
  ): Promise<StylesResponse> {
    return this.get<StylesResponse>(`/v1/files/${fileKey}/styles`, params);
  }

  /**
   * Get team styles
   */
  async getTeamStyles(
    teamId: string,
    params?: PaginationParams
  ): Promise<StylesResponse> {
    return this.get<StylesResponse>(`/v1/teams/${teamId}/styles`, params);
  }

  // ==========================================================================
  // Project Methods
  // ==========================================================================

  /**
   * Get team projects
   */
  async getTeamProjects(teamId: string): Promise<TeamProjectsResponse> {
    return this.get<TeamProjectsResponse>(`/v1/teams/${teamId}/projects`);
  }

  /**
   * Get project files
   */
  async getProjectFiles(
    projectId: string,
    params?: { branch_data?: boolean }
  ): Promise<ProjectFilesResponse> {
    return this.get<ProjectFilesResponse>(`/v1/projects/${projectId}/files`, params);
  }

  // ==========================================================================
  // Webhook Methods (v2)
  // ==========================================================================

  /**
   * Create a webhook
   */
  async createWebhook(params: CreateWebhookParams): Promise<Webhook> {
    return this.post<Webhook>('/v2/webhooks', params);
  }

  /**
   * Get a webhook
   */
  async getWebhook(webhookId: string): Promise<Webhook> {
    return this.get<Webhook>(`/v2/webhooks/${webhookId}`);
  }

  /**
   * Get webhooks
   */
  async getWebhooks(params?: { team_id?: string }): Promise<WebhooksResponse> {
    return this.get<WebhooksResponse>('/v2/webhooks', params);
  }

  /**
   * Update a webhook
   */
  async updateWebhook(webhookId: string, params: UpdateWebhookParams): Promise<Webhook> {
    return this.put<Webhook>(`/v2/webhooks/${webhookId}`, params);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    return this.delete<void>(`/v2/webhooks/${webhookId}`);
  }

  /**
   * Get webhook requests (for debugging)
   */
  async getWebhookRequests(webhookId: string): Promise<WebhookRequestsResponse> {
    return this.get<WebhookRequestsResponse>(`/v2/webhooks/${webhookId}/requests`);
  }

  // ==========================================================================
  // Variable Methods
  // ==========================================================================

  /**
   * Get local variables in a file
   */
  async getLocalVariables(fileKey: string): Promise<LocalVariablesResponse> {
    return this.get<LocalVariablesResponse>(`/v1/files/${fileKey}/variables/local`);
  }

  /**
   * Get published variables in a file
   */
  async getPublishedVariables(fileKey: string): Promise<PublishedVariablesResponse> {
    return this.get<PublishedVariablesResponse>(`/v1/files/${fileKey}/variables/published`);
  }

  // ==========================================================================
  // Dev Resources Methods
  // ==========================================================================

  /**
   * Get dev resources for a file
   */
  async getDevResources(
    fileKey: string,
    params?: { node_ids?: string[] }
  ): Promise<DevResourcesResponse> {
    return this.get<DevResourcesResponse>(`/v1/files/${fileKey}/dev_resources`, params);
  }

  /**
   * Create a dev resource
   */
  async createDevResource(params: CreateDevResourceParams): Promise<DevResource> {
    return this.post<DevResource>('/v1/dev_resources', params);
  }

  /**
   * Update a dev resource
   */
  async updateDevResource(
    devResourceId: string,
    params: UpdateDevResourceParams
  ): Promise<DevResource> {
    return this.put<DevResource>(`/v1/dev_resources/${devResourceId}`, params);
  }

  /**
   * Delete a dev resource
   */
  async deleteDevResource(devResourceId: string): Promise<void> {
    return this.delete<void>(`/v1/dev_resources/${devResourceId}`);
  }

  // ==========================================================================
  // Activity Log Methods
  // ==========================================================================

  /**
   * Get activity logs for a team
   */
  async getActivityLogs(
    params: {
      team_id?: string;
      org_id?: string;
      events?: string[];
      limit?: number;
      cursor?: string;
    }
  ): Promise<ActivityLogsResponse> {
    return this.get<ActivityLogsResponse>('/v1/activity_logs', params);
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Extract file key from Figma URL
   */
  static extractFileKey(url: string): string {
    // Matches URLs like:
    // https://www.figma.com/file/ABC123/FileName
    // https://www.figma.com/design/ABC123/FileName
    // https://figma.com/file/ABC123/FileName
    const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
    if (!match) {
      throw new Error(`Invalid Figma URL: ${url}`);
    }
    return match[1];
  }

  /**
   * Extract node ID from Figma URL
   */
  static extractNodeId(url: string): string | null {
    // Matches ?node-id=123-456 or ?node-id=123:456
    const match = url.match(/node-id=([0-9]+[-:][0-9]+)/);
    return match ? match[1].replace('-', ':') : null;
  }

  /**
   * Build a Figma file URL
   */
  static buildFileUrl(fileKey: string, nodeId?: string): string {
    let url = `https://www.figma.com/file/${fileKey}`;
    if (nodeId) {
      url += `?node-id=${nodeId.replace(':', '-')}`;
    }
    return url;
  }
}
