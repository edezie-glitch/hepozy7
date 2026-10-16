'use client';

import * as React from 'react';
import { useChatStore } from '@/stores/use-chat-store';
import {
  getChatHistory,
  sendChatMessage,
  stopChat,
  editChatMessage,
  type ChatMessageItem,
} from '@/lib/api/chat';
import { MessageItem } from '@/components/chat/message-item';
import { ChatInput } from '@/components/chat/chat-input';
import { ClarificationPrompt } from '@/components/chat/clarification-prompt';
import { QuotaExceededModal } from '@/components/chat/quota-exceeded-modal';
import { serializeAttachment } from '@/lib/attachments';
import { isOptimisticConversationId } from '@/lib/api/conversations';
import { Sparkles } from 'lucide-react';

export interface ChatWorkspaceProps {
  conversationId: string | null;
  onEnsureConversation?: () => Promise<string>;
  onConversationCreated?: (persistedConversationId: string) => void;
  className?: string;
}

function getPersistableConversationId(id: string | null | undefined): string | null {
  return id && !isOptimisticConversationId(id) ? id : null;
}

export function ChatWorkspace({
  conversationId,
  onEnsureConversation,
  onConversationCreated,
  className = '',
}: ChatWorkspaceProps) {
  const [messages, setMessages] = React.useState<ChatMessageItem[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [latestAnimatedAssistantMessageId, setLatestAnimatedAssistantMessageId] =
    React.useState<string | null>(null);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const upgradedConversationIdRef = React.useRef<string | null>(null);

  const replyingTo = useChatStore((state) => state.replyingTo);
  const resetInput = useChatStore((state) => state.resetInput);
  const isGenerating = useChatStore((state) => state.isGenerating);
  const setIsGenerating = useChatStore((state) => state.setIsGenerating);
  const setActiveRequestId = useChatStore((state) => state.setActiveRequestId);
  const setAbortController = useChatStore((state) => state.setAbortController);
  const stopGeneration = useChatStore((state) => state.stopGeneration);

  const clarificationPrompt = useChatStore((state) => state.clarificationPrompt);
  const setClarificationPrompt = useChatStore((state) => state.setClarificationPrompt);
  const clearClarificationPrompt = useChatStore((state) => state.clearClarificationPrompt);
  const quotaExceeded = useChatStore((state) => state.quotaExceeded);
  const setQuotaExceeded = useChatStore((state) => state.setQuotaExceeded);
  const clearQuotaExceeded = useChatStore((state) => state.clearQuotaExceeded);

  // Scroll to bottom helper
  const scrollToBottom = React.useCallback(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, []);

  // Fetch chat history whenever conversationId changes
  React.useEffect(() => {
    let active = true;

    if (!conversationId || isOptimisticConversationId(conversationId)) {
      queueMicrotask(() => {
        if (active) {
          setMessages([]);
          setLoadingHistory(false);
          clearClarificationPrompt();
          clearQuotaExceeded();
        }
      });
      return () => {
        active = false;
      };
    }

    // Skip redundant history refetch when this conversation was upgraded in-place from an optimistic ID
    if (upgradedConversationIdRef.current === conversationId) {
      upgradedConversationIdRef.current = null;
      return () => {
        active = false;
      };
    }

    queueMicrotask(() => {
      if (active) {
        setLoadingHistory(true);
      }
    });

    getChatHistory(conversationId)
      .then((history) => {
        if (active) {
          setMessages(history);
          setLatestAnimatedAssistantMessageId(null);
          clearClarificationPrompt();
          clearQuotaExceeded();
        }
      })
      .catch((err) => {
        console.error('Failed to fetch chat history', err);
      })
      .finally(() => {
        if (active) {
          setLoadingHistory(false);
        }
      });

    return () => {
      active = false;
    };
  }, [conversationId, clearClarificationPrompt, clearQuotaExceeded]);

  // Scroll to bottom on new messages or during generation
  React.useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating, scrollToBottom]);

  // Central execute turn logic
  const executeTurn = async (
    promptText: string,
    quoteContext?: string | null,
    options?: { appendUserMessage?: boolean }
  ) => {
    let targetConvId = conversationId;
    if (!targetConvId && onEnsureConversation) {
      targetConvId = await onEnsureConversation();
    }
    const convIdForApi = getPersistableConversationId(targetConvId);

    const currentStaged = [...useChatStore.getState().stagedAttachments];
    const effectiveMessageContent =
      promptText.trim() ||
      (currentStaged.length > 0 ? 'Please read this and give me a summary.' : '');

    // Encode attachments to base64 { name, type, data }
    const encodedAttachments =
      currentStaged.length > 0
        ? await Promise.all(currentStaged.map((st) => serializeAttachment(st.file)))
        : [];

    const localAttachments = currentStaged.map((st, idx) => ({
      name: st.name,
      type: st.type,
      url: st.previewUrl,
      data: encodedAttachments[idx]?.data,
    }));

    const tempUserId = `user-${Date.now()}-${Math.random()}`;
    const userMsg: ChatMessageItem = {
      id: tempUserId,
      role: 'user',
      content: effectiveMessageContent,
      created_at: new Date().toISOString(),
      reply_to: quoteContext || null,
      attachments: localAttachments.length > 0 ? localAttachments : undefined,
    };

    if (options?.appendUserMessage !== false) {
      setMessages((prev) => [...prev, userMsg]);
    }
    resetInput();
    clearClarificationPrompt();

    const controller = new AbortController();
    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random()}`;

    setActiveRequestId(requestId);
    setAbortController(controller);
    setIsGenerating(true);

    try {
      const response = await sendChatMessage(
        {
          message: effectiveMessageContent,
          conversation_id: convIdForApi,
          request_id: requestId,
          reply_to: quoteContext || null,
          attachments: encodedAttachments.length > 0 ? encodedAttachments : undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        controller.signal
      );

      // Handle message quota exceeded safeguard
      if (response.quota_exceeded) {
        const asstId = response.assistant_message_id || `asst-quota-${Date.now()}`;
        const quotaMsg: ChatMessageItem = {
          id: asstId,
          role: 'assistant',
          content: response.reply || "You've used all your messages for now.",
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, quotaMsg]);
        setIsGenerating(false);
        setActiveRequestId(null);
        setAbortController(null);
        setQuotaExceeded({ resetAt: response.quota_reset_at || null });
        return;
      }

      // If backend returned a persisted user_message_id, update it
      if (response.user_message_id && options?.appendUserMessage !== false) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempUserId ? { ...m, id: response.user_message_id! } : m))
        );
      }

      // Add assistant response
      const asstId = response.assistant_message_id || `asst-${Date.now()}`;
      const assistantMsg: ChatMessageItem = {
        id: asstId,
        role: 'assistant',
        content: response.reply,
        created_at: new Date().toISOString(),
        download_url: response.download_url,
        file_name: response.file_name,
      };

      // Handle conversational clarification prompts
      if (
        response.needs_clarification &&
        response.suggested_replies &&
        response.suggested_replies.length > 0
      ) {
        setClarificationPrompt({
          suggestedReplies: response.suggested_replies,
          assistantMessageId: asstId,
        });
      } else {
        clearClarificationPrompt();
      }

      setLatestAnimatedAssistantMessageId(asstId);
      setMessages((prev) => [...prev, assistantMsg]);

      if (response.conversation_id && onConversationCreated) {
        upgradedConversationIdRef.current = response.conversation_id;
        onConversationCreated(response.conversation_id);
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'AbortError') {
        // Generation stopped by user
        setIsGenerating(false);
      } else {
        const errorMsg: ChatMessageItem = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${error.message || 'Failed to process inquiry.'}`,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        setIsGenerating(false);
      }
      setActiveRequestId(null);
      setAbortController(null);
    }
  };

  const handleSubmitMessage = async (messageText: string) => {
    await executeTurn(messageText, replyingTo?.text);
  };

  const handleClarificationSubmit = async (answerText: string) => {
    clearClarificationPrompt();
    await executeTurn(answerText);
  };

  const handleStop = () => {
    stopGeneration(async ({ requestId, shownText }) => {
      try {
        await stopChat({
          request_id: requestId,
          conversation_id: getPersistableConversationId(conversationId),
          shown_text: shownText,
        });
      } catch (e) {
        console.error('Failed to notify stop', e);
      }
    });
    setLatestAnimatedAssistantMessageId(null);
  };

  const handleRetry = async (assistantMessageId: string) => {
    if (isGenerating) return;

    // Locate the assistant message and its matching user prompt
    const asstIndex = messages.findIndex((m) => m.id === assistantMessageId);
    let promptToRetry: string | null = null;
    let replyQuote: string | null = null;

    if (asstIndex !== -1) {
      for (let i = asstIndex - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          promptToRetry = messages[i].content;
          replyQuote = messages[i].reply_to || null;
          break;
        }
      }
    }

    if (!promptToRetry) return;

    // Remove the assistant message being retried
    setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
    await executeTurn(promptToRetry, replyQuote, { appendUserMessage: false });
  };

  const handleEditSubmit = async (messageId: string, newContent: string) => {
    if (isGenerating) return;

    const userMsg = messages.find((m) => m.id === messageId);
    if (!userMsg) return;

    const persistableConvId = getPersistableConversationId(conversationId);
    if (persistableConvId) {
      try {
        await editChatMessage({
          conversation_id: persistableConvId,
          message_id: messageId,
          original_text: userMsg.content,
        });
      } catch (e) {
        console.error('Failed to edit message on server', e);
      }
    }

    // Remove this message and everything that followed it
    const msgIdx = messages.findIndex((m) => m.id === messageId);
    if (msgIdx !== -1) {
      setMessages((prev) => prev.slice(0, msgIdx));
    }

    await executeTurn(newContent, userMsg.reply_to);
  };

  return (
    <div className={`flex h-full w-full flex-col overflow-hidden ${className}`}>
      {/* Scrollable Message List Viewport with Pane-Docked Scrollbar */}
      <div
        data-testid="message-stream-scroll-viewport"
        className="flex-1 overflow-y-auto px-4 py-4 sm:px-6"
      >
        <div
          data-testid="message-stream-container"
          className="mx-auto flex min-h-full max-w-4xl lg:max-w-5xl w-full flex-col space-y-2"
        >
          {loadingHistory ? (
            <div className="flex flex-1 items-center justify-center space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 animate-spin text-primary" />
                <span>Loading messages...</span>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div
              data-testid="empty-conversation-card"
              className="flex flex-1 flex-col items-center justify-center text-center p-6 text-muted-foreground"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Conversation Ready</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Send a message below to consult Hepozy Assistant or ask for document analysis.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                animateTypewriter={msg.id === latestAnimatedAssistantMessageId}
                onTypewriterComplete={() => {
                  setLatestAnimatedAssistantMessageId(null);
                  setIsGenerating(false);
                  setActiveRequestId(null);
                  setAbortController(null);
                }}
                onRetry={handleRetry}
                onEditSubmit={handleEditSubmit}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Sticky Bottom Input Bar */}
      <div
        data-testid="chat-bottom-bar"
        className="border-t border-border/60 bg-background/95 backdrop-blur-xs px-4 py-3 sm:px-6 sm:py-4"
      >
        <div
          data-testid="chat-input-bounds"
          className="mx-auto max-w-4xl w-full space-y-2"
        >
          {clarificationPrompt && (
            <ClarificationPrompt
              suggestedReplies={clarificationPrompt.suggestedReplies}
              onSubmit={handleClarificationSubmit}
              onDismiss={clearClarificationPrompt}
              disabled={Boolean(quotaExceeded)}
            />
          )}
          <ChatInput
            onSubmit={handleSubmitMessage}
            onStop={handleStop}
            disabled={Boolean(quotaExceeded)}
          />
        </div>
      </div>

      {/* Quota Exceeded Safeguard Modal */}
      <QuotaExceededModal
        open={Boolean(quotaExceeded)}
        onOpenChange={(open) => {
          if (!open) {
            clearQuotaExceeded();
          }
        }}
        quotaResetAt={quotaExceeded?.resetAt}
      />
    </div>
  );
}
