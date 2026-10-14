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

  it('renders rich markdown with code fences, syntax highlighting and table inside assistant response', () => {
    const markdownMsg: ChatMessageItem = {
      id: 'msg-rich',
      role: 'assistant',
      content: '### Summary\n\n| Item | Val |\n| :--- | :--- |\n| A | 10 |\n\n```python\nprint("hello")\n```',
      created_at: '2026-10-14T10:00:00Z',
    };

    render(<MessageItem message={markdownMsg} animateTypewriter={false} />);

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Summary');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Item')).toBeInTheDocument();
    expect(screen.getByText('Val')).toBeInTheDocument();
    expect(screen.getByText('python')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument();
  });

  it('renders prominent generated document card when message contains valid download_url and file_name', () => {
    const docMsg: ChatMessageItem = {
      id: 'msg-doc',
      role: 'assistant',
      content: 'Here is your generated document report.',
      created_at: '2026-10-14T10:00:00Z',
      download_url: '/files/Analysis-Report-abc123.docx',
      file_name: 'Analysis-Report.docx',
    };

    render(<MessageItem message={docMsg} animateTypewriter={false} />);

    expect(screen.getByTestId('generated-document-card')).toBeInTheDocument();
    expect(screen.getByText('Analysis-Report.docx')).toBeInTheDocument();
    expect(screen.getByText('DOCX')).toBeInTheDocument();
    expect(screen.getByText('Generated Document')).toBeInTheDocument();

    const downloadLink = screen.getByRole('link', { name: /download/i });
    expect(downloadLink).toHaveAttribute('href', '/files/Analysis-Report-abc123.docx');
    expect(downloadLink).toHaveAttribute('target', '_blank');
  });

  it('does NOT render document card if file_name is missing or invalid format', () => {
    const invalidMsg: ChatMessageItem = {
      id: 'msg-invalid',
      role: 'assistant',
      content: 'Plain response without valid document.',
      created_at: '2026-10-14T10:00:00Z',
      download_url: '/files/unknown-file.exe',
      file_name: 'unknown-file.exe',
    };

    render(<MessageItem message={invalidMsg} animateTypewriter={false} />);
    expect(screen.queryByTestId('generated-document-card')).not.toBeInTheDocument();
  });

  it('renders image attachments as rounded thumbnails in user message bubble history', () => {
    const userMsgWithImages: ChatMessageItem = {
      id: 'msg-img',
      role: 'user',
      content: 'Look at these design screenshots',
      created_at: '2026-10-14T10:00:00Z',
      attachments: [
        {
          name: 'mockup.png',
          type: 'image/png',
          url: 'https://example.com/mockup.png',
        },
      ],
    };

    render(<MessageItem message={userMsgWithImages} />);

    const imgAttachment = screen.getByTestId('image-attachment');
    expect(imgAttachment).toBeInTheDocument();

    const img = screen.getByAltText('mockup.png');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/mockup.png');
    expect(screen.getByText('Look at these design screenshots')).toBeInTheDocument();
  });

  it('renders document attachments with file icons and filenames in message bubbles', () => {
    const userMsgWithDocs: ChatMessageItem = {
      id: 'msg-doc-user',
      role: 'user',
      content: 'Here is the data export for review',
      created_at: '2026-10-14T10:00:00Z',
      attachments: [
        {
          name: 'dataset.csv',
          type: 'text/csv',
          url: 'https://example.com/dataset.csv',
        },
        {
          name: 'summary.pdf',
          type: 'application/pdf',
        },
      ],
    };

    render(<MessageItem message={userMsgWithDocs} />);

    const docAttachments = screen.getAllByTestId('document-attachment');
    expect(docAttachments.length).toBe(2);

    expect(screen.getByText('dataset.csv')).toBeInTheDocument();
    expect(screen.getByText('summary.pdf')).toBeInTheDocument();
    expect(screen.getByText('Here is the data export for review')).toBeInTheDocument();
  });
});

