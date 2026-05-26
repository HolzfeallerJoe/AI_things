import type { PageBodyWrite } from './types.js';

type ListType = 'ul' | 'ol';

interface ListItem {
  text: string;
  children: ListBlock[];
}

interface ListBlock {
  type: ListType;
  items: ListItem[];
}

interface TableRow {
  cells: string[];
  isHeader: boolean;
}

/**
 * Escapes text for Confluence storage-format XHTML.
 */
export function escapeStorageHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Wraps storage-format XHTML in the API body object.
 */
export function storageBody(value: string): PageBodyWrite {
  return {
    representation: 'storage',
    value,
  };
}

/**
 * Converts inline Markdown within a single line/span to storage-format XHTML.
 *
 * Escapes HTML first, then applies a small inline subset: links, inline code,
 * bold (`**`/`__`), italic (`*`/`_`), and strikethrough (`~~`). Content inside
 * inline code is left untouched by the emphasis rules.
 */
export function inlineMarkdownToStorage(text: string): string {
  // Pull out inline code spans first so their contents aren't mangled by the
  // emphasis/link rules, then splice them back in at the end. A private-use
  // Unicode sentinel survives HTML escaping, is never matched by the
  // emphasis/link regexes, and won't realistically appear in user text, so it
  // introduces no stray spaces or collisions.
  const sentinel = String.fromCharCode(0xe000);
  const codeSpans: string[] = [];
  let working = text.replace(/`([^`]+)`/g, (_match, code: string) => {
    codeSpans.push(code);
    return `${sentinel}${codeSpans.length - 1}${sentinel}`;
  });

  working = escapeStorageHtml(working);

  // Links: [label](url)
  working = working.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_match, label: string, url: string) =>
      `<a href="${escapeStorageHtml(url)}">${label}</a>`
  );

  // Bold before italic so ** / __ win over single-char emphasis.
  working = working.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  working = working.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Strikethrough.
  working = working.replace(/~~([^~]+)~~/g, '<s>$1</s>');

  // Italic. The _ variant is guarded by word boundaries so it doesn't match
  // snake_case identifiers.
  working = working.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  working = working.replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');

  // Restore inline code spans (escaping their contents).
  working = working.replace(
    new RegExp(`${sentinel}(\\d+)${sentinel}`, 'g'),
    (_match, index: string) => `<code>${escapeStorageHtml(codeSpans[Number(index)])}</code>`
  );

  return working;
}

/**
 * Converts plain text paragraphs to Confluence storage-format XHTML.
 */
export function textToStorage(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeStorageHtml(paragraph.trim()).replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}

/**
 * Converts basic Markdown to storage-format XHTML.
 *
 * Supported block syntax:
 * - Headings (`#` through `######`)
 * - Paragraphs and horizontal rules
 * - Bullet and ordered lists, including indentation-based nesting
 * - Task lists (`- [ ]` and `- [x]`) using Confluence `<ac:task-list>`
 * - Blockquotes (`>`) using `<blockquote>`
 * - Pipe tables using standard storage-format tables
 * - Fenced code blocks, including the language as a code macro parameter
 * - Standalone external images (`![alt](url)`) using `<ac:image><ri:url />`
 *
 * Inline support: bold, italic, inline code, links, and strikethrough. Use
 * explicit storage XHTML for complex Confluence layouts.
 */
