import { create } from 'zustand';

export interface ReplyingToState {
  text: string;
  messageId?: string;
}

export interface ChatStoreState {
  inputDraft: string;
  inputPrompt: string;
  replyingTo: ReplyingToState | null;
  editingMessageId: string | null;
  isGenerating: boolean;
  activeRequestId: string | null;
  abortController: AbortController | null;

  setInputDraft: (draft: string) => void;
  setInputPrompt: (prompt: string) => void;
  setReplyingTo: (reply: ReplyingToState | null) => void;
  clearReplyingTo: () => void;
  setEditingMessageId: (id: string | null) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setActiveRequestId: (id: string | null) => void;
  setAbortController: (controller: AbortController | null) => void;
  stopGeneration: (
    onStop?: (params: { requestId: string; shownText?: string }) => void,
    shownText?: string
  ) => void;
  resetInput: () => void;
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  inputDraft: '',
  inputPrompt: '',
  replyingTo: null,
  editingMessageId: null,
  isGenerating: false,
  activeRequestId: null,
  abortController: null,

  setInputDraft: (draft) => set({ inputDraft: draft, inputPrompt: draft }),
  setInputPrompt: (prompt) => set({ inputDraft: prompt, inputPrompt: prompt }),
  setReplyingTo: (reply) => set({ replyingTo: reply }),
  clearReplyingTo: () => set({ replyingTo: null }),
  setEditingMessageId: (id) => set({ editingMessageId: id }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setActiveRequestId: (id) => set({ activeRequestId: id }),
  setAbortController: (controller) => set({ abortController: controller }),

  stopGeneration: (onStop, shownText) => {
    const { abortController, activeRequestId } = get();
    if (abortController) {
      abortController.abort();
    }
    if (activeRequestId && onStop) {
      onStop({ requestId: activeRequestId, shownText });
    }
    set({
      isGenerating: false,
      activeRequestId: null,
      abortController: null,
    });
  },

  resetInput: () => set({ inputDraft: '', inputPrompt: '', replyingTo: null }),
}));
