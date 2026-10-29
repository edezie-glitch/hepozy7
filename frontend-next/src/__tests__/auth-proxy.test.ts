import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy, config } from '@/proxy';
import { updateSession } from '@/lib/supabase/proxy';

const mockGetUser = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

describe('Supabase Auth Proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateSession handler', () => {
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

      const resetReq = new NextRequest(new URL('http://localhost:3000/reset-password'));
      const resetRes = await updateSession(resetReq);
      expect(resetRes.status).toBe(200);

      const updateReq = new NextRequest(new URL('http://localhost:3000/reset-password/update'));
      const updateRes = await updateSession(updateReq);
      expect(updateRes.status).toBe(200);

      const callbackReq = new NextRequest(new URL('http://localhost:3000/auth/callback'));
      const callbackRes = await updateSession(callbackReq);
      expect(callbackRes.status).toBe(200);
    });

    it('redirects authenticated user away from /login, /register, and /reset-password to /', async () => {
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

      const resetReq = new NextRequest(new URL('http://localhost:3000/reset-password'));
      const resetRes = await updateSession(resetReq);
      expect(resetRes.status).toBe(307);
      expect(resetRes.headers.get('location')).toBe('http://localhost:3000/');

      const resetTrailingSlashReq = new NextRequest(new URL('http://localhost:3000/reset-password/'));
      const resetTrailingSlashRes = await updateSession(resetTrailingSlashReq);
      expect(resetTrailingSlashRes.status).toBe(307);
      expect(resetTrailingSlashRes.headers.get('location')).toBe('http://localhost:3000/');
    });

    it('allows authenticated user with recovery session to access /reset-password/update', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'user@example.com' } },
        error: null,
      });

      const updateReq = new NextRequest(new URL('http://localhost:3000/reset-password/update'));
      const updateRes = await updateSession(updateReq);
      expect(updateRes.status).toBe(200);
      expect(updateRes.headers.get('location')).toBeNull();
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

  describe('proxy entry point', () => {
    it('delegates request to session handler and returns response', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const request = new NextRequest(new URL('http://localhost:3000/'));
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/login');
    });

    it('exports a valid route matcher configuration', () => {
      expect(config).toBeDefined();
      expect(config.matcher).toBeDefined();
      expect(Array.isArray(config.matcher)).toBe(true);
      expect(config.matcher.length).toBeGreaterThan(0);
    });
  });
});
