'use client';

import * as React from 'react';
import { useChatStore } from '@/stores/use-chat-store';
import { Button } from '@/components/ui/button';
import { ACCEPTED_FILE_EXTENSIONS } from '@/lib/attachments';
import {
  ArrowUp,
  Square,
  X,
  Quote,
  Paperclip,
  FileText,
  AlertCircle,
} from 'lucide-react';

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
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);

  const inputPrompt = useChatStore((state) => state.inputPrompt);
  const setInputPrompt = useChatStore((state) => state.setInputPrompt);
  const replyingTo = useChatStore((state) => state.replyingTo);
  const clearReplyingTo = useChatStore((state) => state.clearReplyingTo);
  const isGenerating = useChatStore((state) => state.isGenerating);

  const stagedAttachments = useChatStore((state) => state.stagedAttachments);
  const stageFiles = useChatStore((state) => state.stageFiles);
  const removeStagedAttachment = useChatStore((state) => state.removeStagedAttachment);
  const attachmentError = useChatStore((state) => state.attachmentError);
  const setAttachmentError = useChatStore((state) => state.setAttachmentError);

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
    if ((!trimmed && stagedAttachments.length === 0) || isGenerating || disabled) return;
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      stageFiles(Array.from(e.target.files));
      // Reset input value so same file can be selected again if needed
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only turn off if leaving container
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      stageFiles(Array.from(e.dataTransfer.files));
    }
  };

  const hasContentToSend = inputPrompt.trim().length > 0 || stagedAttachments.length > 0;

  return (
    <div
      data-testid="chat-input-container"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex flex-col rounded-2xl border bg-card p-2 shadow-xs transition-all ${
        isDraggingOver
          ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
          : 'border-border focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20'
      } ${className}`}
    >
      {/* Hidden file input for file selector */}
      <input
        ref={fileInputRef}
        type="file"
        data-testid="attachment-file-input"
        multiple
        accept={ACCEPTED_FILE_EXTENSIONS}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Attachment Validation Error Alert */}
      {attachmentError && (
        <div
          data-testid="attachment-error-alert"
          className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive transition-all animate-in fade-in"
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-medium">{attachmentError}</span>
          </div>
          <button
            type="button"
            onClick={() => setAttachmentError(null)}
            aria-label="Dismiss attachment error"
            className="rounded-md p-1 text-destructive/80 hover:bg-destructive/20 hover:text-destructive transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Staged Attachments Preview Strip */}
      {stagedAttachments.length > 0 && (
        <div
          data-testid="staged-preview-strip"
          className="mb-2 flex flex-wrap items-center gap-2 overflow-x-auto p-1"
        >
          {stagedAttachments.map((attachment) => (
            <div key={attachment.id}>
              {attachment.isImage ? (
                <div className="relative group/preview flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 overflow-hidden shadow-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachment.previewUrl || ''}
                    alt={attachment.name}
                    className="h-full w-full object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removeStagedAttachment(attachment.id)}
                    aria-label={`Remove ${attachment.name}`}
                    className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black transition-colors cursor-pointer text-xs font-bold leading-none"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-2.5 py-1.5 text-xs shadow-xs">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="max-w-[140px] truncate font-medium text-foreground">
                    {attachment.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeStagedAttachment(attachment.id)}
                    aria-label={`Remove ${attachment.name}`}
                    className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground transition-colors cursor-pointer text-xs font-bold leading-none"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
        {/* Attachment Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isGenerating}
          aria-label="Attach files"
          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

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
            disabled={!hasContentToSend || disabled}
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
