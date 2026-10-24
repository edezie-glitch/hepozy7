import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceShell } from '@/components/workspace/workspace-shell';
import * as conversationsHooks from '@/hooks/use-conversations';
import * as chatApi from '@/lib/api/chat';
import * as clientModule from '@/lib/supabase/client';
import { ThemeProvider } from '@/components/theme-provider';

import { useChatStore } from '@/stores/use-chat-store';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        {ui}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('WorkspaceShell Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
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
      inputFocusTrigger: 0,
    });

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-abc',
              email: 'john@example.com',
              user_metadata: { username: 'johndoe' },
            },
          },
          error: null,
        }),
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    };
    vi.spyOn(clientModule, 'createClient').mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof clientModule.createClient>
    );

    vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
      data: [
        { id: 'c-1', title: 'First Workspace Chat', created_at: '2026-10-14T10:00:00Z' },
        { id: 'c-2', title: 'Second Document Query', created_at: '2026-10-14T11:00:00Z' },
      ],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

    vi.spyOn(conversationsHooks, 'useDeleteConversation').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof conversationsHooks.useDeleteConversation>);

    vi.spyOn(chatApi, 'getChatHistory').mockResolvedValue([]);
  });

  it('renders full-height canvas without WorkspaceTopbar and provides sidebar footer controls', async () => {
    renderWithProviders(<WorkspaceShell />);

    // WorkspaceTopbar and topbar title should NOT exist in the DOM
    expect(screen.queryByTestId('topbar-conversation-title')).not.toBeInTheDocument();

    // Profile menu trigger
    expect(screen.getAllByLabelText(/user profile menu/i).length).toBeGreaterThanOrEqual(1);

    // Standalone settings and theme buttons are removed from sidebar footer
    expect(screen.queryByRole('button', { name: /open settings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /toggle theme/i })).not.toBeInTheDocument();

    // Full height welcome canvas
    expect(screen.getByRole('heading', { name: /intelligence that works with your documents/i })).toBeInTheDocument();
  });

  it('switches to full-height chat workspace when selecting a conversation without topbar clutter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceShell />);

    expect(screen.queryByTestId('topbar-conversation-title')).not.toBeInTheDocument();

    // Click on a conversation in the sidebar
    await user.click(screen.getByText('First Workspace Chat'));

    // Chat input is present in full-height chat canvas
    expect(screen.getByPlaceholderText(/ask hepozy assistant/i)).toBeInTheDocument();
    // No topbar exists
    expect(screen.queryByTestId('topbar-conversation-title')).not.toBeInTheDocument();
  });

  it('resets active conversation and focuses chat input when clicking New Chat', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceShell />);

    // Select a conversation first
    await user.click(screen.getByText('First Workspace Chat'));
    expect(screen.getByPlaceholderText(/ask hepozy assistant/i)).toBeInTheDocument();

    // Click New Chat
    await user.click(screen.getByRole('button', { name: /new chat/i }));

    expect(screen.getByTestId('empty-conversation-card')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input-textarea')).toHaveFocus();
    expect(screen.queryByTestId('topbar-conversation-title')).not.toBeInTheDocument();
  });

  it('instantly transitions to active chat input without delay or network roundtrip when clicking Start Conversation (#20)', async () => {
    const user = userEvent.setup();
    const historySpy = vi.spyOn(chatApi, 'getChatHistory');

    renderWithProviders(<WorkspaceShell />);

    // Initially at empty home shell
    const startBtn = screen.getByRole('button', { name: /start conversation/i });
    expect(startBtn).toBeInTheDocument();

    // Click Start Conversation
    await user.click(startBtn);

    // Instantly transitions to active chat input and focuses textarea
    expect(screen.getByPlaceholderText(/ask hepozy assistant/i)).toBeInTheDocument();
    expect(screen.getByTestId('empty-conversation-card')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input-textarea')).toHaveFocus();

    // Zero redundant history calls
    expect(historySpy).not.toHaveBeenCalled();
  });

  it('instantly resets workspace message state, draft attachments, and quote context when clicking New Chat (#20)', async () => {
    const user = userEvent.setup();
    const { useChatStore } = await import('@/stores/use-chat-store');

    // Pre-populate store with staged attachment, draft, and quote context
    const testFile = new File(['hello'], 'document.pdf', { type: 'application/pdf' });
    useChatStore.getState().stageFiles([testFile]);
    useChatStore.getState().setInputPrompt('Work in progress draft');
    useChatStore.getState().setReplyingTo({ text: 'Quote reply context', messageId: 'm-1' });

    expect(useChatStore.getState().stagedAttachments.length).toBe(1);
    expect(useChatStore.getState().replyingTo).not.toBeNull();
    expect(useChatStore.getState().inputPrompt).toBe('Work in progress draft');

    renderWithProviders(<WorkspaceShell />);

    // Select an active conversation
    await user.click(screen.getByText('First Workspace Chat'));
    expect(screen.getByPlaceholderText(/ask hepozy assistant/i)).toBeInTheDocument();

    // Click New Chat
    await user.click(screen.getByRole('button', { name: /new chat/i }));

    // Resets to empty conversation and focuses textarea without awaiting network
    expect(screen.getByTestId('empty-conversation-card')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input-textarea')).toHaveFocus();

    // Workspace state in store is completely reset
    expect(useChatStore.getState().stagedAttachments).toEqual([]);
    expect(useChatStore.getState().replyingTo).toBeNull();
    expect(useChatStore.getState().inputPrompt).toBe('');
    expect(useChatStore.getState().inputDraft).toBe('');
  });

  it('toggles mobile slide-out drawer via floating drawer trigger when drawer is closed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceShell />);

    const menuToggle = screen.getByRole('button', { name: /toggle navigation menu/i });
    expect(menuToggle).toHaveAttribute('data-testid', 'mobile-drawer-toggle');

    // Initially drawer backdrop should not be in the document
    expect(screen.queryByTestId('mobile-drawer-backdrop')).not.toBeInTheDocument();

    // Open mobile drawer
    await user.click(menuToggle);
    const backdrop = screen.getByTestId('mobile-drawer-backdrop');
    expect(backdrop).toBeInTheDocument();
    expect(screen.getByTestId('mobile-drawer-panel')).toBeInTheDocument();

    // While drawer is open, floating toggle is closed/hidden
    expect(screen.queryByTestId('mobile-drawer-toggle')).not.toBeInTheDocument();

    // Click backdrop to close
    await user.click(backdrop);
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-drawer-backdrop')).not.toBeInTheDocument();
    });

    // Reopen mobile drawer via floating trigger and test closing via sidebar toggle button
    const restoredMenuToggle = screen.getByRole('button', { name: /toggle navigation menu/i });
    await user.click(restoredMenuToggle);
    expect(screen.getByTestId('mobile-drawer-panel')).toBeInTheDocument();

    const mobilePanel = screen.getByTestId('mobile-drawer-panel');
    const mobileToggleBtn = mobilePanel.querySelector('[data-testid="sidebar-toggle-button"]') as HTMLButtonElement;
    expect(mobileToggleBtn).toBeInTheDocument();
    await user.click(mobileToggleBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('mobile-drawer-panel')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('mobile-drawer-toggle')).toBeInTheDocument();
  });


  it('opens and closes settings modal', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceShell />);

    const profileTrigger = screen.getAllByLabelText(/user profile menu/i)[0];
    await user.click(profileTrigger);

    const settingsMenuItem = await screen.findByRole('menuitem', { name: /settings/i });
    await user.click(settingsMenuItem);

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText(/danger zone/i)).toBeInTheDocument();

    // Close settings modal
    const closeBtn = screen.getByRole('button', { name: /close settings/i });
    await user.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
    });
  });

  it('toggles desktop sidebar between expanded and collapsed rail states', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<WorkspaceShell />);

    const sidebarAside = container.querySelector('aside');
    expect(sidebarAside).toBeInTheDocument();
    expect(sidebarAside).toHaveClass('w-64');

    // Click collapse toggle in sidebar
    const collapseBtn = screen.getByRole('button', { name: /collapse sidebar/i });
    await user.click(collapseBtn);

    expect(sidebarAside).toHaveClass('w-16');
    expect(sidebarAside).not.toHaveClass('w-64');

    // Main workspace welcome header remains visible
    expect(screen.getByRole('heading', { name: /intelligence that works with your documents/i })).toBeInTheDocument();

    // Click expand button to restore
    const expandBtn = screen.getByRole('button', { name: /expand sidebar/i });
    await user.click(expandBtn);

    expect(sidebarAside).toHaveClass('w-64');
  });

  it('constrains empty conversation welcome card and active conversation message stream to shared max-width bounds (#21)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceShell />);

    // 1. Welcome canvas container shares mx-auto max-w-4xl lg:max-w-5xl bounds
    const welcomeHeading = screen.getByRole('heading', {
      name: /intelligence that works with your documents/i,
    });
    const welcomeContainer = welcomeHeading.closest('.max-w-4xl');
    expect(welcomeContainer).toBeInTheDocument();
    expect(welcomeContainer).toHaveClass('mx-auto');
    expect(welcomeContainer).toHaveClass('w-full');
    expect(welcomeContainer).toHaveClass('lg:max-w-5xl');

    // 2. Switch to active conversation
    await user.click(screen.getByText('First Workspace Chat'));

    // Message stream container is at least as wide as the chat input bar
    const streamContainer = await screen.findByTestId('message-stream-container');
    expect(streamContainer).toBeInTheDocument();
    expect(streamContainer).toHaveClass('mx-auto');
    expect(streamContainer).toHaveClass('max-w-4xl');
    expect(streamContainer).toHaveClass('w-full');

    const inputBounds = screen.getByTestId('chat-input-bounds');
    expect(inputBounds).toBeInTheDocument();
    expect(inputBounds).toHaveClass('mx-auto');
    expect(inputBounds).toHaveClass('max-w-3xl');
    expect(inputBounds).toHaveClass('w-full');
  });

  it('preserves clean footer layout with full-width user profile in mobile navigation drawer (#27)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceShell />);

    // Open mobile drawer
    const menuToggle = screen.getByRole('button', { name: /toggle navigation menu/i });
    await user.click(menuToggle);

    const mobilePanel = screen.getByTestId('mobile-drawer-panel');
    expect(mobilePanel).toBeInTheDocument();

    // Mobile drawer contains Preferences header and full-width user profile menu
    const preferencesHeader = mobilePanel.querySelector('span.uppercase');
    expect(preferencesHeader).toBeInTheDocument();

    const mobileUserProfile = screen.getAllByLabelText(/user profile menu/i).find((el) =>
      mobilePanel.contains(el)
    );
    expect(mobileUserProfile).toBeInTheDocument();
    expect(mobileUserProfile).toHaveClass('w-full');
    expect(mobileUserProfile).toHaveClass('px-2.5');
    expect(mobileUserProfile).toHaveClass('py-2');
  });

  describe('Ticket 19 (#28): Conversation-Scoped Generation State & Independent Chat Input Switching', () => {
    it('switching to another conversation in sidebar while an inquiry is generating preserves interactive chat input in target conversation', async () => {
      const user = userEvent.setup();
      let resolveFirst!: (value: chatApi.ChatResponse) => void;
      const firstPromise = new Promise<chatApi.ChatResponse>((resolve) => {
        resolveFirst = resolve;
      });
      vi.spyOn(chatApi, 'sendChatMessage').mockReturnValueOnce(firstPromise);

      renderWithProviders(<WorkspaceShell />);

      // Select First Workspace Chat (id: 'c-1')
      await user.click(screen.getByText('First Workspace Chat'));
      const textarea = screen.getByPlaceholderText(/ask hepozy assistant/i);
      expect(textarea).toBeInTheDocument();

      // Submit turn in c-1
      await user.type(textarea, 'Query in first conversation{enter}');

      // In c-1, input is generating: Stop button is visible and textarea is disabled
      expect(screen.getByRole('button', { name: /stop generation/i })).toBeInTheDocument();
      expect(textarea).toBeDisabled();

      // Switch to Second Document Query (id: 'c-2') from sidebar
      await user.click(screen.getByText('Second Document Query'));

      // In c-2, input is enabled and interactive, with Send button (NOT Stop button)
      const secondTextarea = await screen.findByPlaceholderText(/ask hepozy assistant/i);
      expect(secondTextarea).toBeEnabled();
      expect(screen.queryByRole('button', { name: /stop generation/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();

      // Switch back to First Workspace Chat (c-1)
      await user.click(screen.getByText('First Workspace Chat'));

      // In c-1, generating state is restored with Stop button and disabled textarea
      expect(screen.getByRole('button', { name: /stop generation/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/ask hepozy assistant/i)).toBeDisabled();

      // Resolve c-1 generation
      resolveFirst({
        reply: 'First reply completed',
        conversation_id: 'c-1',
        assistant_message_id: 'a-c1',
        needs_clarification: false,
        quota_exceeded: false,
      });
    });

    it('clicking New Chat while an inquiry is generating in active conversation transitions cleanly to ready-to-type chat with focused input', async () => {
      const user = userEvent.setup();
      vi.spyOn(chatApi, 'sendChatMessage').mockReturnValueOnce(new Promise(() => {}));

      renderWithProviders(<WorkspaceShell />);

      // Select First Workspace Chat (c-1)
      await user.click(screen.getByText('First Workspace Chat'));
      const textarea = screen.getByPlaceholderText(/ask hepozy assistant/i);

      // Submit in c-1 to start generation
      await user.type(textarea, 'Background prompt{enter}');
      expect(screen.getByRole('button', { name: /stop generation/i })).toBeInTheDocument();

      // Click New Chat
      await user.click(screen.getByRole('button', { name: /new chat/i }));

      // Cleanly transitions to ready-to-type new chat with focused input
      expect(screen.getByTestId('empty-conversation-card')).toBeInTheDocument();
      const newTextarea = await screen.findByTestId('chat-input-textarea');
      expect(newTextarea).toBeEnabled();
      expect(newTextarea).toHaveFocus();
      expect(screen.queryByRole('button', { name: /stop generation/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });
  });

  describe('Ticket 26 (#34): Autofocus Chatbox Input on New Chat Navigation & Reset', () => {
    it('clicking New Chat in the expanded desktop sidebar immediately places focus inside chat-input-textarea', async () => {
      const user = userEvent.setup();
      renderWithProviders(<WorkspaceShell />);

      expect(screen.getByRole('heading', { name: /intelligence that works with your documents/i })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /new chat/i }));

      const textarea = await screen.findByTestId('chat-input-textarea');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveFocus();
    });

    it('clicking New Chat in the collapsed sidebar icon rail immediately places focus inside chat-input-textarea', async () => {
      const user = userEvent.setup();
      renderWithProviders(<WorkspaceShell />);

      const collapseBtn = screen.getByRole('button', { name: /collapse sidebar/i });
      await user.click(collapseBtn);

      const railNewChatBtn = screen.getByRole('button', { name: /new chat/i });
      await user.click(railNewChatBtn);

      const textarea = await screen.findByTestId('chat-input-textarea');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveFocus();
    });

    it('clicking New Chat inside mobile drawer panel closes drawer and focuses chat-input-textarea', async () => {
      const user = userEvent.setup();
      renderWithProviders(<WorkspaceShell />);

      const menuToggle = screen.getByTestId('mobile-drawer-toggle');
      await user.click(menuToggle);

      const drawerPanel = screen.getByTestId('mobile-drawer-panel');
      expect(drawerPanel).toBeInTheDocument();

      const drawerNewChatBtn = screen.getAllByRole('button', { name: /new chat/i })[1];
      await user.click(drawerNewChatBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('mobile-drawer-panel')).not.toBeInTheDocument();
      });

      const textarea = await screen.findByTestId('chat-input-textarea');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveFocus();
    });

    it('allows user to immediately type message after New Chat without clicking textarea', async () => {
      const user = userEvent.setup();
      renderWithProviders(<WorkspaceShell />);

      await user.click(screen.getByRole('button', { name: /new chat/i }));
      const textarea = await screen.findByTestId('chat-input-textarea');
      expect(textarea).toHaveFocus();

      await user.keyboard('Direct query prompt without clicking');
      expect(textarea).toHaveValue('Direct query prompt without clicking');
    });
  });
});

