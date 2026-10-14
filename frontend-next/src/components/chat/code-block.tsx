'use client';

import * as React from 'react';
import Prism from 'prismjs';
import { Copy, Check } from 'lucide-react';

// Import common Prism language definitions
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
};

export function CodeBlock({ code, language = '', className = '' }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const rawLang = (language || '').toLowerCase().trim();
  const normalizedLang = LANGUAGE_ALIASES[rawLang] || rawLang;
  const displayLang = normalizedLang || 'code';

  const highlightedHtml = React.useMemo(() => {
    try {
      const grammar = Prism.languages[normalizedLang] || Prism.languages.plain;
      if (grammar) {
        return Prism.highlight(code, grammar, normalizedLang);
      }
    } catch {
      // Fallback if highlight throws
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
      className={`relative my-3 overflow-hidden rounded-xl border border-border/80 bg-zinc-950 text-zinc-100 shadow-sm ${className}`}
    >
      {/* Code Header Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-4 py-1.5 text-xs">
        <span className="font-mono text-xs font-medium text-zinc-400 lowercase select-none">
          {displayLang}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer select-none"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-zinc-400" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <pre className="overflow-x-auto p-4 font-mono text-xs sm:text-sm leading-relaxed text-zinc-100 scrollbar-thin">
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
