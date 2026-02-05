import { AtlassianDocument } from './types.js';
export type JqlOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | '~' | '!~' | 'in' | 'not in' | 'is' | 'is not' | 'was' | 'was not' | 'was in' | 'was not in' | 'changed';
export type JqlField = 'assignee' | 'created' | 'creator' | 'description' | 'duedate' | 'issuetype' | 'key' | 'labels' | 'priority' | 'project' | 'reporter' | 'resolution' | 'resolved' | 'sprint' | 'status' | 'statusCategory' | 'summary' | 'text' | 'updated' | 'watcher' | string;
export type JqlOrderDirection = 'ASC' | 'DESC';
/**
 * Type-safe JQL Query Builder
 */
export declare class JqlBuilder {
    private conditions;
    private orderByFields;
    /**
     * Add an equality condition
     */
    eq(field: JqlField, value: string | number): this;
    /**
     * Add a not-equal condition
     */
    neq(field: JqlField, value: string | number): this;
    /**
     * Add a greater-than condition
     */
    gt(field: JqlField, value: string | number): this;
    /**
     * Add a greater-than-or-equal condition
     */
    gte(field: JqlField, value: string | number): this;
    /**
     * Add a less-than condition
     */
    lt(field: JqlField, value: string | number): this;
    /**
     * Add a less-than-or-equal condition
     */
    lte(field: JqlField, value: string | number): this;
    /**
     * Add a contains/like condition (fuzzy match)
     */
    contains(field: JqlField, value: string): this;
    /**
     * Add a not-contains condition
     */
    notContains(field: JqlField, value: string): this;
    /**
     * Add an "in" condition for multiple values
     */
    in(field: JqlField, values: string[]): this;
    /**
     * Add a "not in" condition
     */
    notIn(field: JqlField, values: string[]): this;
    /**
     * Add an "is" condition (typically for null checks)
     */
    is(field: JqlField, value: 'EMPTY' | 'NULL' | string): this;
    /**
     * Add an "is not" condition
     */
    isNot(field: JqlField, value: 'EMPTY' | 'NULL' | string): this;
    /**
     * Add raw JQL condition
     */
    raw(jql: string): this;
    /**
     * Add AND grouping
     */
    and(builder: JqlBuilder | ((b: JqlBuilder) => JqlBuilder)): this;
    /**
     * Add OR grouping
     */
    or(builder: JqlBuilder | ((b: JqlBuilder) => JqlBuilder)): this;
    /**
     * Add ORDER BY clause
     */
    orderBy(field: JqlField, direction?: JqlOrderDirection): this;
    private formatValue;
    private formatCondition;
    private buildConditions;
    /**
     * Build the final JQL string
     */
    build(): string;
    /**
     * Create a new JQL builder
     */
    static create(): JqlBuilder;
}
/**
 * Builder for creating Atlassian Document Format documents
 */
export declare class AdfBuilder {
    private content;
    /**
     * Add a paragraph
     */
    paragraph(text: string): this;
    /**
     * Add a paragraph with inline formatting
     */
    paragraphWithMarks(segments: Array<{
        text: string;
        marks?: Array<'strong' | 'em' | 'code' | 'strike' | 'underline'>;
    }>): this;
    /**
     * Add a heading
     */
    heading(text: string, level?: 1 | 2 | 3 | 4 | 5 | 6): this;
    /**
     * Add a bullet list
     */
    bulletList(items: string[]): this;
    /**
     * Add an ordered (numbered) list
     */
    orderedList(items: string[]): this;
    /**
     * Add a code block
     */
    codeBlock(code: string, language?: string): this;
    /**
     * Add a blockquote
     */
    blockquote(text: string): this;
    /**
     * Add a horizontal rule
     */
    rule(): this;
    /**
     * Add a panel (info, note, warning, error, success)
     */
    panel(text: string, panelType?: 'info' | 'note' | 'warning' | 'error' | 'success'): this;
    /**
     * Add a table
     */
    table(headers: string[], rows: string[][]): this;
    /**
     * Add a user mention
     */
    mention(accountId: string, displayText?: string): this;
    /**
     * Add an emoji
     */
    emoji(shortName: string): this;
    /**
     * Add a link
     */
    link(text: string, url: string): this;
    /**
     * Build the final ADF document
     */
    build(): AtlassianDocument;
    /**
     * Create a new ADF builder
     */
    static create(): AdfBuilder;
    /**
     * Create a simple text document
     */
    static text(text: string): AtlassianDocument;
}
/**
 * Format a date for Jira (YYYY-MM-DD)
 */
export declare function formatJiraDate(date: Date): string;
/**
 * Format a datetime for Jira (ISO 8601)
 */
export declare function formatJiraDateTime(date: Date): string;
/**
 * Parse a Jira date string to Date object
 */
export declare function parseJiraDate(dateString: string): Date;
/**
 * Parse Jira duration format (e.g., "1w 2d 3h 4m") to seconds
 */
export declare function parseDuration(duration: string): number;
/**
 * Format seconds to Jira duration format
 */
export declare function formatDuration(seconds: number): string;
//# sourceMappingURL=helpers.d.ts.map