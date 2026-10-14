import { create } from 'zustand';
import {
  type StagedAttachment,
  validateAttachment,
  isImageFile,
} from '@/lib/attachments';

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

  // Multimodal Attachments Staging
  stagedAttachments: StagedAttachment[];
  attachmentError: string | null;

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
  resetInput: (revokeUrls?: boolean) => void;

  stageFiles: (files: File[]) => {
    added: StagedAttachment[];
    rejected: { file: File; reason: string }[];
  };
  removeStagedAttachment: (id: string) => void;
  clearStagedAttachments: (revokeUrls?: boolean) => void;
  setAttachmentError: (error: string | null) => void;
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  inputDraft: '',
  inputPrompt: '',
  replyingTo: null,
  editingMessageId: null,
  isGenerating: false,
  activeRequestId: null,
  abortController: null,
  stagedAttachments: [],
  attachmentError: null,

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

  resetInput: (revokeUrls = false) => {
    get().clearStagedAttachments(revokeUrls);
    set({
      inputDraft: '',
      inputPrompt: '',
      replyingTo: null,
    });
  },
}));
