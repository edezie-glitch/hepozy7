import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUser } from '@/hooks/use-user';
import * as clientModule from '@/lib/supabase/client';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

describe('useUser Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches authenticated user and extracts username and email', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: { username: 'testuser' },
    };

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    };

    vi.spyOn(clientModule, 'createClient').mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof clientModule.createClient>
    );

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.username).toBe('testuser');
      expect(result.current.email).toBe('test@example.com');
      expect(result.current.initial).toBe('T');
    });
  });

  it('falls back to email prefix initial if username not present', async () => {
    const mockUser = {
      id: 'user-456',
      email: 'alex@company.com',
      user_metadata: {},
    };

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    };

    vi.spyOn(clientModule, 'createClient').mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof clientModule.createClient>
    );

    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.username).toBe('alex');
      expect(result.current.initial).toBe('A');
    });
  });
});
