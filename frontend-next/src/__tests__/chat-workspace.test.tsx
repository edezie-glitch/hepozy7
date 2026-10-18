import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatWorkspace } from '@/components/chat/chat-workspace';
import * as chatApi from '@/lib/api/chat';
import { useChatStore } from '@/stores/use-chat-store';

describe('ChatWorkspace Component Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useChatStore.getState().clearAllGenerations();
    useChatStore.setState({
      inputPrompt: '',
      replyingTo: null,
      editingMessageId: null,
      isGenerating: false,
      activeRequestId: null,
      abortController: null,
      stagedAttachments: [],
      attachmentError: null,
      clarificationPrompt: null,
      quotaExceeded: null,
      generationStates: {},
      conversationMessages: {},
      animatedAssistantMessageIds: {},
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

    expect(
      await screen.findByText(/TypeScript/, {}, { timeout: 10000 })
    ).toBeInTheDocument();
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

  it('submits user prompt with staged attachments, serializing base64 payloads to POST /api/chat', async () => {
    const user = userEvent.setup();
    vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);
    const sendSpy = vi.spyOn(chatApi, 'sendChatMessage').mockResolvedValueOnce({
      reply: 'I have analyzed the provided spreadsheet and photo.',
      conversation_id: 'conv-1',
      user_message_id: 'u-attach-1',
      assistant_message_id: 'a-attach-1',
      needs_clarification: false,
      quota_exceeded: false,
    });

    // Stage a document and an image
    const csvFile = new File(['year,sales\n2025,100\n2026,200'], 'data.csv', { type: 'text/csv' });
    const imgFile = new File(['image byte content'], 'chart.png', { type: 'image/png' });
    useChatStore.getState().stageFiles([csvFile, imgFile]);

    render(<ChatWorkspace conversationId="conv-1" />);

    // Verify preview strip is displayed before sending
    expect(screen.getByTestId('staged-preview-strip')).toBeInTheDocument();
    expect(screen.getByText('data.csv')).toBeInTheDocument();
    expect(screen.getByAltText('chart.png')).toBeInTheDocument();

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Please analyze these files{enter}');

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Please analyze these files',
          conversation_id: 'conv-1',
          attachments: [
            expect.objectContaining({
              name: 'data.csv',
              type: 'text/csv',
              data: expect.any(String),
            }),
            expect.objectContaining({
              name: 'chart.png',
              type: 'image/png',
              data: expect.any(String),
            }),
          ],
        }),
        expect.any(AbortSignal)
      );
    });

    // Staged preview strip should be cleared after sending
    expect(screen.queryByTestId('staged-preview-strip')).not.toBeInTheDocument();

    // Attachments should render in user message bubble history
    expect(screen.getByTestId('document-attachment')).toHaveTextContent('data.csv');
    expect(screen.getByTestId('image-attachment')).toBeInTheDocument();
  });

  it('renders clarification prompt with suggested reply pills when needs_clarification is active, and submits chosen pill into conversation', async () => {
    const user = userEvent.setup();
    vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);

    const sendSpy = vi
      .spyOn(chatApi, 'sendChatMessage')
      .mockResolvedValueOnce({
        reply: 'Which type of agreement would you like me to draft?',
        conversation_id: 'conv-1',
        assistant_message_id: 'asst-clarify-1',
        needs_clarification: true,
        suggested_replies: ['Employment Agreement', 'NDA Non-Disclosure', 'Consulting Agreement'],
        quota_exceeded: false,
      })
      .mockResolvedValueOnce({
        reply: 'Here is your drafted employment agreement template.',
        conversation_id: 'conv-1',
        assistant_message_id: 'asst-clarify-2',
        needs_clarification: false,
        quota_exceeded: false,
      });

    render(<ChatWorkspace conversationId="conv-1" />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Draft me an agreement{enter}');

    // Clarification question should be in chat
    expect(await screen.findByText('Which type of agreement would you like me to draft?')).toBeInTheDocument();

    // Clarification Prompt component should be rendered with suggested reply pills
    expect(screen.getByTestId('clarification-prompt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Employment Agreement' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'NDA Non-Disclosure' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Consulting Agreement' })).toBeInTheDocument();

    // Clicking a pill submits the answer into the current conversation
    await user.click(screen.getByRole('button', { name: 'Employment Agreement' }));

    // Clarification prompt is dismissed
    expect(screen.queryByTestId('clarification-prompt')).not.toBeInTheDocument();

    // User message is submitted into conversation
    expect(await screen.findByText('Employment Agreement')).toBeInTheDocument();

    // Second call to sendChatMessage has been made with chosen clarification
    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledTimes(2);
      expect(sendSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          message: 'Employment Agreement',
          conversation_id: 'conv-1',
        }),
        expect.any(AbortSignal)
      );
    });

    // Assistant response to clarification appears
    expect(
      await screen.findByText('Here is your drafted employment agreement template.', {}, { timeout: 10000 })
    ).toBeInTheDocument();
  });

  it('submits freeform clarification into the current conversation', async () => {
    const user = userEvent.setup();
    vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);

    const sendSpy = vi
      .spyOn(chatApi, 'sendChatMessage')
      .mockResolvedValueOnce({
        reply: 'Which format do you prefer?',
        conversation_id: 'conv-1',
        assistant_message_id: 'asst-clarify-1',
        needs_clarification: true,
        suggested_replies: ['PDF', 'Word'],
        quota_exceeded: false,
      })
      .mockResolvedValueOnce({
        reply: 'Exported as Markdown document.',
        conversation_id: 'conv-1',
        assistant_message_id: 'asst-clarify-2',
        needs_clarification: false,
        quota_exceeded: false,
      });

    render(<ChatWorkspace conversationId="conv-1" />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Format options?{enter}');

    expect(await screen.findByText('Which format do you prefer?')).toBeInTheDocument();
    expect(screen.getByTestId('clarification-prompt')).toBeInTheDocument();

    // Type into freeform input and submit
    const freeformInput = screen.getByTestId('clarification-freeform-input');
    await user.type(freeformInput, 'Markdown please{enter}');

    expect(screen.queryByTestId('clarification-prompt')).not.toBeInTheDocument();
    expect(await screen.findByText('Markdown please')).toBeInTheDocument();

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledTimes(2);
      expect(sendSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          message: 'Markdown please',
          conversation_id: 'conv-1',
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it('triggers quota exceeded modal dialog with countdown time and disables send controls until dismissed', async () => {
    const user = userEvent.setup();
    vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);

    const futureReset = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    vi.spyOn(chatApi, 'sendChatMessage').mockResolvedValueOnce({
      reply: "You've used all your messages for now.",
      conversation_id: 'conv-1',
      assistant_message_id: 'asst-quota-1',
      needs_clarification: false,
      quota_exceeded: true,
      quota_reset_at: futureReset,
    });

    render(<ChatWorkspace conversationId="conv-1" />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Tell me more{enter}');

    // Assistant reply displayed in message list
    expect(await screen.findByText("You've used all your messages for now.")).toBeInTheDocument();

    // Quota Exceeded modal is displayed with countdown
    expect(await screen.findByRole('heading', { name: /message quota exceeded/i })).toBeInTheDocument();
    expect(screen.getByText(/you can send again in 3 hours/i)).toBeInTheDocument();

    // Send controls are disabled while quota modal is open (dialog sets aria-hidden on background)
    expect(screen.getByRole('textbox', { hidden: true })).toBeDisabled();
    expect(screen.getByRole('button', { name: /attach files/i, hidden: true })).toBeDisabled();

    // Dismiss modal via close button
    const closeBtn = screen.getByRole('button', { name: /close quota notification/i });
    await user.click(closeBtn);

    // Modal is dismissed
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /message quota exceeded/i })).not.toBeInTheDocument();
    });

    // Send controls are re-enabled
    expect(screen.getByRole('textbox')).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /attach files/i })).not.toBeDisabled();
  });

  describe('Medium Max-Width Centered Container Alignment (#21)', () => {
    it('wraps the message stream scroll viewport in a centered medium max-width container with mx-auto max-w-4xl', async () => {
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([
        {
          id: 'msg-u1',
          role: 'user',
          content: 'Hello Hepozy',
          created_at: '2026-10-14T10:00:00Z',
        },
        {
          id: 'msg-a1',
          role: 'assistant',
          content: 'Hello! How can I help you today?',
          created_at: '2026-10-14T10:00:05Z',
        },
      ]);

      render(<ChatWorkspace conversationId="conv-1" />);

      expect(await screen.findByText('Hello Hepozy')).toBeInTheDocument();

      const messageStreamContainer = screen.getByTestId('message-stream-container');
      expect(messageStreamContainer).toBeInTheDocument();
      expect(messageStreamContainer).toHaveClass('mx-auto');
      expect(messageStreamContainer).toHaveClass('max-w-4xl');

      const scrollViewport = screen.getByTestId('message-stream-scroll-viewport');
      expect(scrollViewport).toBeInTheDocument();
      expect(scrollViewport).toHaveClass('overflow-y-auto');
      expect(scrollViewport).toContainElement(messageStreamContainer);
    });

    it('ensures user and assistant message bubbles adhere to column bounds with assistant spanning full width', async () => {
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([
        {
          id: 'msg-u1',
          role: 'user',
          content: 'User query testing width adherence',
          created_at: '2026-10-14T10:00:00Z',
        },
        {
          id: 'msg-a1',
          role: 'assistant',
          content: 'Assistant answer adhering to the medium column bounds.',
          created_at: '2026-10-14T10:00:05Z',
        },
      ]);

      render(<ChatWorkspace conversationId="conv-1" />);

      expect(await screen.findByText('User query testing width adherence')).toBeInTheDocument();

      const messageStreamContainer = screen.getByTestId('message-stream-container');
      const bubbles = screen.getAllByTestId('message-bubble');
      expect(bubbles).toHaveLength(2);

      // Both bubbles are nested inside the centered message stream container
      expect(messageStreamContainer).toContainElement(bubbles[0]);
      expect(messageStreamContainer).toContainElement(bubbles[1]);

      // User bubble has restricted desktop width styling
      const userBubbleContainer = bubbles[0].closest('.flex-row-reverse');
      expect(userBubbleContainer).toHaveClass('sm:max-w-[78%]');

      // Assistant bubble spans full width of the column
      const assistantBubbleContainer = bubbles[1].closest('.flex-row');
      expect(assistantBubbleContainer).toHaveClass('w-full');
      expect(assistantBubbleContainer).toHaveClass('max-w-full');
      expect(assistantBubbleContainer).not.toHaveClass('sm:max-w-[92%]');
    });

    it('aligns horizontal bounds between bottom input bar container, clarification prompt, and empty conversation card with message stream being at least as wide as chatbox', async () => {
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);

      render(<ChatWorkspace conversationId="conv-1" />);

      // Empty conversation welcome card is displayed and bounded by message stream container
      const emptyCard = await screen.findByTestId('empty-conversation-card');
      expect(emptyCard).toBeInTheDocument();
      const messageStreamContainer = screen.getByTestId('message-stream-container');
      expect(messageStreamContainer).toContainElement(emptyCard);
      expect(messageStreamContainer).toHaveClass('max-w-4xl');

      // Bottom input bar container has max-w-4xl width bounds
      const inputBounds = screen.getByTestId('chat-input-bounds');
      expect(inputBounds).toBeInTheDocument();
      expect(inputBounds).toHaveClass('max-w-4xl');
      expect(inputBounds).toHaveClass('mx-auto');

      // When clarificationPrompt is active, it renders inside the input bounds
      act(() => {
        useChatStore.getState().setClarificationPrompt({
          suggestedReplies: ['Option A', 'Option B'],
          assistantMessageId: 'a-1',
        });
      });

      const clarification = await screen.findByTestId('clarification-prompt');
      expect(clarification).toBeInTheDocument();
      expect(inputBounds).toContainElement(clarification);
    });

    it('preserves fluid full-width layout with standard comfortable padding on mobile viewports', async () => {
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);

      render(<ChatWorkspace conversationId="conv-1" />);

      const messageStreamContainer = screen.getByTestId('message-stream-container');
      expect(messageStreamContainer).toHaveClass('w-full');

      const scrollViewport = screen.getByTestId('message-stream-scroll-viewport');
      expect(scrollViewport).toHaveClass('px-4');

      const inputBounds = screen.getByTestId('chat-input-bounds');
      expect(inputBounds).toHaveClass('w-full');

      const bottomBar = screen.getByTestId('chat-bottom-bar');
      expect(bottomBar).toHaveClass('px-4');
    });
  });

  it('does not fetch chat history for optimistic conversation IDs and defers persistence to first message', async () => {
    const user = userEvent.setup();
    const historySpy = vi.spyOn(chatApi, 'getChatHistory');
    const sendSpy = vi.spyOn(chatApi, 'sendChatMessage').mockResolvedValueOnce({
      reply: 'Deferred persistence initial response',
      conversation_id: 'real-persisted-conv-123',
      user_message_id: 'u-1',
      assistant_message_id: 'a-1',
      needs_clarification: false,
      quota_exceeded: false,
    });
    const onCreatedSpy = vi.fn();

    const { rerender } = render(
      <ChatWorkspace
        conversationId="opt_test_123"
        onConversationCreated={onCreatedSpy}
      />
    );

    // No network call for history
    expect(historySpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('empty-conversation-card')).toBeInTheDocument();
    expect(screen.getByText('Conversation Ready')).toBeInTheDocument();

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'First message in new chat{enter}');

    // Message sent with conversation_id: null
    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'First message in new chat',
          conversation_id: null,
        }),
        expect.any(AbortSignal)
      );
    });

    // On response, onConversationCreated is notified with real conversation ID
    await waitFor(() => {
      expect(onCreatedSpy).toHaveBeenCalledWith('real-persisted-conv-123');
    });

    // Parent updates conversationId to the persisted ID; must NOT trigger redundant history fetch
    rerender(
      <ChatWorkspace
        conversationId="real-persisted-conv-123"
        onConversationCreated={onCreatedSpy}
      />
    );

    expect(historySpy).not.toHaveBeenCalled();
  });

  describe('Ticket 13 (#23): Optimistic Message Dispatch & Shimmer Typing Placeholder', () => {
    it('submitting a user message immediately appends an optimistic assistant placeholder bubble to the message stream (#23)', async () => {
      const user = userEvent.setup();
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);

      let resolveChat!: (value: chatApi.ChatResponse) => void;
      const sendPromise = new Promise<chatApi.ChatResponse>((resolve) => {
        resolveChat = resolve;
      });
      vi.spyOn(chatApi, 'sendChatMessage').mockReturnValueOnce(sendPromise);

      render(<ChatWorkspace conversationId="conv-1" />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Explain quantum computing{enter}');

      // Immediately appends user message
      expect(screen.getByText('Explain quantum computing')).toBeInTheDocument();

      // Immediately appends optimistic assistant placeholder with typing shimmer
      const placeholder = screen.getByTestId('optimistic-assistant-placeholder');
      expect(placeholder).toBeInTheDocument();
      expect(placeholder).toHaveAttribute('role', 'status');
      expect(placeholder).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByTestId('typing-shimmer-indicator')).toBeInTheDocument();

      // When generation completes, placeholder transforms into rendered markdown assistant message
      act(() => {
        resolveChat({
          reply: 'Quantum computing uses qubits.',
          conversation_id: 'conv-1',
          user_message_id: 'u-1',
          assistant_message_id: 'a-1',
          needs_clarification: false,
          quota_exceeded: false,
        });
      });

      expect(await screen.findByText('Quantum computing uses qubits.')).toBeInTheDocument();
      expect(screen.queryByTestId('optimistic-assistant-placeholder')).not.toBeInTheDocument();
    });

    it('verifies streaming token arrival transitions placeholder into animated assistant message (#23)', async () => {
      const user = userEvent.setup();
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);

      let resolveChat!: (value: chatApi.ChatResponse) => void;
      const sendPromise = new Promise<chatApi.ChatResponse>((resolve) => {
        resolveChat = resolve;
      });
      vi.spyOn(chatApi, 'sendChatMessage').mockReturnValueOnce(sendPromise);

      render(<ChatWorkspace conversationId="conv-1" />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Stream this message{enter}');

      // Initially shows optimistic placeholder
      expect(screen.getByTestId('optimistic-assistant-placeholder')).toBeInTheDocument();

      // Generation completes / tokens arrive
      act(() => {
        resolveChat({
          reply: 'Streaming tokens arriving smoothly.',
          conversation_id: 'conv-1',
          user_message_id: 'u-stream',
          assistant_message_id: 'a-stream',
          needs_clarification: false,
          quota_exceeded: false,
        });
      });

      // Optimistic placeholder seamlessly transforms into the assistant message
      expect(
        await screen.findByText(/Streaming tokens/, {}, { timeout: 10000 })
      ).toBeInTheDocument();
      expect(screen.queryByTestId('optimistic-assistant-placeholder')).not.toBeInTheDocument();
    });

    it('cleans up the optimistic placeholder without orphaned states when user clicks Stop (#23)', async () => {
      const user = userEvent.setup();
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);
      vi.spyOn(chatApi, 'stopChat').mockResolvedValueOnce({ status: 'stopped' });

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
      await user.type(textarea, 'Write a long essay{enter}');

      expect(screen.getByText('Write a long essay')).toBeInTheDocument();
      expect(screen.getByTestId('optimistic-assistant-placeholder')).toBeInTheDocument();

      const stopBtn = await screen.findByRole('button', { name: /stop generation/i });
      await user.click(stopBtn);

      // Optimistic placeholder is cleanly removed without orphaned assistant bubbles
      await waitFor(() => {
        expect(screen.queryByTestId('optimistic-assistant-placeholder')).not.toBeInTheDocument();
      });
      // No empty assistant bubble
      const bubbles = screen.getAllByTestId('message-bubble');
      expect(bubbles.length).toBe(1); // Only the user message bubble
    });

    it('transforms the optimistic placeholder into a retryable error message on failure (#23)', async () => {
      const user = userEvent.setup();
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);
      vi.spyOn(chatApi, 'sendChatMessage').mockRejectedValueOnce(new Error('Network error: connection refused'));

      render(<ChatWorkspace conversationId="conv-1" />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Check server status{enter}');

      // Initially shows optimistic placeholder
      expect(screen.getByText('Check server status')).toBeInTheDocument();

      // Transforms into error message
      expect(await screen.findByText(/Error: Network error: connection refused/)).toBeInTheDocument();
      expect(screen.queryByTestId('optimistic-assistant-placeholder')).not.toBeInTheDocument();

      // Offers Retry button
      const retryBtn = screen.getByRole('button', { name: /retry turn/i });
      expect(retryBtn).toBeInTheDocument();

      // Clicking Retry resubmits and brings back the optimistic placeholder
      let resolveRetry!: (value: chatApi.ChatResponse) => void;
      const retryPromise = new Promise<chatApi.ChatResponse>((resolve) => {
        resolveRetry = resolve;
      });
      vi.spyOn(chatApi, 'sendChatMessage').mockReturnValueOnce(retryPromise);

      await user.click(retryBtn);

      // Placeholder is restored during retry
      expect(screen.getByTestId('optimistic-assistant-placeholder')).toBeInTheDocument();

      act(() => {
        resolveRetry({
          reply: 'Server is healthy.',
          conversation_id: 'conv-1',
          user_message_id: 'u-retry',
          assistant_message_id: 'a-retry',
          needs_clarification: false,
          quota_exceeded: false,
        });
      });

      expect(await screen.findByText('Server is healthy.')).toBeInTheDocument();
      expect(screen.queryByTestId('optimistic-assistant-placeholder')).not.toBeInTheDocument();
    });

    it('scrolls viewport smoothly when optimistic placeholder is appended (#23)', async () => {
      const user = userEvent.setup();
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);
      vi.spyOn(chatApi, 'sendChatMessage').mockReturnValueOnce(new Promise(() => {}));

      const scrollIntoViewMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      render(<ChatWorkspace conversationId="conv-1" />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Smooth scroll test{enter}');

      expect(screen.getByTestId('optimistic-assistant-placeholder')).toBeInTheDocument();
      expect(scrollIntoViewMock).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    });
  });

  describe('Ticket 22 (#31): Instant Bottom Anchor on Conversation Load Without Initial Scroll Animation', () => {
    it('applies instant scroll positioning rather than smooth scroll on initial conversation history load (#31)', async () => {
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
      const scrollIntoViewMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      render(<ChatWorkspace conversationId="conv-1" />);

      expect(await screen.findByText('What is Hepozy?')).toBeInTheDocument();
      expect(screen.getByText('Hepozy is an AI workspace assistant.')).toBeInTheDocument();

      // Initial history load must anchor instantly, NOT with smooth scrolling
      expect(scrollIntoViewMock).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: 'instant' })
      );
      expect(scrollIntoViewMock).not.toHaveBeenCalledWith(
        expect.objectContaining({ behavior: 'smooth' })
      );
    });

    it('switching between conversations in sidebar instantly positions viewport at latest message without smooth scroll (#31)', async () => {
      const conv1History: chatApi.ChatMessageItem[] = [
        { id: 'c1-1', role: 'user', content: 'Conversation 1 Question', created_at: '2026-10-14T10:00:00Z' },
        { id: 'c1-2', role: 'assistant', content: 'Conversation 1 Answer', created_at: '2026-10-14T10:00:05Z' },
      ];
      const conv2History: chatApi.ChatMessageItem[] = [
        { id: 'c2-1', role: 'user', content: 'Conversation 2 Question', created_at: '2026-10-14T11:00:00Z' },
        { id: 'c2-2', role: 'assistant', content: 'Conversation 2 Answer', created_at: '2026-10-14T11:00:05Z' },
      ];

      const getHistorySpy = vi.spyOn(chatApi, 'getChatHistory');
      getHistorySpy.mockResolvedValueOnce(conv1History);

      const scrollIntoViewMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      const { rerender } = render(<ChatWorkspace conversationId="conv-1" />);

      expect(await screen.findByText('Conversation 1 Answer')).toBeInTheDocument();
      expect(scrollIntoViewMock).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'instant' }));

      // Clear calls before switching
      scrollIntoViewMock.mockClear();
      getHistorySpy.mockResolvedValueOnce(conv2History);

      // User switches to conv-2 in sidebar
      rerender(<ChatWorkspace conversationId="conv-2" />);

      expect(await screen.findByText('Conversation 2 Answer')).toBeInTheDocument();

      // Switched conversation must anchor instantly, NOT with smooth scroll
      expect(scrollIntoViewMock).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'instant' }));
      expect(scrollIntoViewMock).not.toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    });

    it('subsequent user message submission after initial anchor uses smooth scrolling (#31)', async () => {
      const user = userEvent.setup();
      const mockHistory: chatApi.ChatMessageItem[] = [
        { id: 'msg-1', role: 'user', content: 'Prior question', created_at: '2026-10-14T10:00:00Z' },
        { id: 'msg-2', role: 'assistant', content: 'Prior answer', created_at: '2026-10-14T10:00:05Z' },
      ];

      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce(mockHistory);
      vi.spyOn(chatApi, 'sendChatMessage').mockReturnValueOnce(new Promise(() => {}));

      const scrollIntoViewMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      render(<ChatWorkspace conversationId="conv-1" />);

      expect(await screen.findByText('Prior answer')).toBeInTheDocument();
      expect(scrollIntoViewMock).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'instant' }));

      scrollIntoViewMock.mockClear();

      // User submits a new message in the loaded conversation
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Follow-up question{enter}');

      expect(screen.getByText('Follow-up question')).toBeInTheDocument();

      // Real-time user message interaction must use smooth scroll
      expect(scrollIntoViewMock).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
      expect(scrollIntoViewMock).not.toHaveBeenCalledWith(expect.objectContaining({ behavior: 'instant' }));
    });

    it('synchronously sets viewport scrollTop to scrollHeight on initial load (#31)', async () => {
      const mockHistory: chatApi.ChatMessageItem[] = [
        { id: 'msg-1', role: 'user', content: 'First message', created_at: '2026-10-14T10:00:00Z' },
        { id: 'msg-2', role: 'assistant', content: 'Second message', created_at: '2026-10-14T10:00:05Z' },
      ];

      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce(mockHistory);

      let scrollTopAssignedValue: number | null = null;
      Object.defineProperty(HTMLDivElement.prototype, 'scrollHeight', {
        configurable: true,
        get() {
          return 1450;
        },
      });
      const originalScrollTopDescriptor = Object.getOwnPropertyDescriptor(
        Element.prototype,
        'scrollTop'
      );
      Object.defineProperty(HTMLDivElement.prototype, 'scrollTop', {
        configurable: true,
        set(val) {
          scrollTopAssignedValue = val;
        },
        get() {
          return scrollTopAssignedValue ?? 0;
        },
      });

      try {
        render(<ChatWorkspace conversationId="conv-1" />);

        expect(await screen.findByText('Second message')).toBeInTheDocument();
        expect(scrollTopAssignedValue).toBe(1450);
      } finally {
        delete (HTMLDivElement.prototype as unknown as { scrollHeight?: number }).scrollHeight;
        if (originalScrollTopDescriptor) {
          Object.defineProperty(Element.prototype, 'scrollTop', originalScrollTopDescriptor);
        }
      }
    });
  });

  describe('Ticket 19 (#28): Conversation-Scoped Generation State & Independent Chat Input Switching', () => {
    it('moving to a different conversation while an inquiry is generating restores the new conversation chat input to an enabled interactive state with Send button', async () => {
      const user = userEvent.setup();
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValue([]);

      let resolveConv1!: (val: chatApi.ChatResponse) => void;
      const conv1Promise = new Promise<chatApi.ChatResponse>((res) => {
        resolveConv1 = res;
      });
      vi.spyOn(chatApi, 'sendChatMessage').mockReturnValueOnce(conv1Promise);

      const { rerender } = render(<ChatWorkspace conversationId="conv-1" />);

      // Submit message in conv-1 to start generation
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Long query in conv-1{enter}');

      // In conv-1, Stop button is shown and input is disabled
      expect(screen.getByRole('button', { name: /stop generation/i })).toBeInTheDocument();
      expect(textarea).toBeDisabled();

      // Switch to conv-2
      rerender(<ChatWorkspace conversationId="conv-2" />);

      // In conv-2, input is enabled and interactive, and Send button is rendered
      const conv2Textarea = await screen.findByRole('textbox');
      expect(conv2Textarea).toBeEnabled();
      expect(screen.queryByRole('button', { name: /stop generation/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();

      // User can type in conv-2
      await user.type(conv2Textarea, 'Query in conv-2');
      expect(conv2Textarea).toHaveValue('Query in conv-2');

      // Cleanup
      act(() => {
        resolveConv1({
          reply: 'Answer 1',
          conversation_id: 'conv-1',
          assistant_message_id: 'a-1',
          needs_clarification: false,
          quota_exceeded: false,
        });
      });
    });

    it('returning to the generating conversation restores the active generating state, optimistic stream indicator, and stop control', async () => {
      const user = userEvent.setup();
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValue([]);

      let resolveConvA!: (val: chatApi.ChatResponse) => void;
      const convAPromise = new Promise<chatApi.ChatResponse>((res) => {
        resolveConvA = res;
      });
      vi.spyOn(chatApi, 'sendChatMessage').mockReturnValueOnce(convAPromise);

      const { rerender } = render(<ChatWorkspace conversationId="conv-A" />);

      // Start generation in conv-A
      const textareaA = screen.getByRole('textbox');
      await user.type(textareaA, 'Generate essay in A{enter}');

      expect(screen.getByTestId('optimistic-assistant-placeholder')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /stop generation/i })).toBeInTheDocument();

      // Temporarily switch to conv-B
      rerender(<ChatWorkspace conversationId="conv-B" />);
      expect(screen.queryByTestId('optimistic-assistant-placeholder')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();

      // Return to conv-A while generation is still in progress
      rerender(<ChatWorkspace conversationId="conv-A" />);

      // Restores active generating state, optimistic stream indicator, and Stop button
      expect(screen.getByTestId('optimistic-assistant-placeholder')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /stop generation/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeDisabled();

      // Resolve generation
      act(() => {
        resolveConvA({
          reply: 'Finished essay in A',
          conversation_id: 'conv-A',
          assistant_message_id: 'a-finished',
          needs_clarification: false,
          quota_exceeded: false,
        });
      });

      // Transitions placeholder into finished assistant response
      expect(await screen.findByText(/Finished essay in A/)).toBeInTheDocument();
      expect(screen.queryByTestId('optimistic-assistant-placeholder')).not.toBeInTheDocument();
    });

    it('background generation in Conversation A completes and displays assistant message when returning to Conversation A', async () => {
      const user = userEvent.setup();
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValue([]);

      let resolveConvX!: (val: chatApi.ChatResponse) => void;
      const convXPromise = new Promise<chatApi.ChatResponse>((res) => {
        resolveConvX = res;
      });
      vi.spyOn(chatApi, 'sendChatMessage').mockReturnValueOnce(convXPromise);

      const { rerender } = render(<ChatWorkspace conversationId="conv-X" />);

      // Start generation in conv-X
      const textareaX = screen.getByRole('textbox');
      await user.type(textareaX, 'Background analysis{enter}');
      expect(screen.getByTestId('optimistic-assistant-placeholder')).toBeInTheDocument();

      // Switch away to conv-Y
      rerender(<ChatWorkspace conversationId="conv-Y" />);
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();

      // Generation for conv-X completes in background while user views conv-Y
      act(() => {
        resolveConvX({
          reply: 'Background analysis completed successfully.',
          conversation_id: 'conv-X',
          assistant_message_id: 'a-bg-done',
          needs_clarification: false,
          quota_exceeded: false,
        });
      });

      // Return to conv-X
      rerender(<ChatWorkspace conversationId="conv-X" />);

      // Completed assistant message is seamlessly displayed and input is enabled
      expect(await screen.findByText('Background analysis completed successfully.')).toBeInTheDocument();
      expect(screen.queryByTestId('optimistic-assistant-placeholder')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeEnabled();
    });

    it('aborting generation in one conversation cleans up without affecting another conversation', async () => {
      const user = userEvent.setup();
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValue([]);
      const stopSpy = vi.spyOn(chatApi, 'stopChat').mockResolvedValue({ status: 'stopped' });

      // conv-1 hangs until aborted
      vi.spyOn(chatApi, 'sendChatMessage').mockImplementationOnce(
        (_params, signal) =>
          new Promise((_, reject) => {
            signal?.addEventListener('abort', () => {
              const err = new Error('Aborted');
              err.name = 'AbortError';
              reject(err);
            });
          })
      );

      const { rerender } = render(<ChatWorkspace conversationId="conv-1" />);

      // Submit in conv-1
      await user.type(screen.getByRole('textbox'), 'Start conv 1{enter}');
      expect(screen.getByRole('button', { name: /stop generation/i })).toBeInTheDocument();

      // Click Stop in conv-1
      const stopButton = screen.getByRole('button', { name: /stop generation/i });
      await user.click(stopButton);

      expect(stopSpy).toHaveBeenCalledWith(
        expect.objectContaining({ conversation_id: 'conv-1' })
      );

      // conv-1 placeholder removed and controls restored
      expect(screen.queryByTestId('optimistic-assistant-placeholder')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeEnabled();

      // Switch to conv-2
      rerender(<ChatWorkspace conversationId="conv-2" />);
      expect(screen.getByRole('textbox')).toBeEnabled();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });
  });

  describe('Ticket 20 (#29): Message Stream Skeleton Placeholders for Conversation History Loading', () => {
    it('renders structured skeleton placeholder rows instead of generic spinner while loading history', async () => {
      let resolveHistory!: (value: chatApi.ChatMessageItem[]) => void;
      const historyPromise = new Promise<chatApi.ChatMessageItem[]>((resolve) => {
        resolveHistory = resolve;
      });
      vi.spyOn(chatApi, 'getChatHistory').mockReturnValueOnce(historyPromise);

      render(<ChatWorkspace conversationId="conv-history-load" />);

      // The structured skeleton placeholder is rendered
      const skeleton = await screen.findByTestId('message-stream-skeleton');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute('role', 'status');
      expect(skeleton).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText('Loading conversation history...')).toBeInTheDocument();

      // Alternating user and assistant skeleton rows are rendered
      expect(screen.getAllByTestId('user-message-skeleton').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByTestId('assistant-message-skeleton').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByTestId('skeleton-avatar').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByTestId('skeleton-shimmer-bar').length).toBeGreaterThanOrEqual(4);

      // Generic spinner is eliminated
      expect(screen.queryByText('Loading messages...')).not.toBeInTheDocument();

      // When history resolves, skeletons are replaced by actual messages
      await act(async () => {
        resolveHistory([
          {
            id: 'm-loaded-1',
            role: 'user',
            content: 'Hello history',
            created_at: '2026-10-18T10:00:00Z',
          },
          {
            id: 'm-loaded-2',
            role: 'assistant',
            content: 'Loaded response content',
            created_at: '2026-10-18T10:00:05Z',
          },
        ]);
      });

      expect(await screen.findByText('Hello history')).toBeInTheDocument();
      expect(screen.getByText('Loaded response content')).toBeInTheDocument();
      expect(screen.queryByTestId('message-stream-skeleton')).not.toBeInTheDocument();
    });

    it('ensures message stream container maintains centered layout bounds during loading', async () => {
      vi.spyOn(chatApi, 'getChatHistory').mockImplementationOnce(
        () => new Promise(() => {}) // pending forever
      );

      render(<ChatWorkspace conversationId="conv-layout-check" />);

      const skeleton = await screen.findByTestId('message-stream-skeleton');
      const container = screen.getByTestId('message-stream-container');

      expect(container).toHaveClass('max-w-4xl');
      expect(container).toContainElement(skeleton);
    });
  });

  describe('Ticket 23: Base UI MessageScroller Adoption & Intelligent Detachment', () => {
    it('detaches auto-scroll when user scrolls up during generation, showing floating Scroll to bottom button and re-anchoring on click', async () => {
      const user = userEvent.setup();
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);

      let resolveChat!: (value: chatApi.ChatResponse) => void;
      const sendPromise = new Promise<chatApi.ChatResponse>((resolve) => {
        resolveChat = resolve;
      });
      vi.spyOn(chatApi, 'sendChatMessage').mockReturnValueOnce(sendPromise);

      const scrollIntoViewMock = vi.fn();
      window.HTMLElement.prototype.scrollIntoView =
        scrollIntoViewMock as unknown as typeof window.HTMLElement.prototype.scrollIntoView;

      render(<ChatWorkspace conversationId="conv-detach" />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Long running streaming task{enter}');

      expect(screen.getByTestId('optimistic-assistant-placeholder')).toBeInTheDocument();

      const viewport = screen.getByTestId('message-stream-scroll-viewport');

      // Before user scrolls up, button is not visible
      expect(screen.queryByTestId('scroll-to-bottom-button')).not.toBeInTheDocument();

      // Simulate user scrolling up
      Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1200 });
      Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 400 });
      Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 200, writable: true });

      act(() => {
        fireEvent.scroll(viewport);
      });

      // Floating "Scroll to bottom" button appears
      const scrollToBottomBtn = await screen.findByTestId('scroll-to-bottom-button');
      expect(scrollToBottomBtn).toBeInTheDocument();
      expect(scrollToBottomBtn).toHaveAttribute('aria-label', 'Scroll to bottom');

      scrollIntoViewMock.mockClear();

      // Click "Scroll to bottom" button
      await user.click(scrollToBottomBtn);

      // Smooth scroll is triggered to re-anchor
      expect(scrollIntoViewMock).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: 'smooth' })
      );

      // Button disappears
      expect(screen.queryByTestId('scroll-to-bottom-button')).not.toBeInTheDocument();

      // Resolve generation
      act(() => {
        resolveChat({
          reply: 'Completed response.',
          conversation_id: 'conv-detach',
          user_message_id: 'u-done',
          assistant_message_id: 'a-done',
          needs_clarification: false,
          quota_exceeded: false,
        });
      });

      expect(await screen.findByText('Completed response.')).toBeInTheDocument();
    });
  });

  describe('Ticket 24 (#32): Uniform Max-Width Constraint & Column Alignment for Chat Workspace', () => {
    it('enforces identical max-width constraints (max-w-4xl) and mx-auto centering across message stream and bottom input bounds', async () => {
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);

      render(<ChatWorkspace conversationId="conv-width-check" />);

      const messageStreamContainer = screen.getByTestId('message-stream-container');
      const inputBounds = screen.getByTestId('chat-input-bounds');

      expect(messageStreamContainer).toHaveClass('mx-auto', 'max-w-4xl', 'w-full');
      expect(inputBounds).toHaveClass('mx-auto', 'max-w-4xl', 'w-full');
    });

    it('ensures message stream skeleton matches the exact max-w-4xl bounds during history load', async () => {
      vi.spyOn(chatApi, 'getChatHistory').mockImplementationOnce(() => new Promise(() => {}));

      render(<ChatWorkspace conversationId="conv-skeleton-width" />);

      const skeleton = await screen.findByTestId('message-stream-skeleton');
      expect(skeleton).toHaveClass('mx-auto', 'max-w-4xl', 'w-full');
    });

    it('anchors floating scroll button inside a centered max-w-4xl column container when detached', async () => {
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([
        {
          id: 'msg-1',
          role: 'user',
          content: 'Detachment position check',
          created_at: '2026-10-14T10:00:00Z',
        },
      ]);

      render(<ChatWorkspace conversationId="conv-scroller-alignment" />);

      expect(await screen.findByText('Detachment position check')).toBeInTheDocument();

      const viewport = screen.getByTestId('message-stream-scroll-viewport');

      // Scroll up to detach
      Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1200 });
      Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 400 });
      Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 200, writable: true });

      act(() => {
        fireEvent.scroll(viewport);
      });

      const container = await screen.findByTestId('scroll-to-bottom-container');
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass('pointer-events-none', 'absolute', 'inset-x-0', 'bottom-4', 'px-4', 'sm:px-6');

      const innerColumn = container.firstElementChild as HTMLElement;
      expect(innerColumn).toBeInTheDocument();
      expect(innerColumn).toHaveClass('mx-auto', 'max-w-4xl', 'w-full', 'justify-end');

      const button = screen.getByTestId('scroll-to-bottom-button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('pointer-events-auto');
    });

    it('verifies layout stability and proper rendering of empty state and message items within the unified width', async () => {
      // 1. Empty state
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([]);

      const { unmount } = render(<ChatWorkspace conversationId="conv-empty-state-width" />);

      const emptyCard = await screen.findByTestId('empty-conversation-card');
      const emptyStreamContainer = screen.getByTestId('message-stream-container');
      expect(emptyStreamContainer).toContainElement(emptyCard);
      expect(emptyStreamContainer).toHaveClass('mx-auto', 'max-w-4xl', 'w-full');

      unmount();

      // 2. Populated message items
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([
        {
          id: 'msg-u-1',
          role: 'user',
          content: 'Hello message item width test',
          created_at: '2026-10-14T10:00:00Z',
        },
        {
          id: 'msg-a-1',
          role: 'assistant',
          content: 'Assistant response within unified width bounds',
          created_at: '2026-10-14T10:00:05Z',
        },
      ]);

      render(<ChatWorkspace conversationId="conv-populated-width" />);

      expect(await screen.findByText('Hello message item width test')).toBeInTheDocument();
      expect(await screen.findByText('Assistant response within unified width bounds')).toBeInTheDocument();

      const populatedStreamContainer = screen.getByTestId('message-stream-container');
      const bubbles = screen.getAllByTestId('message-bubble');
      expect(bubbles).toHaveLength(2);
      expect(populatedStreamContainer).toContainElement(bubbles[0]);
      expect(populatedStreamContainer).toContainElement(bubbles[1]);
      expect(populatedStreamContainer).toHaveClass('mx-auto', 'max-w-4xl', 'w-full');
    });

    it('prevents column width blowout on messages containing files, wide tables, and code blocks with minWidth: 0 override', async () => {
      vi.spyOn(chatApi, 'getChatHistory').mockResolvedValueOnce([
        {
          id: 'msg-u-wide',
          role: 'user',
          content: 'Process document and output wide table',
          created_at: '2026-10-14T10:00:00Z',
          attachments: [
            {
              name: 'huge-data-sheet-presentation-analysis.xlsx',
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              url: 'https://example.com/huge-data-sheet-presentation-analysis.xlsx',
            },
          ],
        },
        {
          id: 'msg-a-wide',
          role: 'assistant',
          content: `Here is the comprehensive report:\n\n| Column 1 With Extremely Long Text Header | Column 2 Description of Data | Column 3 Values | Column 4 Additional Notes |\n|---|---|---|---|\n| Very long text item that would normally blow out table widths | Data row description | 1000 | Extra notes spanning widely |\n\n\`\`\`typescript\nconst extremelyLongCodeSnippetLineThatWouldSpanAcrossTheEntireScreenWithoutWrappingOrScrolling = { field: 'value' };\n\`\`\``,
          created_at: '2026-10-14T10:00:05Z',
          download_url: '/files/Processed-Report.xlsx',
          file_name: 'Processed-Report.xlsx',
        },
      ]);

      render(<ChatWorkspace conversationId="conv-wide-content" />);

      expect(await screen.findByText(/Process document and output wide table/)).toBeInTheDocument();
      expect(await screen.findByTestId('generated-document-card')).toBeInTheDocument();
      expect(await screen.findByTestId('table-block')).toBeInTheDocument();
      expect(await screen.findByTestId('code-block')).toBeInTheDocument();

      const messageStreamContainer = screen.getByTestId('message-stream-container');
      expect(messageStreamContainer).toHaveClass('mx-auto', 'max-w-4xl', 'w-full', 'min-w-0');
      expect(messageStreamContainer).toHaveStyle({ minWidth: '0px' });

      const inputBounds = screen.getByTestId('chat-input-bounds');
      expect(inputBounds).toHaveClass('mx-auto', 'max-w-4xl', 'w-full');
    });
  });
});




