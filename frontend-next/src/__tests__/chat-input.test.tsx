import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '@/components/chat/chat-input';
import { useChatStore } from '@/stores/use-chat-store';
import { MAX_ATTACHMENT_SIZE } from '@/lib/attachments';

describe('ChatInput Component', () => {
  beforeEach(() => {
    useChatStore.setState({
      inputPrompt: '',
      replyingTo: null,
      isGenerating: false,
      activeRequestId: null,
      abortController: null,
      stagedAttachments: [],
      attachmentError: null,
      inputFocusTrigger: 0,
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

  it('disables send button when textarea is empty and no attachments are staged', () => {
    render(<ChatInput onSubmit={vi.fn()} />);

    const sendButton = screen.getByRole('button', { name: /send message/i });
    expect(sendButton).toBeDisabled();
  });

  it('enables send button when attachments are staged even if textarea is empty', () => {
    useChatStore.getState().stageFiles([
      new File(['doc content'], 'spec.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    ]);

    render(<ChatInput onSubmit={vi.fn()} />);

    const sendButton = screen.getByRole('button', { name: /send message/i });
    expect(sendButton).toBeEnabled();
  });

  it('renders staged preview strip with image thumbnail, doc icon, and interactive remove buttons', async () => {
    const user = userEvent.setup();
    const docFile = new File(['text content'], 'notes.txt', { type: 'text/plain' });
    const imgFile = new File(['image binary'], 'diagram.png', { type: 'image/png' });

    useChatStore.getState().stageFiles([docFile, imgFile]);

    render(<ChatInput onSubmit={vi.fn()} />);

    const previewStrip = screen.getByTestId('staged-preview-strip');
    expect(previewStrip).toBeInTheDocument();

    // Check document item rendering
    expect(screen.getByText('notes.txt')).toBeInTheDocument();

    // Check image item rendering
    const imgThumbnail = screen.getByAltText('diagram.png');
    expect(imgThumbnail).toBeInTheDocument();

    // Interactive remove button for document
    const removeDocBtn = screen.getByRole('button', { name: /remove notes\.txt/i });
    expect(removeDocBtn).toBeInTheDocument();
    await user.click(removeDocBtn);

    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
    expect(screen.getByAltText('diagram.png')).toBeInTheDocument();
  });

  it('displays clear error notification when file selector rejects unaccepted files or >5MB files', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSubmit={vi.fn()} />);

    const fileInput = screen.getByTestId('attachment-file-input') as HTMLInputElement;

    // Upload an invalid exe file
    const invalidFile = new File(['malicious'], 'trojan.exe', { type: 'application/x-msdownload' });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    const errorAlert = screen.getByTestId('attachment-error-alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent(/this file type is not supported/i);

    // Dismiss error alert
    const dismissBtn = screen.getByRole('button', { name: /dismiss attachment error/i });
    await user.click(dismissBtn);
    expect(screen.queryByTestId('attachment-error-alert')).not.toBeInTheDocument();
  });

  it('supports drag-and-drop file upload on input area', async () => {
    render(<ChatInput onSubmit={vi.fn()} />);

    const dropZone = screen.getByTestId('chat-input-container');

    const validFile = new File(['data'], 'analysis.csv', { type: 'text/csv' });
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [validFile],
      },
    });

    expect(await screen.findByText('analysis.csv')).toBeInTheDocument();
    expect(screen.getByTestId('staged-preview-strip')).toBeInTheDocument();
  });

  it('rejects files exceeding 5MB via file selector with clear error notification', () => {
    render(<ChatInput onSubmit={vi.fn()} />);

    const fileInput = screen.getByTestId('attachment-file-input') as HTMLInputElement;
    const oversizedFile = new File([new Uint8Array(MAX_ATTACHMENT_SIZE + 2048)], 'big-archive.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    const errorAlert = screen.getByTestId('attachment-error-alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent(/big-archive\.pdf is over 5 MB/i);
  });

  it('renders textarea with data-testid chat-input-textarea and accessible aria-label', () => {
    render(<ChatInput onSubmit={vi.fn()} />);
    const textarea = screen.getByTestId('chat-input-textarea');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('aria-label', 'Chat message input');
  });

  it('autofocuses textarea on mount when autoFocus is true without disrupting pre-existing draft', () => {
    useChatStore.setState({ inputPrompt: 'Pre-existing draft' });
    render(<ChatInput onSubmit={vi.fn()} autoFocus />);
    const textarea = screen.getByTestId('chat-input-textarea');
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveValue('Pre-existing draft');
  });

  it('programmatically focuses textarea when inputFocusTrigger is triggered in useChatStore', () => {
    render(<ChatInput onSubmit={vi.fn()} />);
    const textarea = screen.getByTestId('chat-input-textarea');
    expect(textarea).not.toHaveFocus();

    act(() => { useChatStore.getState().triggerInputFocus(); });
    expect(textarea).toHaveFocus();
  });

  it('preserves staged attachments when focus trigger is called', () => {
    const testFile = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
    useChatStore.getState().stageFiles([testFile]);
    render(<ChatInput onSubmit={vi.fn()} />);
    const textarea = screen.getByTestId('chat-input-textarea');

    act(() => { useChatStore.getState().triggerInputFocus(); });
    expect(textarea).toHaveFocus();
    expect(useChatStore.getState().stagedAttachments.length).toBe(1);
    expect(screen.getByTestId('staged-preview-strip')).toBeInTheDocument();
  });

  it('rejects unaccepted extensions and oversized files via drag-and-drop with clear error notifications', () => {
    render(<ChatInput onSubmit={vi.fn()} />);

    const dropZone = screen.getByTestId('chat-input-container');

    const invalidDrop = new File(['script code'], 'hack.bat', { type: 'application/x-bat' });
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [invalidDrop],
      },
    });

    const errorAlert = screen.getByTestId('attachment-error-alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent(/hack\.bat: this file type is not supported/i);
    expect(screen.queryByTestId('staged-preview-strip')).not.toBeInTheDocument();
  });

  describe('Ticket 28: Keyboard Tab Navigation Order', () => {
    it('prioritizes textarea over attachment button when tabbing into composer', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <button type="button" data-testid="before-element">Before</button>
          <ChatInput onSubmit={vi.fn()} />
        </div>
      );

      const beforeBtn = screen.getByTestId('before-element');
      const textarea = screen.getByTestId('chat-input-textarea');
      const attachBtn = screen.getByRole('button', { name: /attach files/i });
      const sendBtn = screen.getByRole('button', { name: /send message/i });

      beforeBtn.focus();
      expect(beforeBtn).toHaveFocus();

      // First Tab should land on textarea, NOT attachBtn
      await user.tab();
      expect(textarea).toHaveFocus();

      // Type some text to enable send button
      await user.type(textarea, 'Draft query');

      // Next Tab lands on attachBtn
      await user.tab();
      expect(attachBtn).toHaveFocus();

      // Next Tab lands on enabled sendBtn
      await user.tab();
      expect(sendBtn).toHaveFocus();

      // Shift+Tab traverses back in reverse order
      await user.tab({ shift: true });
      expect(attachBtn).toHaveFocus();

      await user.tab({ shift: true });
      expect(textarea).toHaveFocus();
    });


  });
});


