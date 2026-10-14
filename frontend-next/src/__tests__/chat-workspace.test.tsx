import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
      stagedAttachments: [],
      attachmentError: null,
      clarificationPrompt: null,
      quotaExceeded: null,
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
      await screen.findByText(/TypeScript adds static type definitions/, {}, { timeout: 4000 })
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
    expect(await screen.findByText('Here is your drafted employment agreement template.')).toBeInTheDocument();
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
});


