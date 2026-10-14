import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendChatMessage,
  stopChat,
  editChatMessage,
  getChatHistory,
  type ChatMessageItem,
  type ChatResponse,
} from '@/lib/api/chat';
import * as apiClient from '@/lib/api-client';

describe('Chat API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sendChatMessage calls POST /api/chat with payload and optional abort signal', async () => {
    const mockResponse: ChatResponse = {
      reply: 'Hello! I am Hepozy Assistant.',
      conversation_id: 'conv-123',
      user_message_id: 'msg-u1',
      assistant_message_id: 'msg-a1',
    };

    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValueOnce(mockResponse);
    const controller = new AbortController();

    const result = await sendChatMessage(
      {
        message: 'Hello Assistant',
        conversation_id: 'conv-123',
        request_id: 'req-abc',
        reply_to: 'Quoted context',
      },
      controller.signal
    );

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Hello Assistant',
        conversation_id: 'conv-123',
        request_id: 'req-abc',
        reply_to: 'Quoted context',
      }),
      signal: controller.signal,
    });
    expect(result).toEqual(mockResponse);
  });

  it('stopChat calls POST /api/chat/stop with request_id, conversation_id and shown_text', async () => {
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValueOnce({
      status: 'stopped',
    });

    const result = await stopChat({
      request_id: 'req-abc',
      conversation_id: 'conv-123',
      shown_text: 'Partial text before abort',
    });

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/chat/stop', {
      method: 'POST',
      body: JSON.stringify({
        request_id: 'req-abc',
        conversation_id: 'conv-123',
        shown_text: 'Partial text before abort',
      }),
    });
    expect(result).toEqual({ status: 'stopped' });
  });

  it('editChatMessage calls POST /api/chat/edit with conversation_id and message_id', async () => {
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValueOnce({
      status: 'ok',
      deleted: 2,
    });

    const result = await editChatMessage({
      conversation_id: 'conv-123',
      message_id: 'msg-u1',
      original_text: 'Old question',
    });

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/chat/edit', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: 'conv-123',
        message_id: 'msg-u1',
        original_text: 'Old question',
      }),
    });
    expect(result).toEqual({ status: 'ok', deleted: 2 });
  });

  it('getChatHistory calls GET /api/chat/history/:id and returns messages list', async () => {
    const mockMessages: ChatMessageItem[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hi',
        created_at: '2026-10-14T10:00:00Z',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hello, how can I help?',
        created_at: '2026-10-14T10:00:05Z',
      },
    ];

    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValueOnce({
      messages: mockMessages,
    });

    const result = await getChatHistory('conv-123');

    expect(apiFetchSpy).toHaveBeenCalledWith('/api/chat/history/conv-123');
    expect(result).toEqual(mockMessages);
  });
});
