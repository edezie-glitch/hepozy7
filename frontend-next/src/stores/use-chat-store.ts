import { create } from 'zustand';
import {
  type StagedAttachment,
  validateAttachment,
  isImageFile,
} from '@/lib/attachments';

import type { ChatMessageItem } from '@/lib/api/chat';

export interface ReplyingToState {
  text: string;
  messageId?: string;
}

export interface ClarificationPromptState {
  suggestedReplies: string[];
  assistantMessageId?: string;
}

export interface QuotaExceededState {
  resetAt: string | null;
}

export interface ConversationGeneration {
  isGenerating: boolean;
  activeRequestId: string | null;
  abortController: AbortController | null;
}

export interface ChatStoreState {
  inputDraft: string;
  inputPrompt: string;
  replyingTo: ReplyingToState | null;
  editingMessageId: string | null;
  isGenerating: boolean;
  activeRequestId: string | null;
  abortController: AbortController | null;

  // Scoped generation & conversation state
  generationStates: Record<string, ConversationGeneration>;
  conversationMessages: Record<string, ChatMessageItem[]>;
  animatedAssistantMessageIds: Record<string, string | null>;

  // Multimodal Attachments Staging
  stagedAttachments: StagedAttachment[];
  attachmentError: string | null;

  // Conversational Clarification & Quota Safeguards
  clarificationPrompt: ClarificationPromptState | null;
  quotaExceeded: QuotaExceededState | null;

  setInputDraft: (draft: string) => void;
  setInputPrompt: (prompt: string) => void;
  setReplyingTo: (reply: ReplyingToState | null) => void;
  clearReplyingTo: () => void;
  setEditingMessageId: (id: string | null) => void;
  setIsGenerating: (isGenerating: boolean, conversationId?: string | null) => void;
  setActiveRequestId: (id: string | null, conversationId?: string | null) => void;
  setAbortController: (controller: AbortController | null, conversationId?: string | null) => void;

  // Scoped generation actions
  isConversationGenerating: (conversationId?: string | null) => boolean;
  getConversationGeneration: (conversationId?: string | null) => ConversationGeneration;
  startConversationGeneration: (
    conversationId: string | null,
    requestId: string,
    abortController: AbortController
  ) => void;
  finishConversationGeneration: (conversationId: string | null) => void;
  stopConversationGeneration: (
    conversationId: string | null,
    onStop?: (params: { requestId: string; shownText?: string }) => void,
    shownText?: string
  ) => void;
  clearAllGenerations: () => void;

  // Scoped message & animation actions
  setConversationMessages: (
    conversationId: string | null,
    messages: ChatMessageItem[] | ((prev: ChatMessageItem[]) => ChatMessageItem[])
  ) => void;
  getConversationMessages: (conversationId?: string | null) => ChatMessageItem[] | undefined;
  clearConversationMessages: (conversationId: string | null) => void;
  setAnimatedAssistantMessageId: (conversationId: string | null, messageId: string | null) => void;
  getAnimatedAssistantMessageId: (conversationId?: string | null) => string | null;
  migrateConversationState: (fromId: string, toId: string) => void;

  stopGeneration: (
    onStop?: (params: { requestId: string; shownText?: string }) => void,
    shownText?: string,
    conversationId?: string | null
  ) => void;
  resetInput: (revokeUrls?: boolean) => void;
  resetWorkspaceState: (revokeUrls?: boolean) => void;

  stageFiles: (files: File[]) => {
    added: StagedAttachment[];
    rejected: { file: File; reason: string }[];
  };
  removeStagedAttachment: (id: string) => void;
  clearStagedAttachments: (revokeUrls?: boolean) => void;
  setAttachmentError: (error: string | null) => void;

  setClarificationPrompt: (prompt: ClarificationPromptState | null) => void;
  clearClarificationPrompt: () => void;
  setQuotaExceeded: (quota: QuotaExceededState | null) => void;
  clearQuotaExceeded: () => void;
}

const normalizeConvKey = (id: string | null | undefined): string => id ?? '__default__';

