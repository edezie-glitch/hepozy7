'use client';

import * as React from 'react';
import Prism from 'prismjs';
import { Copy, Check } from 'lucide-react';

// Import common Prism language definitions
import 'prismjs/components/prism-markup'; // HTML, XML, SVG
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';

export interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  html: 'markup',
  xml: 'markup',
  golang: 'go',
  rs: 'rust',
};

export function CodeBlock({ code, language = '', className = '' }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const rawLang = (language || '').toLowerCase().trim();
  const normalizedLang = LANGUAGE_ALIASES[rawLang] || rawLang;
  const displayLang = normalizedLang || 'code';

  const highlightedHtml = React.useMemo(() => {
    if (!normalizedLang) return null;
    try {
      const grammar = Prism.languages[normalizedLang];
      if (grammar) {
        return Prism.highlight(code, grammar, normalizedLang);
      }
    } catch {
      // Fallback if highlight fails
    }
    return null;
  }, [code, normalizedLang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error('Failed to copy code to clipboard', e);
    }
  };

  return (
    <div
      data-testid="code-block"
      className={`relative my-3 overflow-hidden rounded-xl border border-border/80 bg-muted/30 text-foreground shadow-xs min-w-0 max-w-full ${className}`}
    >
      {/* Code Header Bar with semantic tokens */}
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/60 px-4 py-1.5 text-xs">
        <span className="font-mono text-xs font-medium text-muted-foreground lowercase select-none">
          {displayLang}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code"
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
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <pre className="overflow-x-auto p-4 font-mono text-xs sm:text-sm leading-relaxed text-foreground scrollbar-thin min-w-0">
        {highlightedHtml ? (
          <code
            className={`language-${normalizedLang}`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <code>{code}</code>
        )}
      </pre>
    </div>
  );
}
