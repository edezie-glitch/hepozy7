import { render, screen, fireEvent } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
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
    document.cookie = 'hepozy_sidebar_collapsed=; max-age=0; path=/';

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

    // Hepozy Official Logo & Expand Control
    const logoImg = screen.getByRole('img', { name: /hepozy logo/i });
    expect(logoImg).toBeInTheDocument();
    expect(logoImg).toHaveAttribute('src', '/hepozy.jpg');

    // Redundant separate expand button is eliminated: exactly one expand button exists
    const expandButtons = screen.getAllByRole('button', { name: /expand sidebar/i });
    expect(expandButtons).toHaveLength(1);

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
    const settingsMenuItem = await screen.findByRole('menuitem', { name: /settings/i });
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

  describe('Ticket 25: Sidebar Collapsed Hover Maximize & Official Logo', () => {
    it('renders the official Hepozy logo image in expanded state and replaces letter H placeholder', () => {
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

      const logoImg = screen.getByRole('img', { name: /hepozy logo/i });
      expect(logoImg).toBeInTheDocument();
      expect(logoImg).toHaveAttribute('src', '/hepozy.jpg');
      expect(screen.queryByText(/^H$/)).not.toBeInTheDocument();
      expect(screen.getByText('Hepozy')).toBeInTheDocument();
    });

    it('transforms logo container into hover expand button in collapsed state, eliminating redundant separate toggle button', async () => {
      const user = userEvent.setup();
      const onToggleCollapse = vi.fn();

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
          isCollapsed={true}
          onToggleCollapse={onToggleCollapse}
        />,
        { wrapper: createWrapper() }
      );

      // Verify collapsed width
      const aside = container.querySelector('aside');
      expect(aside).toHaveClass('w-16');

      // Exactly one expand trigger button exists (no redundant separate button)
      const expandButtons = screen.getAllByRole('button', { name: /expand sidebar/i });
      expect(expandButtons).toHaveLength(1);

      const logoExpandBtn = expandButtons[0];
      expect(logoExpandBtn).toHaveAttribute('data-testid', 'sidebar-toggle-button');
      expect(logoExpandBtn).toHaveAttribute('aria-expanded', 'false');

      // Official logo is inside the button
      const logoImg = screen.getByRole('img', { name: /hepozy logo/i });
      expect(logoExpandBtn).toContainElement(logoImg);

      // Expand icon is present with hover/focus opacity transitions
      const expandIcon = screen.getByTestId('sidebar-expand-icon');
      expect(expandIcon).toBeInTheDocument();
      expect(expandIcon).toHaveClass('opacity-0');
      expect(expandIcon).toHaveClass('group-hover:opacity-100');

      // Clicking it fires the toggle callback with next collapsed state (false)
      await user.click(logoExpandBtn);
      expect(onToggleCollapse).toHaveBeenCalledWith(false);
    });
  });

  describe('Ticket 27: Focus Styling and Token Standardization in Sidebar', () => {
    it('renders New Chat button with clean focus-visible:ring-ring and focus-visible:ring-offset-0 without white outline artifact', () => {
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

      const newChatBtn = screen.getByRole('button', { name: /new chat/i });
      expect(newChatBtn).toHaveClass('focus-visible:ring-ring');
      expect(newChatBtn).toHaveClass('focus-visible:ring-offset-0');
      expect(newChatBtn).toHaveClass('ring-offset-background');
      expect(newChatBtn).not.toHaveClass('focus-visible:ring-offset-2');
    });

    it('uses standardized focus-visible:ring-2 focus-visible:ring-ring on collapsed rail toggle button', () => {
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

      const toggleBtn = screen.getByTestId('sidebar-toggle-button');
      expect(toggleBtn).toHaveClass('focus-visible:ring-2');
      expect(toggleBtn).toHaveClass('focus-visible:ring-ring');
      expect(toggleBtn).toHaveClass('focus-visible:ring-offset-0');
      expect(toggleBtn).not.toHaveClass('focus-visible:ring-1');
    });

    it('verifies interactive keyboard tab navigation cleanly focuses New Chat button', async () => {
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

      const newChatBtn = screen.getByRole('button', { name: /new chat/i });
      newChatBtn.focus();
      expect(newChatBtn).toHaveFocus();
    });
  });

  describe('Ticket 29 (#37): Fix Keyboard Navigation Tabbing to Invisible Delete Button in Recent Conversations', () => {
    function setupSidebarWithConversations(
      conversations: { id: string; title: string; created_at: string }[],
      onSelect = vi.fn()
    ) {
      vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
        data: conversations,
        isLoading: false,
        isError: false,
      } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

      return render(
        <ConversationSidebar
          activeId={null}
          onSelectConversation={onSelect}
          onNewChat={vi.fn()}
          isCollapsed={false}
        />,
        { wrapper: createWrapper() }
      );
    }

    it('ensures delete button is fully visible with tokenized focus ring when focused via keyboard', async () => {
      const mockConversations = [
        { id: 'conv-1', title: 'Conversation One', created_at: '2026-10-14T10:00:00Z' },
        { id: 'conv-2', title: 'Conversation Two', created_at: '2026-10-14T11:00:00Z' },
      ];
      setupSidebarWithConversations(mockConversations);

      const deleteButtons = screen.getAllByRole('button', { name: /delete conversation/i });
      expect(deleteButtons).toHaveLength(2);

      const firstDeleteBtn = deleteButtons[0];
      // Has focus-visible, and group-focus-within/hover opacity-100 classes
      expect(firstDeleteBtn).toHaveClass('focus-visible:opacity-100');
      expect(firstDeleteBtn).toHaveClass('group-focus-within:opacity-100');
      expect(firstDeleteBtn).toHaveClass('group-hover:opacity-100');

      // Has tokenized focus ring styling
      expect(firstDeleteBtn).toHaveClass('focus-visible:ring-2');
      expect(firstDeleteBtn).toHaveClass('focus-visible:ring-ring');
      expect(firstDeleteBtn).toHaveClass('focus-visible:ring-offset-0');
      expect(firstDeleteBtn).toHaveClass('ring-offset-background');
      expect(firstDeleteBtn).toHaveClass('focus-visible:outline-hidden');
      expect(firstDeleteBtn).toHaveClass('focus-visible:text-destructive');
      expect(firstDeleteBtn).toHaveClass('focus-visible:bg-destructive/10');

      // Receives focus directly
      firstDeleteBtn.focus();
      expect(firstDeleteBtn).toHaveFocus();
    });

    it('eliminates invalid DOM nesting by rendering select button and delete button as sibling controls', () => {
      const mockConversations = [
        { id: 'conv-1', title: 'Conversation One', created_at: '2026-10-14T10:00:00Z' },
      ];
      setupSidebarWithConversations(mockConversations);

      const selectBtn = screen.getByText('Conversation One').closest('button');
      const deleteBtn = screen.getByRole('button', { name: /delete conversation/i });

      expect(selectBtn).toBeInTheDocument();
      expect(deleteBtn).toBeInTheDocument();

      // Delete button is a native HTML button
      expect(deleteBtn.tagName).toBe('BUTTON');

      // Neither button is nested within another button (valid W3C HTML)
      expect(deleteBtn.parentElement?.closest('button')).toBeNull();
      expect(selectBtn?.contains(deleteBtn)).toBe(false);
      expect(deleteBtn.contains(selectBtn!)).toBe(false);
    });

    it('supports keyboard Delete shortcut on focused conversation row to delete item safely', async () => {
      const user = userEvent.setup();
      const mockConversations = [
        { id: 'conv-1', title: 'Conversation to Delete', created_at: '2026-10-14T10:00:00Z' },
      ];
      const mutateMock = vi.fn();
      vi.spyOn(conversationsHooks, 'useDeleteConversation').mockReturnValue({
        mutate: mutateMock,
        isPending: false,
      } as unknown as ReturnType<typeof conversationsHooks.useDeleteConversation>);

      setupSidebarWithConversations(mockConversations);

      const selectBtn = screen.getByText('Conversation to Delete').closest('button');
      selectBtn?.focus();
      expect(selectBtn).toHaveFocus();

      // Press Delete key on focused conversation
      await user.keyboard('{Delete}');
      expect(mutateMock).toHaveBeenCalledWith('conv-1');
    });

    it('supports ArrowDown and ArrowUp keyboard navigation across conversations without stopping at delete action', async () => {
      const user = userEvent.setup();
      const mockConversations = [
        { id: 'conv-1', title: 'First Conversation', created_at: '2026-10-14T10:00:00Z' },
        { id: 'conv-2', title: 'Second Conversation', created_at: '2026-10-14T11:00:00Z' },
        { id: 'conv-3', title: 'Third Conversation', created_at: '2026-10-14T12:00:00Z' },
      ];
      setupSidebarWithConversations(mockConversations);

      const firstBtn = screen.getByText('First Conversation').closest('button');
      const secondBtn = screen.getByText('Second Conversation').closest('button');
      const thirdBtn = screen.getByText('Third Conversation').closest('button');

      firstBtn?.focus();
      expect(firstBtn).toHaveFocus();

      // ArrowDown advances directly to second conversation, skipping delete button
      await user.keyboard('{ArrowDown}');
      expect(secondBtn).toHaveFocus();

      // ArrowDown advances to third conversation
      await user.keyboard('{ArrowDown}');
      expect(thirdBtn).toHaveFocus();

      // ArrowUp returns to second conversation
      await user.keyboard('{ArrowUp}');
      expect(secondBtn).toHaveFocus();
    });

    it('returns focus to conversation item button when Escape is pressed on delete button', async () => {
      const user = userEvent.setup();
      const mockConversations = [
        { id: 'conv-1', title: 'Conversation Item', created_at: '2026-10-14T10:00:00Z' },
      ];
      setupSidebarWithConversations(mockConversations);

      const selectBtn = screen.getByText('Conversation Item').closest('button');
      const deleteBtn = screen.getByRole('button', { name: /delete conversation/i });

      deleteBtn.focus();
      expect(deleteBtn).toHaveFocus();

      await user.keyboard('{Escape}');
      expect(selectBtn).toHaveFocus();
    });

    it('allows sequential keyboard tab navigation through select button and delete button', async () => {
      const user = userEvent.setup();
      const mockConversations = [
        { id: 'conv-1', title: 'Sequential Item', created_at: '2026-10-14T10:00:00Z' },
      ];
      setupSidebarWithConversations(mockConversations);

      const selectBtn = screen.getByText('Sequential Item').closest('button');
      const deleteBtn = screen.getByRole('button', { name: /delete conversation/i });

      selectBtn?.focus();
      expect(selectBtn).toHaveFocus();

      // Tab advances to delete button
      await user.tab();
      expect(deleteBtn).toHaveFocus();
    });
  });

  describe('Ticket 37 (#46): Prevent Sidebar Flash of Expanded State and Hydration Animation on Page Refresh', () => {
    it('renders in collapsed state without transition animation on initial server markup when defaultCollapsed is true', () => {
      vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
      } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

      const Wrapper = createWrapper();
      const serverHtml = renderToString(
        <Wrapper>
          <ConversationSidebar
            activeId={null}
            onSelectConversation={vi.fn()}
            onNewChat={vi.fn()}
            defaultCollapsed={true}
          />
        </Wrapper>
      );

      // Verify server HTML contains collapsed width (w-16) and omits transition-all on aside to prevent closing animation on hydration
      const asideClassMatch = serverHtml.match(/<aside[^>]+class="([^"]+)"/);
      expect(asideClassMatch?.[1]).toBeDefined();
      expect(asideClassMatch?.[1]).toContain('w-16');
      expect(asideClassMatch?.[1]).not.toContain('w-64');
      expect(asideClassMatch?.[1]).not.toContain('transition-all');
    });

    it('renders in collapsed state when defaultCollapsed is true and enables transition after mount', () => {
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
          defaultCollapsed={true}
        />,
        { wrapper: createWrapper() }
      );

      const aside = container.querySelector('aside');
      expect(aside).toHaveClass('w-16');
      expect(aside).not.toHaveClass('w-64');
      // Post-mount on client, transition class is attached for smooth interactive toggling
      expect(aside).toHaveClass('transition-all');
    });

    it('persists sidebar collapse to both localStorage and document.cookie when toggled', async () => {
      const user = userEvent.setup();
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
        />,
        { wrapper: createWrapper() }
      );

      // Collapse the sidebar
      const toggleBtn = screen.getByRole('button', { name: /collapse sidebar/i });
      await user.click(toggleBtn);

      expect(window.localStorage.getItem('hepozy_sidebar_collapsed')).toBe('true');
      expect(document.cookie).toContain('hepozy_sidebar_collapsed=true');

      // Expand the sidebar
      const expandBtn = screen.getByRole('button', { name: /expand sidebar/i });
      await user.click(expandBtn);

      expect(window.localStorage.getItem('hepozy_sidebar_collapsed')).toBe('false');
      expect(document.cookie).toContain('hepozy_sidebar_collapsed=false');
    });

    it('synchronizes document.cookie on mount if localStorage is already set but cookie is absent', () => {
      window.localStorage.setItem('hepozy_sidebar_collapsed', 'true');
      // Clear cookie explicitly
      document.cookie = 'hepozy_sidebar_collapsed=; max-age=0; path=/';

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
        />,
        { wrapper: createWrapper() }
      );

      expect(document.cookie).toContain('hepozy_sidebar_collapsed=true');
    });

    it('completely omits conversation history skeletons and search bar when defaultCollapsed is true while loading', () => {
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
          defaultCollapsed={true}
        />,
        { wrapper: createWrapper() }
      );

      // Verify skeletons and search input are not rendered in collapsed state
      expect(screen.queryByTestId('conversation-skeletons')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/search conversations/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
    });

    it('tags all expanded-only elements in server markup with data-sidebar-expanded-only to enable CSS suppression before hydration', () => {
      vi.spyOn(conversationsHooks, 'useConversations').mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      } as unknown as ReturnType<typeof conversationsHooks.useConversations>);

      const Wrapper = createWrapper();
      const serverHtml = renderToString(
        <Wrapper>
          <ConversationSidebar
            activeId={null}
            onSelectConversation={vi.fn()}
            onNewChat={vi.fn()}
            defaultCollapsed={false}
          />
        </Wrapper>
      );

      // Verify server HTML marks expanded content with data-sidebar-expanded-only
      expect(serverHtml).toContain('data-sidebar-expanded-only="true"');
      expect(serverHtml).toContain('data-testid="conversation-skeletons"');
      expect(serverHtml).toContain('placeholder="Search conversations..."');
    });
  });
});


