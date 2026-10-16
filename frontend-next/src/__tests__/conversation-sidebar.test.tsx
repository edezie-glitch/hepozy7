import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConversationSidebar } from '@/components/workspace/conversation-sidebar';
import * as conversationsHooks from '@/hooks/use-conversations';
import * as conversationsApi from '@/lib/api/conversations';
import * as clientModule from '@/lib/supabase/client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe('ConversationSidebar Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'test@example.com', user_metadata: { username: 'testuser' } } },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    };
    vi.spyOn(clientModule, 'createClient').mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof clientModule.createClient>
    );
  });

  it('renders skeleton loading state while conversations are fetching', () => {
    vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

    render(
      <ConversationSidebar
        activeId={null}
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('conversation-skeletons')).toBeInTheDocument();
  });

  it('displays fetched conversations and highlights active one', () => {
    const mockConversations = [
      { id: 'conv-1', title: 'React 19 Architecture', created_at: '2026-10-14T10:00:00Z' },
      { id: 'conv-2', title: 'Python Backend Routing', created_at: '2026-10-14T11:00:00Z' },
    ];
    vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
      data: mockConversations,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

    const onSelect = vi.fn();
    render(
      <ConversationSidebar
        activeId="conv-1"
        onSelectConversation={onSelect}
        onNewChat={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('React 19 Architecture')).toBeInTheDocument();
    expect(screen.getByText('Python Backend Routing')).toBeInTheDocument();

    const activeItem = screen.getByText('React 19 Architecture').closest('button');
    expect(activeItem).toHaveAttribute('data-active', 'true');

    // Click another conversation
    fireEvent.click(screen.getByText('Python Backend Routing'));
    expect(onSelect).toHaveBeenCalledWith('conv-2');
  });

  it('filters conversations in real-time without server round-trips', async () => {
    const user = userEvent.setup();
    const mockConversations = [
      { id: 'conv-1', title: 'FastAPI Service', created_at: '2026-10-14T10:00:00Z' },
      { id: 'conv-2', title: 'Next.js App Router', created_at: '2026-10-14T11:00:00Z' },
      { id: 'conv-3', title: 'Supabase Vector Store', created_at: '2026-10-14T12:00:00Z' },
    ];
    vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
      data: mockConversations,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

    const getConversationsSpy = vi.spyOn(conversationsApi, 'getConversations');

    render(
      <ConversationSidebar
        activeId={null}
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'Next');

    expect(screen.getByText('Next.js App Router')).toBeInTheDocument();
    expect(screen.queryByText('FastAPI Service')).not.toBeInTheDocument();
    expect(screen.queryByText('Supabase Vector Store')).not.toBeInTheDocument();

    expect(getConversationsSpy).not.toHaveBeenCalled();
  });

  it('clicking New Chat triggers onNewChat callback', async () => {
    const user = userEvent.setup();
    vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

    const onNewChat = vi.fn();
    render(
      <ConversationSidebar
        activeId="some-id"
        onSelectConversation={vi.fn()}
        onNewChat={onNewChat}
      />,
      { wrapper: createWrapper() }
    );

    const newChatBtn = screen.getByRole('button', { name: /new chat/i });
    await user.click(newChatBtn);

    expect(onNewChat).toHaveBeenCalled();
  });

  it('deleting conversation invokes delete mutation and clears active state if deleted', async () => {
    const user = userEvent.setup();
    const mockConversations = [
      { id: 'conv-1', title: 'To Delete', created_at: '2026-10-14T10:00:00Z' },
    ];
    vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
      data: mockConversations,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

    const mutateMock = vi.fn();
    vi.spyOn(conversationsHooks, 'useDeleteConversation').mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof conversationsHooks.useDeleteConversation>);

    const onSelect = vi.fn();
    render(
      <ConversationSidebar
        activeId="conv-1"
        onSelectConversation={onSelect}
        onNewChat={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const deleteBtn = screen.getByRole('button', { name: /delete conversation/i });
    await user.click(deleteBtn);

    expect(mutateMock).toHaveBeenCalledWith('conv-1');
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('replaces decorative AI chip with drawer toggle button that toggles between expanded and collapsed states', async () => {
    const user = userEvent.setup();
    vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

    const { container } = render(
      <ConversationSidebar
        activeId={null}
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('w-64');

    // Toggle button exists and has accessible label and expanded attribute
    const toggleBtn = screen.getByRole('button', { name: /collapse sidebar/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    // Decorative static AI chip text should no longer exist
    expect(screen.queryByText(/^AI$/)).not.toBeInTheDocument();

    // Click toggle to collapse
    await user.click(toggleBtn);
    expect(aside).toHaveClass('w-16');
    expect(aside).not.toHaveClass('w-64');

    const expandBtn = screen.getByRole('button', { name: /expand sidebar/i });
    expect(expandBtn).toBeInTheDocument();
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false');

    // Click toggle to expand
    await user.click(expandBtn);
    expect(aside).toHaveClass('w-64');
  });

  it('persistently renders Hepozy logo, New Chat button, and User Avatar in collapsed state', async () => {
    const user = userEvent.setup();
    const onNewChat = vi.fn();

    vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

    render(
      <ConversationSidebar
        activeId={null}
        onSelectConversation={vi.fn()}
        onNewChat={onNewChat}
      />,
      { wrapper: createWrapper() }
    );

    // Collapse the sidebar
    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }));

    // Hepozy Logo
    expect(screen.getByText('H')).toBeInTheDocument();

    // New Chat (+) button in rail
    const newChatBtn = screen.getByRole('button', { name: /new chat/i });
    expect(newChatBtn).toBeInTheDocument();
    await user.click(newChatBtn);
    expect(onNewChat).toHaveBeenCalled();

    // Theme toggle and standalone settings button are removed from footer
    expect(screen.queryByRole('button', { name: /toggle theme/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open settings/i })).not.toBeInTheDocument();

    // User Avatar profile dropdown
    const userProfileTrigger = screen.getByLabelText(/user profile menu/i);
    expect(userProfileTrigger).toBeInTheDocument();
  });

  it('renders User Profile in expanded sidebar footer without settings or theme button', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();

    vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

    render(
      <ConversationSidebar
        activeId={null}
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
        onOpenSettings={onOpenSettings}
        isCollapsed={false}
      />,
      { wrapper: createWrapper() }
    );

    // User Profile dropdown
    const userProfileTrigger = screen.getByLabelText(/user profile menu/i);
    expect(userProfileTrigger).toBeInTheDocument();

    // Standalone settings and theme buttons are removed from footer
    expect(screen.queryByRole('button', { name: /open settings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /toggle theme/i })).not.toBeInTheDocument();

    // Settings is accessible via User Profile menu
    await user.click(userProfileTrigger);
    const settingsMenuItem = screen.getByRole('menuitem', { name: /settings/i });
    expect(settingsMenuItem).toBeInTheDocument();
    await user.click(settingsMenuItem);
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('renders refined footer layout with full-width user profile and graceful truncation in expanded mode (#27)', async () => {
    const mockLongUser = {
      id: 'user-long',
      email: 'alexander.montgomery.longemail@corporation.example.com',
      user_metadata: { username: 'Alexander Montgomery The Third' },
    };
    vi.spyOn(clientModule, 'createClient').mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockLongUser },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    } as unknown as ReturnType<typeof clientModule.createClient>);

    vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

    render(
      <ConversationSidebar
        activeId={null}
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
        isCollapsed={false}
      />,
      { wrapper: createWrapper() }
    );

    // User profile trigger spans full width and has comfortable padding
    const userProfileTrigger = screen.getByLabelText(/user profile menu/i);
    expect(userProfileTrigger).toHaveClass('w-full');
    expect(userProfileTrigger).toHaveClass('px-2.5');
    expect(userProfileTrigger).toHaveClass('py-2');
    expect(userProfileTrigger).toHaveClass('hover:bg-accent/70');

    // Long username and email with graceful truncation and title attributes
    const usernameEl = await screen.findByText('Alexander Montgomery The Third');
    expect(usernameEl).toHaveClass('truncate');
    expect(usernameEl).toHaveAttribute('title', 'Alexander Montgomery The Third');

    const emailEl = screen.getByText('alexander.montgomery.longemail@corporation.example.com');
    expect(emailEl).toHaveClass('truncate');
    expect(emailEl).toHaveAttribute('title', 'alexander.montgomery.longemail@corporation.example.com');

    // Standalone settings and theme buttons are removed from footer
    expect(screen.queryByRole('button', { name: /open settings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /toggle theme/i })).not.toBeInTheDocument();
  });

  it('renders centered vertical stack with uniform touch targets and right-aligned tooltips in collapsed rail mode (#27)', async () => {
    vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

    render(
      <ConversationSidebar
        activeId={null}
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
        isCollapsed={true}
      />,
      { wrapper: createWrapper() }
    );

    // Footer container is centered
    const footer = screen.getByTestId('sidebar-footer');
    expect(footer).toHaveClass('items-center');
    expect(footer).toHaveClass('justify-center');

    // Standalone theme and settings buttons are removed from footer
    expect(screen.queryByRole('button', { name: /toggle theme/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open settings/i })).not.toBeInTheDocument();

    // User profile trigger shares uniform target
    const userProfileTrigger = screen.getByLabelText(/user profile menu/i);
    expect(userProfileTrigger).toHaveClass('h-8');
    expect(userProfileTrigger).toHaveClass('w-8');
  });

  it('collapses search input and conversation list cleanly without horizontal overflow', async () => {
    const user = userEvent.setup();
    const mockConversations = [
      { id: 'conv-1', title: 'React 19 Deep Dive', created_at: '2026-10-14T10:00:00Z' },
    ];
    vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
      data: mockConversations,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

    const { container } = render(
      <ConversationSidebar
        activeId={null}
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('overflow-hidden');

    expect(screen.getByPlaceholderText(/search conversations/i)).toBeInTheDocument();
    expect(screen.getByText('React 19 Deep Dive')).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }));

    // Search and conversations should not be displayed
    expect(screen.queryByPlaceholderText(/search conversations/i)).not.toBeInTheDocument();
    expect(screen.queryByText('React 19 Deep Dive')).not.toBeInTheDocument();
  });

  it('persists collapsed state across localStorage and restores on mount', async () => {
    window.localStorage.setItem('hepozy_sidebar_collapsed', 'true');

    vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

    const { container, unmount } = render(
      <ConversationSidebar
        activeId={null}
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('w-16');
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /expand sidebar/i }));

    expect(window.localStorage.getItem('hepozy_sidebar_collapsed')).toBe('false');

    unmount();
  });

  it('supports keyboard navigation on drawer toggle button', async () => {
    const user = userEvent.setup();
    vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

    const { container } = render(
      <ConversationSidebar
        activeId={null}
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const aside = container.querySelector('aside');
    const toggleBtn = screen.getByRole('button', { name: /collapse sidebar/i });
    toggleBtn.focus();
    expect(toggleBtn).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(aside).toHaveClass('w-16');

    const expandBtn = screen.getByRole('button', { name: /expand sidebar/i });
    expandBtn.focus();
    await user.keyboard(' ');
    expect(aside).toHaveClass('w-64');
  });
});

