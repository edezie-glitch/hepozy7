import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageItem } from '@/components/chat/message-item';
import { useChatStore } from '@/stores/use-chat-store';
import type { ChatMessageItem } from '@/lib/api/chat';

describe('MessageItem Component', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    useChatStore.setState({
      editingMessageId: null,
      replyingTo: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders user message with content, timestamp, and reply quote if present', () => {
    const userMsg: ChatMessageItem = {
      id: 'msg-u1',
      role: 'user',
      content: 'Can you summarize this report?',
      created_at: '2026-10-14T10:00:00Z',
      reply_to: 'Previous assistant context quote',
    };

    render(<MessageItem message={userMsg} />);

    expect(screen.getByText('Can you summarize this report?')).toBeInTheDocument();
    expect(screen.getByText(/Previous assistant context quote/)).toBeInTheDocument();
  });

  it('renders assistant message with typewriter animation and allows fast-forward/skip on click', () => {
    const assistantMsg: ChatMessageItem = {
      id: 'msg-a1',
      role: 'assistant',
      content: 'Hepozy is an intelligent AI workspace assistant.',
      created_at: '2026-10-14T10:00:05Z',
    };

    const handleComplete = vi.fn();

    render(
      <MessageItem
        message={assistantMsg}
        animateTypewriter={true}
        onTypewriterComplete={handleComplete}
      />
    );

    const bubble = screen.getByTestId('message-bubble');

    // Initially, only a partial slice is shown
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(bubble.textContent?.length).toBeLessThan(assistantMsg.content.length);

    // Clicking the bubble fast-forwards/skips to full text
    act(() => {
      bubble.click();
    });

    expect(bubble).toHaveTextContent('Hepozy is an intelligent AI workspace assistant.');
    expect(handleComplete).toHaveBeenCalled();
  });

  it('copies message text to clipboard when clicking Copy', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const msg: ChatMessageItem = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Here is some code to copy',
      created_at: '2026-10-14T10:00:00Z',
    };

    render(<MessageItem message={msg} animateTypewriter={false} />);

    const copyBtn = screen.getByRole('button', { name: /copy message/i });
    await user.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith('Here is some code to copy');
  });

  it('quotes previous message into input bar when clicking Reply on assistant message', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();

    const assistantMsg: ChatMessageItem = {
      id: 'msg-a1',
      role: 'assistant',
      content: 'This is the assistant insight to quote.',
      created_at: '2026-10-14T10:00:00Z',
    };

    render(<MessageItem message={assistantMsg} animateTypewriter={false} />);

    const replyBtn = screen.getByRole('button', { name: /reply to message/i });
    await user.click(replyBtn);

    expect(useChatStore.getState().replyingTo).toEqual({
      text: 'This is the assistant insight to quote.',
      messageId: 'msg-a1',
    });
  });

  it('allows user to edit a sent message inline and re-run the turn', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const handleEditSubmit = vi.fn();

    const userMsg: ChatMessageItem = {
      id: 'msg-u1',
      role: 'user',
      content: 'Original user question',
      created_at: '2026-10-14T10:00:00Z',
    };

    render(<MessageItem message={userMsg} onEditSubmit={handleEditSubmit} />);

    const editBtn = screen.getByRole('button', { name: /edit message/i });
    await user.click(editBtn);

    const editTextarea = screen.getByTestId('inline-edit-textarea');
    expect(editTextarea).toHaveValue('Original user question');

    await user.clear(editTextarea);
    await user.type(editTextarea, 'Updated revised prompt');

    const saveBtn = screen.getByRole('button', { name: /save & submit/i });
    await user.click(saveBtn);

    expect(handleEditSubmit).toHaveBeenCalledWith('msg-u1', 'Updated revised prompt');
  });

  it('allows user to click Retry on assistant turn to re-submit turn', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const handleRetry = vi.fn();

    const assistantMsg: ChatMessageItem = {
      id: 'msg-a1',
      role: 'assistant',
      content: 'Generated answer that user wants to retry.',
      created_at: '2026-10-14T10:00:00Z',
    };

    render(
      <MessageItem
        message={assistantMsg}
        animateTypewriter={false}
        onRetry={handleRetry}
      />
    );

    const retryBtn = screen.getByRole('button', { name: /retry turn/i });
    await user.click(retryBtn);

    expect(handleRetry).toHaveBeenCalledWith('msg-a1');
  });
});
