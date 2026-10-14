import { apiFetch } from '@/lib/api-client';
import type {
  ChatRequest,
  ChatResponse,
  StopRequest,
  EditRequest,
} from '@/types/api';

export type { ChatRequest, ChatResponse, StopRequest, EditRequest };

export interface ChatAttachment {
  name: string;
  type: string;
  url?: string;
  data?: string;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  reply_to?: string | null;
  attachments?: ChatAttachment[];
  download_url?: string | null;
  file_name?: string | null;
}

export type SendChatMessageParams = ChatRequest;
export type StopChatParams = StopRequest;
export type EditChatMessageParams = EditRequest;

export async function sendChatMessage(
  params: SendChatMessageParams,
  signal?: AbortSignal
): Promise<ChatResponse> {
  return await apiFetch<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify(params),
    signal,
  });
}

export async function stopChat(params: StopChatParams): Promise<{ status: string }> {
  return await apiFetch<{ status: string }>('/api/chat/stop', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function editChatMessage(
  params: EditChatMessageParams
): Promise<{ status: string; deleted?: number }> {
  return await apiFetch<{ status: string; deleted?: number }>('/api/chat/edit', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getChatHistory(conversationId: string): Promise<ChatMessageItem[]> {
  const data = await apiFetch<{ messages: ChatMessageItem[] }>(
    `/api/chat/history/${conversationId}`
  );
  return data.messages || [];
}
