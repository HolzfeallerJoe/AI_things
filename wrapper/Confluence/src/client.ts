import type {
  ConfluenceConfig,
  CreatePageParams,
  CqlSearchParams,
  CqlSearchResponse,
  CurrentUser,
  CursorPaginationParams,
  CursorPagedResponse,
  ErrorResponse,
  GetPageParams,
  Label,
  LabelCreateParams,
  Page,
  PageBodyWrite,
  PageListParams,
  Space,
  SpaceListParams,
  UpdatePageParams,
} from './types.js';

type QueryParams = Record<string, string | number | boolean | string[] | undefined | null>;
type ApiArea = 'v2' | 'rest';

/**
 * Custom error class for Confluence API errors.
 */
export class ConfluenceApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errorResponse?: ErrorResponse
  ) {
    super(message);
    this.name = 'ConfluenceApiError';
  }
}

/**
 * Type-safe Confluence Cloud REST API client.
 */
export class ConfluenceClient {
  private readonly v2BaseUrl: string;
  private readonly restBaseUrl: string;
  private readonly authHeader: string;

  constructor(config: ConfluenceConfig) {
    this.v2BaseUrl = `https://${config.domain}/wiki/api/v2`;
    this.restBaseUrl = `https://${config.domain}/wiki/rest/api`;
    this.authHeader = `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`;
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: QueryParams;
      area?: ApiArea;
    } = {}
  ): Promise<T> {
    const baseUrl = options.area === 'rest' ? this.restBaseUrl : this.v2BaseUrl;
    const url = new URL(`${baseUrl}${path}`);

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            for (const item of value) {
              url.searchParams.append(key, item);
            }
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      Accept: 'application/json',
    };

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      let errorResponse: ErrorResponse | undefined;
      try {
        errorResponse = (await response.json()) as ErrorResponse;
      } catch {
        // Response may not be JSON.
      }

      const message =
        errorResponse?.message ||
        errorResponse?.errors?.map((error) => error.detail || error.title).filter(Boolean).join(', ') ||
        `Confluence API error: ${response.status} ${response.statusText}`;

      throw new ConfluenceApiError(message, response.status, errorResponse);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private get<T>(path: string, query?: QueryParams, area?: ApiArea): Promise<T> {
    return this.request<T>('GET', path, { query, area });
  }

  private post<T>(path: string, body?: unknown, query?: QueryParams, area?: ApiArea): Promise<T> {
    return this.request<T>('POST', path, { body, query, area });
  }

  private put<T>(path: string, body?: unknown, query?: QueryParams, area?: ApiArea): Promise<T> {
    return this.request<T>('PUT', path, { body, query, area });
  }

  private delete<T>(path: string, query?: QueryParams, area?: ApiArea): Promise<T> {
    return this.request<T>('DELETE', path, { query, area });
  }

  // ============================================================================
  // Users
  // ============================================================================

  /**
   * Get the Atlassian account the API token / email authenticates as.
   * Backed by the REST `/user/current` endpoint (no v2 equivalent).
   */
  async getCurrentUser(): Promise<CurrentUser> {
    return this.get<CurrentUser>('/user/current', undefined, 'rest');
  }

  // ============================================================================
  // Spaces
  // ============================================================================

  /**
   * Derive the personal space key for an Atlassian account id.
   *
   * Confluence Cloud stores personal space keys as `~` followed by the account
   * id with all `:` and `-` characters removed. For example the account id
   * `712020:7ed4b425-2e83-44de-b207-fb2ef751caae` maps to the space key
   * `~7120207ed4b4252e8344deb207fb2ef751caae`.
   */
  personalSpaceKey(accountId: string): string {
    const stripped = accountId.replace(/^~/, '').replace(/[:-]/g, '');
    return `~${stripped}`;
  }

  /**
   * Resolve the personal (user) space for a given account id, if one exists.
   * Tries the normalized key first, then a couple of legacy key shapes, then
   * falls back to scanning personal spaces. Returns `undefined` when the user
   * has no personal space (these are not auto-created on Confluence Cloud).
   */
  async getPersonalSpace(accountId: string): Promise<Space | undefined> {
    const candidateKeys = [
      this.personalSpaceKey(accountId),
      `~${accountId.replace(/^~/, '')}`,
    ];

    for (const key of candidateKeys) {
      const space = await this.getSpaceByKey(key);
      if (space) {
        return space;
      }
    }

    // Fallback: scan personal spaces and match by normalized key.
    const wanted = this.personalSpaceKey(accountId);
    for await (const space of this.paginate((p) =>
      this.getSpaces({ ...p, type: 'personal' })
    )) {
      if (space.key === wanted || space.authorId === accountId) {
        return space;
      }
    }

    return undefined;
  }

  /**
   * Resolve the personal (user) space for the account the API token
   * authenticates as. Convenience wrapper over {@link getCurrentUser} and
   * {@link getPersonalSpace}. Returns `undefined` if the user has no personal
   * space yet.
   */
  async getCurrentUserPersonalSpace(): Promise<Space | undefined> {
    const user = await this.getCurrentUser();
    return this.getPersonalSpace(user.accountId);
  }

  /**
   * List visible spaces.
   */
  async getSpaces(params?: SpaceListParams): Promise<CursorPagedResponse<Space>> {
    return this.get<CursorPagedResponse<Space>>('/spaces', {
      ids: params?.ids,
      keys: params?.keys,
      type: params?.type,
      status: params?.status,
      limit: params?.limit,
      cursor: params?.cursor,
    });
  }

  /**
   * Get a space by numeric ID.
   */
  async getSpace(spaceId: string): Promise<Space> {
    return this.get<Space>(`/spaces/${spaceId}`);
  }

  /**
   * Get the first matching space by key.
   */
  async getSpaceByKey(key: string): Promise<Space | undefined> {
    const response = await this.getSpaces({ keys: [key], limit: 1 });
    return response.results[0];
  }

  // ============================================================================
  // Pages
  // ============================================================================

  /**
   * List pages, optionally filtered by space, title, status, or body format.
   */
  async getPages(params?: PageListParams): Promise<CursorPagedResponse<Page>> {
    return this.get<CursorPagedResponse<Page>>('/pages', {
      id: params?.id,
      'space-id': params?.spaceId,
      title: params?.title,
      status: params?.status,
      sort: params?.sort,
      'body-format': params?.bodyFormat,
      limit: params?.limit,
      cursor: params?.cursor,
    });
  }

  /**
   * List pages inside a space.
   */
  async getPagesInSpace(
    spaceId: string,
    params?: Omit<PageListParams, 'spaceId'>
  ): Promise<CursorPagedResponse<Page>> {
    return this.get<CursorPagedResponse<Page>>(`/spaces/${spaceId}/pages`, {
      id: params?.id,
      title: params?.title,
      status: params?.status,
      sort: params?.sort,
      'body-format': params?.bodyFormat,
      limit: params?.limit,
      cursor: params?.cursor,
    });
  }

  /**
   * Get a page by ID.
   */
  async getPage(pageId: string, params?: GetPageParams): Promise<Page> {
    return this.get<Page>(`/pages/${pageId}`, {
      'body-format': params?.bodyFormat,
      'get-draft': params?.getDraft,
      status: params?.status,
      'include-labels': params?.includeLabels,
      'include-properties': params?.includeProperties,
      'include-operations': params?.includeOperations,
      'include-likes': params?.includeLikes,
      'include-versions': params?.includeVersions,
      'include-version': params?.includeVersion,
    });
  }

  /**
   * Create a page. String bodies are treated as Confluence storage-format XHTML.
   */
  async createPage(params: CreatePageParams): Promise<Page> {
    return this.post<Page>(
      '/pages',
      {
        spaceId: params.spaceId,
        status: params.status || 'current',
        title: params.title,
        parentId: params.parentId,
        body: this.toPageBody(params.body),
      },
      {
        'root-level': params.rootLevel,
        private: params.private,
      }
    );
  }

  /**
   * Update a page. If versionNumber is omitted, the client fetches the page and
   * increments the current version number.
   */
  async updatePage(params: UpdatePageParams): Promise<Page> {
    const versionNumber = params.versionNumber ?? (await this.getPage(params.id)).version?.number;

    if (versionNumber === undefined) {
      throw new ConfluenceApiError('Page version number is required for update.', 400);
    }

    return this.put<Page>(`/pages/${params.id}`, {
      id: params.id,
      status: params.status || 'current',
      title: params.title,
      spaceId: params.spaceId,
      parentId: params.parentId,
      body: params.body === undefined ? undefined : this.toPageBody(params.body),
      version: {
        number: versionNumber + 1,
        message: params.versionMessage,
        minorEdit: params.minorEdit,
      },
    });
  }

  /**
   * Delete a page by ID.
   */
  async deletePage(pageId: string): Promise<void> {
    return this.delete<void>(`/pages/${pageId}`);
  }

  /**
   * Get child pages for a page.
   */
  async getPageChildren(
    pageId: string,
    params?: CursorPaginationParams
  ): Promise<CursorPagedResponse<Page>> {
    return this.get<CursorPagedResponse<Page>>(`/pages/${pageId}/children`, {
      limit: params?.limit,
      cursor: params?.cursor,
    });
  }

  // ============================================================================
  // Labels
  // ============================================================================

  /**
   * Get labels assigned to a page.
   */
  async getPageLabels(
    pageId: string,
    params?: CursorPaginationParams
  ): Promise<CursorPagedResponse<Label>> {
    return this.get<CursorPagedResponse<Label>>(`/pages/${pageId}/labels`, {
      limit: params?.limit,
      cursor: params?.cursor,
    });
  }

  /**
   * Add labels to a page.
   */
  async addPageLabels(pageId: string, params: LabelCreateParams): Promise<CursorPagedResponse<Label>> {
    return this.post<CursorPagedResponse<Label>>(`/pages/${pageId}/labels`, params);
  }

  // ============================================================================
  // Search
  // ============================================================================

  /**
   * Search content with Confluence Query Language (CQL).
   */
  async search(params: CqlSearchParams): Promise<CqlSearchResponse> {
    return this.get<CqlSearchResponse>(
      '/search',
      {
        cql: params.cql,
        limit: params.limit,
        start: params.start,
        expand: params.expand,
        excerpt: params.excerpt,
        includeArchivedSpaces: params.includeArchivedSpaces,
      },
      'rest'
    );
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Iterate through cursor-paginated v2 endpoints.
   */
  async *paginate<T>(
    fetchFn: (params: CursorPaginationParams) => Promise<CursorPagedResponse<T>>,
    pageSize = 50
  ): AsyncGenerator<T, void, unknown> {
    let cursor: string | undefined;

    do {
      const response = await fetchFn({ limit: pageSize, cursor });
      for (const item of response.results) {
        yield item;
      }
      cursor = this.extractCursor(response._links?.next);
    } while (cursor);
  }

  /**
   * Get all cursor-paginated results at once.
   */
  async getAll<T>(
    fetchFn: (params: CursorPaginationParams) => Promise<CursorPagedResponse<T>>,
    pageSize = 50
  ): Promise<T[]> {
    const results: T[] = [];
    for await (const item of this.paginate(fetchFn, pageSize)) {
      results.push(item);
    }
    return results;
  }

  private toPageBody(body: string | PageBodyWrite): PageBodyWrite {
    if (typeof body === 'string') {
      return {
        representation: 'storage',
        value: body,
      };
    }

    return body;
  }

  private extractCursor(nextLink: string | undefined): string | undefined {
    if (!nextLink) {
      return undefined;
    }

    const url = new URL(nextLink, this.v2BaseUrl);
    return url.searchParams.get('cursor') || undefined;
  }
}
