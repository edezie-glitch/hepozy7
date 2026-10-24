'use client';

import * as React from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

function getEmailSnapshot(): string {
  if (typeof window === 'undefined') return 'your email';
  return sessionStorage.getItem('pending_verification_email') || 'your email';
}

function getServerSnapshot(): string {
  return 'your email';
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

export default function VerifyPendingPage() {
  const email = React.useSyncExternalStore(subscribe, getEmailSnapshot, getServerSnapshot);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      <header className="absolute top-0 right-0 p-4 z-10">
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[420px] rounded-2xl bg-card border border-border/60 p-8 shadow-xl text-center">
          <div className="w-14 h-14 rounded-full bg-primary/15 text-primary flex items-center justify-center mx-auto mb-6">
            <Mail className="w-7 h-7" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-foreground mb-2">
            Check your email
          </h1>

          <p className="text-sm text-muted-foreground mb-1">We sent a confirmation link to</p>
          <p className="text-sm font-semibold text-foreground break-all">{email}</p>

          <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
            Click the link to verify your account, then come back and log in.
          </p>

          <div className="mt-8 space-y-3 text-xs">
            <div>
              <span className="text-muted-foreground">Wrong email? </span>
              <Link href="/register" className="text-primary font-medium hover:underline">
                Sign up again
              </Link>
            </div>
            <div>
              <Link href="/login" className="text-primary font-medium hover:underline">
                Back to log in
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
