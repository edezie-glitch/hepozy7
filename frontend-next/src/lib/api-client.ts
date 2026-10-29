import { createClient } from '@/lib/supabase/client';

export class ApiError extends Error {
  status: number;
  retryAfter?: number;
  data?: unknown;

  constructor(message: string, status: number, retryAfter?: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfter = retryAfter;
    this.data = data;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(options.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(normalizedEndpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message =
      (errorData && (errorData.detail || errorData.message)) ||
      `Request failed with status ${response.status}`;
    const rawRetryAfter = response.headers?.get?.('Retry-After');
    const retryAfter = rawRetryAfter ? parseInt(rawRetryAfter, 10) : undefined;
    const finalMessage = typeof message === 'string' ? message : JSON.stringify(message);

    throw new ApiError(
      finalMessage,
      response.status,
      Number.isFinite(retryAfter) ? retryAfter : undefined,
      errorData
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}
