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
      clarificationPrompt: null,
      quotaExceeded: null,
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

  it('manages staging attachments, rejection errors, removal, and clearing', () => {
    expect(useChatStore.getState().stagedAttachments).toEqual([]);
    expect(useChatStore.getState().attachmentError).toBeNull();

    const validDoc = new File(['valid pdf content'], 'report.pdf', { type: 'application/pdf' });
    const validImg = new File(['valid img content'], 'photo.png', { type: 'image/png' });
    const invalidFile = new File(['bad'], 'script.sh', { type: 'application/x-sh' });

    // Stage valid files
    const result1 = useChatStore.getState().stageFiles([validDoc, validImg]);
    expect(result1.added.length).toBe(2);
    expect(result1.rejected.length).toBe(0);
    expect(useChatStore.getState().stagedAttachments.length).toBe(2);
    expect(useChatStore.getState().stagedAttachments[0].name).toBe('report.pdf');
    expect(useChatStore.getState().stagedAttachments[1].isImage).toBe(true);

    // Stage invalid file -> should set error and reject
    const result2 = useChatStore.getState().stageFiles([invalidFile]);
    expect(result2.rejected.length).toBe(1);
    expect(useChatStore.getState().attachmentError).toMatch(/this file type is not supported/i);

    // Remove one attachment
    const idToRemove = useChatStore.getState().stagedAttachments[0].id;
    useChatStore.getState().removeStagedAttachment(idToRemove);
    expect(useChatStore.getState().stagedAttachments.length).toBe(1);
    expect(useChatStore.getState().stagedAttachments[0].name).toBe('photo.png');

    // Clear staged attachments
    useChatStore.getState().clearStagedAttachments();
    expect(useChatStore.getState().stagedAttachments).toEqual([]);
    expect(useChatStore.getState().attachmentError).toBeNull();
  });

  it('manages clarificationPrompt state and clearing', () => {
    expect(useChatStore.getState().clarificationPrompt).toBeNull();

    useChatStore.getState().setClarificationPrompt({
      suggestedReplies: ['Option A', 'Option B'],
      assistantMessageId: 'asst-123',
    });

    expect(useChatStore.getState().clarificationPrompt).toEqual({
      suggestedReplies: ['Option A', 'Option B'],
      assistantMessageId: 'asst-123',
    });

    useChatStore.getState().clearClarificationPrompt();
    expect(useChatStore.getState().clarificationPrompt).toBeNull();
  });

  it('manages quotaExceeded state and clearing', () => {
    expect(useChatStore.getState().quotaExceeded).toBeNull();

    useChatStore.getState().setQuotaExceeded({
      resetAt: '2026-10-14T23:55:00Z',
    });

    expect(useChatStore.getState().quotaExceeded).toEqual({
      resetAt: '2026-10-14T23:55:00Z',
    });

    useChatStore.getState().clearQuotaExceeded();
    expect(useChatStore.getState().quotaExceeded).toBeNull();
  });

  it('resets workspace state including staged attachments, quotes, and drafts', () => {
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    useChatStore.getState().stageFiles([file]);
    useChatStore.getState().setInputPrompt('some draft');
    useChatStore.getState().setReplyingTo({ text: 'quote', messageId: 'm1' });
    useChatStore.getState().setClarificationPrompt({ suggestedReplies: ['A'] });
    useChatStore.getState().setEditingMessageId('edit-1');

    expect(useChatStore.getState().stagedAttachments.length).toBe(1);
    expect(useChatStore.getState().inputPrompt).toBe('some draft');
    expect(useChatStore.getState().replyingTo).not.toBeNull();

    useChatStore.getState().resetWorkspaceState();

    expect(useChatStore.getState().stagedAttachments).toEqual([]);
    expect(useChatStore.getState().inputDraft).toBe('');
    expect(useChatStore.getState().inputPrompt).toBe('');
    expect(useChatStore.getState().replyingTo).toBeNull();
    expect(useChatStore.getState().editingMessageId).toBeNull();
    expect(useChatStore.getState().clarificationPrompt).toBeNull();
  });

  describe('Ticket 19 (#28): Conversation-Scoped Generation State & Message Persistence', () => {
    it('manages conversation-scoped generation state independently across multiple conversations', () => {
      const controller1 = new AbortController();
      const abortSpy1 = vi.spyOn(controller1, 'abort');
      const controller2 = new AbortController();
      const abortSpy2 = vi.spyOn(controller2, 'abort');

      expect(useChatStore.getState().isConversationGenerating('c-1')).toBe(false);
      expect(useChatStore.getState().isConversationGenerating('c-2')).toBe(false);

      // Start generation in c-1
      useChatStore.getState().startConversationGeneration('c-1', 'req-1', controller1);
      expect(useChatStore.getState().isConversationGenerating('c-1')).toBe(true);
      expect(useChatStore.getState().isConversationGenerating('c-2')).toBe(false);
      expect(useChatStore.getState().isGenerating).toBe(true);

      // Start generation in c-2 concurrently
      useChatStore.getState().startConversationGeneration('c-2', 'req-2', controller2);
      expect(useChatStore.getState().isConversationGenerating('c-1')).toBe(true);
      expect(useChatStore.getState().isConversationGenerating('c-2')).toBe(true);

      // Stop only c-1
      const onStop1 = vi.fn();
      useChatStore.getState().stopConversationGeneration('c-1', onStop1, 'Partial c-1');

      expect(abortSpy1).toHaveBeenCalled();
      expect(abortSpy2).not.toHaveBeenCalled();
      expect(onStop1).toHaveBeenCalledWith({ requestId: 'req-1', shownText: 'Partial c-1' });

      // c-1 is stopped, but c-2 is still generating
      expect(useChatStore.getState().isConversationGenerating('c-1')).toBe(false);
      expect(useChatStore.getState().isConversationGenerating('c-2')).toBe(true);
      expect(useChatStore.getState().isGenerating).toBe(true);

      // Finish c-2
      useChatStore.getState().finishConversationGeneration('c-2');
      expect(useChatStore.getState().isConversationGenerating('c-2')).toBe(false);
      expect(useChatStore.getState().isGenerating).toBe(false);
    });

    it('manages per-conversation message caching and retrieval', () => {
      const msg1 = { id: 'm-1', role: 'user' as const, content: 'Hello', created_at: '2026-10-18T10:00:00Z' };
      const msg2 = { id: 'm-2', role: 'assistant' as const, content: 'Hi there', created_at: '2026-10-18T10:00:05Z' };

      useChatStore.getState().setConversationMessages('c-100', [msg1]);
      expect(useChatStore.getState().getConversationMessages('c-100')).toEqual([msg1]);
      expect(useChatStore.getState().getConversationMessages('c-200')).toBeUndefined();

      // Functional updater
      useChatStore.getState().setConversationMessages('c-100', (prev) => [...prev, msg2]);
      expect(useChatStore.getState().getConversationMessages('c-100')).toEqual([msg1, msg2]);

      // Clear conversation messages
      useChatStore.getState().clearConversationMessages('c-100');
      expect(useChatStore.getState().getConversationMessages('c-100')).toBeUndefined();
    });

    it('migrates generation, message, and typewriter state from optimistic ID to persisted ID', () => {
      const controller = new AbortController();
      useChatStore.getState().startConversationGeneration('opt-123', 'req-migrate', controller);
      useChatStore.getState().setConversationMessages('opt-123', [
        { id: 'm-opt', role: 'user', content: 'Migrate test', created_at: '2026-10-18T10:00:00Z' },
      ]);
      useChatStore.getState().setAnimatedAssistantMessageId('opt-123', 'asst-mig');

      expect(useChatStore.getState().isConversationGenerating('opt-123')).toBe(true);

      // Migrate to persisted conversation ID
      useChatStore.getState().migrateConversationState('opt-123', 'persisted-456');

      expect(useChatStore.getState().isConversationGenerating('opt-123')).toBe(false);
      expect(useChatStore.getState().isConversationGenerating('persisted-456')).toBe(true);
      expect(useChatStore.getState().getConversationMessages('persisted-456')).toEqual([
        { id: 'm-opt', role: 'user', content: 'Migrate test', created_at: '2026-10-18T10:00:00Z' },
      ]);
      expect(useChatStore.getState().getAnimatedAssistantMessageId('persisted-456')).toBe('asst-mig');
    });

    it('clearAllGenerations cleanly aborts all active controllers and resets states', () => {
      const ctrl1 = new AbortController();
      const ctrl2 = new AbortController();
      const spy1 = vi.spyOn(ctrl1, 'abort');
      const spy2 = vi.spyOn(ctrl2, 'abort');

      useChatStore.getState().startConversationGeneration('c-a', 'r-a', ctrl1);
      useChatStore.getState().startConversationGeneration('c-b', 'r-b', ctrl2);

      useChatStore.getState().clearAllGenerations();

      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
      expect(useChatStore.getState().isGenerating).toBe(false);
      expect(useChatStore.getState().isConversationGenerating('c-a')).toBe(false);
      expect(useChatStore.getState().isConversationGenerating('c-b')).toBe(false);
    });
  });
});

