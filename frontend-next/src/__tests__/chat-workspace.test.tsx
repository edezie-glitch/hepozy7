import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatWorkspace } from '@/components/chat/chat-workspace';
import * as chatApi from '@/lib/api/chat';
import { useChatStore } from '@/stores/use-chat-store';

describe('ChatWorkspace Component Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useChatStore.setState({
      inputPrompt: '',
      replyingTo: null,
      editingMessageId: null,
      isGenerating: false,
      activeRequestId: null,
      abortController: null,
    });
  });

  it('renders chat history when conversationId is provided', async () => {
    const mockHistory: chatApi.ChatMessageItem[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'What is Hepozy?',
        created_at: '2026-10-14T10:00:00Z',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hepozy is an AI workspace assistant.',
        created_at: '2026-10-14T10:00:05Z',
      },
    ];

    vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce(mockHistory);

    render(<ChatWorkspace conversationId="conv-1" />);

    expect(await screen.findByText('What is Hepozy?')).toBeInTheDocument();
    expect(screen.getByText('Hepozy is an AI workspace assistant.')).toBeInTheDocument();
  });

  it('submits user prompt immediately into messages and sends POST /api/chat', async () => {
    const user = userEvent.setup();
    vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);
    const sendSpy = vi.spyOn(chatApi, 'sendChatMessage').mockResolvedValueOnce({
      reply: 'Vector search retrieves documents.',
      conversation_id: 'conv-1',
      user_message_id: 'u-100',
      assistant_message_id: 'a-100',
      needs_clarification: false,
      quota_exceeded: false,
    });

    render(<ChatWorkspace conversationId="conv-1" />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'How does semantic search work?{enter}');

    // Immediately rendered in message list
    expect(screen.getByText('How does semantic search work?')).toBeInTheDocument();

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'How does semantic search work?',
          conversation_id: 'conv-1',
        }),
        expect.any(AbortSignal)
      );
    });

    // Assistant response appears
    expect(await screen.findByText(/Vector search retrieves documents/)).toBeInTheDocument();
  });

  it('handles Stop button during generation and notifies POST /api/chat/stop', async () => {
    const user = userEvent.setup();
    vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);
    const stopSpy = vi.spyOn(chatApi, 'stopChat').mockResolvedValueOnce({ status: 'stopped' });

    // Mock sendChatMessage to remain pending until aborted
    vi.spyOn(chatApi, 'sendChatMessage').mockImplementation(
      (_params, signal) =>
        new Promise((_, reject) => {
          signal?.addEventListener('abort', () => {
            const err = new Error('The user aborted a request.');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );

    render(<ChatWorkspace conversationId="conv-1" />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Generate extensive project plan{enter}');

    // Button transforms to Stop
    const stopBtn = await screen.findByRole('button', { name: /stop generation/i });
    expect(stopBtn).toBeInTheDocument();

    await user.click(stopBtn);

    await waitFor(() => {
      expect(stopSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation_id: 'conv-1',
        })
      );
    });

    // isGenerating resets and Stop button returns to normal
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });
  });

  it('handles Retry turn on assistant message to re-submit turn', async () => {
    const user = userEvent.setup();
    const mockHistory: chatApi.ChatMessageItem[] = [
      {
        id: 'msg-u1',
        role: 'user',
        content: 'Explain Docker containers',
        created_at: '2026-10-14T10:00:00Z',
      },
      {
        id: 'msg-a1',
        role: 'assistant',
        content: 'Incomplete explanation...',
        created_at: '2026-10-14T10:00:05Z',
      },
    ];

    vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce(mockHistory);
    const sendSpy = vi.spyOn(chatApi, 'sendChatMessage').mockResolvedValueOnce({
      reply: 'Docker containers are isolated environments.',
      conversation_id: 'conv-1',
      user_message_id: 'msg-u1',
      assistant_message_id: 'msg-a2',
      needs_clarification: false,
      quota_exceeded: false,
    });

    render(<ChatWorkspace conversationId="conv-1" />);

    expect(await screen.findByText('Explain Docker containers')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry turn/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Explain Docker containers',
          conversation_id: 'conv-1',
        }),
        expect.any(AbortSignal)
      );
    });

    expect(await screen.findByText(/Docker containers are isolated environments/)).toBeInTheDocument();
  });

  it('handles inline edit on user message, calling POST /api/chat/edit and re-running turn', async () => {
    const user = userEvent.setup();
    const mockHistory: chatApi.ChatMessageItem[] = [
      {
        id: 'msg-u1',
        role: 'user',
        content: 'Original prompt about Python',
        created_at: '2026-10-14T10:00:00Z',
      },
      {
        id: 'msg-a1',
        role: 'assistant',
        content: 'Python is an interpreted language.',
        created_at: '2026-10-14T10:00:05Z',
      },
    ];

    vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce(mockHistory);
    const editSpy = vi.spyOn(chatApi, 'editChatMessage').mockResolvedValueOnce({
      status: 'ok',
      deleted: 2,
    });
    const sendSpy = vi.spyOn(chatApi, 'sendChatMessage').mockResolvedValueOnce({
      reply: 'TypeScript adds static type definitions to JavaScript.',
      conversation_id: 'conv-1',
      user_message_id: 'msg-u2',
      assistant_message_id: 'msg-a2',
      needs_clarification: false,
      quota_exceeded: false,
    });

    render(<ChatWorkspace conversationId="conv-1" />);

    expect(await screen.findByText('Original prompt about Python')).toBeInTheDocument();

    const editBtn = screen.getByRole('button', { name: /edit message/i });
    await user.click(editBtn);

    const editTextarea = screen.getByTestId('inline-edit-textarea');
    await user.clear(editTextarea);
    await user.type(editTextarea, 'Revised prompt about TypeScript');

    const saveBtn = screen.getByRole('button', { name: /save & submit/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(editSpy).toHaveBeenCalledWith({
        conversation_id: 'conv-1',
        message_id: 'msg-u1',
        original_text: 'Original prompt about Python',
      });
    });

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Revised prompt about TypeScript',
          conversation_id: 'conv-1',
        }),
        expect.any(AbortSignal)
      );
    });

    expect(await screen.findByText(/TypeScript adds static type definitions/)).toBeInTheDocument();
  });

  it('allows quoting a user message, displaying reply quote chip in the input bar', async () => {
    const user = userEvent.setup();
    const mockHistory: chatApi.ChatMessageItem[] = [
      {
        id: 'msg-u1',
        role: 'user',
        content: 'Original user question to quote',
        created_at: '2026-10-14T10:00:00Z',
      },
    ];

    vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce(mockHistory);

    render(<ChatWorkspace conversationId="conv-1" />);

    expect(await screen.findByText('Original user question to quote')).toBeInTheDocument();

    const replyBtn = screen.getByRole('button', { name: /reply to message/i });
    await user.click(replyBtn);

    const replyChip = screen.getByTestId('reply-quote-chip');
    expect(replyChip).toBeInTheDocument();
    expect(replyChip).toHaveTextContent('Original user question to quote');
  });

  it('animates assistant response via typewriter and fast-forwards on bubble click', async () => {
    const user = userEvent.setup();
    vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);
    vi.spyOn(chatApi, 'sendChatMessage').mockResolvedValueOnce({
      reply: 'Detailed multi-sentence explanation of LLM routing and token allocation.',
      conversation_id: 'conv-1',
      user_message_id: 'u-1',
      assistant_message_id: 'a-1',
      needs_clarification: false,
      quota_exceeded: false,
    });

    render(<ChatWorkspace conversationId="conv-1" />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Explain multi-model routing{enter}');

    // Assistant message bubble appears
    const bubbles = await screen.findAllByTestId('message-bubble');
    const assistantBubble = bubbles[bubbles.length - 1];
    expect(assistantBubble).toBeInTheDocument();

    // Clicking the bubble fast-forwards the animation to full text
    await user.click(assistantBubble);

    expect(assistantBubble).toHaveTextContent('Detailed multi-sentence explanation of LLM routing and token allocation.');
    expect(useChatStore.getState().isGenerating).toBe(false);
  });
});