export function markdownToStorage(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let listBlocks: ListBlock[] = [];
  let listStack: Array<{ level: number; block: ListBlock }> = [];
  let taskItems: Array<{ checked: boolean; text: string }> = [];
  let quoteLines: string[] = [];
  let tableRows: TableRow[] = [];
  let codeLines: string[] = [];
  let codeLanguage: string | undefined;
  let inCodeBlock = false;

  const flushParagraph = (): void => {
    if (!paragraph.length) return;
    blocks.push(`<p>${inlineMarkdownToStorage(paragraph.join(' ').trim())}</p>`);
    paragraph = [];
  };

  const flushLists = (): void => {
    if (!listBlocks.length) return;
    blocks.push(listBlocks.map(renderListBlock).join(''));
    listBlocks = [];
    listStack = [];
  };

  const flushTasks = (): void => {
    if (!taskItems.length) return;
    blocks.push(
      `<ac:task-list>${taskItems
        .map(
          (item) =>
            `<ac:task><ac:task-status>${item.checked ? 'complete' : 'incomplete'}</ac:task-status><ac:task-body>${inlineMarkdownToStorage(item.text)}</ac:task-body></ac:task>`
        )
        .join('')}</ac:task-list>`
    );
    taskItems = [];
  };

  const flushQuote = (): void => {
    if (!quoteLines.length) return;
    blocks.push(`<blockquote><p>${inlineMarkdownToStorage(quoteLines.join(' ').trim())}</p></blockquote>`);
    quoteLines = [];
  };

  const flushTable = (): void => {
    if (!tableRows.length) return;
    blocks.push(
      `<table><tbody>${tableRows
        .map(
          (row) =>
            `<tr>${row.cells
              .map((cell) => {
                const tag = row.isHeader ? 'th' : 'td';
                return `<${tag}>${inlineMarkdownToStorage(cell.trim())}</${tag}>`;
              })
              .join('')}</tr>`
        )
        .join('')}</tbody></table>`
    );
    tableRows = [];
  };

  const flushOpenBlocks = (): void => {
    flushParagraph();
    flushLists();
    flushTasks();
    flushQuote();
    flushTable();
  };

  const resetIncompatibleBlocks = (keep?: 'list' | 'tasks' | 'quote' | 'table'): void => {
    flushParagraph();
    if (keep !== 'list') flushLists();
    if (keep !== 'tasks') flushTasks();
    if (keep !== 'quote') flushQuote();
    if (keep !== 'table') flushTable();
  };

  const appendListItem = (indent: number, type: ListType, text: string): void => {
    const level = Math.floor(indent / 2);
    listStack = listStack.filter((entry) => entry.level < level);

    let siblings = listBlocks;
    if (level > 0) {
      const parent = listStack[level - 1]?.block.items.at(-1);
      if (!parent) {
        appendListItem(0, type, text);
        return;
      }
      siblings = parent.children;
    }

    let block = siblings.at(-1);
    if (!block || block.type !== type) {
      block = { type, items: [] };
      siblings.push(block);
    }

    block.items.push({ text, children: [] });
    listStack[level] = { level, block };
  };

  const flushCodeBlock = (): void => {
    const parameters = codeLanguage
      ? `<ac:parameter ac:name="language">${escapeStorageHtml(codeLanguage)}</ac:parameter>`
      : '';
    blocks.push(
      `<ac:structured-macro ac:name="code">${parameters}<ac:plain-text-body><![CDATA[${escapeCdata(codeLines.join('\n'))}]]></ac:plain-text-body></ac:structured-macro>`
    );
    codeLines = [];
    codeLanguage = undefined;
  };

  for (const line of lines) {
    const codeFence = /^```\s*([A-Za-z0-9_-]+)?\s*$/.exec(line.trim());
    if (codeFence) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        flushOpenBlocks();
        codeLanguage = codeFence[1];
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushOpenBlocks();
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushOpenBlocks();
      blocks.push(`<h${heading[1].length}>${inlineMarkdownToStorage(heading[2])}</h${heading[1].length}>`);
      continue;
    }

    if (trimmed === '---') {
      flushOpenBlocks();
      blocks.push('<hr />');
      continue;
    }

    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(trimmed);
    if (image) {
      flushOpenBlocks();
      blocks.push(renderImage(image[2], image[1]));
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      resetIncompatibleBlocks('quote');
      quoteLines.push(quote[1]);
      continue;
    }

    const task = /^[-*]\s+\[([ xX])\]\s+(.+)$/.exec(trimmed);
    if (task) {
      resetIncompatibleBlocks('tasks');
      taskItems.push({ checked: task[1].toLowerCase() === 'x', text: task[2] });
      continue;
    }

    if (isTableSeparator(trimmed)) {
      continue;
    }

    const tableCells = parseTableRow(trimmed);
    if (tableCells) {
      resetIncompatibleBlocks('table');
      tableRows.push({ cells: tableCells, isHeader: tableRows.length === 0 });
      continue;
    }

    const bullet = /^(\s*)[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      resetIncompatibleBlocks('list');
      appendListItem(countIndent(bullet[1]), 'ul', bullet[2]);
      continue;
    }

    const ordered = /^(\s*)\d+\.\s+(.+)$/.exec(line);
    if (ordered) {
      resetIncompatibleBlocks('list');
      appendListItem(countIndent(ordered[1]), 'ol', ordered[2]);
      continue;
    }

    flushLists();
    flushTasks();
    flushQuote();
    flushTable();
    paragraph.push(trimmed);
  }

  if (inCodeBlock) {
    flushCodeBlock();
  }
  flushOpenBlocks();

  return blocks.join('\n');
}

function renderListBlock(block: ListBlock): string {
  const tag = block.type;
  return `<${tag}>${block.items
    .map((item) => `<li>${inlineMarkdownToStorage(item.text)}${item.children.map(renderListBlock).join('')}</li>`)
    .join('')}</${tag}>`;
}

function parseTableRow(line: string): string[] | undefined {
  if (!line.includes('|')) {
    return undefined;
  }

  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return undefined;
  }

  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line);
}

function renderImage(url: string, altText: string): string {
  const alt = altText ? ` ac:alt="${escapeStorageHtml(altText)}"` : '';
  return `<p><ac:image${alt}><ri:url ri:value="${escapeStorageHtml(url)}" /></ac:image></p>`;
}

function countIndent(indent: string): number {
  return indent.replace(/\t/g, '  ').length;
}

function escapeCdata(value: string): string {
  return value.replace(/\]\]>/g, ']]]]><![CDATA[>');
}
