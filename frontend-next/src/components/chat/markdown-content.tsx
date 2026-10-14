'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './code-block';

export interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <div
      data-testid="markdown-content"
      className={`markdown-body space-y-2 text-sm sm:text-base leading-relaxed break-words ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1
              className="mt-4 mb-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground first:mt-0"
              {...props}
            />
          ),
          h2: ({ node, ...props }) => (
            <h2
              className="mt-3.5 mb-2 text-lg sm:text-xl font-semibold tracking-tight text-foreground first:mt-0"
              {...props}
            />
          ),
          h3: ({ node, ...props }) => (
            <h3
              className="mt-3 mb-1.5 text-base sm:text-lg font-semibold text-foreground first:mt-0"
              {...props}
            />
          ),
          h4: ({ node, ...props }) => (
            <h4
              className="mt-2.5 mb-1 text-sm sm:text-base font-semibold text-foreground first:mt-0"
              {...props}
            />
          ),
          p: ({ node, ...props }) => (
            <p className="my-1.5 leading-relaxed last:mb-0" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="my-2 ml-5 list-disc space-y-1" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="my-2 ml-5 list-decimal space-y-1" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="my-3 border-l-4 border-primary/70 bg-primary/5 pl-3.5 py-1.5 text-muted-foreground italic rounded-r-md"
              {...props}
            />
          ),
          table: ({ node, ...props }) => (
            <div className="table-container my-3 w-full overflow-x-auto rounded-lg border border-border/80 shadow-xs">
              <table className="w-full border-collapse text-left text-xs sm:text-sm" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead
              className="border-b border-border bg-muted/60 text-muted-foreground font-semibold"
              {...props}
            />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-border/60" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="transition-colors hover:bg-muted/30" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-3.5 py-2 font-semibold text-foreground" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3.5 py-2 align-top text-foreground" {...props} />
          ),
          a: ({ node, href, children, ...props }) => (
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
          pre: ({ children }) => {
            const codeProps = React.isValidElement(children) ? (children.props as any) : null;
            if (codeProps) {
              const rawContent = String(codeProps.children || '').replace(/\n$/, '');
              const match = /language-(\w+)/.exec(codeProps.className || '');
              return (
                <CodeBlock
                  code={rawContent}
                  language={match ? match[1] : undefined}
                />
              );
            }
            return <pre className="overflow-x-auto p-4">{children}</pre>;
          },
          code: ({ node, className, children, ...props }: any) => {
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
