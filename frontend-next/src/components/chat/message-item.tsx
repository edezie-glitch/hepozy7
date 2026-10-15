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
} from 'lucide-react';
import { isImageFile } from '@/lib/attachments';
import { MarkdownContent } from './markdown-content';
import {
  GeneratedDocumentCard,
  parseDocumentFormat,
} from './generated-document-card';

const ACTION_BUTTON_CLASS =
  'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring transition-colors cursor-pointer';

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
    let active = true;
    if (!animateTypewriter || isUser) {
      queueMicrotask(() => {
        if (active) {
          setDisplayedText(message.content);
          setIsAnimating(false);
        }
      });
      return () => {
        active = false;
      };
    }

    const fullText = message.content;
    const chunkSize = Math.max(2, Math.ceil(fullText.length / 60));
    let currentIdx = 0;

    queueMicrotask(() => {
      if (active) {
        setIsAnimating(true);
        setDisplayedText('');
      }
    });

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
      <div
        className={`flex gap-3 sm:gap-3.5 ${
          isUser
            ? 'max-w-[85%] sm:max-w-[78%] flex-row-reverse'
            : 'w-full max-w-full sm:max-w-[92%] flex-row'
        }`}
      >
        {/* Assistant Avatar */}
        {!isUser && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-xs mt-0.5">
            <Sparkles className="h-4 w-4" />
          </div>
        )}

        <div className={`flex flex-col gap-1 min-w-0 ${isUser ? '' : 'flex-1'}`}>
          {/* Main Bubble / Borderless Assistant Container */}
          <div
            data-testid="message-bubble"
            onClick={handleBubbleClick}
            className={`relative break-words transition-colors ${
              isUser
                ? 'rounded-2xl px-4 py-3 text-sm sm:text-base shadow-xs bg-secondary text-secondary-foreground border border-border/80 whitespace-pre-wrap'
                : 'px-0 py-0.5 text-sm sm:text-base text-foreground'
            } ${isAnimating ? 'cursor-pointer hover:opacity-95' : ''}`}
          >
            {/* Reply Quote Preview */}
            {message.reply_to && (
              <div className="mb-2 border-l-2 border-primary/80 bg-primary/5 pl-2.5 py-1 text-xs text-muted-foreground italic rounded-r-md">
                <span className="font-semibold not-italic text-primary/90 mr-1.5">Quoting:</span>
                <span className="line-clamp-2">{message.reply_to}</span>
              </div>
            )}

            {/* Message Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {message.attachments.map((att, idx) => {
                  const isImg = isImageFile({ type: att.type, name: att.name });
                  const imgSrc =
                    att.url ||
                    (att.data
                      ? att.data.startsWith('data:')
                        ? att.data
                        : `data:${att.type || 'image/png'};base64,${att.data}`
                      : '');

                  if (isImg) {
                    return (
                      <div
                        key={`${att.name}-${idx}`}
                        data-testid="image-attachment"
                        className="relative overflow-hidden rounded-xl border border-border/60 shadow-xs max-w-[240px]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgSrc}
                          alt={att.name}
                          className="h-auto max-h-56 w-auto object-cover rounded-xl"
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`${att.name}-${idx}`}
                      data-testid="document-attachment"
                      className="flex items-center gap-2 rounded-xl border border-border/80 bg-background/60 px-3 py-1.5 text-xs shadow-xs"
                    >
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      {att.url ? (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate font-medium hover:underline text-foreground max-w-[180px]"
                        >
                          {att.name}
                        </a>
                      ) : (
                        <span className="truncate font-medium text-foreground max-w-[180px]">
                          {att.name}
                        </span>
                      )}
                    </div>
                  );
                })}
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
            ) : isUser ? (
              <div>
                <span>{displayedText}</span>
              </div>
            ) : (
              <div className="relative">
                <MarkdownContent content={displayedText} />
                {isAnimating && (
                  <span className="inline-block h-3.5 w-1.5 ml-1 bg-primary animate-pulse align-middle" />
                )}
              </div>
            )}

            {/* Generated Document Card if available */}
            {message.download_url &&
              message.file_name &&
              parseDocumentFormat(message.file_name) && (
                <GeneratedDocumentCard
                  downloadUrl={message.download_url}
                  fileName={message.file_name}
                />
              )}
          </div>

          {/* Time & Action Toolbar */}
          <div
            className={`flex items-center gap-2 text-xs text-muted-foreground ${
              isUser ? 'justify-end px-1' : 'justify-start px-0 pt-1'
            }`}
          >
            {formattedTime && <span className="opacity-70 text-[11px]">{formattedTime}</span>}

            {/* Message Action Tools */}
            {!isEditing && (
              <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity">
                {/* Copy Button */}
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy message"
                  className={ACTION_BUTTON_CLASS}
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
                  className={ACTION_BUTTON_CLASS}
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
                    className={ACTION_BUTTON_CLASS}
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
                    className={ACTION_BUTTON_CLASS}
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
