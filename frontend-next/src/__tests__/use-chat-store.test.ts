import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from '@/stores/use-chat-store';

describe('useChatStore', () => {
  beforeEach(() => {
    useChatStore.setState({
      inputPrompt: '',
      replyingTo: null,
      editingMessageId: null,
      isGenerating: false,
      activeRequestId: null,
      abortController: null,
    });
  });

  it('manages inputPrompt state and resets properly', () => {
    expect(useChatStore.getState().inputPrompt).toBe('');
    useChatStore.getState().setInputPrompt('Hello world');
    expect(useChatStore.getState().inputPrompt).toBe('Hello world');

    useChatStore.getState().resetInput();
    expect(useChatStore.getState().inputPrompt).toBe('');
  });

  it('manages replyingTo quote state and clearing', () => {
    expect(useChatStore.getState().replyingTo).toBeNull();

    useChatStore.getState().setReplyingTo({
      text: 'Quoted message content',
      messageId: 'msg-1',
    });
    expect(useChatStore.getState().replyingTo).toEqual({
      text: 'Quoted message content',
      messageId: 'msg-1',
    });

    useChatStore.getState().clearReplyingTo();
    expect(useChatStore.getState().replyingTo).toBeNull();
  });

  it('manages editingMessageId state', () => {
    expect(useChatStore.getState().editingMessageId).toBeNull();
    useChatStore.getState().setEditingMessageId('msg-user-1');
    expect(useChatStore.getState().editingMessageId).toBe('msg-user-1');
    useChatStore.getState().setEditingMessageId(null);
    expect(useChatStore.getState().editingMessageId).toBeNull();
  });

  it('manages isGenerating, activeRequestId, abortController, and stopGeneration', () => {
    const controller = new AbortController();
    const abortSpy = vi.spyOn(controller, 'abort');
    const onStopCallback = vi.fn();

    useChatStore.getState().setIsGenerating(true);
    useChatStore.getState().setActiveRequestId('req-123');
    useChatStore.getState().setAbortController(controller);

    expect(useChatStore.getState().isGenerating).toBe(true);
    expect(useChatStore.getState().activeRequestId).toBe('req-123');
    expect(useChatStore.getState().abortController).toBe(controller);

    // Trigger stopGeneration
    useChatStore.getState().stopGeneration(onStopCallback, 'Partial text');

    expect(abortSpy).toHaveBeenCalled();
    expect(onStopCallback).toHaveBeenCalledWith({
      requestId: 'req-123',
      shownText: 'Partial text',
    });
    expect(useChatStore.getState().isGenerating).toBe(false);
    expect(useChatStore.getState().activeRequestId).toBeNull();
    expect(useChatStore.getState().abortController).toBeNull();
  });
});
