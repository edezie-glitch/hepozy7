import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getConversations,
  createConversation,
  updateConversationTitle,
  deleteConversation,
  generateOptimisticConversationId,
  isOptimisticConversationId,
} from '@/lib/api/conversations';
import * as apiClient from '@/lib/api-client';

describe('Conversations API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getConversations calls GET /api/chat/conversations and extracts conversations list', async () => {
    const mockData = [
      { id: 'conv-1', title: 'First Conversation', created_at: '2026-10-14T10:00:00Z' },
      { id: 'conv-2', title: 'Second Conversation', created_at: '2026-10-14T11:00:00Z' },
    ];
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValueOnce({
      conversations: mockData,
    });

    const result = await getConversations();

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/chat/conversations');
    expect(result).toEqual(mockData);
  });

  it('createConversation calls POST /api/chat/conversations/new', async () => {
    const newConv = { id: 'conv-new', title: null };
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValueOnce({
      conversation: newConv,
    });

    const result = await createConversation();

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/chat/conversations/new', {
      method: 'POST',
    });
    expect(result).toEqual(newConv);
  });

  it('updateConversationTitle calls PATCH /api/chat/conversations/:id/title', async () => {
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValueOnce({
      status: 'ok',
    });

    const result = await updateConversationTitle('conv-1', 'Renamed Title');

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/chat/conversations/conv-1/title', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Renamed Title' }),
    });
    expect(result).toEqual({ status: 'ok' });
  });

  it('deleteConversation calls DELETE /api/chat/conversations/:id', async () => {
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValueOnce({
      status: 'ok',
    });

    const result = await deleteConversation('conv-1');

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/chat/conversations/conv-1', {
      method: 'DELETE',
    });
    expect(result).toEqual({ status: 'ok' });
  });

  it('generates optimistic conversation ID prefixed with opt_', () => {
    const id = generateOptimisticConversationId();
    expect(id).toMatch(/^opt_/);
    expect(isOptimisticConversationId(id)).toBe(true);
  });

  it('correctly identifies optimistic conversation IDs', () => {
    expect(isOptimisticConversationId('opt_123')).toBe(true);
    expect(isOptimisticConversationId('opt_any_random_uuid')).toBe(true);
    expect(isOptimisticConversationId('local_456')).toBe(false);
    expect(isOptimisticConversationId('new')).toBe(false);
    expect(isOptimisticConversationId('conv-real-uuid')).toBe(false);
    expect(isOptimisticConversationId(null)).toBe(false);
    expect(isOptimisticConversationId(undefined)).toBe(false);
  });
});
