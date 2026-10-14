'use client';

import * as React from 'react';
import { useChatStore } from '@/stores/use-chat-store';
import { Button } from '@/components/ui/button';
import type { ChatMessageItem } from '@/lib/api/chat';
import {
  Sparkles,
  Copy,
  Check,
  Quote,
  Pencil,
  RotateCcw,
  FileText,
  Download,
} from 'lucide-react';

export interface MessageItemProps {
  message: ChatMessageItem;
  animateTypewriter?: boolean;
  onTypewriterComplete?: () => void;
  onEditSubmit?: (messageId: string, newContent: string) => Promise<void> | void;
  onRetry?: (messageId: string) => void;
  onReply?: (content: string, messageId: string) => void;
}

export function MessageItem({
  message,
  animateTypewriter = false,
  onTypewriterComplete,
  onEditSubmit,
  onRetry,
  onReply,
}: MessageItemProps) {
  const isUser = message.role === 'user';

  const editingMessageId = useChatStore((state) => state.editingMessageId);
  const setEditingMessageId = useChatStore((state) => state.setEditingMessageId);
  const setReplyingTo = useChatStore((state) => state.setReplyingTo);

  const isEditing = editingMessageId === message.id;

  const [copied, setCopied] = React.useState(false);
  const [editText, setEditText] = React.useState(message.content);
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);

  // Typewriter state
  const [displayedText, setDisplayedText] = React.useState(
    animateTypewriter && !isUser ? '' : message.content
  );
  const [isAnimating, setIsAnimating] = React.useState(animateTypewriter && !isUser);

  // Interval reference for typewriter
  React.useEffect(() => {
    if (!animateTypewriter || isUser) {
      setDisplayedText(message.content);
      setIsAnimating(false);
      return;
    }

    const fullText = message.content;
    const chunkSize = Math.max(2, Math.ceil(fullText.length / 60));
    let currentIdx = 0;

    setIsAnimating(true);
    setDisplayedText('');

    const interval = setInterval(() => {
      currentIdx += chunkSize;
      if (currentIdx >= fullText.length) {
        clearInterval(interval);
        setDisplayedText(fullText);
        setIsAnimating(false);
        onTypewriterComplete?.();
      } else {
        setDisplayedText(fullText.slice(0, currentIdx));
      }
    }, 14);

    return () => clearInterval(interval);
  }, [message.content, animateTypewriter, isUser, onTypewriterComplete]);

  // Fast-forward / skip typewriter on click
  const handleBubbleClick = () => {
    if (isAnimating) {
      setDisplayedText(message.content);
      setIsAnimating(false);
      onTypewriterComplete?.();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error('Failed to copy text', e);
    }
  };

  const handleReply = () => {
    if (onReply) {
      onReply(message.content, message.id);
    } else {
      setReplyingTo({ text: message.content, messageId: message.id });
    }
  };

  const handleStartEdit = () => {
    setEditText(message.content);
    setEditingMessageId(message.id);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditText(message.content);
  };

  const handleSaveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed || isSubmittingEdit) return;

    setIsSubmittingEdit(true);
    try {
      if (onEditSubmit) {
        await onEditSubmit(message.id, trimmed);
      }
      setEditingMessageId(null);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
      e.preventDefault();
      handleSaveEdit();
    }
  };

  // Timestamp formatting
  const formattedTime = React.useMemo(() => {
    if (!message.created_at) return '';
    try {
      const d = new Date(message.created_at);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, [message.created_at]);

  return (
    <div
      className={`group relative flex w-full flex-col gap-1.5 py-2.5 transition-colors ${
        isUser ? 'items-end' : 'items-start'
      }`}
    >
      <div className={`flex max-w-[85%] sm:max-w-[78%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Assistant Avatar */}
        {!isUser && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
        )}

        <div className="flex flex-col gap-1 min-w-0">
          {/* Main Bubble */}
          <div
            data-testid="message-bubble"
            onClick={handleBubbleClick}
            className={`relative rounded-2xl px-4 py-3 text-sm sm:text-base shadow-xs break-words whitespace-pre-wrap transition-colors ${
              isUser
                ? 'bg-secondary text-secondary-foreground border border-border/80'
                : 'bg-card text-card-foreground border border-border/60'
            } ${isAnimating ? 'cursor-pointer hover:opacity-95' : ''}`}
          >
            {/* Reply Quote Preview */}
            {message.reply_to && (
              <div className="mb-2 border-l-2 border-primary/80 bg-primary/5 pl-2.5 py-1 text-xs text-muted-foreground italic rounded-r-md">
                <span className="font-semibold not-italic text-primary/90 mr-1.5">Quoting:</span>
                <span className="line-clamp-2">{message.reply_to}</span>
              </div>
            )}

            {/* Inline Editing UI */}
            {isEditing ? (
              <div className="flex flex-col gap-2 min-w-[260px] sm:min-w-[340px]">
                <textarea
                  data-testid="inline-edit-textarea"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border bg-background p-2.5 text-sm text-foreground outline-hidden focus:border-primary focus:ring-1 focus:ring-primary"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={isSubmittingEdit}
                    className="h-8 px-2.5 text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={!editText.trim() || isSubmittingEdit}
                    className="h-8 px-3 text-xs cursor-pointer"
                  >
                    Save & Submit
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <span>{displayedText}</span>
                {isAnimating && (
                  <span className="inline-block h-3.5 w-1.5 ml-1 bg-primary animate-pulse" />
                )}
              </div>
            )}

            {/* Generated Document Card if available */}
            {message.download_url && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs sm:text-sm text-foreground">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/20 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="truncate font-medium">
                    {message.file_name || 'Generated Document'}
                  </span>
                </div>
                <a
                  href={message.download_url}
                  download={message.file_name || true}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </a>
              </div>
            )}
          </div>

          {/* Time & Action Toolbar */}
          <div
            className={`flex items-center gap-2 px-1 text-xs text-muted-foreground ${
              isUser ? 'justify-end' : 'justify-start'
            }`}
          >
            {formattedTime && <span className="opacity-70 text-[11px]">{formattedTime}</span>}

            {/* Message Action Tools */}
            {!isEditing && (
              <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Copy Button */}
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy message"
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-green-500" />
                      <span className="text-green-500 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                {/* Reply Button */}
                <button
                  type="button"
                  onClick={handleReply}
                  aria-label="Reply to message"
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  <Quote className="h-3 w-3 text-primary" />
                  <span>Reply</span>
                </button>

                {/* Edit Button (User turn) */}
                {isUser && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    aria-label="Edit message"
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                )}

                {/* Retry Button (Assistant turn) */}
                {!isUser && onRetry && (
                  <button
                    type="button"
                    onClick={() => onRetry(message.id)}
                    aria-label="Retry turn"
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3 text-orange-500" />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
