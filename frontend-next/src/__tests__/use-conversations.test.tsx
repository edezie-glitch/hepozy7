import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useConversations,
  useCreateConversation,
  useUpdateConversationTitle,
  useDeleteConversation,
  computeTitlePollingInterval,
  TITLE_POLL_CONFIG,
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

    result.current.mutate('2');

    await waitFor(() => {
      const cached = queryClient.getQueryData<conversationsApi.Conversation[]>(['conversations']);
      expect(cached).toEqual([{ id: '1', title: 'To Keep', created_at: '2026-10-14T00:00:00Z' }]);
    });

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

    await waitFor(() => {
      const cached = queryClient.getQueryData<conversationsApi.Conversation[]>(['conversations']);
      expect(cached?.[0].title).toBe('Updated Title');
    });

    resolveUpdate({ status: 'ok' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('useConversations dynamically polls when a conversation has null title and reflects persisted title', async () => {
    const initialList = [{ id: 'conv-new', title: null, created_at: '2026-10-18T00:00:00Z' }];
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

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.data?.[0].title).toBe('Autonomous Title Generation');
    });
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  describe('Adaptive Title Polling Backoff', () => {
    it('returns false when data has no pending titles or is empty', () => {
      const meta = {};
      expect(computeTitlePollingInterval([], meta)).toBe(false);
      expect(computeTitlePollingInterval(undefined, meta)).toBe(false);
      expect(
        computeTitlePollingInterval(
          [{ id: '1', title: 'Existing Title', created_at: '2026-10-14T00:00:00Z' }],
          meta
        )
      ).toBe(false);
    });

    it('returns relaxed base interval on first pending check and backs off on consecutive data updates', () => {
      const meta: Record<string, unknown> = {};
      const pendingData = [{ id: 'c1', title: null, created_at: '2026-10-14T00:00:00Z' }];

      const first = computeTitlePollingInterval(pendingData, meta, 100);
      expect(first).toBe(TITLE_POLL_CONFIG.BASE_INTERVAL_MS);
      expect(first).toBeGreaterThanOrEqual(2000);

      // Re-render without new data update should not advance the attempt
      const same = computeTitlePollingInterval(pendingData, meta, 100);
      expect(same).toBe(first);

      // Next data update advances attempt
      const second = computeTitlePollingInterval(pendingData, meta, 200);
      expect(second).toBeGreaterThan(first as number);

      const third = computeTitlePollingInterval(pendingData, meta, 300);
      expect(third).toBeGreaterThan(second as number);
    });

    it('caps interval at MAX_INTERVAL_MS and stops polling after MAX_ATTEMPTS', () => {
      const meta: Record<string, unknown> = {};
      const pendingData = [{ id: 'c1', title: null, created_at: '2026-10-14T00:00:00Z' }];

      for (let i = 0; i < TITLE_POLL_CONFIG.MAX_ATTEMPTS; i++) {
        const interval = computeTitlePollingInterval(pendingData, meta, (i + 1) * 100);
        expect(interval).not.toBe(false);
        expect(interval as number).toBeLessThanOrEqual(TITLE_POLL_CONFIG.MAX_INTERVAL_MS);
      }

      // Past MAX_ATTEMPTS, it stops polling to protect rate limits
      const stopInterval = computeTitlePollingInterval(
        pendingData,
        meta,
        (TITLE_POLL_CONFIG.MAX_ATTEMPTS + 1) * 100
      );
      expect(stopInterval).toBe(false);
    });

    it('resets backoff attempt counter when title is resolved or new pending item appears', () => {
      const meta: Record<string, unknown> = {};
      const pendingDataA = [{ id: 'c1', title: null, created_at: '2026-10-14T00:00:00Z' }];
      computeTitlePollingInterval(pendingDataA, meta, 100);
      computeTitlePollingInterval(pendingDataA, meta, 200);

      // Title resolved
      const resolvedData = [{ id: 'c1', title: 'Generated', created_at: '2026-10-14T00:00:00Z' }];
      expect(computeTitlePollingInterval(resolvedData, meta, 300)).toBe(false);

      // New pending conversation resets attempt to 0
      const pendingDataB = [{ id: 'c2', title: null, created_at: '2026-10-14T00:00:00Z' }];
      const fresh = computeTitlePollingInterval(pendingDataB, meta, 400);
      expect(fresh).toBe(TITLE_POLL_CONFIG.BASE_INTERVAL_MS);
    });
  });
});
