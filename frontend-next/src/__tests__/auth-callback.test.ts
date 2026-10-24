import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/auth/callback/route';

const mockExchangeCodeForSession = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}));

describe('Auth Callback Route Handler (/auth/callback)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exchanges code for session and redirects to next param on success', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = new Request('http://localhost:3000/auth/callback?code=mock-code&next=/reset-password/update');
    const response = await GET(request);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('mock-code');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/reset-password/update');
  });

  it('redirects to / when next param is not provided', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = new Request('http://localhost:3000/auth/callback?code=mock-code');
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('redirects to /login?error=auth-callback-failed when exchangeCodeForSession fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: 'Invalid or expired code' },
    });

    const request = new Request('http://localhost:3000/auth/callback?code=invalid-code&next=/reset-password/update');
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/login?error=auth-callback-failed');
  });

  it('redirects to /login?error=auth-callback-failed when no code is present', async () => {
    const request = new Request('http://localhost:3000/auth/callback?next=/reset-password/update');
    const response = await GET(request);

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/login?error=auth-callback-failed');
  });

  it('sanitizes next param to prevent open redirect vulnerabilities', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const request = new Request('http://localhost:3000/auth/callback?code=mock-code&next=//evil.com/phish');
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/');
  });
});
