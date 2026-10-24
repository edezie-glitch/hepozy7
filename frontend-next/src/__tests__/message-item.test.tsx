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

  it('renders assistant message with borderless clean layout directly on canvas (no bg-card, no border, no rounded-2xl, no shadow-xs)', () => {
    const assistantMsg: ChatMessageItem = {
      id: 'msg-asst-borderless',
      role: 'assistant',
      content: 'Assistant response rendering borderless on canvas.',
      created_at: '2026-10-14T10:00:00Z',
    };

    render(<MessageItem message={assistantMsg} animateTypewriter={false} />);

    const bubble = screen.getByTestId('message-bubble');

    // Verify borderless layout without card background, rounded container, or box shadow
    expect(bubble.className).not.toContain('bg-card');
    expect(bubble.className).not.toContain('border');
    expect(bubble.className).not.toContain('rounded-2xl');
    expect(bubble.className).not.toContain('shadow-xs');

    // Verify native typography text-foreground
    expect(bubble.className).toContain('text-foreground');
  });

  it('retains distinct bubble styling for user messages (bg-secondary, border, rounded-2xl, shadow-xs)', () => {
    const userMsg: ChatMessageItem = {
      id: 'msg-user-bubble',
      role: 'user',
      content: 'User message retaining bubble styling.',
      created_at: '2026-10-14T10:00:00Z',
    };

    render(<MessageItem message={userMsg} />);

    const bubble = screen.getByTestId('message-bubble');

    // Verify user bubble retains distinct bubble styling
    expect(bubble.className).toContain('bg-secondary');
    expect(bubble.className).toContain('text-secondary-foreground');
    expect(bubble.className).toContain('border');
    expect(bubble.className).toContain('rounded-2xl');
    expect(bubble.className).toContain('shadow-xs');
  });

  it('renders accessible hover and focus action toolbar with Copy, Retry, and Reply beneath assistant message', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const assistantMsg: ChatMessageItem = {
      id: 'msg-asst-toolbar',
      role: 'assistant',
      content: 'Assistant response with toolbar.',
      created_at: '2026-10-14T10:00:00Z',
    };

    const handleRetry = vi.fn();

    render(
      <MessageItem
        message={assistantMsg}
        animateTypewriter={false}
        onRetry={handleRetry}
      />
    );

    const copyBtn = screen.getByRole('button', { name: /copy message/i });
    const replyBtn = screen.getByRole('button', { name: /reply to message/i });
    const retryBtn = screen.getByRole('button', { name: /retry turn/i });

    expect(copyBtn).toBeInTheDocument();
    expect(replyBtn).toBeInTheDocument();
    expect(retryBtn).toBeInTheDocument();

    // Verify focus accessibility classes
    const toolbar = copyBtn.closest('div');
    expect(toolbar?.className).toContain('focus-within:opacity-100');

    // Verify actual keyboard tab focus progression through toolbar
    await user.tab();
    expect(copyBtn).toHaveFocus();

    await user.tab();
    expect(replyBtn).toHaveFocus();

    await user.tab();
    expect(retryBtn).toHaveFocus();
  });

  it('renders markdown elements and generated document card cleanly within the borderless assistant flow without clipping', () => {
    const richAssistantMsg: ChatMessageItem = {
      id: 'msg-asst-rich-flow',
      role: 'assistant',
      content: '## Overview\n\n| Feature | Status |\n| :--- | :--- |\n| Layout | Borderless |\n\n```json\n{"status": "ok"}\n```',
      created_at: '2026-10-14T10:00:00Z',
      download_url: '/files/Report.docx',
      file_name: 'Report.docx',
      reply_to: 'User query about borderless assistant layout',
    };

    render(<MessageItem message={richAssistantMsg} animateTypewriter={false} />);

    // Verify quote preview
    expect(screen.getByText(/User query about borderless assistant layout/)).toBeInTheDocument();

    // Verify markdown heading, table, codeblock
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Overview');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Borderless')).toBeInTheDocument();
    expect(screen.getByText('json')).toBeInTheDocument();

    // Verify generated document card is rendered
    expect(screen.getByTestId('generated-document-card')).toBeInTheDocument();
    expect(screen.getByText('Report.docx')).toBeInTheDocument();

    // Verify bubble is borderless
    const bubble = screen.getByTestId('message-bubble');
    expect(bubble.className).not.toContain('bg-card');
    expect(bubble.className).not.toContain('border');
  });

  it('renders optimistic assistant placeholder with animated typing/shimmer indicator when is_pending is true', () => {
    const pendingMsg: ChatMessageItem = {
      id: 'asst-opt-1',
      role: 'assistant',
      content: '',
      created_at: '2026-10-18T10:00:00Z',
      is_pending: true,
    };

    render(<MessageItem message={pendingMsg} />);

    // Renders placeholder container with status/busy accessibility attributes
    const placeholder = screen.getByTestId('optimistic-assistant-placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveAttribute('role', 'status');
    expect(placeholder).toHaveAttribute('aria-busy', 'true');

    // Renders shimmer typing indicator
    const shimmer = screen.getByTestId('typing-shimmer-indicator');
    expect(shimmer).toBeInTheDocument();

    // Action buttons (copy, reply, retry, edit) should not be shown while pending
    expect(screen.queryByRole('button', { name: /copy message/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reply to message/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry turn/i })).not.toBeInTheDocument();
  });

  describe('Ticket 25: Animated Bot Avatar on Loading State Only & Desktop Offset', () => {
    it('does NOT render assistant bot avatar on completed reply turns', () => {
      const replyMsg: ChatMessageItem = {
        id: 'msg-reply-no-avatar',
        role: 'assistant',
        content: 'I am your assistant reply without an avatar logo.',
        created_at: '2026-10-18T10:00:00Z',
      };

      render(<MessageItem message={replyMsg} animateTypewriter={false} />);

      expect(screen.queryByTestId('assistant-avatar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('assistant-avatar-video')).not.toBeInTheDocument();
    });

    it('renders animated video avatar with 123.mp4 and poster fallback on assistant loading state (is_pending)', () => {
      const pendingMsg: ChatMessageItem = {
        id: 'msg-video-avatar-pending',
        role: 'assistant',
        content: '',
        created_at: '2026-10-18T10:00:00Z',
        is_pending: true,
      };

      render(<MessageItem message={pendingMsg} animateTypewriter={false} />);

      const avatar = screen.getByTestId('assistant-avatar');
      expect(avatar).toBeInTheDocument();

      const video = screen.getByTestId('assistant-avatar-video');
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute('src', '/123.mp4');
      expect(video).toHaveAttribute('poster', '/hepozy.jpg');
      expect(video).toHaveAttribute('autoplay');
      expect(video).toHaveAttribute('loop');
      expect(video).toHaveAttribute('playsinline');

      const fallbackImg = video.querySelector('img');
      expect(fallbackImg).toBeInTheDocument();
      expect(fallbackImg).toHaveAttribute('src', '/hepozy.jpg');
    });

    it('positions assistant avatar outside content column on desktop viewports and keeps mobile inline during loading state', () => {
      const pendingMsg: ChatMessageItem = {
        id: 'msg-avatar-offset-pending',
        role: 'assistant',
        content: '',
        created_at: '2026-10-18T10:00:00Z',
        is_pending: true,
      };

      render(<MessageItem message={pendingMsg} animateTypewriter={false} />);

      const avatar = screen.getByTestId('assistant-avatar');
      expect(avatar.className).toMatch(/sm:absolute|sm:-ml-/);
    });

    it('does not render assistant avatar for user turns, preserving neat user bubble styling', () => {
      const userMsg: ChatMessageItem = {
        id: 'msg-user-no-avatar',
        role: 'user',
        content: 'User message without bot avatar.',
        created_at: '2026-10-18T10:00:00Z',
      };

      render(<MessageItem message={userMsg} />);

      expect(screen.queryByTestId('assistant-avatar')).not.toBeInTheDocument();
      const bubble = screen.getByTestId('message-bubble');
      expect(bubble).toHaveClass('bg-secondary', 'rounded-2xl', 'border');
    });
  });
});

