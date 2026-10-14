import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const mockGetUser = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

describe('Supabase Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated user from protected route / to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const request = new NextRequest(new URL('http://localhost:3000/'));
    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('allows unauthenticated user to access public routes like /login and /register', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const loginReq = new NextRequest(new URL('http://localhost:3000/login'));
    const loginRes = await updateSession(loginReq);
    expect(loginRes.status).toBe(200);

    const regReq = new NextRequest(new URL('http://localhost:3000/register'));
    const regRes = await updateSession(regReq);
    expect(regRes.status).toBe(200);

    const verifyReq = new NextRequest(new URL('http://localhost:3000/verifypend'));
    const verifyRes = await updateSession(verifyReq);
    expect(verifyRes.status).toBe(200);
  });

  it('redirects authenticated user away from /login and /register to /', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'user@example.com' } },
      error: null,
    });

    const loginReq = new NextRequest(new URL('http://localhost:3000/login'));
    const loginRes = await updateSession(loginReq);
    expect(loginRes.status).toBe(307);
    expect(loginRes.headers.get('location')).toBe('http://localhost:3000/');

    const regReq = new NextRequest(new URL('http://localhost:3000/register'));
    const regRes = await updateSession(regReq);
    expect(regRes.status).toBe(307);
    expect(regRes.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('allows authenticated user to access protected route /', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'user@example.com' } },
      error: null,
    });

    const request = new NextRequest(new URL('http://localhost:3000/'));
    const response = await updateSession(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});
