import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch } from '@/lib/api-client';

const mockGetSession = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: mockGetSession,
    },
  })),
}));

describe('API Client Helper (apiFetch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('attaches Authorization bearer token when active session exists', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: { access_token: 'mock-jwt-token-123' },
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await apiFetch('/api/conversations');

    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/conversations',
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );

    const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(calledHeaders.get('Authorization')).toBe('Bearer mock-jwt-token-123');
    expect(calledHeaders.get('Content-Type')).toBe('application/json');
  });

  it('does not attach Authorization header when no session exists', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'public' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await apiFetch('/api/public');

    const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(calledHeaders.get('Authorization')).toBeNull();
  });

  it('throws an error with message from response body when request fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Invalid username or password.' }),
      })
    );

    await expect(apiFetch('/api/protected')).rejects.toThrow('Invalid username or password.');
  });
});
