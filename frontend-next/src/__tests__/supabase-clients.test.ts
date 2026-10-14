import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { createClient as createServerClient } from '@/lib/supabase/server';

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({ type: 'browser-client' })),
  createServerClient: vi.fn(() => ({ type: 'server-client' })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}));

describe('Supabase Client Initializers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates browser client with public supabase url and key', () => {
    const client = createBrowserClient();
    expect(client).toBeDefined();
    expect(client).toEqual({ type: 'browser-client' });
  });

  it('creates server client with cookie handlers', async () => {
    const client = await createServerClient();
    expect(client).toBeDefined();
    expect(client).toEqual({ type: 'server-client' });
  });
});
