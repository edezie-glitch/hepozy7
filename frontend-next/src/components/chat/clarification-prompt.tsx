'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ClarificationPromptProps {
  suggestedReplies: string[];
  onSubmit: (response: string) => void;
  onDismiss?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ClarificationPrompt({
  suggestedReplies,
  onSubmit,
  onDismiss,
  disabled = false,
  className,
}: ClarificationPromptProps) {
  const [freeformText, setFreeformText] = React.useState('');

  const handlePillClick = (reply: string) => {
    if (disabled) return;
    onSubmit(reply);
  };

  const handleFreeformSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = freeformText.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setFreeformText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFreeformSubmit();
    } else if (e.key === 'Escape' && onDismiss) {
      e.preventDefault();
      onDismiss();
    }
  };

  return (
    <div
      data-testid="clarification-prompt"
      className={cn(
        'relative flex flex-col gap-2.5 rounded-2xl border border-primary/25 bg-primary/5 p-3 sm:p-3.5 shadow-xs transition-all animate-in fade-in slide-in-from-bottom-2',
        className
      )}
    >
      {/* Header with Title and optional dismiss button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Clarification Prompt</span>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            disabled={disabled}
            aria-label="Dismiss clarification prompt"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Suggested Reply Pills */}
      {suggestedReplies.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Suggested reply pills">
          {suggestedReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              disabled={disabled}
              onClick={() => handlePillClick(reply)}
              className="inline-flex items-center rounded-full border border-primary/30 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-2xs hover:border-primary hover:bg-primary/10 hover:text-primary transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 ring-offset-background"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Freeform Clarification Input Row */}
      <form onSubmit={handleFreeformSubmit} className="flex items-center gap-2">
        <input
          type="text"
          data-testid="clarification-freeform-input"
          value={freeformText}
          onChange={(e) => setFreeformText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Or type your own answer…"
          className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-hidden focus:border-ring/50 focus:ring-2 focus:ring-ring/20 transition-all disabled:opacity-50"
        />
        <Button
          type="submit"
          size="icon"
          data-testid="clarification-freeform-submit"
          disabled={disabled || !freeformText.trim()}
          aria-label="Submit clarification"
          className="h-8 w-8 rounded-lg shrink-0 cursor-pointer disabled:opacity-40"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
