'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setUser(data.user);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }, [router]);

  const username =
    (user?.user_metadata?.username as string | undefined) ||
    (user?.email ? user.email.split('@')[0] : 'User');

  const email = user?.email || '';

  const initial = (username.charAt(0) || 'U').toUpperCase();

  return {
    user,
    loading,
    username,
    email,
    initial,
    signOut,
  };
}
