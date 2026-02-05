import { AtlassianDocument, AtlassianDocumentNode } from './types.js';

// ============================================================================
// JQL Query Builder
// ============================================================================

export type JqlOperator =
  | '='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | '~'
  | '!~'
  | 'in'
  | 'not in'
  | 'is'
  | 'is not'
  | 'was'
  | 'was not'
  | 'was in'
  | 'was not in'
  | 'changed';

export type JqlField =
  | 'assignee'
  | 'created'
  | 'creator'
  | 'description'
  | 'duedate'
  | 'issuetype'
  | 'key'
  | 'labels'
  | 'priority'
  | 'project'
  | 'reporter'
  | 'resolution'
  | 'resolved'
  | 'sprint'
  | 'status'
  | 'statusCategory'
  | 'summary'
  | 'text'
  | 'updated'
  | 'watcher'
  | string;

export type JqlOrderDirection = 'ASC' | 'DESC';

interface JqlCondition {
  field: JqlField;
  operator: JqlOperator;
  value: string | string[] | number | null;
}

interface JqlOrder {
  field: JqlField;
  direction: JqlOrderDirection;
}

/**
 * Type-safe JQL Query Builder
 */
export class JqlBuilder {
  private conditions: Array<JqlCondition | string> = [];
  private orderByFields: JqlOrder[] = [];

  /**
   * Add an equality condition
   */
  eq(field: JqlField, value: string | number): this {
    this.conditions.push({ field, operator: '=', value });
    return this;
  }

  /**
   * Add a not-equal condition
   */
  neq(field: JqlField, value: string | number): this {
    this.conditions.push({ field, operator: '!=', value });
    return this;
  }

  /**
   * Add a greater-than condition
   */
  gt(field: JqlField, value: string | number): this {
    this.conditions.push({ field, operator: '>', value });
    return this;
  }

  /**
   * Add a greater-than-or-equal condition
   */
  gte(field: JqlField, value: string | number): this {
    this.conditions.push({ field, operator: '>=', value });
    return this;
  }

  /**
   * Add a less-than condition
   */
  lt(field: JqlField, value: string | number): this {
    this.conditions.push({ field, operator: '<', value });
    return this;
  }

  /**
   * Add a less-than-or-equal condition
   */
  lte(field: JqlField, value: string | number): this {
    this.conditions.push({ field, operator: '<=', value });
    return this;
  }

  /**
   * Add a contains/like condition (fuzzy match)
   */
  contains(field: JqlField, value: string): this {
    this.conditions.push({ field, operator: '~', value });
    return this;
  }

  /**
   * Add a not-contains condition
   */
  notContains(field: JqlField, value: string): this {
    this.conditions.push({ field, operator: '!~', value });
    return this;
  }

  /**
   * Add an "in" condition for multiple values
   */
  in(field: JqlField, values: string[]): this {
    this.conditions.push({ field, operator: 'in', value: values });
    return this;
  }

  /**
   * Add a "not in" condition
   */
  notIn(field: JqlField, values: string[]): this {
    this.conditions.push({ field, operator: 'not in', value: values });
    return this;
  }

  /**
   * Add an "is" condition (typically for null checks)
   */
  is(field: JqlField, value: 'EMPTY' | 'NULL' | string): this {
    this.conditions.push({ field, operator: 'is', value });
    return this;
  }

  /**
   * Add an "is not" condition
   */
  isNot(field: JqlField, value: 'EMPTY' | 'NULL' | string): this {
    this.conditions.push({ field, operator: 'is not', value });
    return this;
  }

  /**
   * Add raw JQL condition
   */
  raw(jql: string): this {
    this.conditions.push(jql);
    return this;
  }

  /**
   * Add AND grouping
   */
  and(builder: JqlBuilder | ((b: JqlBuilder) => JqlBuilder)): this {
    const subBuilder = builder instanceof JqlBuilder ? builder : builder(new JqlBuilder());
    const subJql = subBuilder.buildConditions();
    if (subJql) {
      this.conditions.push(`(${subJql})`);
    }
    return this;
  }

