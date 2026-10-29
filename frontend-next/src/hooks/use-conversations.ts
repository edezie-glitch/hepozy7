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

export const TITLE_POLL_CONFIG = {
  BASE_INTERVAL_MS: 2500,
  MAX_INTERVAL_MS: 8000,
  BACKOFF_FACTOR: 1.3,
  MAX_ATTEMPTS: 10,
} as const;

export interface TitlePollState {
  pendingKey: string;
  attempt: number;
  lastDataUpdatedAt: number;
}

const queryPollMap = new WeakMap<object, TitlePollState>();

export function computeTitlePollingInterval(
  data: Conversation[] | undefined,
  queryKeyHolder?: object,
  dataUpdatedAt: number = 0
): number | false {
  if (!data || data.length === 0) {
    if (queryKeyHolder) {
      queryPollMap.delete(queryKeyHolder);
    }
    return false;
  }

  const pendingList = data.filter((conv) => !conv.title).map((conv) => conv.id).sort();
  if (pendingList.length === 0) {
    if (queryKeyHolder) {
      queryPollMap.delete(queryKeyHolder);
    }
    return false;
  }

  const pendingKey = pendingList.join(',');
  let pollState = queryKeyHolder ? queryPollMap.get(queryKeyHolder) : undefined;

  if (!pollState || pollState.pendingKey !== pendingKey) {
    pollState = {
      pendingKey,
      attempt: 0,
      lastDataUpdatedAt: dataUpdatedAt,
    };
  } else if (dataUpdatedAt > pollState.lastDataUpdatedAt) {
    pollState = {
      pendingKey,
      attempt: pollState.attempt + 1,
      lastDataUpdatedAt: dataUpdatedAt,
    };
  }

  if (queryKeyHolder) {
    queryPollMap.set(queryKeyHolder, pollState);
  }

  if (pollState.attempt >= TITLE_POLL_CONFIG.MAX_ATTEMPTS) {
    return false;
  }

  const interval = Math.min(
    Math.round(
      TITLE_POLL_CONFIG.BASE_INTERVAL_MS *
        Math.pow(TITLE_POLL_CONFIG.BACKOFF_FACTOR, pollState.attempt)
    ),
    TITLE_POLL_CONFIG.MAX_INTERVAL_MS
  );

  return interval;
}

export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: getConversations,
    refetchInterval: (query) => {
      return computeTitlePollingInterval(
        query.state.data,
        query,
        query.state.dataUpdatedAt
      );
    },
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
