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
import { MessageStreamSkeleton } from '@/components/chat/message-stream-skeleton';
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

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

export function ChatWorkspace({
  conversationId,
  onEnsureConversation,
  onConversationCreated,
  className = '',
}: ChatWorkspaceProps) {
  const conversationIdRef = React.useRef<string | null>(conversationId);

  const isGenerating = useChatStore((state) =>
    conversationId ? state.isConversationGenerating(conversationId) : state.isConversationGenerating(null)
  );

  const setConversationMessages = useChatStore((state) => state.setConversationMessages);
  const startConversationGeneration = useChatStore((state) => state.startConversationGeneration);
  const finishConversationGeneration = useChatStore((state) => state.finishConversationGeneration);
  const stopConversationGeneration = useChatStore((state) => state.stopConversationGeneration);
  const setAnimatedAssistantMessageId = useChatStore((state) => state.setAnimatedAssistantMessageId);
  const migrateConversationState = useChatStore((state) => state.migrateConversationState);

  const [messages, setMessages] = React.useState<ChatMessageItem[]>(() =>
    useChatStore.getState().isConversationGenerating(conversationId)
      ? useChatStore.getState().getConversationMessages(conversationId) || []
      : []
  );
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [latestAnimatedAssistantMessageId, setLatestAnimatedAssistantMessageId] =
    React.useState<string | null>(() =>
      useChatStore.getState().getAnimatedAssistantMessageId(conversationId)
    );

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const upgradedConversationIdRef = React.useRef<string | null>(null);

  const pendingInstantScrollRef = React.useRef(
    Boolean(getPersistableConversationId(conversationId))
  );
  const loadedConversationIdRef = React.useRef<string | null>(null);
  const [prevConversationId, setPrevConversationId] = React.useState(conversationId);

  if (conversationId !== prevConversationId) {
    setPrevConversationId(conversationId);
    if (useChatStore.getState().isConversationGenerating(conversationId)) {
      setMessages(useChatStore.getState().getConversationMessages(conversationId) || []);
    } else {
      setMessages([]);
    }
  }

  useIsomorphicLayoutEffect(() => {
    conversationIdRef.current = conversationId;
    if (upgradedConversationIdRef.current === conversationId) {
      // In-place upgrade of active conversation — preserve smooth scrolling
      loadedConversationIdRef.current = conversationId;
      pendingInstantScrollRef.current = false;
    } else {
      loadedConversationIdRef.current = null;
      pendingInstantScrollRef.current = Boolean(
        getPersistableConversationId(conversationId)
      );
    }
  }, [conversationId]);

  const replyingTo = useChatStore((state) => state.replyingTo);
  const resetInput = useChatStore((state) => state.resetInput);

  const clarificationPrompt = useChatStore((state) => state.clarificationPrompt);
  const setClarificationPrompt = useChatStore((state) => state.setClarificationPrompt);
  const clearClarificationPrompt = useChatStore((state) => state.clearClarificationPrompt);
  const quotaExceeded = useChatStore((state) => state.quotaExceeded);
  const setQuotaExceeded = useChatStore((state) => state.setQuotaExceeded);
  const clearQuotaExceeded = useChatStore((state) => state.clearQuotaExceeded);

  // Scroll to bottom helper supporting instant bottom anchor and smooth scrolling
  const scrollToBottom = React.useCallback(
    (options?: ScrollBehavior | { instant?: boolean; behavior?: ScrollBehavior }) => {
      let behavior: ScrollBehavior = 'smooth';
      if (typeof options === 'string') {
        behavior = options;
      } else if (options && typeof options === 'object') {
        if (options.behavior) {
          behavior = options.behavior;
        } else if (options.instant) {
          behavior = 'instant';
        }
      }

      if (behavior === 'instant' && viewportRef.current) {
        viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      }
      messagesEndRef.current?.scrollIntoView?.({
        behavior,
      });
    },
    []
  );

  // Fetch chat history whenever conversationId changes
  React.useEffect(() => {
    let active = true;

    if (!conversationId || isOptimisticConversationId(conversationId)) {
      loadedConversationIdRef.current = conversationId;
      pendingInstantScrollRef.current = false;
      queueMicrotask(() => {
        if (active) {
          const stored = useChatStore.getState().getConversationMessages(conversationId) || [];
          setMessages(stored);
          setLoadingHistory(false);
          clearClarificationPrompt();
          clearQuotaExceeded();
        }
      });
      return () => {
        active = false;
      };
    }

    // If conversation is actively generating in background, restore its in-flight messages immediately
    if (useChatStore.getState().isConversationGenerating(conversationId)) {
      loadedConversationIdRef.current = conversationId;
      pendingInstantScrollRef.current = false;
      queueMicrotask(() => {
        if (active) {
          const stored = useChatStore.getState().getConversationMessages(conversationId) || [];
          setMessages(stored);
          setLatestAnimatedAssistantMessageId(
            useChatStore.getState().getAnimatedAssistantMessageId(conversationId)
          );
          setLoadingHistory(false);
        }
      });
      return () => {
        active = false;
      };
    }

    // Skip redundant history refetch when this conversation was upgraded in-place from an optimistic ID
    if (upgradedConversationIdRef.current === conversationId) {
      upgradedConversationIdRef.current = null;
      loadedConversationIdRef.current = conversationId;
      pendingInstantScrollRef.current = false;
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
          // If the conversation began generating while history was fetching, do not overwrite in-flight messages
          if (useChatStore.getState().isConversationGenerating(conversationId)) {
            return;
          }
          loadedConversationIdRef.current = conversationId;
          setMessages(history);
          setConversationMessages(conversationId, history);
          setLatestAnimatedAssistantMessageId(null);
          clearClarificationPrompt();
          clearQuotaExceeded();
          setLoadingHistory(false);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch chat history', err);
        if (active) {
          loadedConversationIdRef.current = conversationId;
          pendingInstantScrollRef.current = false;
          setLoadingHistory(false);
        }
      });

    return () => {
      active = false;
    };
  }, [conversationId, clearClarificationPrompt, clearQuotaExceeded, setConversationMessages]);

  // Scroll to bottom on new messages or during generation, differentiating instant anchor vs smooth scroll
  useIsomorphicLayoutEffect(() => {
    const isPersistedConversation = Boolean(getPersistableConversationId(conversationId));
    // While loading history for a persisted conversation, wait for messages to be in the DOM
    if (
      loadingHistory ||
      (isPersistedConversation && loadedConversationIdRef.current !== conversationId)
    ) {
      return;
    }

    if (pendingInstantScrollRef.current) {
      pendingInstantScrollRef.current = false;
      scrollToBottom('instant');
    } else if (messages.length > 0 || isGenerating) {
      scrollToBottom('smooth');
    }
  }, [messages, isGenerating, conversationId, loadingHistory, scrollToBottom]);

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

    const optimisticAssistantId = `asst-opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimisticAssistantMsg: ChatMessageItem = {
      id: optimisticAssistantId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      is_pending: true,
    };

    const appendMessages = (prev: ChatMessageItem[]) =>
      options?.appendUserMessage !== false
        ? [...prev, userMsg, optimisticAssistantMsg]
        : [...prev, optimisticAssistantMsg];

    setConversationMessages(targetConvId, appendMessages);
    if (conversationIdRef.current === targetConvId) {
      setMessages((prev) => appendMessages(prev));
    }
    resetInput();
    clearClarificationPrompt();

    const settleOptimisticMessage = (updates: Partial<ChatMessageItem>) => {
      const updateList = (prev: ChatMessageItem[]) =>
        prev.map((m) =>
          m.id === optimisticAssistantId
            ? {
                ...m,
                ...updates,
                created_at: new Date().toISOString(),
                is_pending: false,
              }
            : m
        );
      setConversationMessages(targetConvId, updateList);
      if (conversationIdRef.current === targetConvId) {
        setMessages((prev) => updateList(prev));
      }
    };

    const controller = new AbortController();
    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random()}`;

    startConversationGeneration(targetConvId, requestId, controller);

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
        settleOptimisticMessage({
          id: asstId,
          role: 'assistant',
          content: response.reply || "You've used all your messages for now.",
        });
        finishConversationGeneration(targetConvId);
        setQuotaExceeded({ resetAt: response.quota_reset_at || null });
        return;
      }

      // If backend returned a persisted user_message_id, update it
      if (response.user_message_id && options?.appendUserMessage !== false) {
        const updateUserMsg = (prev: ChatMessageItem[]) =>
          prev.map((m) => (m.id === tempUserId ? { ...m, id: response.user_message_id! } : m));
        setConversationMessages(targetConvId, updateUserMsg);
        if (conversationIdRef.current === targetConvId) {
          setMessages((prev) => updateUserMsg(prev));
        }
      }

      // Seamlessly transform optimistic placeholder into rendered assistant message
      const asstId = response.assistant_message_id || `asst-${Date.now()}`;
      settleOptimisticMessage({
        id: asstId,
        role: 'assistant',
        content: response.reply,
        download_url: response.download_url,
        file_name: response.file_name,
      });

      // Handle conversational clarification prompts
      if (
        response.needs_clarification &&
        response.suggested_replies &&
        response.suggested_replies.length > 0
      ) {
        if (conversationIdRef.current === targetConvId) {
          setClarificationPrompt({
            suggestedReplies: response.suggested_replies,
            assistantMessageId: asstId,
          });
        }
      } else {
        if (conversationIdRef.current === targetConvId) {
          clearClarificationPrompt();
        }
      }

      setAnimatedAssistantMessageId(targetConvId, asstId);
      if (conversationIdRef.current === targetConvId) {
        setLatestAnimatedAssistantMessageId(asstId);
      }

      if (response.conversation_id) {
        if (targetConvId && targetConvId !== response.conversation_id) {
          migrateConversationState(targetConvId, response.conversation_id);
        }
        if (onConversationCreated) {
          upgradedConversationIdRef.current = response.conversation_id;
          onConversationCreated(response.conversation_id);
        }
      }

      if (conversationIdRef.current !== targetConvId) {
        finishConversationGeneration(targetConvId);
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'AbortError') {
        // Generation stopped by user: cleanly remove the optimistic placeholder without orphaned states
        const removePending = (prev: ChatMessageItem[]) =>
          prev.filter((m) => m.id !== optimisticAssistantId);
        setConversationMessages(targetConvId, removePending);
        if (conversationIdRef.current === targetConvId) {
          setMessages((prev) => removePending(prev));
        }
        finishConversationGeneration(targetConvId);
      } else {
        // On network or server failure, transform the optimistic bubble into a retryable error message
        settleOptimisticMessage({
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${error.message || 'Failed to process inquiry.'}`,
        });
        finishConversationGeneration(targetConvId);
      }
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
    stopConversationGeneration(conversationId, async ({ requestId, shownText }) => {
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
    setAnimatedAssistantMessageId(conversationId, null);
    setConversationMessages(conversationId, (prev) => prev.filter((m) => !m.is_pending));
    setMessages((prev) => prev.filter((m) => !m.is_pending));
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
    const filtered = (prev: ChatMessageItem[]) => prev.filter((m) => m.id !== assistantMessageId);
    setConversationMessages(conversationId, filtered);
    setMessages((prev) => filtered(prev));
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
      const sliced = (prev: ChatMessageItem[]) => prev.slice(0, msgIdx);
      setConversationMessages(conversationId, sliced);
      setMessages((prev) => sliced(prev));
    }

    await executeTurn(newContent, userMsg.reply_to);
  };

  return (
    <div className={`flex h-full w-full flex-col overflow-hidden ${className}`}>
      {/* Scrollable Message List Viewport with Pane-Docked Scrollbar */}
      <div
        ref={viewportRef}
        data-testid="message-stream-scroll-viewport"
        className="flex-1 overflow-y-auto [overflow-anchor:auto] px-4 py-4 sm:px-6"
      >
        <div
          data-testid="message-stream-container"
          className="mx-auto flex min-h-full max-w-4xl lg:max-w-5xl w-full flex-col space-y-2"
        >
          {loadingHistory ? (
            <MessageStreamSkeleton />
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
                  setAnimatedAssistantMessageId(conversationId, null);
                  finishConversationGeneration(conversationId);
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
            conversationId={conversationId}
            isGenerating={isGenerating}
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