export const useChatStore = create<ChatStoreState>((set, get) => ({
  inputDraft: '',
  inputPrompt: '',
  replyingTo: null,
  editingMessageId: null,
  isGenerating: false,
  activeRequestId: null,
  abortController: null,
  generationStates: {},
  conversationMessages: {},
  animatedAssistantMessageIds: {},
  stagedAttachments: [],
  attachmentError: null,
  clarificationPrompt: null,
  quotaExceeded: null,

  setInputDraft: (draft) => set({ inputDraft: draft, inputPrompt: draft }),
  setInputPrompt: (prompt) => set({ inputDraft: prompt, inputPrompt: prompt }),
  setReplyingTo: (reply) => set({ replyingTo: reply }),
  clearReplyingTo: () => set({ replyingTo: null }),
  setEditingMessageId: (id) => set({ editingMessageId: id }),

  setIsGenerating: (isGenerating, conversationId) => {
    const key = normalizeConvKey(conversationId);
    set((state) => {
      const nextGenStates = { ...state.generationStates };
      if (isGenerating) {
        nextGenStates[key] = {
          ...nextGenStates[key],
          isGenerating: true,
          activeRequestId: nextGenStates[key]?.activeRequestId ?? state.activeRequestId,
          abortController: nextGenStates[key]?.abortController ?? state.abortController,
        };
      } else {
        if (nextGenStates[key]) {
          nextGenStates[key] = {
            ...nextGenStates[key],
            isGenerating: false,
            activeRequestId: null,
            abortController: null,
          };
        }
      }
      const anyGenerating = Object.values(nextGenStates).some((g) => g.isGenerating);
      return {
        isGenerating: anyGenerating || (conversationId ? state.isGenerating : isGenerating),
        generationStates: nextGenStates,
      };
    });
  },

  setActiveRequestId: (id, conversationId) => {
    const key = normalizeConvKey(conversationId);
    set((state) => ({
      activeRequestId: id,
      generationStates: {
        ...state.generationStates,
        [key]: {
          isGenerating: state.generationStates[key]?.isGenerating ?? state.isGenerating,
          activeRequestId: id,
          abortController: state.generationStates[key]?.abortController ?? state.abortController,
        },
      },
    }));
  },

  setAbortController: (controller, conversationId) => {
    const key = normalizeConvKey(conversationId);
    set((state) => ({
      abortController: controller,
      generationStates: {
        ...state.generationStates,
        [key]: {
          isGenerating: state.generationStates[key]?.isGenerating ?? state.isGenerating,
          activeRequestId: state.generationStates[key]?.activeRequestId ?? state.activeRequestId,
          abortController: controller,
        },
      },
    }));
  },

  isConversationGenerating: (conversationId) => {
    const state = get();
    if (!state.isGenerating) {
      return false;
    }
    if (conversationId === undefined) {
      return true;
    }
    const key = normalizeConvKey(conversationId);
    return Boolean(state.generationStates[key]?.isGenerating);
  },

  getConversationGeneration: (conversationId) => {
    const state = get();
    const key = normalizeConvKey(conversationId);
    return (
      state.generationStates[key] ?? {
        isGenerating: false,
        activeRequestId: null,
        abortController: null,
      }
    );
  },

  startConversationGeneration: (conversationId, requestId, abortController) => {
    const key = normalizeConvKey(conversationId);
    set((state) => ({
      isGenerating: true,
      activeRequestId: requestId,
      abortController,
      generationStates: {
        ...state.generationStates,
        [key]: {
          isGenerating: true,
          activeRequestId: requestId,
          abortController,
        },
      },
    }));
  },

  finishConversationGeneration: (conversationId) => {
    const key = normalizeConvKey(conversationId);
    set((state) => {
      const nextStates = { ...state.generationStates };
      delete nextStates[key];
      const anyGenerating = Object.values(nextStates).some((g) => g.isGenerating);
      return {
        isGenerating: anyGenerating,
        activeRequestId: anyGenerating ? state.activeRequestId : null,
        abortController: anyGenerating ? state.abortController : null,
        generationStates: nextStates,
      };
    });
  },

  stopConversationGeneration: (conversationId, onStop, shownText) => {
    const state = get();
    const key = normalizeConvKey(conversationId);
    const gen = state.generationStates[key];
    const controller = gen?.abortController ?? (conversationId ? null : state.abortController);
    const reqId = gen?.activeRequestId ?? (conversationId ? null : state.activeRequestId);

    if (controller) {
      controller.abort();
    }
    if (reqId && onStop) {
      onStop({ requestId: reqId, shownText });
    }

    set((prev) => {
      const nextStates = { ...prev.generationStates };
      delete nextStates[key];
      const anyGenerating = Object.values(nextStates).some((g) => g.isGenerating);
      return {
        isGenerating: anyGenerating,
        activeRequestId: anyGenerating ? prev.activeRequestId : null,
        abortController: anyGenerating ? prev.abortController : null,
        generationStates: nextStates,
      };
    });
  },

  clearAllGenerations: () => {
    const state = get();
    if (state.abortController) {
      state.abortController.abort();
    }
    for (const gen of Object.values(state.generationStates)) {
      if (gen.abortController && gen.abortController !== state.abortController) {
        gen.abortController.abort();
      }
    }
    set({
      isGenerating: false,
      activeRequestId: null,
      abortController: null,
      generationStates: {},
      conversationMessages: {},
      animatedAssistantMessageIds: {},
    });
  },

  setConversationMessages: (conversationId, messagesOrUpdater) => {
    const key = normalizeConvKey(conversationId);
    set((state) => {
      const current = state.conversationMessages[key] || [];
      const updated =
        typeof messagesOrUpdater === 'function'
          ? messagesOrUpdater(current)
          : messagesOrUpdater;
      return {
        conversationMessages: {
          ...state.conversationMessages,
          [key]: updated,
        },
      };
    });
  },

  getConversationMessages: (conversationId) => {
    const key = normalizeConvKey(conversationId);
    return get().conversationMessages[key];
  },

  clearConversationMessages: (conversationId) => {
    const key = normalizeConvKey(conversationId);
    set((state) => {
      const next = { ...state.conversationMessages };
      delete next[key];
      return { conversationMessages: next };
    });
  },

  setAnimatedAssistantMessageId: (conversationId, messageId) => {
    const key = normalizeConvKey(conversationId);
    set((state) => ({
      animatedAssistantMessageIds: {
        ...state.animatedAssistantMessageIds,
        [key]: messageId,
      },
    }));
  },

  getAnimatedAssistantMessageId: (conversationId) => {
    const key = normalizeConvKey(conversationId);
    return get().animatedAssistantMessageIds[key] ?? null;
  },

  migrateConversationState: (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    set((state) => {
      const nextGen = { ...state.generationStates };
      const nextMessages = { ...state.conversationMessages };
      const nextAnimated = { ...state.animatedAssistantMessageIds };

      if (nextGen[fromId]) {
        nextGen[toId] = nextGen[fromId];
        delete nextGen[fromId];
      }
      if (nextMessages[fromId]) {
        nextMessages[toId] = nextMessages[fromId];
        delete nextMessages[fromId];
      }
      if (nextAnimated[fromId] !== undefined) {
        nextAnimated[toId] = nextAnimated[fromId];
        delete nextAnimated[fromId];
      }

      return {
        generationStates: nextGen,
        conversationMessages: nextMessages,
        animatedAssistantMessageIds: nextAnimated,
      };
    });
  },

  stopGeneration: (onStop, shownText, conversationId) => {
    if (conversationId !== undefined) {
      get().stopConversationGeneration(conversationId, onStop, shownText);
      return;
    }
    const state = get();
    if (state.abortController) {
      state.abortController.abort();
    }
    for (const gen of Object.values(state.generationStates)) {
      if (gen.abortController && gen.abortController !== state.abortController) {
        gen.abortController.abort();
      }
    }
    if (state.activeRequestId && onStop) {
      onStop({ requestId: state.activeRequestId, shownText });
    }
    set({
      isGenerating: false,
      activeRequestId: null,
      abortController: null,
      generationStates: {},
    });
  },

  stageFiles: (files: File[]) => {
    const added: StagedAttachment[] = [];
    const rejected: { file: File; reason: string }[] = [];

    for (const file of files) {
      const validation = validateAttachment(file);
      if (!validation.valid) {
        rejected.push({ file, reason: validation.error || 'Invalid file' });
      } else {
        const isImg = isImageFile(file);
        let previewUrl: string | undefined;
        if (isImg && typeof URL !== 'undefined' && URL.createObjectURL) {
          try {
            previewUrl = URL.createObjectURL(file);
          } catch {
            previewUrl = undefined;
          }
        }
        const staged: StagedAttachment = {
          id: `attach-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          previewUrl,
          isImage: isImg,
        };
        added.push(staged);
      }
    }

    set((state) => ({
      stagedAttachments: [...state.stagedAttachments, ...added],
      attachmentError:
        rejected.length > 0
          ? rejected.map((r) => r.reason).join('; ')
          : state.attachmentError,
    }));

    return { added, rejected };
  },

  removeStagedAttachment: (id: string) => {
    const { stagedAttachments } = get();
    const item = stagedAttachments.find((a) => a.id === id);
    if (item?.previewUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch {
        // ignore
      }
    }
    set({
      stagedAttachments: stagedAttachments.filter((a) => a.id !== id),
    });
  },

  clearStagedAttachments: (revokeUrls = true) => {
    const { stagedAttachments } = get();
    if (revokeUrls) {
      for (const item of stagedAttachments) {
        if (item.previewUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
          try {
            URL.revokeObjectURL(item.previewUrl);
          } catch {
            // ignore
          }
        }
      }
    }
    set({
      stagedAttachments: [],
      attachmentError: null,
    });
  },

  setAttachmentError: (error: string | null) => set({ attachmentError: error }),

  setClarificationPrompt: (prompt) => set({ clarificationPrompt: prompt }),
  clearClarificationPrompt: () => set({ clarificationPrompt: null }),
  setQuotaExceeded: (quota) => set({ quotaExceeded: quota }),
  clearQuotaExceeded: () => set({ quotaExceeded: null }),

  resetInput: (revokeUrls = false) => {
    get().clearStagedAttachments(revokeUrls);
    set({
      inputDraft: '',
      inputPrompt: '',
      replyingTo: null,
    });
  },

  resetWorkspaceState: (revokeUrls = true) => {
    get().resetInput(revokeUrls);
    set((state) => {
      const nextMessages = { ...state.conversationMessages };
      delete nextMessages['__default__'];
      return {
        editingMessageId: null,
        clarificationPrompt: null,
        quotaExceeded: null,
        conversationMessages: nextMessages,
      };
    });
  },
}));
