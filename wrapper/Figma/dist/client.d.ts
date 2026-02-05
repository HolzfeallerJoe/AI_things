import { User, FileResponse, FileNodesResponse, FileMetaResponse, FileVersionsResponse, ImageResponse, ImageFillsResponse, GetImageParams, Comment, CommentsResponse, PostCommentParams, CommentReactionsResponse, ComponentResponse, ComponentsResponse, ComponentSetResponse, ComponentSetsResponse, StyleResponse, StylesResponse, ProjectFilesResponse, TeamProjectsResponse, Webhook, WebhooksResponse, WebhookRequestsResponse, CreateWebhookParams, UpdateWebhookParams, LocalVariablesResponse, PublishedVariablesResponse, DevResource, DevResourcesResponse, CreateDevResourceParams, UpdateDevResourceParams, ActivityLogsResponse, FigmaErrorResponse, PaginationParams } from './types.js';
export interface FigmaClientConfig {
    accessToken: string;
    baseUrl?: string;
}
export declare class FigmaApiError extends Error {
    status: number;
    errorResponse?: FigmaErrorResponse | undefined;
    constructor(message: string, status: number, errorResponse?: FigmaErrorResponse | undefined);
}
export declare class FigmaClient {
    private baseUrl;
    private accessToken;
    constructor(config: FigmaClientConfig);
    private request;
    private get;
    private post;
    private put;
    private delete;
    /**
     * Get the current user
     */
    getCurrentUser(): Promise<User>;
    /**
     * Get a file
     */
    getFile(fileKey: string, params?: {
        version?: string;
        ids?: string[];
        depth?: number;
        geometry?: 'paths';
        plugin_data?: string;
        branch_data?: boolean;
    }): Promise<FileResponse>;
    /**
     * Get specific nodes from a file
     */
    getFileNodes(fileKey: string, ids: string[], params?: {
        version?: string;
        depth?: number;
        geometry?: 'paths';
        plugin_data?: string;
    }): Promise<FileNodesResponse>;
    /**
     * Get file metadata
     */
    getFileMeta(fileKey: string): Promise<FileMetaResponse>;
    /**
     * Get file versions
     */
    getFileVersions(fileKey: string, params?: PaginationParams): Promise<FileVersionsResponse>;
    /**
     * Render images from a file
     */
    getImage(fileKey: string, params: GetImageParams): Promise<ImageResponse>;
    /**
     * Get image fill URLs
     */
    getImageFills(fileKey: string): Promise<ImageFillsResponse>;
    /**
     * Get comments on a file
     */
    getComments(fileKey: string, params?: {
        as_md?: boolean;
    }): Promise<CommentsResponse>;
    /**
     * Post a comment on a file
     */
    postComment(fileKey: string, params: PostCommentParams): Promise<Comment>;
    /**
     * Delete a comment
     */
    deleteComment(fileKey: string, commentId: string): Promise<void>;
    /**
     * Get reactions on a comment
     */
    getCommentReactions(fileKey: string, commentId: string, params?: {
        cursor?: string;
    }): Promise<CommentReactionsResponse>;
    /**
     * Post a reaction to a comment
     */
    postCommentReaction(fileKey: string, commentId: string, emoji: string): Promise<void>;
    /**
     * Delete a reaction from a comment
     */
    deleteCommentReaction(fileKey: string, commentId: string, emoji: string): Promise<void>;
    /**
     * Get a component by key
     */
    getComponent(componentKey: string): Promise<ComponentResponse>;
    /**
     * Get components from a file
     */
    getFileComponents(fileKey: string, params?: PaginationParams): Promise<ComponentsResponse>;
    /**
     * Get team components
     */
    getTeamComponents(teamId: string, params?: PaginationParams): Promise<ComponentsResponse>;
    /**
     * Get a component set by key
     */
    getComponentSet(componentSetKey: string): Promise<ComponentSetResponse>;
    /**
     * Get component sets from a file
     */
    getFileComponentSets(fileKey: string, params?: PaginationParams): Promise<ComponentSetsResponse>;
    /**
     * Get team component sets
     */
    getTeamComponentSets(teamId: string, params?: PaginationParams): Promise<ComponentSetsResponse>;
    /**
     * Get a style by key
     */
    getStyle(styleKey: string): Promise<StyleResponse>;
    /**
     * Get styles from a file
     */
    getFileStyles(fileKey: string, params?: PaginationParams): Promise<StylesResponse>;
    /**
     * Get team styles
     */
    getTeamStyles(teamId: string, params?: PaginationParams): Promise<StylesResponse>;
    /**
     * Get team projects
     */
    getTeamProjects(teamId: string): Promise<TeamProjectsResponse>;
    /**
     * Get project files
     */
    getProjectFiles(projectId: string, params?: {
        branch_data?: boolean;
    }): Promise<ProjectFilesResponse>;
    /**
     * Create a webhook
     */
    createWebhook(params: CreateWebhookParams): Promise<Webhook>;
    /**
     * Get a webhook
     */
    getWebhook(webhookId: string): Promise<Webhook>;
    /**
     * Get webhooks
     */
    getWebhooks(params?: {
        team_id?: string;
    }): Promise<WebhooksResponse>;
    /**
     * Update a webhook
     */
    updateWebhook(webhookId: string, params: UpdateWebhookParams): Promise<Webhook>;
    /**
     * Delete a webhook
     */
    deleteWebhook(webhookId: string): Promise<void>;
    /**
     * Get webhook requests (for debugging)
     */
    getWebhookRequests(webhookId: string): Promise<WebhookRequestsResponse>;
    /**
     * Get local variables in a file
     */
    getLocalVariables(fileKey: string): Promise<LocalVariablesResponse>;
    /**
     * Get published variables in a file
     */
    getPublishedVariables(fileKey: string): Promise<PublishedVariablesResponse>;
    /**
     * Get dev resources for a file
     */
    getDevResources(fileKey: string, params?: {
        node_ids?: string[];
    }): Promise<DevResourcesResponse>;
    /**
     * Create a dev resource
     */
    createDevResource(params: CreateDevResourceParams): Promise<DevResource>;
    /**
     * Update a dev resource
     */
    updateDevResource(devResourceId: string, params: UpdateDevResourceParams): Promise<DevResource>;
    /**
     * Delete a dev resource
     */
    deleteDevResource(devResourceId: string): Promise<void>;
    /**
     * Get activity logs for a team
     */
    getActivityLogs(params: {
        team_id?: string;
        org_id?: string;
        events?: string[];
        limit?: number;
        cursor?: string;
    }): Promise<ActivityLogsResponse>;
    /**
     * Extract file key from Figma URL
     */
    static extractFileKey(url: string): string;
    /**
     * Extract node ID from Figma URL
     */
    static extractNodeId(url: string): string | null;
    /**
     * Build a Figma file URL
     */
    static buildFileUrl(fileKey: string, nodeId?: string): string;
}
//# sourceMappingURL=client.d.ts.map