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
});
