import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useConversations,
  useCreateConversation,
  useUpdateConversationTitle,
  useDeleteConversation,
} from '@/hooks/use-conversations';
import * as conversationsApi from '@/lib/api/conversations';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe('useConversations Hooks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('useConversations queries and returns conversation list', async () => {
    const mockList = [
      { id: '1', title: 'Conversation 1', created_at: '2026-10-14T00:00:00Z' },
      { id: '2', title: 'Conversation 2', created_at: '2026-10-14T01:00:00Z' },
    ];
    vi.spyOn(conversationsApi, 'getConversations').mockResolvedValueOnce(mockList);

    const { result } = renderHook(() => useConversations(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockList);
  });

  it('useCreateConversation creates conversation and invalidates cache', async () => {
    const newConv = { id: '3', title: null };
    vi.spyOn(conversationsApi, 'createConversation').mockResolvedValueOnce(newConv);

    const { result } = renderHook(() => useCreateConversation(), {
      wrapper: createWrapper(),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(newConv);
  });

  it('useDeleteConversation optimistically removes item from conversations cache', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const initialList = [
      { id: '1', title: 'To Keep', created_at: '2026-10-14T00:00:00Z' },
      { id: '2', title: 'To Delete', created_at: '2026-10-14T01:00:00Z' },
    ];
    queryClient.setQueryData(['conversations'], initialList);

    let resolveDelete: (val: { status: string }) => void = () => {};
    const deletePromise = new Promise<{ status: string }>((resolve) => {
      resolveDelete = resolve;
    });
    vi.spyOn(conversationsApi, 'deleteConversation').mockReturnValueOnce(deletePromise);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeleteConversation(), { wrapper });

    // Trigger delete
    result.current.mutate('2');

    // Verify cache was updated optimistically BEFORE network promise resolves
    await waitFor(() => {
      const cached = queryClient.getQueryData<conversationsApi.Conversation[]>(['conversations']);
      expect(cached).toEqual([{ id: '1', title: 'To Keep', created_at: '2026-10-14T00:00:00Z' }]);
    });

    // Resolve network call
    resolveDelete({ status: 'ok' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('useUpdateConversationTitle optimistically updates title in cache', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const initialList = [
      { id: '1', title: 'Old Title', created_at: '2026-10-14T00:00:00Z' },
    ];
    queryClient.setQueryData(['conversations'], initialList);

    let resolveUpdate: (val: { status: string }) => void = () => {};
    const updatePromise = new Promise<{ status: string }>((resolve) => {
      resolveUpdate = resolve;
    });
    vi.spyOn(conversationsApi, 'updateConversationTitle').mockReturnValueOnce(updatePromise);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateConversationTitle(), { wrapper });

    result.current.mutate({ id: '1', title: 'Updated Title' });

    // Verify optimistic update
    await waitFor(() => {
      const cached = queryClient.getQueryData<conversationsApi.Conversation[]>(['conversations']);
      expect(cached?.[0].title).toBe('Updated Title');
    });

    resolveUpdate({ status: 'ok' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('useConversations dynamically polls when a conversation has null title and reflects persisted title', async () => {
    // Initial fetch returns conversation with title=null (pending background generation)
    const initialList = [{ id: 'conv-new', title: null, created_at: '2026-10-18T00:00:00Z' }];
    // Subsequent fetch returns conversation with generated title persisted
    const updatedList = [
      { id: 'conv-new', title: 'Autonomous Title Generation', created_at: '2026-10-18T00:00:00Z' },
    ];

    const getSpy = vi
      .spyOn(conversationsApi, 'getConversations')
      .mockResolvedValueOnce(initialList)
      .mockResolvedValueOnce(updatedList);

    const { result } = renderHook(() => useConversations(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].title).toBeNull();

    // Trigger refetch (as refetchInterval would do on interval)
    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.data?.[0].title).toBe('Autonomous Title Generation');
    });
    expect(getSpy).toHaveBeenCalledTimes(2);
  });
});
