"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdfBuilder = exports.JqlBuilder = void 0;
exports.formatJiraDate = formatJiraDate;
exports.formatJiraDateTime = formatJiraDateTime;
exports.parseJiraDate = parseJiraDate;
exports.parseDuration = parseDuration;
exports.formatDuration = formatDuration;
/**
 * Type-safe JQL Query Builder
 */
class JqlBuilder {
    conditions = [];
    orderByFields = [];
    /**
     * Add an equality condition
     */
    eq(field, value) {
        this.conditions.push({ field, operator: '=', value });
        return this;
    }
    /**
     * Add a not-equal condition
     */
    neq(field, value) {
        this.conditions.push({ field, operator: '!=', value });
        return this;
    }
    /**
     * Add a greater-than condition
     */
    gt(field, value) {
        this.conditions.push({ field, operator: '>', value });
        return this;
    }
    /**
     * Add a greater-than-or-equal condition
     */
    gte(field, value) {
        this.conditions.push({ field, operator: '>=', value });
        return this;
    }
    /**
     * Add a less-than condition
     */
    lt(field, value) {
        this.conditions.push({ field, operator: '<', value });
        return this;
    }
    /**
     * Add a less-than-or-equal condition
     */
    lte(field, value) {
        this.conditions.push({ field, operator: '<=', value });
        return this;
    }
    /**
     * Add a contains/like condition (fuzzy match)
     */
    contains(field, value) {
        this.conditions.push({ field, operator: '~', value });
        return this;
    }
    /**
     * Add a not-contains condition
     */
    notContains(field, value) {
        this.conditions.push({ field, operator: '!~', value });
        return this;
    }
    /**
     * Add an "in" condition for multiple values
     */
    in(field, values) {
        this.conditions.push({ field, operator: 'in', value: values });
        return this;
    }
    /**
     * Add a "not in" condition
     */
    notIn(field, values) {
        this.conditions.push({ field, operator: 'not in', value: values });
        return this;
    }
    /**
     * Add an "is" condition (typically for null checks)
     */
    is(field, value) {
        this.conditions.push({ field, operator: 'is', value });
        return this;
    }
    /**
     * Add an "is not" condition
     */
    isNot(field, value) {
        this.conditions.push({ field, operator: 'is not', value });
        return this;
    }
    /**
     * Add raw JQL condition
     */
    raw(jql) {
        this.conditions.push(jql);
        return this;
    }
    /**
     * Add AND grouping
     */
    and(builder) {
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
    or(builder) {
        const subBuilder = builder instanceof JqlBuilder ? builder : builder(new JqlBuilder());
        const subJql = subBuilder.buildConditions();
        if (subJql && this.conditions.length > 0) {
            const lastCondition = this.conditions.pop();
            this.conditions.push(`(${this.formatCondition(lastCondition)} OR ${subJql})`);
        }
        return this;
    }
    /**
     * Add ORDER BY clause
     */
    orderBy(field, direction = 'ASC') {
        this.orderByFields.push({ field, direction });
        return this;
    }
    formatValue(value) {
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
    formatCondition(condition) {
        if (typeof condition === 'string') {
            return condition;
        }
        return `${condition.field} ${condition.operator} ${this.formatValue(condition.value)}`;
    }
    buildConditions() {
        return this.conditions.map((c) => this.formatCondition(c)).join(' AND ');
    }
    /**
     * Build the final JQL string
     */
    build() {
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
    static create() {
        return new JqlBuilder();
    }
}
exports.JqlBuilder = JqlBuilder;
// ============================================================================
// Atlassian Document Format (ADF) Builder
// ============================================================================
/**
 * Builder for creating Atlassian Document Format documents
 */
class AdfBuilder {
    content = [];
    /**
     * Add a paragraph
     */
    paragraph(text) {
        this.content.push({
            type: 'paragraph',
            content: [{ type: 'text', text }],
        });
        return this;
    }
    /**
     * Add a paragraph with inline formatting
     */
    paragraphWithMarks(segments) {
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
    heading(text, level = 1) {
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
    bulletList(items) {
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
    orderedList(items) {
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
    codeBlock(code, language) {
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
    blockquote(text) {
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
    rule() {
        this.content.push({ type: 'rule' });
        return this;
    }
    /**
     * Add a panel (info, note, warning, error, success)
     */
    panel(text, panelType = 'info') {
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
    table(headers, rows) {
        const tableRows = [];
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
    mention(accountId, displayText) {
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
    emoji(shortName) {
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
    link(text, url) {
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
    build() {
        return {
            type: 'doc',
            version: 1,
            content: this.content,
        };
    }
    /**
     * Create a new ADF builder
     */
    static create() {
        return new AdfBuilder();
    }
    /**
     * Create a simple text document
     */
    static text(text) {
        return new AdfBuilder().paragraph(text).build();
    }
}
exports.AdfBuilder = AdfBuilder;
// ============================================================================
// Date Helpers
// ============================================================================
/**
 * Format a date for Jira (YYYY-MM-DD)
 */
function formatJiraDate(date) {
    return date.toISOString().split('T')[0];
}
/**
 * Format a datetime for Jira (ISO 8601)
 */
function formatJiraDateTime(date) {
    return date.toISOString();
}
/**
 * Parse a Jira date string to Date object
 */
function parseJiraDate(dateString) {
    return new Date(dateString);
}
// ============================================================================
// Time Tracking Helpers
// ============================================================================
/**
 * Parse Jira duration format (e.g., "1w 2d 3h 4m") to seconds
 */
function parseDuration(duration) {
    const regex = /(\d+)([wdhm])/g;
    let totalSeconds = 0;
    let match;
    const multipliers = {
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
function formatDuration(seconds) {
    const weeks = Math.floor(seconds / (5 * 8 * 60 * 60));
    seconds %= 5 * 8 * 60 * 60;
    const days = Math.floor(seconds / (8 * 60 * 60));
    seconds %= 8 * 60 * 60;
    const hours = Math.floor(seconds / (60 * 60));
    seconds %= 60 * 60;
    const minutes = Math.floor(seconds / 60);
    const parts = [];
    if (weeks > 0)
        parts.push(`${weeks}w`);
    if (days > 0)
        parts.push(`${days}d`);
    if (hours > 0)
        parts.push(`${hours}h`);
    if (minutes > 0)
        parts.push(`${minutes}m`);
    return parts.join(' ') || '0m';
}
//# sourceMappingURL=helpers.js.map