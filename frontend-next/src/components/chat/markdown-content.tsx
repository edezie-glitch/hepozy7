'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { CodeBlock } from './code-block';

export interface MarkdownContentProps {
  content: string;
  className?: string;
}

const PreBlockContext = React.createContext<boolean>(false);

export function extractMarkdownFromTable(tableEl: HTMLTableElement): string {
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  if (rows.length === 0) return '';

  const tableData = rows.map((row) =>
    Array.from(row.querySelectorAll('th, td')).map((cell) =>
      (cell.textContent || '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
    )
  );

  const colCount = Math.max(...tableData.map((r) => r.length), 0);
  if (colCount === 0) return '';

  const normalizedRows = tableData.map((r) => {
    const padded = [...r];
    while (padded.length < colCount) {
      padded.push('');
    }
    return padded;
  });

  const colWidths = Array(colCount).fill(3);
  for (const row of normalizedRows) {
    row.forEach((cell, i) => {
      if (cell.length > colWidths[i]) {
        colWidths[i] = cell.length;
      }
    });
  }

  const formatRow = (row: string[]) =>
    `| ${row.map((c, i) => c.padEnd(colWidths[i])).join(' | ')} |`;

  const headerLine = formatRow(normalizedRows[0]);
  const separatorLine = `| ${colWidths.map((w) => '-'.repeat(w)).join(' | ')} |`;
  const bodyLines = normalizedRows.slice(1).map(formatRow);

  return [headerLine, separatorLine, ...bodyLines].join('\n');
}

export function MarkdownTable({ className = '', children, ...props }: React.ComponentPropsWithoutRef<'table'>) {
  const [copied, setCopied] = React.useState(false);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!tableRef.current) return;
    try {
      const text = extractMarkdownFromTable(tableRef.current);
      await navigator.clipboard.writeText(text);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setCopied(true);
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, 2000);
    } catch (e) {
      console.error('Failed to copy table to clipboard', e);
    }
  };

  return (
    <div data-testid="table-block" className="my-3 min-w-0 max-w-full">
      <div className="flex items-center justify-end mb-1">
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy table"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer select-none"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-500 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Copy Table</span>
            </>
          )}
        </button>
      </div>
      <div className="table-container w-full min-w-0 overflow-x-auto rounded-lg border border-border/80 shadow-xs">
        <table
          ref={tableRef}
          className={`w-full border-collapse text-left text-xs sm:text-sm ${className}`}
          {...props}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <div
      data-testid="markdown-content"
      className={`markdown-body space-y-2 text-sm sm:text-base leading-relaxed break-words min-w-0 ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node: _node, ...props }) => (
            <h1
              className="mt-4 mb-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground first:mt-0"
              {...props}
            />
          ),
          h2: ({ node: _node, ...props }) => (
            <h2
              className="mt-3.5 mb-2 text-lg sm:text-xl font-semibold tracking-tight text-foreground first:mt-0"
              {...props}
            />
          ),
          h3: ({ node: _node, ...props }) => (
            <h3
              className="mt-3 mb-1.5 text-base sm:text-lg font-semibold text-foreground first:mt-0"
              {...props}
            />
          ),
          h4: ({ node: _node, ...props }) => (
            <h4
              className="mt-2.5 mb-1 text-sm sm:text-base font-semibold text-foreground first:mt-0"
              {...props}
            />
          ),
          p: ({ node: _node, ...props }) => (
            <p className="my-1.5 leading-relaxed last:mb-0" {...props} />
          ),
          ul: ({ node: _node, ...props }) => (
            <ul className="my-2 ml-5 list-disc space-y-1" {...props} />
          ),
          ol: ({ node: _node, ...props }) => (
            <ol className="my-2 ml-5 list-decimal space-y-1" {...props} />
          ),
          li: ({ node: _node, ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),
          blockquote: ({ node: _node, ...props }) => (
            <blockquote
              className="my-3 border-l-4 border-primary/70 bg-primary/5 pl-3.5 py-1.5 text-muted-foreground italic rounded-r-md"
              {...props}
            />
          ),
          table: ({ node: _node, ...props }) => (
            <MarkdownTable {...props} />
          ),
          thead: ({ node: _node, ...props }) => (
            <thead
              className="border-b border-border bg-muted/60 text-muted-foreground font-semibold"
              {...props}
            />
          ),
          tbody: ({ node: _node, ...props }) => (
            <tbody className="divide-y divide-border/60" {...props} />
          ),
          tr: ({ node: _node, ...props }) => (
            <tr className="even:bg-muted/20 hover:bg-muted/35 transition-colors" {...props} />
          ),
          th: ({ node: _node, ...props }) => (
            <th className="px-3.5 py-2 font-semibold text-foreground" {...props} />
          ),
          td: ({ node: _node, ...props }) => (
            <td className="px-3.5 py-2 align-top text-foreground" {...props} />
          ),
          a: ({ node: _node, href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
              {...props}
            >
              {children}
            </a>
          ),
          pre: ({ children }) => (
            <PreBlockContext.Provider value={true}>
              {children}
            </PreBlockContext.Provider>
          ),
          code: function MarkdownCode({
            className,
            children,
            ...props
          }: React.ComponentPropsWithoutRef<'code'>) {
            const isInsidePre = React.useContext(PreBlockContext);
            if (isInsidePre) {
              const rawContent = String(children || '').replace(/\n$/, '');
              const match = /language-(\w+)/.exec(className || '');
              return (
                <CodeBlock
                  code={rawContent}
                  language={match ? match[1] : undefined}
                />
              );
            }
            return (
              <code
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-foreground border border-border/50"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