  /**
   * Add OR grouping
   */
  or(builder: JqlBuilder | ((b: JqlBuilder) => JqlBuilder)): this {
    const subBuilder = builder instanceof JqlBuilder ? builder : builder(new JqlBuilder());
    const subJql = subBuilder.buildConditions();
    if (subJql && this.conditions.length > 0) {
      const lastCondition = this.conditions.pop();
      this.conditions.push(`(${this.formatCondition(lastCondition!)} OR ${subJql})`);
    }
    return this;
  }

  /**
   * Add ORDER BY clause
   */
  orderBy(field: JqlField, direction: JqlOrderDirection = 'ASC'): this {
    this.orderByFields.push({ field, direction });
    return this;
  }

  private formatValue(value: string | string[] | number | null): string {
    if (value === null) {
      return 'null';
    }
    if (Array.isArray(value)) {
      return `(${value.map((v) => `"${v}"`).join(', ')})`;
    }
    if (typeof value === 'number') {
      return String(value);
    }
    // Check if value needs quoting
    if (/^[a-zA-Z0-9_-]+$/.test(value) && !value.includes(' ')) {
      return value;
    }
    return `"${value}"`;
  }

  private formatCondition(condition: JqlCondition | string): string {
    if (typeof condition === 'string') {
      return condition;
    }
    return `${condition.field} ${condition.operator} ${this.formatValue(condition.value)}`;
  }

  private buildConditions(): string {
    return this.conditions.map((c) => this.formatCondition(c)).join(' AND ');
  }

  /**
   * Build the final JQL string
   */
  build(): string {
    let jql = this.buildConditions();

    if (this.orderByFields.length > 0) {
      const orderBy = this.orderByFields
        .map((o) => `${o.field} ${o.direction}`)
        .join(', ');
      jql += ` ORDER BY ${orderBy}`;
    }

    return jql;
  }

  /**
   * Create a new JQL builder
   */
  static create(): JqlBuilder {
    return new JqlBuilder();
  }
}

// ============================================================================
// Atlassian Document Format (ADF) Builder
// ============================================================================

/**
 * Builder for creating Atlassian Document Format documents
 */
export class AdfBuilder {
  private content: AtlassianDocumentNode[] = [];

  /**
   * Add a paragraph
   */
  paragraph(text: string): this {
    this.content.push({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    });
    return this;
  }

  /**
   * Add a paragraph with inline formatting
   */
  paragraphWithMarks(
    segments: Array<{ text: string; marks?: Array<'strong' | 'em' | 'code' | 'strike' | 'underline'> }>
  ): this {
    this.content.push({
      type: 'paragraph',
      content: segments.map((segment) => ({
        type: 'text',
        text: segment.text,
        marks: segment.marks?.map((m) => ({ type: m })),
      })),
    });
    return this;
  }

  /**
   * Add a heading
   */
  heading(text: string, level: 1 | 2 | 3 | 4 | 5 | 6 = 1): this {
    this.content.push({
      type: 'heading',
      attrs: { level },
      content: [{ type: 'text', text }],
    });
    return this;
  }

