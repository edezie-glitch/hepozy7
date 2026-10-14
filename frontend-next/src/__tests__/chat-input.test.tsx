import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '@/components/chat/chat-input';
import { useChatStore } from '@/stores/use-chat-store';

describe('ChatInput Component', () => {
  beforeEach(() => {
    useChatStore.setState({
      inputPrompt: '',
      replyingTo: null,
      isGenerating: false,
      activeRequestId: null,
      abortController: null,
    });
  });

  it('renders textarea with placeholder and updates inputPrompt on typing', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<ChatInput onSubmit={handleSubmit} placeholder="Ask a question..." />);

    const textarea = screen.getByPlaceholderText('Ask a question...');
    expect(textarea).toBeInTheDocument();

    await user.type(textarea, 'Explain quantum computing');
    expect(useChatStore.getState().inputPrompt).toBe('Explain quantum computing');
  });

  it('submits on Enter key press without Shift and resets prompt', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<ChatInput onSubmit={handleSubmit} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Create a project plan{enter}');

    expect(handleSubmit).toHaveBeenCalledWith('Create a project plan');
  });

  it('does NOT submit on Shift+Enter, but inserts a newline', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<ChatInput onSubmit={handleSubmit} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Line 1{Shift>}{enter}{/Shift}Line 2');

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(useChatStore.getState().inputPrompt).toContain('Line 1\nLine 2');
  });

  it('renders orange accented reply chip when replyingTo is set and dismisses on close', async () => {
    const user = userEvent.setup();
    useChatStore.setState({
      replyingTo: { text: 'How do neural networks learn weights?' },
    });

    render(<ChatInput onSubmit={vi.fn()} />);

    const replyChip = screen.getByTestId('reply-quote-chip');
    expect(replyChip).toBeInTheDocument();
    expect(replyChip).toHaveTextContent('How do neural networks learn weights?');

    const dismissButton = screen.getByRole('button', { name: /dismiss reply quote/i });
    await user.click(dismissButton);

    expect(useChatStore.getState().replyingTo).toBeNull();
    expect(screen.queryByTestId('reply-quote-chip')).not.toBeInTheDocument();
  });

  it('transforms send button into active Stop button when isGenerating is true', async () => {
    const user = userEvent.setup();
    const handleStop = vi.fn();

    const { rerender } = render(<ChatInput onSubmit={vi.fn()} onStop={handleStop} />);

    // Initially not generating -> Send button
    const sendButton = screen.getByRole('button', { name: /send message/i });
    expect(sendButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /stop generation/i })).not.toBeInTheDocument();

    // Now set isGenerating to true
    useChatStore.setState({ isGenerating: true });
    rerender(<ChatInput onSubmit={vi.fn()} onStop={handleStop} />);

    const stopButton = screen.getByRole('button', { name: /stop generation/i });
    expect(stopButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send message/i })).not.toBeInTheDocument();

    await user.click(stopButton);
    expect(handleStop).toHaveBeenCalled();
  });

  it('disables send button when textarea is empty', () => {
    render(<ChatInput onSubmit={vi.fn()} />);

    const sendButton = screen.getByRole('button', { name: /send message/i });
    expect(sendButton).toBeDisabled();
  });
});
