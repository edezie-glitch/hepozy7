'use client';

import * as React from 'react';
import { useChatStore } from '@/stores/use-chat-store';
import { Button } from '@/components/ui/button';
import { ArrowUp, Square, X, Quote } from 'lucide-react';

export interface ChatInputProps {
  onSubmit: (prompt: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInput({
  onSubmit,
  onStop,
  disabled = false,
  placeholder = 'Ask Hepozy Assistant anything...',
  className = '',
}: ChatInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const inputPrompt = useChatStore((state) => state.inputPrompt);
  const setInputPrompt = useChatStore((state) => state.setInputPrompt);
  const replyingTo = useChatStore((state) => state.replyingTo);
  const clearReplyingTo = useChatStore((state) => state.clearReplyingTo);
  const isGenerating = useChatStore((state) => state.isGenerating);

  // Auto-resize textarea as text grows
  const adjustHeight = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 192; // ~12rem
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, []);

  React.useEffect(() => {
    adjustHeight();
  }, [inputPrompt, adjustHeight]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputPrompt(e.target.value);
  };

  const handleSend = () => {
    const trimmed = inputPrompt.trim();
    if (!trimmed || isGenerating || disabled) return;
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`relative flex flex-col rounded-2xl border border-border bg-card p-2 shadow-xs transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 ${className}`}>
      {/* Orange Accented Reply Chip */}
      {replyingTo && (
        <div
          data-testid="reply-quote-chip"
          className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary transition-all animate-in fade-in"
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Quote className="h-3.5 w-3.5 shrink-0 opacity-80" />
            <span className="font-semibold shrink-0">Replying to:</span>
            <span className="truncate text-foreground/80 dark:text-foreground/90 font-normal">
              {replyingTo.text}
            </span>
          </div>
          <button
            type="button"
            onClick={clearReplyingTo}
            aria-label="Dismiss reply quote"
            className="rounded-md p-1 text-primary/70 hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 px-1">
        <textarea
          ref={textareaRef}
          value={inputPrompt}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || isGenerating}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm sm:text-base text-foreground placeholder:text-muted-foreground outline-hidden focus:outline-hidden disabled:opacity-50 min-h-[38px] max-h-48 overflow-y-auto"
        />

        {/* Dynamic Send / Stop Button */}
        {isGenerating ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onStop}
            aria-label="Stop generation"
            className="h-9 px-3 gap-1.5 font-medium cursor-pointer shadow-xs bg-red-600 hover:bg-red-700 text-white shrink-0"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            <span className="text-xs font-semibold">Stop</span>
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            disabled={!inputPrompt.trim() || disabled}
            aria-label="Send message"
            className="h-9 w-9 rounded-xl shrink-0 cursor-pointer transition-transform active:scale-95 disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
