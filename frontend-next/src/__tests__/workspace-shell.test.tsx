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

  it('renders topbar with title, user profile avatar, settings trigger, and theme toggle', async () => {
    renderWithProviders(<WorkspaceShell />);

    // Default title is "New conversation" when no conversation is selected
    expect(screen.getByTestId('topbar-conversation-title')).toHaveTextContent(/new conversation/i);

    // Profile menu trigger
    expect(screen.getAllByLabelText(/user profile menu/i).length).toBeGreaterThanOrEqual(1);

    // Settings modal trigger
    expect(screen.getByRole('button', { name: /open settings/i })).toBeInTheDocument();

    // Theme toggle
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
  });

  it('updates topbar title when selecting a conversation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceShell />);

    expect(screen.getByTestId('topbar-conversation-title')).toHaveTextContent(/new conversation/i);

    // Click on a conversation in the sidebar
    await user.click(screen.getByText('First Workspace Chat'));

    expect(screen.getByTestId('topbar-conversation-title')).toHaveTextContent('First Workspace Chat');
  });

  it('resets active conversation and topbar title when clicking New Chat', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceShell />);

    // Select a conversation first
    await user.click(screen.getByText('First Workspace Chat'));
    expect(screen.getByTestId('topbar-conversation-title')).toHaveTextContent('First Workspace Chat');

    // Click New Chat
    await user.click(screen.getByRole('button', { name: /new chat/i }));

    expect(screen.getByTestId('topbar-conversation-title')).toHaveTextContent(/new conversation/i);
    expect(screen.getByRole('heading', { name: /intelligence that works with your documents/i })).toBeInTheDocument();
  });

  it('toggles mobile slide-out drawer and backdrop overlay', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceShell />);

    const menuToggle = screen.getByRole('button', { name: /toggle navigation menu/i });

    // Initially drawer backdrop should not be in the document
    expect(screen.queryByTestId('mobile-drawer-backdrop')).not.toBeInTheDocument();

    // Open mobile drawer
    await user.click(menuToggle);
    const backdrop = screen.getByTestId('mobile-drawer-backdrop');
    expect(backdrop).toBeInTheDocument();
    expect(screen.getByTestId('mobile-drawer-panel')).toBeInTheDocument();

    // Click backdrop to close
    await user.click(backdrop);
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-drawer-backdrop')).not.toBeInTheDocument();
    });

    // Reopen mobile drawer and test closing via sidebar toggle button
    await user.click(menuToggle);
    expect(screen.getByTestId('mobile-drawer-panel')).toBeInTheDocument();

    const mobilePanel = screen.getByTestId('mobile-drawer-panel');
    const mobileToggleBtn = mobilePanel.querySelector('[data-testid="sidebar-toggle-button"]') as HTMLButtonElement;
    expect(mobileToggleBtn).toBeInTheDocument();
    await user.click(mobileToggleBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('mobile-drawer-panel')).not.toBeInTheDocument();
    });
  });


  it('opens and closes settings modal', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceShell />);

    const settingsBtn = screen.getByRole('button', { name: /open settings/i });
    await user.click(settingsBtn);

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
});

