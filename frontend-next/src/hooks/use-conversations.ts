import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Conversation,
  CreatedConversation,
  getConversations,
  createConversation,
  updateConversationTitle,
  deleteConversation,
} from '@/lib/api/conversations';

export const CONVERSATIONS_QUERY_KEY = ['conversations'] as const;

export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: getConversations,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation<CreatedConversation, Error, void>({
    mutationFn: createConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    },
  });
}

export function useUpdateConversationTitle() {
  const queryClient = useQueryClient();

  return useMutation<
    { status: string },
    Error,
    { id: string; title: string },
    { previous?: Conversation[] }
  >({
    mutationFn: ({ id, title }) => updateConversationTitle(id, title),
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY);

      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old) => {
        if (!old) return old;
        return old.map((conv) => (conv.id === id ? { ...conv, title } : conv));
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation<
    { status: string },
    Error,
    string,
    { previous?: Conversation[] }
  >({
    mutationFn: (id: string) => deleteConversation(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY);

      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_QUERY_KEY, (old) => {
        if (!old) return old;
        return old.filter((conv) => conv.id !== id);
      });

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CONVERSATIONS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    },
  });
}