  /**
   * Add a bullet list
   */
  bulletList(items: string[]): this {
    this.content.push({
      type: 'bulletList',
      content: items.map((item) => ({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: item }],
          },
        ],
      })),
    });
    return this;
  }

  /**
   * Add an ordered (numbered) list
   */
  orderedList(items: string[]): this {
    this.content.push({
      type: 'orderedList',
      content: items.map((item) => ({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: item }],
          },
        ],
      })),
    });
    return this;
  }

  /**
   * Add a code block
   */
  codeBlock(code: string, language?: string): this {
    this.content.push({
      type: 'codeBlock',
      attrs: language ? { language } : undefined,
      content: [{ type: 'text', text: code }],
    });
    return this;
  }

  /**
   * Add a blockquote
   */
  blockquote(text: string): this {
    this.content.push({
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text }],
        },
      ],
    });
    return this;
  }

  /**
   * Add a horizontal rule
   */
  rule(): this {
    this.content.push({ type: 'rule' });
    return this;
  }

  /**
   * Add a panel (info, note, warning, error, success)
   */
  panel(text: string, panelType: 'info' | 'note' | 'warning' | 'error' | 'success' = 'info'): this {
    this.content.push({
      type: 'panel',
      attrs: { panelType },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text }],
        },
      ],
    });
    return this;
  }

  /**
   * Add a table
   */
  table(
    headers: string[],
    rows: string[][]
  ): this {
    const tableRows: AtlassianDocumentNode[] = [];

    // Header row
    tableRows.push({
      type: 'tableRow',
      content: headers.map((header) => ({
        type: 'tableHeader',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: header }],
          },
        ],
      })),
    });

    // Data rows
    for (const row of rows) {
      tableRows.push({
        type: 'tableRow',
        content: row.map((cell) => ({
          type: 'tableCell',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: cell }],
            },
          ],
        })),
      });
    }

    this.content.push({
      type: 'table',
      attrs: { isNumberColumnEnabled: false, layout: 'default' },
      content: tableRows,
    });
    return this;
  }

  /**
   * Add a user mention
   */
  mention(accountId: string, displayText?: string): this {
    this.content.push({
      type: 'paragraph',
      content: [
        {
          type: 'mention',
          attrs: {
            id: accountId,
            text: displayText || `@${accountId}`,
            accessLevel: '',
          },
        },
      ],
    });
    return this;
  }

  /**
   * Add an emoji
   */
  emoji(shortName: string): this {
    this.content.push({
      type: 'paragraph',
      content: [
        {
          type: 'emoji',
          attrs: {
            shortName: `:${shortName}:`,
            text: shortName,
          },
        },
      ],
    });
    return this;
  }

  /**
   * Add a link
   */
  link(text: string, url: string): this {
    this.content.push({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text,
          marks: [
            {
              type: 'link',
              attrs: { href: url },
            },
          ],
        },
      ],
    });
    return this;
  }

  /**
   * Build the final ADF document
   */
  build(): AtlassianDocument {
    return {
      type: 'doc',
      version: 1,
      content: this.content,
    };
  }

  /**
   * Create a new ADF builder
   */
  static create(): AdfBuilder {
    return new AdfBuilder();
  }

  /**
   * Create a simple text document
   */
  static text(text: string): AtlassianDocument {
    return new AdfBuilder().paragraph(text).build();
  }
}

// ============================================================================
// Date Helpers
// ============================================================================

/**
 * Format a date for Jira (YYYY-MM-DD)
 */
export function formatJiraDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format a datetime for Jira (ISO 8601)
 */
export function formatJiraDateTime(date: Date): string {
  return date.toISOString();
}

/**
 * Parse a Jira date string to Date object
 */
export function parseJiraDate(dateString: string): Date {
  return new Date(dateString);
}

// ============================================================================
// Time Tracking Helpers
// ============================================================================

/**
 * Parse Jira duration format (e.g., "1w 2d 3h 4m") to seconds
 */
export function parseDuration(duration: string): number {
  const regex = /(\d+)([wdhm])/g;
  let totalSeconds = 0;
  let match;

  const multipliers: Record<string, number> = {
    w: 5 * 8 * 60 * 60, // 1 week = 5 days * 8 hours
    d: 8 * 60 * 60, // 1 day = 8 hours
    h: 60 * 60,
    m: 60,
  };

  while ((match = regex.exec(duration)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2];
    totalSeconds += value * (multipliers[unit] || 0);
  }

  return totalSeconds;
}

/**
 * Format seconds to Jira duration format
 */
export function formatDuration(seconds: number): string {
  const weeks = Math.floor(seconds / (5 * 8 * 60 * 60));
  seconds %= 5 * 8 * 60 * 60;

  const days = Math.floor(seconds / (8 * 60 * 60));
  seconds %= 8 * 60 * 60;

  const hours = Math.floor(seconds / (60 * 60));
  seconds %= 60 * 60;

  const minutes = Math.floor(seconds / 60);

  const parts: string[] = [];
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(' ') || '0m';
}
