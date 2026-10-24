import { apiFetch } from '@/lib/api-client';

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
}

export interface CreatedConversation {
  id: string;
  title: string | null;
}

export async function getConversations(): Promise<Conversation[]> {
  const data = await apiFetch<{ conversations: Conversation[] }>('/api/chat/conversations');
  return data.conversations || [];
}

export async function createConversation(): Promise<CreatedConversation> {
  const data = await apiFetch<{ conversation: CreatedConversation }>(
    '/api/chat/conversations/new',
    {
      method: 'POST',
    }
  );
  return data.conversation;
}

export async function updateConversationTitle(
  id: string,
  title: string
): Promise<{ status: string }> {
  return await apiFetch<{ status: string }>(`/api/chat/conversations/${id}/title`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

export async function deleteConversation(id: string): Promise<{ status: string }> {
  return await apiFetch<{ status: string }>(`/api/chat/conversations/${id}`, {
    method: 'DELETE',
  });
}

export const OPTIMISTIC_CONVERSATION_PREFIX = 'opt_';

export function isOptimisticConversationId(id: string | null | undefined): boolean {
  if (!id) return false;
  return id.startsWith(OPTIMISTIC_CONVERSATION_PREFIX);
}

export function generateOptimisticConversationId(): string {
  const uuid =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return `${OPTIMISTIC_CONVERSATION_PREFIX}${uuid}`;
}
